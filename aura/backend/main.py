import json
import os
import re
import secrets
import asyncio
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any
from urllib.error import HTTPError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

from fastapi import FastAPI, Depends, BackgroundTasks, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, Response
from fastapi.staticfiles import StaticFiles
from sqlalchemy.orm import Session
from pydantic import BaseModel
from dotenv import load_dotenv
import edge_tts

load_dotenv(override=True)

from .database import (
    get_db,
    Base,
    engine,
    ChatMessage,
    Memory,
    Task,
    InboxMessage,
    UserProfile,
    IntegrationConnection,
)
from .ai_engine import generate_chat_stream, analyze_intent_and_memory
from .automation import execute_desktop_command

app = FastAPI(title="Akansha AI Engine")

# @app.on_event("startup")
# def reset_database():
#     import traceback
#     try:
#         Base.metadata.drop_all(bind=engine)
#         Base.metadata.create_all(bind=engine)
#         print("Successfully reset the database schema!")
#     except Exception as e:
#         print("Failed to reset database schema:", e)
#         traceback.print_exc()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class ChatRequest(BaseModel):
    message: str
    session_id: str = "default"
    user_tone: str | None = None
    response_style: str | None = None
    conversation_mode: str | None = None
    language_preference: str | None = None


class ProfileUpdateRequest(BaseModel):
    full_name: str | None = None
    email: str | None = None
    preferred_mode: str | None = None
    voice_gender: str | None = None
    voice_tone: str | None = None
    voice_language: str | None = None
    avatar_style: str | None = None
    background_listening: bool | None = None
    interrupt_enabled: bool | None = None


class ReminderRequest(BaseModel):
    title: str
    date_time: str


class SocialReplyRequest(BaseModel):
    message_id: int | None = None
    platform: str
    sender: str
    reply: str
    approved: bool = False


class SocialSetupRequest(BaseModel):
    config: dict[str, str]


class TTSRequest(BaseModel):
    text: str
    voice_gender: str = "female"
    voice_tone: str | None = None
    language_mode: str | None = None


class BrowserAutomationPermissionsRequest(BaseModel):
    open_links: bool | None = None
    open_close_tabs: bool | None = None
    type_into_page: bool | None = None
    edit_fields: bool | None = None
    delete_draft_content: bool | None = None
    background_open: bool | None = None


class BrowserAutomationRunRequest(BaseModel):
    action: str
    target: str | None = None
    run_at: str | None = None
    background: bool = False


class BrowserAutomationPromptRequest(BaseModel):
    prompt: str
    run_at: str | None = None
    background: bool = True


GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID")
GOOGLE_CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET")
GOOGLE_REDIRECT_URI = os.getenv("GOOGLE_REDIRECT_URI", "http://localhost:8000/api/google/callback")
ELEVENLABS_API_KEY = os.getenv("ELEVENLABS_API_KEY")
ELEVENLABS_VOICE_ID = os.getenv("ELEVENLABS_VOICE_ID")
ELEVENLABS_MODEL_ID = os.getenv("ELEVENLABS_MODEL_ID", "eleven_multilingual_v2")
GOOGLE_SCOPES = [
    "openid",
    "email",
    "profile",
    "https://www.googleapis.com/auth/gmail.readonly",
    "https://www.googleapis.com/auth/gmail.modify",
    "https://www.googleapis.com/auth/calendar",
]


def get_or_create_profile(db: Session) -> UserProfile:
    profile = db.query(UserProfile).first()
    if profile:
        return profile

    profile = UserProfile()
    db.add(profile)
    db.commit()
    db.refresh(profile)
    return profile


def get_or_create_connection(db: Session, provider: str) -> IntegrationConnection:
    connection = db.query(IntegrationConnection).filter(IntegrationConnection.provider == provider).first()
    if connection:
        return connection

    connection = IntegrationConnection(provider=provider)
    db.add(connection)
    db.commit()
    db.refresh(connection)
    return connection


def serialize_profile(profile: UserProfile) -> dict[str, Any]:
    return {
        "full_name": profile.full_name,
        "email": profile.email,
        "preferred_mode": profile.preferred_mode,
        "voice_gender": profile.voice_gender,
        "voice_tone": profile.voice_tone,
        "voice_language": profile.voice_language or "telugu_english",
        "avatar_style": profile.avatar_style,
        "background_listening": profile.background_listening,
        "interrupt_enabled": profile.interrupt_enabled,
        "google_connected": profile.google_connected,
        "google_email": profile.google_email,
    }


def google_configured() -> bool:
    return bool(GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET and GOOGLE_REDIRECT_URI)


def cloned_voice_configured() -> bool:
    return bool(ELEVENLABS_API_KEY and ELEVENLABS_VOICE_ID)


def detect_text_language_mode(text: str) -> str:
    telugu_chars = len(re.findall(r"[\u0C00-\u0C7F]", text))
    hindi_chars = len(re.findall(r"[\u0900-\u097F]", text))
    latin_chars = len(re.findall(r"[A-Za-z]", text))
    if hindi_chars and latin_chars:
        return "hindi"
    if hindi_chars:
        return "hindi"
    if telugu_chars and latin_chars:
        return "mixed"
    if telugu_chars:
        return "telugu"
    return "english"


def build_voice_settings(voice_tone: str | None) -> dict[str, float]:
    tone = (voice_tone or "friendly").lower()
    if tone == "energetic":
        return {"stability": 0.38, "similarity_boost": 0.82, "style": 0.7, "use_speaker_boost": True}
    if tone == "calm":
        return {"stability": 0.72, "similarity_boost": 0.8, "style": 0.2, "use_speaker_boost": True}
    if tone == "professional":
        return {"stability": 0.64, "similarity_boost": 0.84, "style": 0.28, "use_speaker_boost": True}
    return {"stability": 0.52, "similarity_boost": 0.83, "style": 0.45, "use_speaker_boost": True}


def get_edge_voice_name(voice_gender: str, language_mode: str) -> str:
    normalized_gender = (voice_gender or "female").lower()
    normalized_mode = (language_mode or "english").lower()

    telugu_voice = "te-IN-ShrutiNeural" if normalized_gender == "female" else "te-IN-MohanNeural"
    english_voice = "en-IN-NeerjaNeural" if normalized_gender == "female" else "en-IN-PrabhatNeural"
    hindi_voice = "hi-IN-SwaraNeural" if normalized_gender == "female" else "hi-IN-MadhurNeural"

    if normalized_mode == "hindi":
        return hindi_voice
    if normalized_mode in {"telugu", "mixed"}:
        return telugu_voice
    return english_voice


def get_edge_tts_prosody(voice_tone: str | None) -> tuple[str, str]:
    tone = (voice_tone or "friendly").lower()
    if tone == "energetic":
        return "+8%", "+4Hz"
    if tone == "calm":
        return "-10%", "-2Hz"
    if tone == "professional":
        return "-2%", "-1Hz"
    return "+0%", "+0Hz"


