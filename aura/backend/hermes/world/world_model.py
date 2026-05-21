from __future__ import annotations

import re
from typing import Any
from uuid import uuid4

from ..database.store import CognitiveStore, dumps, loads, stable_fingerprint, utc_now


class WorldModelEngine:
    """Maintains Akansha's durable graph of users, goals, projects, and habits."""

    NODE_TYPES = {"user", "project", "goal", "relationship", "behavior", "deadline", "preference"}

    def __init__(self, store: CognitiveStore) -> None:
        self.store = store

    def upsert_node(self, node_type: str, name: str, attributes: dict[str, Any] | None = None, confidence: float = 0.7) -> dict[str, Any]:
        if node_type not in self.NODE_TYPES:
            raise ValueError(f"Unsupported world node type: {node_type}")
        if not name.strip():
            raise ValueError("World node name cannot be empty")
        fingerprint = stable_fingerprint(f"{node_type}:{name}")
        now = utc_now()
        attributes = attributes or {}
        with self.store.connect(self.store.files.agents) as conn:
            existing = conn.execute("SELECT * FROM world_nodes WHERE fingerprint = ?", (fingerprint,)).fetchone()
            if existing:
                merged = loads(existing["attributes"], {})
                merged.update(attributes)
                conn.execute(
                    """
                    UPDATE world_nodes
                    SET attributes = ?, confidence = MAX(confidence, ?), updated_at = ?
                    WHERE fingerprint = ?
                    """,
                    (dumps(merged), max(0.0, min(1.0, confidence)), now, fingerprint),
                )
            else:
                conn.execute(
                    """
                    INSERT INTO world_nodes(
                        id, node_type, name, attributes, confidence, fingerprint, created_at, updated_at
                    )
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        f"world_{uuid4().hex}",
                        node_type,
                        name.strip(),
                        dumps(attributes),
                        max(0.0, min(1.0, confidence)),
                        fingerprint,
                        now,
                        now,
                    ),
                )
        return self.get_node_by_fingerprint(fingerprint) or {"node_type": node_type, "name": name}

    def add_edge(
        self,
        source_id: str,
        target_id: str,
        relationship: str,
        attributes: dict[str, Any] | None = None,
        confidence: float = 0.7,
    ) -> dict[str, Any]:
        if not source_id or not target_id or not relationship.strip():
            raise ValueError("World edge requires source, target, and relationship")
        fingerprint = stable_fingerprint(f"{source_id}:{relationship}:{target_id}")
        now = utc_now()
        attributes = attributes or {}
        with self.store.connect(self.store.files.agents) as conn:
            existing = conn.execute("SELECT * FROM world_edges WHERE fingerprint = ?", (fingerprint,)).fetchone()
            if existing:
                merged = loads(existing["attributes"], {})
                merged.update(attributes)
                conn.execute(
                    """
                    UPDATE world_edges
                    SET attributes = ?, confidence = MAX(confidence, ?), updated_at = ?
                    WHERE fingerprint = ?
                    """,
                    (dumps(merged), max(0.0, min(1.0, confidence)), now, fingerprint),
                )
            else:
                conn.execute(
                    """
                    INSERT INTO world_edges(
                        id, source_id, target_id, relationship, attributes,
                        confidence, fingerprint, created_at, updated_at
                    )
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        f"edge_{uuid4().hex}",
                        source_id,
                        target_id,
                        relationship.strip(),
                        dumps(attributes),
                        max(0.0, min(1.0, confidence)),
                        fingerprint,
                        now,
                        now,
                    ),
                )
        return self.get_edge_by_fingerprint(fingerprint) or {"relationship": relationship}

    def observe_task(self, task: str, owner_name: str = "Yogesh") -> dict[str, Any]:
        owner = self.upsert_node("user", owner_name, {"role": "owner"}, 0.95)
        lowered = task.lower()
        created = [owner]
        if "deadline" in lowered or re.search(r"\btomorrow|today|exam|due\b", lowered):
            deadline = self.upsert_node("deadline", self._compact_name(task, "deadline"), {"source": task}, 0.72)
            self.add_edge(owner["id"], deadline["id"], "has_deadline", {"source": "task_observation"}, 0.72)
            created.append(deadline)
        if re.search(r"\bproject|repo|github|deploy|build\b", lowered):
            project = self.upsert_node("project", self._compact_name(task, "project"), {"source": task}, 0.7)
            self.add_edge(owner["id"], project["id"], "works_on", {"source": "task_observation"}, 0.7)
            created.append(project)
        if re.search(r"\bprefer|always|language|telugu|hindi|english\b", lowered):
            preference = self.upsert_node("preference", self._compact_name(task, "preference"), {"source": task}, 0.76)
            self.add_edge(owner["id"], preference["id"], "prefers", {"source": "task_observation"}, 0.76)
            created.append(preference)
        return {"observed_nodes": created, "graph": self.graph(limit=50)}

    def graph(self, limit: int = 100) -> dict[str, Any]:
        bounded = max(1, min(limit, 500))
        with self.store.connect(self.store.files.agents) as conn:
            nodes = conn.execute("SELECT * FROM world_nodes ORDER BY updated_at DESC LIMIT ?", (bounded,)).fetchall()
            edges = conn.execute("SELECT * FROM world_edges ORDER BY updated_at DESC LIMIT ?", (bounded,)).fetchall()
        return {
            "nodes": [self._decode_node(row) for row in nodes],
            "edges": [self._decode_edge(row) for row in edges],
        }

    def get_node_by_fingerprint(self, fingerprint: str) -> dict[str, Any] | None:
        with self.store.connect(self.store.files.agents) as conn:
            row = conn.execute("SELECT * FROM world_nodes WHERE fingerprint = ?", (fingerprint,)).fetchone()
        return self._decode_node(row) if row else None

    def get_edge_by_fingerprint(self, fingerprint: str) -> dict[str, Any] | None:
        with self.store.connect(self.store.files.agents) as conn:
            row = conn.execute("SELECT * FROM world_edges WHERE fingerprint = ?", (fingerprint,)).fetchone()
        return self._decode_edge(row) if row else None

    def _compact_name(self, task: str, fallback: str) -> str:
        words = re.findall(r"[A-Za-z0-9+#.]+", task)
        return " ".join(words[:10]) if words else fallback

    def _decode_node(self, row: Any) -> dict[str, Any]:
        data = dict(row)
        data["attributes"] = loads(data.get("attributes"), {})
        return data

    def _decode_edge(self, row: Any) -> dict[str, Any]:
        data = dict(row)
        data["attributes"] = loads(data.get("attributes"), {})
        return data
