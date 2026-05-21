from __future__ import annotations

import re
from typing import Any

from .task_decomposer import TaskDecomposer


class InputUnderstandingEngine:
    def __init__(self) -> None:
        self.decomposer = TaskDecomposer()

    def understand(self, text: str) -> dict[str, Any]:
        lowered = text.lower()
        steps = self.decomposer.decompose(text)
        required_tools = self._tools(lowered)
        risk_level = "critical" if re.search(r"\b(delete|payment|submit|send email|password)\b", lowered) else "high" if "desktop" in lowered else "low"
        emotion = "stressed" if re.search(r"\b(urgent|angry|frustrated|wrong|failed|not working)\b", lowered) else "neutral"
        intent = self._intent(lowered)
        return {
            "intent": intent,
            "priority": "high" if risk_level in {"high", "critical"} or "urgent" in lowered else "normal",
            "emotion": emotion,
            "required_tools": required_tools,
            "task_complexity": min(100, len(steps) * max(1, len(required_tools)) * 10),
            "memory_relevance": 0.8 if re.search(r"\b(remember|again|previous|last time)\b", lowered) else 0.4,
            "risk_level": risk_level,
            "steps": steps,
        }

    def _intent(self, lowered: str) -> str:
        if re.search(r"\b(search|latest|news|score|price|weather)\b", lowered):
            return "live_research"
        if re.search(r"\b(debug|fix|patch|bug|issue|code|test|tests|build|deploy)\b", lowered):
            return "coding"
        if re.search(r"\b(pdf|excel|ppt|docx|csv|json|file|report)\b", lowered):
            return "artifact_generation"
        if re.search(r"\b(open|click|scroll|desktop|browser|submit)\b", lowered):
            return "automation"
        return "conversation"

    def _tools(self, lowered: str) -> list[str]:
        tools: list[str] = []
        if re.search(r"\b(search|latest|news|score|price|weather)\b", lowered):
            tools.append("web_search")
        if re.search(r"\b(pdf|excel|ppt|docx|csv|json|file|report)\b", lowered):
            tools.append("artifact_generation")
        if re.search(r"\b(open|click|scroll|desktop|browser|submit)\b", lowered):
            tools.extend(["browser_automation", "desktop_control"])
        if re.search(r"\b(debug|fix|patch|bug|issue|code|test|tests|build|deploy)\b", lowered):
            tools.extend(["repo_read", "tests"])
        return sorted(set(tools))