async def generate_edge_tts_audio(text: str, voice_gender: str, voice_tone: str | None, language_mode: str | None) -> bytes:
    resolved_mode = language_mode or detect_text_language_mode(text)
    voice_name = get_edge_voice_name(voice_gender, resolved_mode)
    rate, pitch = get_edge_tts_prosody(voice_tone)

    communicate = edge_tts.Communicate(
        text=text,
        voice=voice_name,
        rate=rate,
        pitch=pitch,
    )

    audio_chunks: list[bytes] = []
    async for chunk in communicate.stream():
        if chunk["type"] == "audio":
            audio_chunks.append(chunk["data"])

    if not audio_chunks:
        raise HTTPException(status_code=502, detail="Edge TTS did not return audio.")

    return b"".join(audio_chunks)


def generate_cloned_voice_audio(text: str, voice_tone: str | None) -> bytes:
    if not cloned_voice_configured():
        raise HTTPException(
            status_code=400,
            detail=(
                "Cloned female voice is not configured. Add ELEVENLABS_API_KEY and ELEVENLABS_VOICE_ID "
                "for the Irina voice clone."
            ),
        )

    payload = json.dumps(
        {
            "text": text,
            "model_id": ELEVENLABS_MODEL_ID,
            "voice_settings": build_voice_settings(voice_tone),
        }
    ).encode("utf-8")

    request = Request(
        f"https://api.elevenlabs.io/v1/text-to-speech/{ELEVENLABS_VOICE_ID}?output_format=mp3_44100_128",
        data=payload,
        headers={
            "xi-api-key": ELEVENLABS_API_KEY or "",
            "Content-Type": "application/json",
            "Accept": "audio/mpeg",
        },
        method="POST",
    )

    try:
        with urlopen(request, timeout=45) as response:
            return response.read()
    except HTTPError as exc:
        detail = "Cloned voice request failed."
        try:
            provider_error = exc.read().decode("utf-8", errors="ignore")
            if provider_error:
                detail = provider_error
        except Exception:
            pass

        raise HTTPException(
            status_code=exc.code if exc.code else 502,
            detail=f"ElevenLabs voice synthesis failed: {detail}",
        )


def google_auth_headers(connection: IntegrationConnection) -> dict[str, str]:
    if not connection.access_token:
        raise HTTPException(status_code=400, detail="Google account is not connected yet.")
    return {"Authorization": f"Bearer {connection.access_token}"}


def google_api_get(url: str, connection: IntegrationConnection) -> Any:
    request = Request(url, headers=google_auth_headers(connection))
    with urlopen(request, timeout=20) as response:
        return json.loads(response.read().decode("utf-8"))


def update_google_connection(
    db: Session,
    connection: IntegrationConnection,
    profile: UserProfile,
    token_payload: dict[str, Any],
    user_info: dict[str, Any] | None = None,
):
    expires_in = token_payload.get("expires_in", 0)
    expiry = datetime.now(timezone.utc) + timedelta(seconds=expires_in) if expires_in else None

    connection.access_token = token_payload.get("access_token")
    connection.refresh_token = token_payload.get("refresh_token") or connection.refresh_token
    connection.scope = token_payload.get("scope")
    connection.token_expiry = expiry
    connection.is_connected = True
    connection.account_email = (user_info or {}).get("email") or connection.account_email
    connection.metadata_json = json.dumps(
        {
            "token_type": token_payload.get("token_type", "Bearer"),
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }
    )

    profile.google_connected = True
    profile.google_email = connection.account_email

    db.add(connection)
    db.add(profile)
    db.commit()


SOCIAL_PLATFORM_META: dict[str, dict[str, str]] = {
    "whatsapp": {"label": "WhatsApp", "accent": "#25D366"},
    "instagram": {"label": "Instagram", "accent": "#F43F5E"},
    "twitter": {"label": "X / Twitter", "accent": "#60A5FA"},
    "telegram": {"label": "Telegram", "accent": "#38BDF8"},
    "discord": {"label": "Discord", "accent": "#818CF8"},
}

SOCIAL_REQUIRED_FIELDS: dict[str, list[str]] = {
    "whatsapp": ["phone_number_id", "access_token", "webhook_verify_token"],
    "instagram": ["app_id", "app_secret", "access_token"],
    "twitter": ["api_key", "api_secret", "bearer_token"],
    "telegram": ["bot_token", "chat_id"],
    "discord": ["bot_token", "guild_id", "channel_id"],
}

BROWSER_AUTOMATION_PROVIDER = "browser-automation"
BROWSER_AUTOMATION_DEFAULTS: dict[str, bool] = {
    "open_links": True,
    "open_close_tabs": True,
    "type_into_page": True,
    "edit_fields": True,
    "delete_draft_content": True,
    "background_open": True,
}
BROWSER_AUTOMATION_ACTIONS: list[dict[str, str]] = [
    {
        "key": "open_url",
        "label": "Open link",
        "permission": "open_links",
        "description": "Open any URL in the default browser.",
    },
    {
        "key": "open_youtube_song",
        "label": "Open YouTube search",
        "permission": "open_links",
        "description": "Open a YouTube search for a song or playlist in the default browser.",
    },
    {
        "key": "new_tab",
        "label": "Open tab",
        "permission": "open_close_tabs",
        "description": "Create a new tab in the active browser window.",
    },
    {
        "key": "close_tab",
        "label": "Close tab",
        "permission": "open_close_tabs",
        "description": "Close the current active browser tab.",
    },
    {
        "key": "type_text",
        "label": "Type into page",
        "permission": "type_into_page",
        "description": "Type text into the currently focused browser field.",
    },
    {
        "key": "edit_field",
        "label": "Edit field",
        "permission": "edit_fields",
        "description": "Replace the content of the focused field.",
    },
    {
        "key": "remove_draft",
        "label": "Clear draft",
        "permission": "delete_draft_content",
        "description": "Select and delete the current draft or focused field content.",
    },
    {
        "key": "open_app",
        "label": "Open desktop app",
        "permission": "open_links",
        "description": "Open a desktop app such as Notepad, Calculator, Explorer, VS Code, or Chrome.",
    },
    {
        "key": "close_window",
        "label": "Close desktop window",
        "permission": "open_close_tabs",
        "description": "Close the currently active desktop app window.",
    },
    {
        "key": "switch_window",
        "label": "Switch desktop window",
        "permission": "open_close_tabs",
        "description": "Move to the next open desktop app window.",
    },
]

DESKTOP_APP_ALIASES: dict[str, list[str]] = {
    "notepad": ["notepad"],
    "calculator": ["calculator", "calc"],
    "file explorer": ["file explorer", "explorer"],
    "vscode": ["vscode", "vs code", "visual studio code", "code editor"],
    "chrome": ["chrome", "google chrome"],
    "brave": ["brave", "brave browser"],
    "edge": ["edge", "microsoft edge"],
    "command prompt": ["command prompt", "cmd"],
    "powershell": ["powershell"],
}

SPECIAL_FOLDERS: dict[str, str] = {
    "downloads": str((Path.home() / "Downloads")),
    "desktop": str((Path.home() / "Desktop")),
    "documents": str((Path.home() / "Documents")),
    "pictures": str((Path.home() / "Pictures")),
    "videos": str((Path.home() / "Videos")),
    "music": str((Path.home() / "Music")),
}

