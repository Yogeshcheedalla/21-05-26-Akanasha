from __future__ import annotations

from datetime import datetime, timezone
from typing import Any
from uuid import uuid4

from ..database.store import CognitiveStore, dumps, loads, utc_now


class BackgroundJobEngine:
    """Bounded autonomous job registry for reminders, monitors, and alerts."""

    SUPPORTED_KINDS = {"monitor", "scheduled_task", "alert", "update", "reminder"}

    def __init__(self, store: CognitiveStore) -> None:
        self.store = store

    def schedule(
        self,
        name: str,
        kind: str,
        payload: dict[str, Any],
        schedule: dict[str, Any],
        next_run_at: str | None = None,
        max_runs: int = 1,
    ) -> dict[str, Any]:
        if kind not in self.SUPPORTED_KINDS:
            raise ValueError(f"Unsupported job kind: {kind}")
        if not name.strip():
            raise ValueError("Job name cannot be empty")
        now = utc_now()
        job_id = f"job_{uuid4().hex}"
        with self.store.connect(self.store.files.agents) as conn:
            conn.execute(
                """
                INSERT INTO background_jobs(
                    id, name, kind, payload, schedule, next_run_at,
                    last_run_at, status, run_count, max_runs, created_at, updated_at
                )
                VALUES (?, ?, ?, ?, ?, ?, NULL, 'active', 0, ?, ?, ?)
                """,
                (
                    job_id,
                    name.strip(),
                    kind,
                    dumps(payload),
                    dumps(schedule),
                    next_run_at or now,
                    max(1, min(max_runs, 100)),
                    now,
                    now,
                ),
            )
        return self.get(job_id) or {"id": job_id}

    def list_jobs(self, status: str | None = None, limit: int = 50) -> list[dict[str, Any]]:
        query = "SELECT * FROM background_jobs"
        params: list[Any] = []
        if status:
            query += " WHERE status = ?"
            params.append(status)
        query += " ORDER BY updated_at DESC LIMIT ?"
        params.append(max(1, min(limit, 200)))
        with self.store.connect(self.store.files.agents) as conn:
            rows = conn.execute(query, tuple(params)).fetchall()
        return [self._decode(row) for row in rows]

    def run_due(self, now: str | None = None, limit: int = 10) -> dict[str, Any]:
        now_value = now or utc_now()
        self._validate_iso(now_value)
        with self.store.connect(self.store.files.agents) as conn:
            rows = conn.execute(
                """
                SELECT * FROM background_jobs
                WHERE status = 'active' AND next_run_at IS NOT NULL AND next_run_at <= ?
                ORDER BY next_run_at ASC
                LIMIT ?
                """,
                (now_value, max(1, min(limit, 25))),
            ).fetchall()
            executed: list[dict[str, Any]] = []
            for row in rows:
                job = self._decode(row)
                run_count = int(job["run_count"]) + 1
                status = "completed" if run_count >= int(job["max_runs"]) else "active"
                conn.execute(
                    """
                    UPDATE background_jobs
                    SET last_run_at = ?, next_run_at = NULL, status = ?, run_count = ?, updated_at = ?
                    WHERE id = ?
                    """,
                    (now_value, status, run_count, now_value, job["id"]),
                )
                executed.append(
                    {
                        "id": job["id"],
                        "name": job["name"],
                        "kind": job["kind"],
                        "status": status,
                        "result": "queued_for_safe_orchestrator_execution",
                    }
                )
        return {"executed": executed, "timestamp": now_value}

    def get(self, job_id: str) -> dict[str, Any] | None:
        with self.store.connect(self.store.files.agents) as conn:
            row = conn.execute("SELECT * FROM background_jobs WHERE id = ?", (job_id,)).fetchone()
        return self._decode(row) if row else None

    def _decode(self, row: Any) -> dict[str, Any]:
        data = dict(row)
        data["payload"] = loads(data.get("payload"), {})
        data["schedule"] = loads(data.get("schedule"), {})
        return data

    def _validate_iso(self, value: str) -> None:
        try:
            datetime.fromisoformat(value.replace("Z", "+00:00"))
        except ValueError as exc:
            raise ValueError(f"Invalid ISO timestamp: {value}") from exc
