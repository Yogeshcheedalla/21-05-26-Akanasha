from __future__ import annotations

from typing import Any

from ..database.store import CognitiveStore, dumps, utc_now


class ShortTermMemory:
    def __init__(self, store: CognitiveStore) -> None:
        self.store = store

    def add(
        self,
        session_id: str,
        conversation: str,
        tool_usage: list[str] | None = None,
        context_score: float = 0.5,
    ) -> int:
        with self.store.connect(self.store.files.memories) as conn:
            cursor = conn.execute(
                """
                INSERT INTO short_term_memory(session_id, timestamp, conversation, tool_usage, context_score)
                VALUES (?, ?, ?, ?, ?)
                """,
                (session_id, utc_now(), conversation, dumps(tool_usage or []), max(0.0, min(1.0, context_score))),
            )
            return int(cursor.lastrowid)

    def recent(self, session_id: str, limit: int = 20) -> list[dict[str, Any]]:
        with self.store.connect(self.store.files.memories) as conn:
            rows = conn.execute(
                """
                SELECT id, session_id, timestamp, conversation, tool_usage, context_score
                FROM short_term_memory
                WHERE session_id = ?
                ORDER BY timestamp DESC
                LIMIT ?
                """,
                (session_id, max(1, min(limit, 100))),
            ).fetchall()
        return [dict(row) for row in rows]
