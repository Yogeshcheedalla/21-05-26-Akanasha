from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from ..database.store import CognitiveStore, cosine_similarity, loads, token_embedding, utc_now


def _days_old(timestamp: str | None) -> float:
    if not timestamp:
        return 365.0
    try:
        value = datetime.fromisoformat(timestamp)
        if value.tzinfo is None:
            value = value.replace(tzinfo=timezone.utc)
        return max(0.0, (datetime.now(timezone.utc) - value).total_seconds() / 86400)
    except Exception:
        return 365.0


class MemoryRetrievalEngine:
    def __init__(self, store: CognitiveStore) -> None:
        self.store = store

    def recall(self, query: str, limit: int = 10) -> list[dict[str, Any]]:
        query_embedding = token_embedding(query)
        with self.store.connect(self.store.files.memories) as conn:
            rows = conn.execute(
                """
                SELECT * FROM long_term_memories
                WHERE archived = 0
                """
            ).fetchall()

            scored: list[dict[str, Any]] = []
            for row in rows:
                data = dict(row)
                semantic = cosine_similarity(query_embedding, loads(data["embedding"], {}))
                recency = 1.0 / (1.0 + _days_old(data.get("last_accessed")) / 30.0)
                usage = min(1.0, float(data.get("usage_count") or 0) / 20.0)
                importance = max(0.0, min(1.0, float(data["importance_score"])))
                confidence = max(0.0, min(1.0, float(data["confidence"])))
                score = (
                    0.35 * semantic
                    + 0.20 * importance
                    + 0.15 * recency
                    + 0.15 * usage
                    + 0.15 * confidence
                )
                data["recall_score"] = round(score, 6)
                data["semantic_similarity"] = round(semantic, 6)
                scored.append(data)

            top = sorted(scored, key=lambda item: item["recall_score"], reverse=True)[: max(1, min(limit, 10))]
            now = utc_now()
            for item in top:
                conn.execute(
                    """
                    UPDATE long_term_memories
                    SET usage_count = usage_count + 1, last_accessed = ?
                    WHERE memory_id = ?
                    """,
                    (now, item["memory_id"]),
                )
        return top
