from __future__ import annotations

from typing import Any
from uuid import uuid4

from ..database.store import CognitiveStore, dumps, loads, stable_fingerprint, utc_now


class FailureAnalysisEngine:
    def __init__(self, store: CognitiveStore) -> None:
        self.store = store

    def recent_failures(self, limit: int = 10) -> list[dict[str, Any]]:
        with self.store.connect(self.store.files.experiences) as conn:
            rows = conn.execute(
                """
                SELECT * FROM experiences
                WHERE reward < 0.55 OR errors != '[]'
                ORDER BY created_at DESC
                LIMIT ?
                """,
                (max(1, min(limit, 50)),),
            ).fetchall()
        failures = []
        for row in rows:
            data = dict(row)
            data["errors"] = loads(data.get("errors"), [])
            data["tools_used"] = loads(data.get("tools_used"), [])
            failures.append(data)
        return failures

    def record_lesson(
        self,
        task: str,
        failure: str,
        cause: str,
        fix: str,
        confidence: float = 0.7,
        source: str = "experience",
    ) -> dict[str, Any]:
        if not task.strip() or not failure.strip() or not fix.strip():
            raise ValueError("Failure lesson requires task, failure, and fix")
        fingerprint = stable_fingerprint(f"{task}:{failure}:{cause}:{fix}")
        now = utc_now()
        bounded_confidence = max(0.0, min(1.0, confidence))
        with self.store.connect(self.store.files.experiences) as conn:
            existing = conn.execute(
                "SELECT * FROM failure_lessons WHERE fingerprint = ?",
                (fingerprint,),
            ).fetchone()
            if existing:
                conn.execute(
                    """
                    UPDATE failure_lessons
                    SET confidence = MAX(confidence, ?), updated_at = ?, status = 'active'
                    WHERE fingerprint = ?
                    """,
                    (bounded_confidence, now, fingerprint),
                )
            else:
                conn.execute(
                    """
                    INSERT INTO failure_lessons(
                        id, task, failure, cause, fix, confidence, source,
                        status, fingerprint, created_at, updated_at
                    )
                    VALUES (?, ?, ?, ?, ?, ?, ?, 'active', ?, ?, ?)
                    """,
                    (
                        f"failure_{uuid4().hex}",
                        task,
                        failure,
                        cause,
                        fix,
                        bounded_confidence,
                        source,
                        fingerprint,
                        now,
                        now,
                    ),
                )
            row = conn.execute("SELECT * FROM failure_lessons WHERE fingerprint = ?", (fingerprint,)).fetchone()
        return dict(row)

    def learned_lessons(self, limit: int = 10) -> list[dict[str, Any]]:
        with self.store.connect(self.store.files.experiences) as conn:
            rows = conn.execute(
                """
                SELECT * FROM failure_lessons
                WHERE status = 'active'
                ORDER BY confidence DESC, updated_at DESC
                LIMIT ?
                """,
                (max(1, min(limit, 50)),),
            ).fetchall()
        return [dict(row) for row in rows]

    def recommendations(self, limit: int = 10) -> dict[str, Any]:
        failures = self.recent_failures(limit)
        recommendations: list[str] = []
        if any("timeout" in " ".join(item["errors"]).lower() for item in failures):
            recommendations.append("Add timeout-aware retry and cached fallback paths.")
        if any("validation" in " ".join(item["errors"]).lower() for item in failures):
            recommendations.append("Promote validation earlier in the workflow.")
        if any("browser" in item.get("tools_used", []) for item in failures):
            recommendations.append("Run browser preflight focus and permission checks.")
        return {
            "failures": failures,
            "learned_lessons": self.learned_lessons(limit),
            "recommendations": recommendations,
        }
