from __future__ import annotations

import re
from typing import Any
from uuid import uuid4

from ..database.store import CognitiveStore, dumps, loads, utc_now
from .memory_compression import MemoryCompressionEngine


class CognitiveCompressionEngine:
    """Turns raw memory into durable decisions, patterns, and lessons.

    This layer is intentionally deterministic. It does not invent new facts; it
    only extracts compact structure from stored conversation and memory rows,
    archives noisy memory, and records the compression snapshot for audit.
    """

    DECISION_RE = re.compile(r"\b(decided|decision|always|prefer|should|use|must|never)\b", re.I)
    LESSON_RE = re.compile(r"\b(failed|wrong|error|fixed|fix|lesson|issue|avoid|worked)\b", re.I)

    def __init__(self, store: CognitiveStore) -> None:
        self.store = store
        self.basic_compression = MemoryCompressionEngine(store)

    def compress_context(self, min_confidence: float = 0.25, max_rows: int = 120) -> dict[str, Any]:
        base = self.basic_compression.compress(min_confidence=min_confidence)
        memories = self._active_memories(max_rows)
        sessions = self._recent_session_lines(max_rows=40)
        combined = memories + sessions

        decisions = self._extract_matching(combined, self.DECISION_RE, limit=12)
        lessons = self._extract_matching(combined, self.LESSON_RE, limit=12)
        user_patterns = self._extract_user_patterns(memories, limit=12)
        summary = self._summary(decisions, user_patterns, lessons)

        archived_ids = self._archive_low_signal(memories)
        compression = {
            "id": f"compression_{uuid4().hex}",
            "summary": summary,
            "decisions": decisions,
            "user_patterns": user_patterns,
            "lessons": lessons,
            "archived_memory_ids": archived_ids,
            "removed_noise": base["archived"],
            "confidence": self._confidence(decisions, user_patterns, lessons),
            "created_at": utc_now(),
        }
        with self.store.connect(self.store.files.memories) as conn:
            conn.execute(
                """
                INSERT INTO cognitive_compressions(
                    id, summary, decisions, user_patterns, lessons,
                    archived_memory_ids, removed_noise, confidence, created_at
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    compression["id"],
                    compression["summary"],
                    dumps(decisions),
                    dumps(user_patterns),
                    dumps(lessons),
                    dumps(archived_ids),
                    compression["removed_noise"],
                    compression["confidence"],
                    compression["created_at"],
                ),
            )
        compression["base_compression"] = base
        return compression

    def latest(self) -> dict[str, Any] | None:
        with self.store.connect(self.store.files.memories) as conn:
            row = conn.execute(
                "SELECT * FROM cognitive_compressions ORDER BY created_at DESC LIMIT 1"
            ).fetchone()
        if not row:
            return None
        data = dict(row)
        for field in ("decisions", "user_patterns", "lessons", "archived_memory_ids"):
            data[field] = loads(data.get(field), [])
        return data

    def _active_memories(self, max_rows: int) -> list[dict[str, Any]]:
        with self.store.connect(self.store.files.memories) as conn:
            rows = conn.execute(
                """
                SELECT memory_id, category, content, importance_score, confidence, usage_count, updated_at
                FROM long_term_memories
                WHERE archived = 0
                ORDER BY importance_score DESC, usage_count DESC, updated_at DESC
                LIMIT ?
                """,
                (max(1, min(max_rows, 500)),),
            ).fetchall()
        return [dict(row) for row in rows]

    def _recent_session_lines(self, max_rows: int) -> list[dict[str, Any]]:
        with self.store.connect(self.store.files.memories) as conn:
            rows = conn.execute(
                """
                SELECT id AS memory_id, 'session' AS category, conversation AS content,
                       context_score AS importance_score, context_score AS confidence,
                       0 AS usage_count, timestamp AS updated_at
                FROM short_term_memory
                ORDER BY timestamp DESC
                LIMIT ?
                """,
                (max(1, min(max_rows, 100)),),
            ).fetchall()
        return [dict(row) for row in rows]

    def _extract_matching(self, rows: list[dict[str, Any]], pattern: re.Pattern[str], limit: int) -> list[str]:
        seen: set[str] = set()
        results: list[str] = []
        for row in rows:
            content = str(row.get("content", "")).strip()
            if not content or not pattern.search(content):
                continue
            normalized = re.sub(r"\s+", " ", content)
            if normalized.lower() in seen:
                continue
            seen.add(normalized.lower())
            results.append(normalized[:260])
            if len(results) >= limit:
                break
        return results

    def _extract_user_patterns(self, rows: list[dict[str, Any]], limit: int) -> list[str]:
        preferred_categories = {"user_preferences", "personal_context", "learned_patterns", "successful_workflows"}
        patterns: list[str] = []
        seen: set[str] = set()
        for row in rows:
            category = str(row.get("category", ""))
            content = str(row.get("content", "")).strip()
            if category not in preferred_categories or not content:
                continue
            normalized = re.sub(r"\s+", " ", content)
            key = normalized.lower()
            if key in seen:
                continue
            seen.add(key)
            patterns.append(normalized[:260])
            if len(patterns) >= limit:
                break
        return patterns

    def _archive_low_signal(self, rows: list[dict[str, Any]]) -> list[str]:
        archived: list[str] = []
        now = utc_now()
        with self.store.connect(self.store.files.memories) as conn:
            for row in rows:
                content = str(row.get("content", "")).strip()
                confidence = float(row.get("confidence", 0.0))
                importance = float(row.get("importance_score", 0.0))
                if confidence >= 0.35 or importance >= 0.35 or len(content) >= 12:
                    continue
                memory_id = str(row["memory_id"])
                conn.execute(
                    "UPDATE long_term_memories SET archived = 1, updated_at = ? WHERE memory_id = ?",
                    (now, memory_id),
                )
                archived.append(memory_id)
        return archived

    def _summary(self, decisions: list[str], user_patterns: list[str], lessons: list[str]) -> str:
        parts = []
        if decisions:
            parts.append(f"{len(decisions)} decisions")
        if user_patterns:
            parts.append(f"{len(user_patterns)} user patterns")
        if lessons:
            parts.append(f"{len(lessons)} lessons")
        return "Compressed " + ", ".join(parts) if parts else "No high-signal memory found for compression"

    def _confidence(self, decisions: list[str], user_patterns: list[str], lessons: list[str]) -> float:
        signal = min(1.0, (len(decisions) * 0.08) + (len(user_patterns) * 0.1) + (len(lessons) * 0.07))
        return round(max(0.35, signal), 3)