KNOWN_LOGIN_URLS: dict[str, dict[str, Any]] = {
    "codechef.com": {
        "url": "https://www.codechef.com/login?page=1",
        "prefill_delay": 3.0,
        "tab_presses_before": 1,
        "type_interval": 0.07,
        "step_delay": 0.18,
    },
    "linkedin.com": {
        "url": "https://www.linkedin.com/login",
        "prefill_delay": 2.4,
        "tab_presses_before": 0,
        "type_interval": 0.06,
        "step_delay": 0.14,
    },
    "instagram.com": {
        "url": "https://www.instagram.com/accounts/login/",
        "prefill_delay": 2.8,
        "tab_presses_before": 0,
        "type_interval": 0.06,
        "step_delay": 0.14,
    },
    "twitter.com": {
        "url": "https://x.com/i/flow/login",
        "prefill_delay": 2.8,
        "tab_presses_before": 0,
        "type_interval": 0.06,
        "step_delay": 0.14,
    },
    "x.com": {
        "url": "https://x.com/i/flow/login",
        "prefill_delay": 2.8,
        "tab_presses_before": 0,
        "type_interval": 0.06,
        "step_delay": 0.14,
    },
    "github.com": {
        "url": "https://github.com/login",
        "prefill_delay": 2.2,
        "tab_presses_before": 0,
        "type_interval": 0.05,
        "step_delay": 0.12,
    },
    "leetcode.com": {
        "url": "https://leetcode.com/accounts/login/",
        "prefill_delay": 2.6,
        "tab_presses_before": 0,
        "type_interval": 0.05,
        "step_delay": 0.12,
    },
    "codeforces.com": {
        "url": "https://codeforces.com/enter",
        "prefill_delay": 2.6,
        "tab_presses_before": 0,
        "type_interval": 0.05,
        "step_delay": 0.12,
    },
}


def extract_first_url_or_domain(prompt: str) -> str | None:
    url_match = re.search(r"(https?://[^\s]+)", prompt, flags=re.IGNORECASE)
    if url_match:
        return url_match.group(1).rstrip(".,)")

    domain_match = re.search(
        r"\b([a-z0-9-]+(?:\.[a-z0-9-]+)*\.(?:com|in|org|net|io|ai|co|app|dev))\b",
        prompt,
        flags=re.IGNORECASE,
    )
    if domain_match:
        return domain_match.group(1)
    return None


def extract_search_phrase(prompt: str) -> str | None:
    quoted = re.search(r'"([^"]+)"|\'([^\']+)\'', prompt)
    if quoted:
        return next(group for group in quoted.groups() if group)

    for marker in ["search for", "look for", "find", "play", "search"]:
        match = re.search(rf"{marker}\s+(.+)", prompt, flags=re.IGNORECASE)
        if match:
            phrase = re.split(r"\b(?:on|in|using|at)\b", match.group(1), maxsplit=1, flags=re.IGNORECASE)[0]
            return phrase.strip(" .")
    return None


def extract_field_value(prompt: str, field_names: list[str]) -> str | None:
    for field in field_names:
        pattern = rf"\b{re.escape(field)}\b\s*(?:is|=|:)?\s*([^\n,;]+)"
        match = re.search(pattern, prompt, flags=re.IGNORECASE)
        if match:
            return match.group(1).strip().strip("\"'")
    return None


def extract_login_credentials(prompt: str) -> tuple[str | None, str | None]:
    username_match = re.search(
        r"\b(?:username|user\s*id|login\s*id|email)\b\s*[-:=]?\s*(.+?)(?=\s+\b(?:password|passcode)\b|$)",
        prompt,
        flags=re.IGNORECASE | re.DOTALL,
    )
    password_match = re.search(
        r"\b(?:password|passcode)\b\s*[-:=]?\s*(.+?)(?=$)",
        prompt,
        flags=re.IGNORECASE | re.DOTALL,
    )

    username = username_match.group(1).strip().strip("\"'") if username_match else None
    password = password_match.group(1).strip().strip("\"'") if password_match else None
    return username, password


def normalize_domain(url_or_domain: str | None) -> str | None:
    if not url_or_domain:
        return None
    normalized = url_or_domain.lower().strip()
    normalized = re.sub(r"^https?://", "", normalized)
    normalized = normalized.split("/")[0]
    return normalized


def detect_known_site(prompt: str) -> str | None:
    lowered = prompt.lower()
    if "codechef" in lowered:
        return "codechef.com"
    if "linkedin" in lowered:
        return "linkedin.com"
    if "instagram" in lowered:
        return "instagram.com"
    if "youtube" in lowered:
        return "youtube.com"
    if "codeforces" in lowered:
        return "codeforces.com"
    if "leetcode" in lowered:
        return "leetcode.com"
    if "github" in lowered:
        return "github.com"
    return None


def detect_desktop_app(prompt: str) -> str | None:
    lowered = prompt.lower()
    for app_name, aliases in DESKTOP_APP_ALIASES.items():
        if any(re.search(rf"\b{re.escape(alias)}\b", lowered) for alias in aliases):
            return app_name
    return None


def extract_windows_path(prompt: str) -> str | None:
    match = re.search(r"([A-Za-z]:\\[^\n\r\"']+)", prompt)
    if match:
        return match.group(1).strip()
    return None


def detect_special_folder(prompt: str) -> str | None:
    lowered = prompt.lower()
    for key in SPECIAL_FOLDERS.keys():
        if re.search(rf"\b{re.escape(key)}\b", lowered):
            return key
    return None


def extract_create_folder_name(prompt: str) -> str | None:
    match = re.search(
        r"(?:create|make)\s+(?:another\s+|a\s+new\s+)?folder(?:\s+named|\s+called|\s+with\s+name)?\s+([^\n,.;]+)",
        prompt,
        flags=re.IGNORECASE,
    )
    if match:
        name = match.group(1).strip().strip('"')
        if name.lower() not in {"in", "same", "the same"}:
            return name
    return None


def extract_run_command(prompt: str) -> tuple[str | None, str]:
    powershell_match = re.search(r"(?:run|execute)\s+(?:powershell|pwsh)\s+command\s+(.+)", prompt, flags=re.IGNORECASE)
    if powershell_match:
        return powershell_match.group(1).strip(), "powershell"

    cmd_match = re.search(r"(?:run|execute)\s+cmd\s+command\s+(.+)", prompt, flags=re.IGNORECASE)
    if cmd_match:
        return cmd_match.group(1).strip(), "cmd"

    generic_match = re.search(r"(?:run|execute)\s+command\s+(.+)", prompt, flags=re.IGNORECASE)
    if generic_match:
        return generic_match.group(1).strip(), "powershell"

    return None, "powershell"


def is_complex_site_workflow(prompt: str) -> bool:
    lowered = prompt.lower()
    workflow_tokens = [
        "complete all",
        "solve all",
        "submit all",
        "verify if",
        "go to another question",
        "complete the path",
        "difficulty",
        "section",
        "pop up a message",
        "do the corrections",
    ]
    return any(token in lowered for token in workflow_tokens)


