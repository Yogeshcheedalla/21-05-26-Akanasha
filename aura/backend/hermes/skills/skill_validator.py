from __future__ import annotations

from typing import Any


class SkillValidator:
    def validate(self, skill: dict[str, Any]) -> dict[str, Any]:
        required = ["name", "description", "trigger_conditions", "required_tools", "execution_steps", "confidence"]
        missing = [field for field in required if not skill.get(field)]
        confidence = float(skill.get("confidence", 0.0))
        reward = float(skill.get("reward_score", 0.0))
        safe = not any("delete all" in str(step).lower() for step in skill.get("execution_steps", []))
        return {
            "valid": not missing and confidence >= 0.75 and reward >= 0.65 and safe,
            "missing": missing,
            "confidence": confidence,
            "reward_score": reward,
            "safe": safe,
        }
