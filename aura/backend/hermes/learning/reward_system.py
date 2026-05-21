from __future__ import annotations


class RewardSystem:
    @staticmethod
    def compute(
        task_success: bool,
        speed_score: float,
        user_feedback: float,
        tool_efficiency: float,
        error_penalty: float,
    ) -> float:
        success = 1.0 if task_success else 0.0
        reward = (success * 0.45) + (speed_score * 0.20) + (user_feedback * 0.20) + (tool_efficiency * 0.15)
        reward -= max(0.0, min(1.0, error_penalty)) * 0.30
        return round(max(0.0, min(1.0, reward)), 6)