def build_browser_prompt_plan(prompt: str) -> dict[str, Any]:
    normalized = " ".join(prompt.split())
    lowered = normalized.lower()
    url_or_domain = extract_first_url_or_domain(normalized)
    normalized_domain = normalize_domain(url_or_domain) or detect_known_site(normalized)
    windows_path = extract_windows_path(normalized)
    special_folder = detect_special_folder(normalized)
    search_phrase = extract_search_phrase(normalized)
    username_value, password_value = extract_login_credentials(normalized)
    email_value = username_value or extract_field_value(normalized, ["email", "username", "user id", "login id"])
    message_value = extract_field_value(normalized, ["message", "text", "reply"])
    desktop_app = detect_desktop_app(normalized)
    created_folder_name = extract_create_folder_name(normalized) or "Converted_PPTs"
    shell_command, shell_name = extract_run_command(normalized)
    typed_match = re.search(r"\b(?:type|write|send)\b\s+(.+)", normalized, flags=re.IGNORECASE)
    typed_instruction = None
    if typed_match:
        typed_instruction = re.split(
            r"\b(?:in the active field|into the active field|in the field|into the field)\b",
            typed_match.group(1),
            maxsplit=1,
            flags=re.IGNORECASE,
        )[0].strip(" .")

    steps: list[dict[str, Any]] = []
    summary = "Prepared a browser automation plan."

    if any(token in lowered for token in ["close tab", "remove tab"]):
        steps.append({"action": "close_tab"})
        summary = "Closing the current browser tab."
        return {"summary": summary, "steps": steps}

    if any(token in lowered for token in ["new tab", "open tab"]):
        steps.append({"action": "new_tab"})
        summary = "Opening a new browser tab."
        return {"summary": summary, "steps": steps}

    if any(token in lowered for token in ["clear draft", "delete draft", "remove draft", "clear field"]):
        steps.append({"action": "remove_draft"})
        summary = "Clearing the active draft or field."
        return {"summary": summary, "steps": steps}

    if normalized_domain == "codechef.com" and any(token in lowered for token in ["practice", "problem section", "practice problem"]):
        java_path = "https://www.codechef.com/practice/java" if "java" in lowered else "https://www.codechef.com/practice"
        steps.append({"action": "open_url", "target": java_path})

        if is_complex_site_workflow(normalized):
            steps.append(
                {
                    "action": "unsupported_browser_workflow",
                    "payload": {
                        "message": (
                            "I opened the CodeChef practice path, but this kind of multi-step site workflow "
                            "needs a DOM-aware web agent. The current automation will not auto-solve or submit "
                            "CodeChef practice problems."
                        ),
                        "note": (
                            "This prevents the old behavior where the full prompt was typed into random text boxes."
                        ),
                    },
                }
            )
            summary = "Opening the CodeChef practice path without dumping your prompt into the page."
            return {"summary": summary, "steps": steps}

        summary = "Opening the CodeChef practice path."
        return {"summary": summary, "steps": steps}

    if shell_command:
        steps.append({"action": "run_command", "target": shell_command, "payload": {"shell": shell_name}})
        summary = f"Running the requested {shell_name} command."
        return {"summary": summary, "steps": steps}

    if any(token in lowered for token in ["convert all pdfs to ppts", "convert pdfs to ppts", "convert pdf to ppt", "convert pdfs to pptx"]):
        source_path = windows_path or SPECIAL_FOLDERS.get(special_folder or "", SPECIAL_FOLDERS["downloads"])
        steps.append(
            {
                "action": "convert_pdfs_to_ppts",
                "payload": {
                    "source_path": source_path,
                    "output_folder_name": created_folder_name,
                },
            }
        )
        summary = f"Converting all PDFs in {source_path} into PPTX files and placing them in {created_folder_name}."
        return {"summary": summary, "steps": steps}

    if any(token in lowered for token in ["open folder", "open path", "go to files", "go to folder", "open downloads", "open desktop", "open documents"]):
        source_path = windows_path or SPECIAL_FOLDERS.get(special_folder or "", "")
        if source_path:
            steps.append({"action": "open_path", "payload": {"path": source_path}})
            summary = f"Opening {source_path} in File Explorer."
            return {"summary": summary, "steps": steps}

    if any(token in lowered for token in ["close window", "close app", "exit app"]):
        steps.append({"action": "close_window"})
        summary = "Closing the current desktop app window."
        return {"summary": summary, "steps": steps}

    if any(token in lowered for token in ["switch window", "switch app", "change window"]):
        steps.append({"action": "switch_window"})
        summary = "Switching to the next open desktop window."
        return {"summary": summary, "steps": steps}

    if any(token in lowered for token in ["minimize window", "minimize app"]):
        steps.append({"action": "minimize_window"})
        summary = "Minimizing the current desktop window."
        return {"summary": summary, "steps": steps}

    if any(token in lowered for token in ["maximize window", "maximize app"]):
        steps.append({"action": "maximize_window"})
        summary = "Maximizing the current desktop window."
        return {"summary": summary, "steps": steps}

    if desktop_app and any(token in lowered for token in ["open", "launch", "start"]):
        steps.append({"action": "open_app", "target": desktop_app})
        summary = f"Opening {desktop_app} on the desktop."
        if typed_instruction:
            steps.append({"action": "wait", "payload": {"seconds": 1.4}})
            steps.append({"action": "type_text", "target": typed_instruction})
            summary = f"Opening {desktop_app} and typing the requested text."
        elif message_value:
            steps.append({"action": "wait", "payload": {"seconds": 1.4}})
            steps.append({"action": "type_text", "target": message_value})
            summary = f"Opening {desktop_app} and typing the provided message."
        elif desktop_app == "calculator":
            operation_match = re.search(r"(?:do|calculate|compute)\s+([0-9+\-*/().\s]+)", normalized, flags=re.IGNORECASE)
            if operation_match:
                expression = operation_match.group(1).replace(" ", "")
                steps.append({"action": "wait", "payload": {"seconds": 1.2}})
                steps.append({"action": "type_text", "target": expression})
                steps.append({"action": "wait", "payload": {"seconds": 0.4}})
                steps.append({"action": "type_text", "target": "="})
                summary = f"Opening calculator and entering {expression}."
        return {"summary": summary, "steps": steps}

    if (any(token in lowered for token in ["login", "sign in", "log in"]) or ((email_value or password_value) and normalized_domain)) and normalized_domain:
        login_meta = KNOWN_LOGIN_URLS.get(normalized_domain)
        if login_meta:
            steps.append({"action": "open_url", "target": login_meta["url"]})
        else:
            steps.append({"action": "open_url", "target": url_or_domain})

        if email_value or password_value:
            steps.append({"action": "wait", "payload": {"seconds": (login_meta or {}).get("prefill_delay", 2.4)}})
            steps.append(
                {
                    "action": "type_sequence",
                    "payload": {
                        "values": [value for value in [email_value, password_value] if value],
                        "submit": True,
                        "tab_presses_before": (login_meta or {}).get("tab_presses_before", 0),
                        "type_interval": (login_meta or {}).get("type_interval", 0.05),
                        "step_delay": (login_meta or {}).get("step_delay", 0.12),
                        "clear_each": True,
                    },
                }
            )
            summary = f"Opening the login page for {normalized_domain} and filling the provided credentials."
            return {"summary": summary, "steps": steps}

    if "youtube" in lowered:
        query = search_phrase or normalized
        steps.append({"action": "open_youtube_song", "target": query})
        summary = f"Opening YouTube and searching for {query}."
        return {"summary": summary, "steps": steps}

    if search_phrase:
        if url_or_domain and "google" in (url_or_domain.lower() if url_or_domain else ""):
            target_url = f"https://www.google.com/search?q={urlencode({'q': search_phrase})[2:]}"
            steps.append({"action": "open_url", "target": target_url})
            summary = f"Opening Google search for {search_phrase}."
            return {"summary": summary, "steps": steps}

        if url_or_domain:
            steps.append({"action": "open_url", "target": url_or_domain})
            steps.append({"action": "wait", "payload": {"seconds": 1.8}})
            steps.append({"action": "type_text", "target": search_phrase})
            summary = f"Opening {url_or_domain} and typing the important search phrase."
            return {"summary": summary, "steps": steps}

        target_url = f"https://www.google.com/search?q={urlencode({'q': search_phrase})[2:]}"
        steps.append({"action": "open_url", "target": target_url})
        summary = f"Opening a browser search for {search_phrase}."
        return {"summary": summary, "steps": steps}

    if url_or_domain:
        steps.append({"action": "open_url", "target": url_or_domain})
        summary = f"Opening {url_or_domain} in the default browser."

    if typed_instruction and not is_complex_site_workflow(normalized):
        if steps:
            steps.append({"action": "wait", "payload": {"seconds": 1.8}})
        steps.append({"action": "type_text", "target": typed_instruction})
        summary = "Opening the requested page and typing the important message into the active field."
        return {"summary": summary, "steps": steps}

    if email_value or password_value:
        if not steps and not url_or_domain:
            summary = "Typing the provided credentials into the active browser fields."
        elif steps:
            steps.append({"action": "wait", "payload": {"seconds": 2.0}})
            summary = f"{summary} Then filling the credentials into the active fields."

        sequence = [value for value in [email_value, password_value] if value]
        steps.append({"action": "type_sequence", "payload": {"values": sequence, "submit": "login" in lowered or "sign in" in lowered}})
        return {"summary": summary, "steps": steps}

    if message_value:
        steps.append({"action": "type_text", "target": message_value})
        summary = "Typing the provided message into the active browser field."
        return {"summary": summary, "steps": steps}

    if any(token in lowered for token in ["type ", "write ", "send "]) and not message_value and not is_complex_site_workflow(normalized):
        typed_text = normalized
        for prefix in ["type", "write", "send"]:
            if lowered.startswith(prefix):
                typed_text = normalized[len(prefix):].strip(" :")
                break
        steps.append({"action": "type_text", "target": typed_text})
        summary = "Typing the requested text into the active app or browser field."
        return {"summary": summary, "steps": steps}

    if not steps:
        target_url = f"https://www.google.com/search?q={urlencode({'q': normalized})[2:]}"
        steps.append({"action": "open_url", "target": target_url})
        summary = "Opening a browser search based on the important part of your prompt."

    return {"summary": summary, "steps": steps}


