from __future__ import annotations

import re
from typing import Any


class AdaptiveUIEngine:
    """Selects the user-facing mode without mutating frontend layout."""

    MODES = {"coding", "research", "voice", "planning", "business", "creative"}

    def mode_for_task(self, task: str, analysis: dict[str, Any] | None = None) -> dict[str, Any]:
        lowered = task.lower()
        intent = (analysis or {}).get("intent", "")
        if "voice" in lowered or "speech" in lowered or "avatar" in lowered:
            mode = "voice"
        elif intent == "coding" or re.search(r"\b(code|debug|test|repo|deploy)\b", lowered):
            mode = "coding"
        elif intent == "live_research" or re.search(r"\b(research|latest|news|source|citation)\b", lowered):
            mode = "research"
        elif re.search(r"\b(plan|todo|schedule|deadline|workflow)\b", lowered):
            mode = "planning"
        elif re.search(r"\b(business|invoice|market|analytics|report)\b", lowered):
            mode = "business"
        elif re.search(r"\b(image|creative|design|story|presentation)\b", lowered):
            mode = "creative"
        else:
            mode = "planning" if len(task) > 160 else "research"
        return self._config(mode)

    def _config(self, mode: str) -> dict[str, Any]:
        base = {
            "mode": mode,
            "density": "balanced",
            "primary_panels": ["conversation", "sources", "actions"],
            "response_style": "concise_with_audit",
        }
        configs = {
            "coding": {
                "primary_panels": ["diff", "tests", "terminal", "conversation"],
                "accent": "code_quality",
                "default_artifacts": ["patch", "test_report"],
            },
            "research": {
                "primary_panels": ["answer", "source_table", "confidence", "timeline"],
                "accent": "citations",
                "default_artifacts": ["table", "summary"],
            },
            "voice": {
                "primary_panels": ["avatar", "live_transcript", "interruptions", "language_state"],
                "accent": "low_latency",
                "default_artifacts": ["transcript"],
            },
            "planning": {
                "primary_panels": ["workflow", "todo", "calendar", "risks"],
                "accent": "execution",
                "default_artifacts": ["checklist"],
            },
            "business": {
                "primary_panels": ["metrics", "tables", "charts", "exports"],
                "accent": "decision_support",
                "default_artifacts": ["xlsx", "pdf"],
            },
            "creative": {
                "primary_panels": ["canvas", "variants", "assets", "exports"],
                "accent": "visual_output",
                "default_artifacts": ["png", "pptx"],
            },
        }
        base.update(configs.get(mode, {}))
        return base
