from __future__ import annotations

from typing import Any
from uuid import uuid4

from ..database.store import CognitiveStore, dumps, loads, stable_fingerprint, utc_now


class SkillRegistry:
    def __init__(self, store: CognitiveStore) -> None:
        self.store = store

    def latest(self, name: str) -> dict[str, Any] | None:
        with self.store.connect(self.store.files.skills) as conn:
            row = conn.execute(
                "SELECT * FROM skills WHERE name = ? ORDER BY version DESC LIMIT 1",
                (name,),
            ).fetchone()
        return self._decode(row) if row else None

    def create_version(
        self,
        name: str,
        description: str,
        trigger_conditions: list[str],
        required_tools: list[str],
        execution_steps: list[str],
        examples: list[str],
        confidence: float,
        success_rate: float,
        reward_score: float,
        status: str = "draft",
    ) -> dict[str, Any]:
        if not name.strip():
            raise ValueError("Skill name cannot be empty")
        fingerprint = stable_fingerprint(name)
        latest = self.latest(name)
        version = int(latest["version"]) + 1 if latest else 1
        parent_id = latest["id"] if latest else None
        rollback_id = latest["id"] if latest and latest.get("status") == "stable" else parent_id
        skill_id = f"skill_{uuid4().hex}"
        now = utc_now()
        with self.store.connect(self.store.files.skills) as conn:
            conn.execute(
                """
                INSERT INTO skills(
                    id, name, description, trigger_conditions, required_tools,
                    execution_steps, examples, confidence, version, success_rate,
                    usage_count, reward_score, status, parent_id, rollback_id,
                    fingerprint, created_at, updated_at
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    skill_id,
                    name,
                    description,
                    dumps(trigger_conditions),
                    dumps(required_tools),
                    dumps(execution_steps),
                    dumps(examples),
                    max(0.0, min(1.0, confidence)),
                    version,
                    max(0.0, min(1.0, success_rate)),
                    max(0.0, min(1.0, reward_score)),
                    status,
                    parent_id,
                    rollback_id,
                    fingerprint,
                    now,
                    now,
                ),
            )
            conn.execute(
                "INSERT INTO skill_events(skill_id, event_type, payload, created_at) VALUES (?, ?, ?, ?)",
                (skill_id, "created", dumps({"version": version, "status": status}), now),
            )
        return self.latest(name) or {"id": skill_id, "name": name, "version": version}

    def promote(self, skill_id: str) -> dict[str, Any]:
        with self.store.connect(self.store.files.skills) as conn:
            row = conn.execute("SELECT * FROM skills WHERE id = ?", (skill_id,)).fetchone()
            if not row:
                raise ValueError(f"Skill not found: {skill_id}")
            if float(row["confidence"]) < 0.85 or float(row["reward_score"]) < 0.80:
                raise ValueError("Skill promotion requires confidence >= 0.85 and reward_score >= 0.80")
            now = utc_now()
            conn.execute("UPDATE skills SET status = 'stable', updated_at = ? WHERE id = ?", (now, skill_id))
            conn.execute(
                "INSERT INTO skill_events(skill_id, event_type, payload, created_at) VALUES (?, ?, ?, ?)",
                (skill_id, "promoted", dumps({"status": "stable"}), now),
            )
        return self.get(skill_id)

    def rollback_target(self, skill_id: str) -> dict[str, Any] | None:
        skill = self.get(skill_id)
        rollback_id = skill.get("rollback_id")
        return self.get(rollback_id) if rollback_id else None

    def get(self, skill_id: str | None) -> dict[str, Any] | None:
        if not skill_id:
            return None
        with self.store.connect(self.store.files.skills) as conn:
            row = conn.execute("SELECT * FROM skills WHERE id = ?", (skill_id,)).fetchone()
        return self._decode(row) if row else None

    def search(self, query: str, limit: int = 10) -> list[dict[str, Any]]:
        needle = f"%{query.lower()}%"
        with self.store.connect(self.store.files.skills) as conn:
            rows = conn.execute(
                """
                SELECT * FROM skills
                WHERE lower(name) LIKE ? OR lower(description) LIKE ?
                ORDER BY status = 'stable' DESC, reward_score DESC, success_rate DESC
                LIMIT ?
                """,
                (needle, needle, max(1, min(limit, 50))),
            ).fetchall()
        return [self._decode(row) for row in rows]

    def _decode(self, row: Any) -> dict[str, Any]:
        data = dict(row)
        for field in ("trigger_conditions", "required_tools", "execution_steps", "examples"):
            data[field] = loads(data.get(field), [])
        return data
