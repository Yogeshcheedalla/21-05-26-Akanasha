from __future__ import annotations

import re


class TaskDecomposer:
    def decompose(self, text: str) -> list[str]:
        parts = re.split(
            r"\b(?:then|after that|and then|also)\b|[.;]\s*|,\s*(?=(?:generate|validate|test|run|fix|debug|summarize|prepare|research|open|create|analyze|build)\b)",
            text,
            flags=re.IGNORECASE,
        )
        steps = [" ".join(part.split()) for part in parts if part.strip()]
        return steps[:20] or [text.strip()]
