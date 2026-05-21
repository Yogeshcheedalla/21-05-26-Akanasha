from __future__ import annotations

from typing import Any
from uuid import uuid4

from ..database.store import CognitiveStore, dumps, stable_fingerprint, token_embedding, utc_now


ALLOWED_MEMORY_CATEGORIES = {
    "user_preferences",
    "personal_context",
    "task_history",
    "learned_patterns",
    "successful_workflows",
    "failures",
    "agent_behavior",
    "skills",
    "tool_knowledge",
}


class LongTermMemory:
    def __init__(self, store: CognitiveStore) -> None:
        self.store = store

    def upsert(
        self,
        category: str,
        content: str,
        importance_score: float,
        source: str,
        confidence: float,
    ) -> dict[str, Any]:
        if category not in ALLOWED_MEMORY_CATEGORIES:
            raise ValueError(f"Unsupported memory category: {category}")
        clean_content = " ".join(content.split())
        if not clean_content:
            raise ValueError("Memory content cannot be empty")

        now = utc_now()
        fingerprint = f"{category}:{stable_fingerprint(clean_content)}"
        embedding = dumps(token_embedding(clean_content))
        importance = max(0.0, min(1.0, importance_score))
        safe_confidence = max(0.0, min(1.0, confidence))

        with self.store.connect(self.store.files.memories) as conn:
            existing = conn.execute(
                "SELECT * FROM long_term_memories WHERE fingerprint = ?",
                (fingerprint,),
            ).fetchone()
            if existing:
                conn.execute(
                    """
                    UPDATE long_term_memories
                    SET importance_score = MAX(importance_score, ?),
                        confidence = MAX(confidence, ?),
                        source = ?,
                        embedding = ?,
                        archived = 0,
                        updated_at = ?
                    WHERE memory_id = ?
                    """,
                    (importance, safe_confidence, source, embedding, now, existing["memory_id"]),
                )
                return {**dict(existing), "deduplicated": True}

            memory_id = f"mem_{uuid4().hex}"
            conn.execute(
                """
                INSERT INTO long_term_memories(
                    memory_id, category, content, importance_score, usage_count,
                    last_accessed, source, confidence, embedding, fingerprint,
                    archived, created_at, updated_at
                )
                VALUES (?, ?, ?, ?, 0, ?, ?, ?, ?, ?, 0, ?, ?)
                """,
                (
                    memory_id,
                    category,
                    clean_content,
                    importance,
                    now,
                    source,
                    safe_confidence,
                    embedding,
                    fingerprint,
                    now,
                    now,
                ),
            )
        return {
            "memory_id": memory_id,
            "category": category,
            "content": clean_content,
            "importance_score": importance,
            "source": source,
            "confidence": safe_confidence,
            "deduplicated": False,
        }
