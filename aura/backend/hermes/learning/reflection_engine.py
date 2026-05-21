from __future__ import annotations

from typing import Any
from uuid import uuid4

from ..database.store import CognitiveStore, loads, utc_now


class ReflectionEngine:
    def __init__(self, store: CognitiveStore) -> None:
        self.store = store

    def reflect(self, experience_id: str) -> dict[str, Any]:
        with self.store.connect(self.store.files.experiences) as conn:
            row = conn.execute("SELECT * FROM experiences WHERE id = ?", (experience_id,)).fetchone()
            if not row:
                raise ValueError(f"Experience not found: {experience_id}")
            data = dict(row)
            errors = loads(data["errors"], [])
            successful = loads(data["successful_steps"], [])
            tools = loads(data["tools_used"], [])
            reward = float(data["reward"])
            worked = "; ".join(successful[:5]) or "No successful steps recorded"
            failed = "; ".join(errors[:5]) or "No failures recorded"
            lessons = []
            if reward >= 0.8:
                lessons.append("Workflow is a candidate for skill promotion after repeated validation.")
            if errors:
                lessons.append("Add preflight validation before repeating failed steps.")
            if tools:
                lessons.append(f"Tool pattern learned: {', '.join(tools[:5])}.")
            candidate_skill = data["task"] if reward >= 0.8 and len(successful) >= 3 else None
            reflection_id = f"ref_{uuid4().hex}"
            created_at = utc_now()
            conn.execute(
                """
                INSERT INTO reflections(id, experience_id, worked, failed, lessons, candidate_skill, confidence, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    reflection_id,
                    experience_id,
                    worked,
                    failed,
                    "\n".join(lessons),
                    candidate_skill,
                    min(0.95, max(0.35, reward)),
                    created_at,
                ),
            )
        return {
            "reflection_id": reflection_id,
            "experience_id": experience_id,
            "worked": worked,
            "failed": failed,
            "lessons": lessons,
            "candidate_skill": candidate_skill,
            "confidence": min(0.95, max(0.35, reward)),
        }
