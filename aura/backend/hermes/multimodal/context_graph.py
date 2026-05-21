from __future__ import annotations

from typing import Any
from uuid import uuid4

from ..database.store import CognitiveStore, dumps, loads, stable_fingerprint, utc_now


SUPPORTED_MODALITIES = {"text", "voice", "image", "video", "pdf", "web", "screenshot", "document", "audio", "spreadsheet"}


class MultimodalContextGraph:
    """Stores all input modalities as one shared, auditable context graph."""

    def __init__(self, store: CognitiveStore) -> None:
        self.store = store

    def ingest(
        self,
        session_id: str,
        modality: str,
        content_ref: str,
        summary: str,
        metadata: dict[str, Any] | None = None,
        confidence: float = 0.7,
    ) -> dict[str, Any]:
        if modality not in SUPPORTED_MODALITIES:
            raise ValueError(f"Unsupported modality: {modality}")
        if not content_ref.strip() and not summary.strip():
            raise ValueError("Context item requires content_ref or summary")
        metadata = metadata or {}
        fingerprint = stable_fingerprint(f"{session_id}:{modality}:{content_ref}:{summary}")
        now = utc_now()
        context_id = f"context_{uuid4().hex}"
        with self.store.connect(self.store.files.agents) as conn:
            existing = conn.execute("SELECT * FROM multimodal_contexts WHERE fingerprint = ?", (fingerprint,)).fetchone()
            if existing:
                return self._decode(existing, deduplicated=True)
            conn.execute(
                """
                INSERT INTO multimodal_contexts(
                    id, session_id, modality, content_ref, summary,
                    metadata, confidence, fingerprint, created_at
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    context_id,
                    session_id,
                    modality,
                    content_ref,
                    summary,
                    dumps(metadata),
                    max(0.0, min(1.0, confidence)),
                    fingerprint,
                    now,
                ),
            )
        return self.get(context_id) or {"id": context_id}

    def session_context(self, session_id: str, limit: int = 20) -> dict[str, Any]:
        with self.store.connect(self.store.files.agents) as conn:
            rows = conn.execute(
                """
                SELECT * FROM multimodal_contexts
                WHERE session_id = ?
                ORDER BY created_at DESC
                LIMIT ?
                """,
                (session_id, max(1, min(limit, 100))),
            ).fetchall()
        items = [self._decode(row) for row in rows]
        modalities = sorted({item["modality"] for item in items})
        return {
            "session_id": session_id,
            "modalities": modalities,
            "items": items,
            "combined_summary": self._combined_summary(items),
        }

    def get(self, context_id: str) -> dict[str, Any] | None:
        with self.store.connect(self.store.files.agents) as conn:
            row = conn.execute("SELECT * FROM multimodal_contexts WHERE id = ?", (context_id,)).fetchone()
        return self._decode(row) if row else None

    def _combined_summary(self, items: list[dict[str, Any]]) -> str:
        if not items:
            return ""
        fragments = [f"{item['modality']}: {item['summary']}" for item in items[:8] if item.get("summary")]
        return " | ".join(fragments)

    def _decode(self, row: Any, deduplicated: bool = False) -> dict[str, Any]:
        data = dict(row)
        data["metadata"] = loads(data.get("metadata"), {})
        data["deduplicated"] = deduplicated
        return data