def get_social_connection_status(connection: IntegrationConnection) -> tuple[bool, dict[str, Any]]:
    metadata: dict[str, Any] = {}
    if connection.metadata_json:
        try:
            metadata = json.loads(connection.metadata_json)
        except json.JSONDecodeError:
            metadata = {}

    configured = bool(metadata.get("configured")) and connection.is_connected
    return configured, metadata


def get_connection_metadata(connection: IntegrationConnection) -> dict[str, Any]:
    if not connection.metadata_json:
        return {}
    try:
        return json.loads(connection.metadata_json)
    except json.JSONDecodeError:
        return {}


def get_browser_automation_status(connection: IntegrationConnection) -> dict[str, Any]:
    metadata = get_connection_metadata(connection)
    permissions = {
        **BROWSER_AUTOMATION_DEFAULTS,
        **metadata.get("permissions", {}),
    }
    scheduled_actions = metadata.get("scheduled_actions", [])
    return {
        "provider": BROWSER_AUTOMATION_PROVIDER,
        "permissions": permissions,
        "scheduled_actions": scheduled_actions,
        "actions": BROWSER_AUTOMATION_ACTIONS,
        "disclaimer": (
            "Akansha can prepare and trigger browser actions, but the browser and OS still enforce "
            "their own security and focus rules."
        ),
    }


def ensure_social_seed(db: Session):
    existing = (
        db.query(InboxMessage)
        .filter(InboxMessage.platform.in_(list(SOCIAL_PLATFORM_META.keys())))
        .count()
    )
    if existing:
        return

    samples = [
        InboxMessage(
            platform="whatsapp",
            sender="Rahul",
            content="Hey, can we move tomorrow's practice interview to 7:30 PM?",
            intent="schedule",
            sentiment="neutral",
        ),
        InboxMessage(
            platform="instagram",
            sender="Ananya Design",
            content="Loved your AI project post. Are you open to collaborating on a reel next week?",
            intent="collaboration",
            sentiment="positive",
        ),
        InboxMessage(
            platform="twitter",
            sender="Open Source Club",
            content="We saw your thread on JWT refresh flow. Would you like to join our Sunday space?",
            intent="invitation",
            sentiment="positive",
        ),
        InboxMessage(
            platform="telegram",
            sender="Project Team",
            content="Can you confirm whether the demo build is ready before midnight?",
            intent="status",
            sentiment="urgent",
        ),
        InboxMessage(
            platform="discord",
            sender="Build Squad",
            content="Can you review the latest bot integration notes in the shared Discord channel?",
            intent="review",
            sentiment="neutral",
        ),
    ]
    db.add_all(samples)
    db.commit()


def suggest_social_replies(message: InboxMessage) -> list[str]:
    content = message.content.lower()
    name = message.sender.split()[0]

    if any(token in content for token in ["move", "schedule", "time", "tomorrow"]):
        return [
            f"Yes {name}, 7:30 PM works for me.",
            f"I can do tomorrow, but I need a little later. Would 8 PM work?",
            "Let me confirm in a few minutes and I will get back to you.",
        ]

    if any(token in content for token in ["collab", "collaborating", "reel"]):
        return [
            "That sounds exciting. I would love to hear the idea in a little more detail.",
            "Yes, I am open to it. Can you share the concept and expected timeline?",
            "I am interested. Let us lock a quick call and plan it properly.",
        ]

    if any(token in content for token in ["join", "space", "sunday", "invite"]):
        return [
            "Thanks for inviting me. Please share the exact time and topic.",
            "I would be happy to join if the timing works. Send me the details.",
            "That sounds good. Let me check my schedule and confirm shortly.",
        ]

    if any(token in content for token in ["ready", "midnight", "demo", "confirm"]):
        return [
            "I am checking the latest build right now and will confirm shortly.",
            "The demo is almost ready. I will send a final status update soon.",
            "Give me a little time and I will confirm the final build status.",
        ]

    return [
        f"Thanks {name}, I saw your message.",
        "I am on it. Let me get back to you shortly.",
        "Got it. I will reply with a proper update soon.",
    ]


@app.post("/api/chat")
async def chat_endpoint(req: ChatRequest, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    if not req.message:
        raise HTTPException(status_code=400, detail="Message is empty")

    # Save User Message
    user_msg = ChatMessage(role="user", content=req.message, session_id=req.session_id)
    db.add(user_msg)
    db.commit()

    try:
        # Generate Response
        response_generator = generate_chat_stream(
            db,
            req.message,
            req.session_id,
            user_tone=req.user_tone,
            response_style=req.response_style,
            conversation_mode=req.conversation_mode,
            language_preference=req.language_preference,
        )
        response_text = "".join(list(response_generator))
        
        # Save Assistant Message
        ai_msg = ChatMessage(role="assistant", content=response_text, session_id=req.session_id)
        db.add(ai_msg)
        db.commit()

        # Background Task: Extract Memories & Tasks
        background_tasks.add_task(analyze_intent_and_memory, db, req.message, response_text)

        return {"response": response_text}
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"AI Engine Error: {str(e)}")


