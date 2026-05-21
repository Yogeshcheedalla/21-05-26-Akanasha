from __future__ import annotations

from typing import Any

from ..database.store import CognitiveStore, utc_now


class SkillRetirement:
    def __init__(self, store: CognitiveStore) -> None:
        self.store = store

    def retire_low_performers(self, min_success_rate: float = 0.35, min_usage: int = 5) -> dict[str, Any]:
        with self.store.connect(self.store.files.skills) as conn:
            cursor = conn.execute(
                """
                UPDATE skills
                SET status = 'retired', updated_at = ?
                WHERE status != 'stable'
                  AND usage_count >= ?
                  AND success_rate < ?
                """,
                (utc_now(), min_usage, min_success_rate),
            )
            return {"retired": cursor.rowcount}
