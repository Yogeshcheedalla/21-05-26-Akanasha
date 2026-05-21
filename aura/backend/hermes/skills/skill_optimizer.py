from __future__ import annotations

from typing import Any

from ..database.store import CognitiveStore
from .skill_registry import SkillRegistry


class SkillOptimizer:
    def __init__(self, store: CognitiveStore) -> None:
        self.store = store
        self.registry = SkillRegistry(store)

    def improve_after_use(
        self,
        skill_id: str,
        success: bool,
        latency_seconds: float,
        tool_failures: int,
        feedback_score: float,
    ) -> dict[str, Any]:
        skill = self.registry.get(skill_id)
        if not skill:
            raise ValueError(f"Skill not found: {skill_id}")
        penalty = min(0.3, tool_failures * 0.05) + min(0.2, latency_seconds / 120.0)
        outcome_score = max(0.0, min(1.0, (1.0 if success else 0.2) * 0.55 + feedback_score * 0.45 - penalty))
        new_success_rate = (float(skill["success_rate"]) * max(1, int(skill["usage_count"])) + outcome_score) / (
            max(1, int(skill["usage_count"])) + 1
        )
        improved_steps = list(skill["execution_steps"])
        if tool_failures:
            improved_steps.insert(0, "Run preflight validation before tool execution.")
        if latency_seconds > 20:
            improved_steps.insert(0, "Prefer cached context and parallel-safe reads before slow tools.")

        improved = self.registry.create_version(
            name=skill["name"],
            description=skill["description"],
            trigger_conditions=skill["trigger_conditions"],
            required_tools=skill["required_tools"],
            execution_steps=self._dedupe(improved_steps),
            examples=skill["examples"],
            confidence=min(0.99, max(float(skill["confidence"]), outcome_score)),
            success_rate=max(0.0, min(1.0, new_success_rate)),
            reward_score=max(float(skill["reward_score"]), outcome_score),
            status="draft",
        )
        return improved

    def _dedupe(self, values: list[str]) -> list[str]:
        seen: set[str] = set()
        out: list[str] = []
        for value in values:
            key = value.lower()
            if key not in seen:
                seen.add(key)
                out.append(value)
        return out[:16]