@app.post("/api/chat/stream")
async def chat_stream_endpoint(
    req: ChatRequest, background_tasks: BackgroundTasks, db: Session = Depends(get_db)
):
    if not req.message:
        raise HTTPException(status_code=400, detail="Message is empty")

    user_msg = ChatMessage(role="user", content=req.message, session_id=req.session_id)
    db.add(user_msg)
    db.commit()

    async def event_stream():
        response_text = ""
        try:
            for chunk in generate_chat_stream(
                db,
                req.message,
                req.session_id,
                user_tone=req.user_tone,
                response_style=req.response_style,
                conversation_mode=req.conversation_mode,
                language_preference=req.language_preference,
            ):
                response_text += chunk
                yield f"data: {json.dumps({'type': 'chunk', 'content': chunk})}\n\n"

            ai_msg = ChatMessage(role="assistant", content=response_text, session_id=req.session_id)
            db.add(ai_msg)
            db.commit()
            background_tasks.add_task(analyze_intent_and_memory, db, req.message, response_text)
            yield f"data: {json.dumps({'type': 'done', 'content': response_text})}\n\n"
        except Exception as exc:
            yield f"data: {json.dumps({'type': 'error', 'message': str(exc)})}\n\n"

    return StreamingResponse(event_stream(), media_type="text/event-stream")

@app.get("/api/chat")
def get_chat_history(session_id: str | None = None, db: Session = Depends(get_db)):
    query = db.query(ChatMessage)
    if session_id:
        query = query.filter(ChatMessage.session_id == session_id)

    messages = query.order_by(ChatMessage.id.asc()).all()
    return {
        "messages": [
            {
                "id": m.id,
                "session_id": m.session_id,
                "role": m.role,
                "content": m.content,
                "timestamp": m.timestamp.isoformat()
                if hasattr(m, "timestamp") and m.timestamp
                else None,
            }
            for m in messages
        ]
    }

@app.get("/api/memories")
def get_memories(db: Session = Depends(get_db)):
    memories = db.query(Memory).order_by(Memory.importance.desc()).all()
    return {"memories": [{"id": m.id, "topic": m.topic, "insight": m.insight, "importance": m.importance, "timestamp": m.timestamp.isoformat() if hasattr(m, 'timestamp') and m.timestamp else None} for m in memories]}

@app.get("/api/tasks")
def get_tasks(db: Session = Depends(get_db)):
    tasks = db.query(Task).filter(Task.is_completed == False).order_by(Task.timestamp.desc()).all()
    return {"tasks": [{"id": t.id, "title": t.title, "description": t.description} for t in tasks]}

@app.get("/api/inbox")
def get_inbox(db: Session = Depends(get_db)):
    messages = db.query(InboxMessage).order_by(InboxMessage.timestamp.desc()).limit(20).all()
    return {"inbox": [{"platform": m.platform, "sender": m.sender, "content": m.content, "intent": m.intent} for m in messages]}


@app.get("/api/social/inbox")
def get_social_inbox(db: Session = Depends(get_db)):
    ensure_social_seed(db)
    messages = (
        db.query(InboxMessage)
        .filter(InboxMessage.platform.in_(list(SOCIAL_PLATFORM_META.keys())))
        .order_by(InboxMessage.timestamp.desc())
        .limit(12)
        .all()
    )

    platforms = []
    for key, meta in SOCIAL_PLATFORM_META.items():
        connection = get_or_create_connection(db, key)
        configured, metadata = get_social_connection_status(connection)
        platforms.append(
            {
                "key": key,
                "label": meta["label"],
                "connected": configured,
                "accent": meta["accent"],
                "setup_required": not configured,
                "required_fields": SOCIAL_REQUIRED_FIELDS.get(key, []),
                "configured_fields": metadata.get("configured_fields", []),
                "last_verified": metadata.get("last_verified"),
            }
        )

    return {
        "platforms": platforms,
        "messages": [
            {
                "id": message.id,
                "platform": message.platform,
                "sender": message.sender,
                "content": message.content,
                "intent": message.intent or "general",
                "sentiment": message.sentiment or "neutral",
                "is_read": message.is_read,
                "timestamp": message.timestamp.isoformat() if message.timestamp else None,
                "suggested_replies": suggest_social_replies(message),
            }
            for message in messages
        ],
    }


@app.post("/api/social/connect/{platform}")
def connect_social_platform(platform: str, db: Session = Depends(get_db)):
    if platform not in SOCIAL_PLATFORM_META:
        raise HTTPException(status_code=404, detail="Unsupported social platform")

    raise HTTPException(
        status_code=400,
        detail="This platform is not connected yet. Add the required API credentials in setup first.",
    )


@app.post("/api/social/setup/{platform}")
def setup_social_platform(platform: str, req: SocialSetupRequest, db: Session = Depends(get_db)):
    if platform not in SOCIAL_PLATFORM_META:
        raise HTTPException(status_code=404, detail="Unsupported social platform")

    required_fields = SOCIAL_REQUIRED_FIELDS.get(platform, [])
    missing = [field for field in required_fields if not req.config.get(field, "").strip()]
    if missing:
        raise HTTPException(
            status_code=400,
            detail=f"Missing required fields: {', '.join(missing)}",
        )

    connection = get_or_create_connection(db, platform)
    connection.is_connected = True
    connection.account_email = f"{platform}@configured.local"
    connection.metadata_json = json.dumps(
        {
            "mode": "manual-api-config",
            "configured": True,
            "configured_fields": sorted(req.config.keys()),
            "last_verified": datetime.utcnow().isoformat(),
        }
    )
    db.add(connection)
    db.commit()

    return {
        "success": True,
        "platform": platform,
        "configured_fields": sorted(req.config.keys()),
    }


@app.post("/api/social/disconnect/{platform}")
def disconnect_social_platform(platform: str, db: Session = Depends(get_db)):
    if platform not in SOCIAL_PLATFORM_META:
        raise HTTPException(status_code=404, detail="Unsupported social platform")

    connection = get_or_create_connection(db, platform)
    connection.is_connected = False
    connection.account_email = None
    connection.metadata_json = json.dumps(
        {
            "mode": "manual-api-config",
            "configured": False,
            "configured_fields": [],
            "last_verified": None,
        }
    )
    db.add(connection)
    db.commit()

    return {"success": True, "platform": platform}


@app.post("/api/social/send")
def send_social_reply(req: SocialReplyRequest, db: Session = Depends(get_db)):
    if req.platform not in SOCIAL_PLATFORM_META:
        raise HTTPException(status_code=404, detail="Unsupported social platform")
    if not req.approved:
        raise HTTPException(status_code=400, detail="Approval is required before Akansha can send a reply.")

    connection = get_or_create_connection(db, req.platform)
    if not connection.is_connected:
        raise HTTPException(status_code=400, detail="Connect the platform before sending replies.")

    if req.message_id:
        original = db.query(InboxMessage).filter(InboxMessage.id == req.message_id).first()
        if original:
            original.is_read = True
            db.add(original)

    db.add(
        InboxMessage(
            platform=req.platform,
            sender=f"You -> {req.sender}",
            content=req.reply,
            intent="reply",
            sentiment="approved",
            is_read=True,
        )
    )
    db.commit()

    return {
        "success": True,
        "status": "approved-and-queued",
        "platform": req.platform,
        "sender": req.sender,
        "reply": req.reply,
    }


