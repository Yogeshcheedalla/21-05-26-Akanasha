from __future__ import annotations

import re
from typing import Any

from ..database.store import CognitiveStore, loads


class PredictiveAssistant:
    """Produces bounded proactive suggestions from graph, failures, and task text."""

    def __init__(self, store: CognitiveStore) -> None:
        self.store = store

    def predict(self, task: str, analysis: dict[str, Any] | None = None) -> dict[str, Any]:
        lowered = task.lower()
        suggestions: list[dict[str, Any]] = []
        failure_lessons = self._failure_lessons(limit=10)

        if re.search(r"\bdeploy|github|server|production\b", lowered):
            if any("env" in (lesson["cause"] + " " + lesson["fix"]).lower() for lesson in failure_lessons):
                suggestions.append(
                    {
                        "type": "risk_prevention",
                        "message": "Check environment variables before deployment because similar tasks failed there before.",
                        "confidence": 0.86,
                    }
                )
            else:
                suggestions.append(
                    {
                        "type": "workflow_prediction",
                        "message": "Deployment tasks usually need build, tests, environment validation, and rollback notes.",
                        "confidence": 0.78,
                    }
                )
        if re.search(r"\bpdf|excel|ppt|docx|report|presentation\b", lowered):
            suggestions.append(
                {
                    "type": "output_format",
                    "message": "Generate a structured artifact, verify the file exists, then return a direct download link.",
                    "confidence": 0.88,
                }
            )
        if re.search(r"\blatest|current|today|live|score|price|news\b", lowered):
            suggestions.append(
                {
                    "type": "accuracy_guard",
                    "message": "Use live sources with timestamp and avoid confident answers until at least one source is validated.",
                    "confidence": 0.9,
                }
            )
        if re.search(r"\btomorrow|exam|deadline|due\b", lowered):
            suggestions.append(
                {
                    "type": "deadline_awareness",
                    "message": "Offer a schedule, reminder, or study/work plan because the task includes time pressure.",
                    "confidence": 0.82,
                }
            )

        mode = (analysis or {}).get("intent", "conversation")
        return {
            "mode": mode,
            "suggestions": suggestions[:6],
            "risk_flags": self._risk_flags(lowered, analysis or {}),
            "failure_lessons_used": failure_lessons[:3],
        }

    def _risk_flags(self, lowered: str, analysis: dict[str, Any]) -> list[str]:
        flags: list[str] = []
        if analysis.get("risk_level") in {"high", "critical"}:
            flags.append("requires_permission_review")
        if re.search(r"\bsubmit|payment|delete|password\b", lowered):
            flags.append("sensitive_action_confirmation")
        if re.search(r"\blatest|current|live\b", lowered):
            flags.append("live_source_required")
        return flags

    def _failure_lessons(self, limit: int) -> list[dict[str, Any]]:
        with self.store.connect(self.store.files.experiences) as conn:
            rows = conn.execute(
                "SELECT * FROM failure_lessons WHERE status = 'active' ORDER BY confidence DESC, updated_at DESC LIMIT ?",
                (max(1, min(limit, 50)),),
            ).fetchall()
        return [dict(row) for row in rows]
