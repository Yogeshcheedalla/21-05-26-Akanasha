from __future__ import annotations

from typing import Any

from ..database.store import CognitiveStore, utc_now


class MemoryCompressionEngine:
    def __init__(self, store: CognitiveStore) -> None:
        self.store = store

    def compress(self, min_confidence: float = 0.25) -> dict[str, Any]:
        archived = 0
        merged = 0
        now = utc_now()
        with self.store.connect(self.store.files.memories) as conn:
            low_confidence = conn.execute(
                """
                SELECT memory_id FROM long_term_memories
                WHERE archived = 0 AND confidence < ?
                """,
                (min_confidence,),
            ).fetchall()
            for row in low_confidence:
                conn.execute(
                    "UPDATE long_term_memories SET archived = 1, updated_at = ? WHERE memory_id = ?",
                    (now, row["memory_id"]),
                )
                archived += 1

            duplicates = conn.execute(
                """
                SELECT fingerprint, GROUP_CONCAT(memory_id) AS ids, COUNT(*) AS count
                FROM long_term_memories
                WHERE archived = 0
                GROUP BY fingerprint
                HAVING count > 1
                """
            ).fetchall()
            for row in duplicates:
                ids = str(row["ids"]).split(",")
                keeper = ids[0]
                for duplicate_id in ids[1:]:
                    conn.execute(
                        "UPDATE long_term_memories SET archived = 1, updated_at = ? WHERE memory_id = ?",
                        (now, duplicate_id),
                    )
                    conn.execute(
                        """
                        UPDATE long_term_memories
                        SET usage_count = usage_count + 1, updated_at = ?
                        WHERE memory_id = ?
                        """,
                        (now, keeper),
                    )
                    merged += 1
        return {"archived": archived, "merged": merged, "timestamp": now}