@app.get("/api/profile")
def get_profile(db: Session = Depends(get_db)):
    profile = get_or_create_profile(db)
    return {"profile": serialize_profile(profile)}


@app.put("/api/profile")
def update_profile(req: ProfileUpdateRequest, db: Session = Depends(get_db)):
    profile = get_or_create_profile(db)

    for field, value in req.model_dump(exclude_none=True).items():
        setattr(profile, field, value)

    db.add(profile)
    db.commit()
    db.refresh(profile)
    return {"profile": serialize_profile(profile)}


@app.get("/api/google/status")
def get_google_status(db: Session = Depends(get_db)):
    profile = get_or_create_profile(db)
    connection = get_or_create_connection(db, "google")
    return {
        "configured": google_configured(),
        "connected": connection.is_connected,
        "email": connection.account_email or profile.google_email,
        "scopes": connection.scope.split(" ") if connection.scope else GOOGLE_SCOPES,
        "redirect_uri": GOOGLE_REDIRECT_URI,
        "setup_required": not google_configured(),
    }


@app.get("/api/voice/status")
def get_voice_status():
    return {
        "female_cloned_voice_configured": cloned_voice_configured(),
        "provider": "edge-tts",
        "model_id": "te-IN-ShrutiNeural / en-IN-NeerjaNeural / hi-IN-SwaraNeural",
        "voice_id_present": True,
        "supported_language_modes": ["english", "telugu", "mixed", "hindi"],
    }


@app.get("/api/automation/browser/status")
def get_browser_automation_state(db: Session = Depends(get_db)):
    connection = get_or_create_connection(db, BROWSER_AUTOMATION_PROVIDER)
    return get_browser_automation_status(connection)


@app.put("/api/automation/browser/permissions")
def update_browser_automation_permissions(
    req: BrowserAutomationPermissionsRequest, db: Session = Depends(get_db)
):
    connection = get_or_create_connection(db, BROWSER_AUTOMATION_PROVIDER)
    metadata = get_connection_metadata(connection)
    permissions = {
        **BROWSER_AUTOMATION_DEFAULTS,
        **metadata.get("permissions", {}),
    }

    for key, value in req.model_dump(exclude_none=True).items():
        permissions[key] = value

    metadata["permissions"] = permissions
    metadata["scheduled_actions"] = metadata.get("scheduled_actions", [])
    connection.is_connected = True
    connection.metadata_json = json.dumps(metadata)
    db.add(connection)
    db.commit()

    return get_browser_automation_status(connection)


@app.post("/api/automation/browser/run")
async def run_browser_automation(req: BrowserAutomationRunRequest, db: Session = Depends(get_db)):
    connection = get_or_create_connection(db, BROWSER_AUTOMATION_PROVIDER)
    status = get_browser_automation_status(connection)
    actions = {item["key"]: item for item in BROWSER_AUTOMATION_ACTIONS}
    action_meta = actions.get(req.action)

    if not action_meta:
        raise HTTPException(status_code=404, detail="Unsupported browser automation action.")

    permission_key = action_meta["permission"]
    if not status["permissions"].get(permission_key):
        raise HTTPException(
            status_code=400,
            detail=f"The '{action_meta['label']}' permission is currently turned off.",
        )

    metadata = get_connection_metadata(connection)
    metadata["permissions"] = status["permissions"]
    scheduled_actions = metadata.get("scheduled_actions", [])

    if req.run_at:
        scheduled_action = {
            "id": secrets.token_hex(6),
            "action": req.action,
            "label": action_meta["label"],
            "target": req.target,
            "run_at": req.run_at,
            "background": req.background,
            "status": "scheduled",
            "created_at": datetime.utcnow().isoformat(),
            "note": (
                "Saved inside Akansha as a planned browser action. Automatic timed execution still "
                "depends on keeping a worker running."
            ),
        }
        scheduled_actions.append(scheduled_action)
        metadata["scheduled_actions"] = scheduled_actions
        connection.is_connected = True
        connection.metadata_json = json.dumps(metadata)
        db.add(connection)
        db.commit()
        return {
            "success": True,
            "scheduled": True,
            "message": f"{action_meta['label']} saved for {req.run_at}.",
            "scheduled_action": scheduled_action,
        }

    result = await execute_desktop_command(
        req.action,
        req.target,
        {"background": req.background},
    )
    return {
        "success": bool(result.get("success")),
        "scheduled": False,
        "message": result.get("message"),
        "note": result.get("note"),
    }


@app.post("/api/automation/browser/prompt")
async def run_browser_automation_prompt(req: BrowserAutomationPromptRequest, db: Session = Depends(get_db)):
    prompt = req.prompt.strip()
    if not prompt:
        raise HTTPException(status_code=400, detail="Automation prompt is empty.")

    connection = get_or_create_connection(db, BROWSER_AUTOMATION_PROVIDER)
    metadata = get_connection_metadata(connection)
    metadata["permissions"] = {**BROWSER_AUTOMATION_DEFAULTS}
    scheduled_actions = metadata.get("scheduled_actions", [])

    plan = build_browser_prompt_plan(prompt)

    if req.run_at:
        scheduled_action = {
            "id": secrets.token_hex(6),
            "action": "freeform-prompt",
            "label": plan["summary"],
            "target": prompt,
            "run_at": req.run_at,
            "background": req.background,
            "status": "scheduled",
            "created_at": datetime.utcnow().isoformat(),
            "note": "Saved from the freeform automation box.",
        }
        scheduled_actions.append(scheduled_action)
        metadata["scheduled_actions"] = scheduled_actions
        connection.is_connected = True
        connection.metadata_json = json.dumps(metadata)
        db.add(connection)
        db.commit()
        return {
            "success": True,
            "scheduled": True,
            "message": f"{plan['summary']} Saved for {req.run_at}.",
            "plan": plan,
        }

    execution_results = []
    for step in plan["steps"]:
        result = await execute_desktop_command(
            step["action"],
            step.get("target"),
            step.get("payload"),
        )
        execution_results.append({"step": step, "result": result})
        if not result.get("success"):
            break

    final_result = execution_results[-1]["result"] if execution_results else {"success": False, "message": "No steps were executed."}
    return {
        "success": bool(final_result.get("success")),
        "scheduled": False,
        "message": final_result.get("message") or plan["summary"],
        "plan": plan,
        "results": execution_results,
        "note": (
            "This uses best-effort desktop automation. Complex site-specific flows still depend on page focus, "
            "login state, and the current browser layout."
        ),
    }


@app.delete("/api/automation/browser/scheduled/{action_id}")
def delete_scheduled_browser_automation(action_id: str, db: Session = Depends(get_db)):
    connection = get_or_create_connection(db, BROWSER_AUTOMATION_PROVIDER)
    metadata = get_connection_metadata(connection)
    scheduled_actions = metadata.get("scheduled_actions", [])
    filtered_actions = [item for item in scheduled_actions if item.get("id") != action_id]

    metadata["scheduled_actions"] = filtered_actions
    metadata["permissions"] = {
        **BROWSER_AUTOMATION_DEFAULTS,
        **metadata.get("permissions", {}),
    }
    connection.metadata_json = json.dumps(metadata)
    db.add(connection)
    db.commit()

    return {"success": True, "remaining": len(filtered_actions)}


