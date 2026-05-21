from __future__ import annotations

from typing import Any
from uuid import uuid4

from ..database.store import CognitiveStore, dumps, loads, stable_fingerprint, utc_now
from .skill_registry import SkillRegistry


class SkillMarketplace:
    """Governed install/update/remove layer for dynamic skills."""

    def __init__(self, store: CognitiveStore) -> None:
        self.store = store
        self.registry = SkillRegistry(store)

    def install(self, manifest: dict[str, Any]) -> dict[str, Any]:
        self._validate_manifest(manifest)
        latest_package = self._latest_package(manifest["name"])
        if latest_package and latest_package["status"] == "installed":
            return {"installed": False, "reason": "already_installed", "package": latest_package}

        skill = self.registry.create_version(
            name=manifest["name"],
            description=manifest["description"],
            trigger_conditions=list(manifest["trigger_conditions"]),
            required_tools=list(manifest["required_tools"]),
            execution_steps=list(manifest["execution_steps"]),
            examples=list(manifest.get("examples", [])),
            confidence=float(manifest["confidence"]),
            success_rate=float(manifest.get("success_rate", manifest["confidence"])),
            reward_score=float(manifest["reward_score"]),
            status="draft",
        )
        package = self._create_package(manifest, skill["id"], "installed")
        self._event(package["id"], skill["id"], "installed", package["version"], {"name": manifest["name"]})
        return {"installed": True, "package": package, "skill": skill}

    def update(self, name: str, manifest: dict[str, Any]) -> dict[str, Any]:
        self._validate_manifest({**manifest, "name": name})
        previous = self._latest_package(name)
        if not previous:
            raise ValueError(f"Package not installed: {name}")
        skill = self.registry.create_version(
            name=name,
            description=manifest["description"],
            trigger_conditions=list(manifest["trigger_conditions"]),
            required_tools=list(manifest["required_tools"]),
            execution_steps=list(manifest["execution_steps"]),
            examples=list(manifest.get("examples", [])),
            confidence=float(manifest["confidence"]),
            success_rate=float(manifest.get("success_rate", manifest["confidence"])),
            reward_score=float(manifest["reward_score"]),
            status="draft",
        )
        package = self._create_package({**manifest, "name": name}, skill["id"], "installed", previous["id"])
        self._event(package["id"], skill["id"], "updated", package["version"], {"rollback_id": previous["id"]})
        return {"updated": True, "package": package, "skill": skill, "rollback_package": previous}

    def remove(self, name: str) -> dict[str, Any]:
        package = self._latest_package(name)
        if not package:
            return {"removed": False, "reason": "not_installed"}
        now = utc_now()
        with self.store.connect(self.store.files.skills) as conn:
            conn.execute(
                "UPDATE skill_marketplace SET status = 'removed', updated_at = ? WHERE id = ?",
                (now, package["id"]),
            )
        self._event(package["id"], package.get("skill_id"), "removed", package["version"], {"name": name})
        removed = self._get_package(package["id"])
        return {"removed": True, "package": removed}

    def list_packages(self, status: str | None = None, limit: int = 50) -> list[dict[str, Any]]:
        query = "SELECT * FROM skill_marketplace"
        params: list[Any] = []
        if status:
            query += " WHERE status = ?"
            params.append(status)
        query += " ORDER BY updated_at DESC LIMIT ?"
        params.append(max(1, min(limit, 200)))
        with self.store.connect(self.store.files.skills) as conn:
            rows = conn.execute(query, tuple(params)).fetchall()
        return [self._decode(row) for row in rows]

    def _create_package(
        self,
        manifest: dict[str, Any],
        skill_id: str,
        status: str,
        rollback_id: str | None = None,
    ) -> dict[str, Any]:
        previous = self._latest_package(manifest["name"])
        version = int(previous["version"]) + 1 if previous else 1
        now = utc_now()
        package_id = f"package_{uuid4().hex}"
        fingerprint = stable_fingerprint(f"{manifest['name']}:{version}")
        with self.store.connect(self.store.files.skills) as conn:
            conn.execute(
                """
                INSERT INTO skill_marketplace(
                    id, name, description, version, status, skill_id,
                    manifest, rollback_id, fingerprint, created_at, updated_at
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    package_id,
                    manifest["name"],
                    manifest["description"],
                    version,
                    status,
                    skill_id,
                    dumps(manifest),
                    rollback_id,
                    fingerprint,
                    now,
                    now,
                ),
            )
        return self._get_package(package_id) or {"id": package_id}

    def _latest_package(self, name: str) -> dict[str, Any] | None:
        with self.store.connect(self.store.files.skills) as conn:
            row = conn.execute(
                "SELECT * FROM skill_marketplace WHERE name = ? ORDER BY version DESC LIMIT 1",
                (name,),
            ).fetchone()
        return self._decode(row) if row else None

    def _get_package(self, package_id: str) -> dict[str, Any] | None:
        with self.store.connect(self.store.files.skills) as conn:
            row = conn.execute("SELECT * FROM skill_marketplace WHERE id = ?", (package_id,)).fetchone()
        return self._decode(row) if row else None

    def _event(self, package_id: str | None, skill_id: str | None, action: str, version: int | None, payload: dict[str, Any]) -> None:
        with self.store.connect(self.store.files.skills) as conn:
            conn.execute(
                """
                INSERT INTO marketplace_events(package_id, skill_id, action, version, payload, created_at)
                VALUES (?, ?, ?, ?, ?, ?)
                """,
                (package_id, skill_id, action, version, dumps(payload), utc_now()),
            )

    def _validate_manifest(self, manifest: dict[str, Any]) -> None:
        required = ["name", "description", "trigger_conditions", "required_tools", "execution_steps", "confidence", "reward_score"]
        missing = [field for field in required if field not in manifest]
        if missing:
            raise ValueError(f"Skill manifest missing: {', '.join(missing)}")
        if float(manifest["confidence"]) < 0.85 or float(manifest["reward_score"]) < 0.8:
            raise ValueError("Marketplace skill requires confidence >= 0.85 and reward_score >= 0.80")
        if not manifest["trigger_conditions"] or not manifest["execution_steps"]:
            raise ValueError("Skill manifest requires triggers and execution steps")

    def _decode(self, row: Any) -> dict[str, Any]:
        data = dict(row)
        data["manifest"] = loads(data.get("manifest"), {})
        return data
