from __future__ import annotations

import re
from collections import defaultdict
from typing import Any

from ..database.store import CognitiveStore, loads
from .skill_registry import SkillRegistry


class SkillGenerator:
    def __init__(self, store: CognitiveStore) -> None:
        self.store = store
        self.registry = SkillRegistry(store)

    def generate_from_repetitions(self, task_family: str) -> dict[str, Any] | None:
        with self.store.connect(self.store.files.experiences) as conn:
            rows = conn.execute(
                """
                SELECT * FROM experiences
                WHERE lower(task) LIKE ?
                ORDER BY created_at DESC
                LIMIT 20
                """,
                (f"%{task_family.lower()}%",),
            ).fetchall()
        successful = [dict(row) for row in rows if float(row["reward"]) >= 0.80 and float(row["score"]) >= 0.75]
        if len(successful) < 3:
            return None

        average_reward = sum(float(row["reward"]) for row in successful) / len(successful)
        if average_reward < 0.80:
            return None

        tools: set[str] = set()
        steps: list[str] = []
        examples: list[str] = []
        for row in successful[:5]:
            tools.update(loads(row["tools_used"], []))
            steps.extend(loads(row["successful_steps"], [])[:4])
            examples.append(row["goal"])

        name = self._skill_name(task_family)
        existing = self.registry.latest(name)
        if existing and existing["status"] == "stable" and float(existing["reward_score"]) >= average_reward:
            return existing

        return self.registry.create_version(
            name=name,
            description=f"Reusable workflow for {task_family} generated from validated successful experiences.",
            trigger_conditions=[task_family, f"user asks for {task_family}", "similar workflow succeeds repeatedly"],
            required_tools=sorted(tools),
            execution_steps=self._dedupe(steps)[:12],
            examples=self._dedupe(examples)[:5],
            confidence=min(0.99, average_reward + 0.08),
            success_rate=min(1.0, len(successful) / max(3, len(rows))),
            reward_score=average_reward,
            status="draft",
        )

    def _skill_name(self, task_family: str) -> str:
        words = re.findall(r"[A-Za-z0-9]+", task_family.title())
        return "".join(words[:5]) + "Skill"

    def _dedupe(self, values: list[str]) -> list[str]:
        seen: set[str] = set()
        out: list[str] = []
        for value in values:
            clean = " ".join(str(value).split())
            if clean and clean.lower() not in seen:
                seen.add(clean.lower())
                out.append(clean)
        return out
