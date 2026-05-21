from __future__ import annotations

from typing import Any
from uuid import uuid4

from ..database.store import CognitiveStore, dumps, utc_now
from .reward_system import RewardSystem


class ExperienceEngine:
    def __init__(self, store: CognitiveStore) -> None:
        self.store = store
        self.reward_system = RewardSystem()

    def record(self, payload: dict[str, Any]) -> dict[str, Any]:
        required = ["task", "goal", "actions_taken", "tools_used", "successful_steps"]
        missing = [key for key in required if key not in payload]
        if missing:
            raise ValueError(f"Missing experience fields: {', '.join(missing)}")

        reward = self.reward_system.compute(
            bool(payload.get("task_success", payload.get("score", 0) >= 0.7)),
            float(payload.get("speed_score", 0.5)),
            float(payload.get("user_feedback", 0.5)),
            float(payload.get("tool_efficiency", 0.5)),
            float(payload.get("error_penalty", 0.0)),
        )
        experience_id = f"exp_{uuid4().hex}"
        created_at = utc_now()
        with self.store.connect(self.store.files.experiences) as conn:
            conn.execute(
                """
                INSERT INTO experiences(
                    id, task, goal, actions_taken, tools_used, agents_used, errors,
                    successful_steps, time_taken, feedback, score, reward, created_at
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    experience_id,
                    payload["task"],
                    payload["goal"],
                    dumps(payload.get("actions_taken", [])),
                    dumps(payload.get("tools_used", [])),
                    dumps(payload.get("agents_used", [])),
                    dumps(payload.get("errors", [])),
                    dumps(payload.get("successful_steps", [])),
                    float(payload.get("time_taken", 0.0)),
                    str(payload.get("feedback", "")),
                    float(payload.get("score", reward)),
                    reward,
                    created_at,
                ),
            )
        return {"experience_id": experience_id, "reward": reward, "created_at": created_at}