@app.post("/api/voice/tts")
async def text_to_speech(req: TTSRequest):
    if not req.text.strip():
        raise HTTPException(status_code=400, detail="Text is empty.")

    try:
        audio = await generate_edge_tts_audio(
            req.text.strip(),
            req.voice_gender,
            req.voice_tone,
            req.language_mode,
        )
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"TTS synthesis failed: {exc}")

    return Response(content=audio, media_type="audio/mpeg")


@app.get("/api/google/auth-url")
def get_google_auth_url():
    if not google_configured():
        return {
            "configured": False,
            "auth_url": None,
            "message": "Add GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and GOOGLE_REDIRECT_URI to enable Google OAuth.",
        }

    state = secrets.token_urlsafe(24)
    query = urlencode(
        {
            "client_id": GOOGLE_CLIENT_ID,
            "redirect_uri": GOOGLE_REDIRECT_URI,
            "response_type": "code",
            "access_type": "offline",
            "prompt": "consent",
            "scope": " ".join(GOOGLE_SCOPES),
            "state": state,
        }
    )
    return {
        "configured": True,
        "auth_url": f"https://accounts.google.com/o/oauth2/v2/auth?{query}",
        "state": state,
    }


@app.get("/api/google/callback")
def google_callback(code: str, db: Session = Depends(get_db)):
    if not google_configured():
        raise HTTPException(status_code=400, detail="Google OAuth is not configured.")

    token_request = Request(
        "https://oauth2.googleapis.com/token",
        data=urlencode(
            {
                "code": code,
                "client_id": GOOGLE_CLIENT_ID,
                "client_secret": GOOGLE_CLIENT_SECRET,
                "redirect_uri": GOOGLE_REDIRECT_URI,
                "grant_type": "authorization_code",
            }
        ).encode("utf-8"),
        headers={"Content-Type": "application/x-www-form-urlencoded"},
    )

    with urlopen(token_request, timeout=20) as response:
        token_payload = json.loads(response.read().decode("utf-8"))

    access_token = token_payload.get("access_token")
    if not access_token:
        raise HTTPException(status_code=500, detail="Google did not return an access token.")

    user_info_request = Request(
        "https://www.googleapis.com/oauth2/v2/userinfo",
        headers={"Authorization": f"Bearer {access_token}"},
    )
    with urlopen(user_info_request, timeout=20) as response:
        user_info = json.loads(response.read().decode("utf-8"))

    profile = get_or_create_profile(db)
    connection = get_or_create_connection(db, "google")
    update_google_connection(db, connection, profile, token_payload, user_info)

    return {
        "success": True,
        "email": user_info.get("email"),
        "message": "Google account connected. You can return to Akansha now.",
    }


@app.post("/api/google/disconnect")
def disconnect_google(db: Session = Depends(get_db)):
    profile = get_or_create_profile(db)
    connection = get_or_create_connection(db, "google")

    connection.access_token = None
    connection.refresh_token = None
    connection.scope = None
    connection.account_email = None
    connection.token_expiry = None
    connection.metadata_json = None
    connection.is_connected = False

    profile.google_connected = False
    profile.google_email = None

    db.add(connection)
    db.add(profile)
    db.commit()

    return {"success": True}


@app.get("/api/google/gmail/summary")
def get_gmail_summary(db: Session = Depends(get_db)):
    connection = get_or_create_connection(db, "google")
    if not connection.is_connected or not connection.access_token:
        return {
            "connected": False,
            "summary": "Connect Google to read and summarize Gmail threads from Akansha.",
            "emails": [],
        }

    try:
        messages = google_api_get(
            "https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=5&q=category:primary",
            connection,
        )
        email_cards = []
        for item in messages.get("messages", []):
            message_data = google_api_get(
                f"https://gmail.googleapis.com/gmail/v1/users/me/messages/{item['id']}?format=metadata&metadataHeaders=From&metadataHeaders=Subject",
                connection,
            )
            headers = {
                header["name"]: header["value"]
                for header in message_data.get("payload", {}).get("headers", [])
            }
            email_cards.append(
                {
                    "id": item["id"],
                    "sender": headers.get("From", "Unknown sender"),
                    "subject": headers.get("Subject", "No subject"),
                    "snippet": message_data.get("snippet", ""),
                    "important": "IMPORTANT" in message_data.get("labelIds", []),
                }
            )

        summary = (
            f"You have {len(email_cards)} recent Gmail threads ready for review."
            if email_cards
            else "No recent Gmail threads were found."
        )
        return {"connected": True, "summary": summary, "emails": email_cards}
    except Exception as exc:
        return {
            "connected": True,
            "summary": f"Gmail is connected, but Akansha could not fetch messages right now: {exc}",
            "emails": [],
        }


@app.get("/api/google/calendar/events")
def get_calendar_events(db: Session = Depends(get_db)):
    connection = get_or_create_connection(db, "google")
    if not connection.is_connected or not connection.access_token:
        return {
            "connected": False,
            "events": [
                {
                    "title": "Connect Google Calendar",
                    "start": "Anytime",
                    "description": "Authorize Google to view upcoming events and create reminders.",
                }
            ],
        }

    try:
        now = datetime.now(timezone.utc).isoformat()
        events_data = google_api_get(
            f"https://www.googleapis.com/calendar/v3/calendars/primary/events?maxResults=5&singleEvents=true&orderBy=startTime&timeMin={now}",
            connection,
        )
        events = [
            {
                "id": item.get("id"),
                "title": item.get("summary", "Untitled event"),
                "start": item.get("start", {}).get("dateTime") or item.get("start", {}).get("date"),
                "description": item.get("description", ""),
            }
            for item in events_data.get("items", [])
        ]
        return {"connected": True, "events": events}
    except Exception as exc:
        return {
            "connected": True,
            "events": [],
            "error": f"Calendar is connected, but events could not be loaded: {exc}",
        }


@app.post("/api/google/calendar/reminders")
def create_calendar_reminder(req: ReminderRequest, db: Session = Depends(get_db)):
    connection = get_or_create_connection(db, "google")
    if not connection.is_connected or not connection.access_token:
        raise HTTPException(status_code=400, detail="Connect Google Calendar before creating reminders.")

    event_payload = {
        "summary": req.title,
        "start": {"dateTime": req.date_time},
        "end": {"dateTime": req.date_time},
    }
    request = Request(
        "https://www.googleapis.com/calendar/v3/calendars/primary/events",
        data=json.dumps(event_payload).encode("utf-8"),
        headers={
            **google_auth_headers(connection),
            "Content-Type": "application/json",
        },
        method="POST",
    )
    with urlopen(request, timeout=20) as response:
        created = json.loads(response.read().decode("utf-8"))

    return {
        "success": True,
        "event_id": created.get("id"),
        "html_link": created.get("htmlLink"),
    }

# Mount frontend files
app.mount("/", StaticFiles(directory="frontend", html=True), name="frontend")
