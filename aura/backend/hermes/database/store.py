from __future__ import annotations

import json
import math
import re
import sqlite3
from collections import Counter
from contextlib import contextmanager
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from threading import RLock
from typing import Any, Iterator


DATABASE_DIR = Path(__file__).resolve().parent
MEMORIES_DB = DATABASE_DIR / "memories.db"
SKILLS_DB = DATABASE_DIR / "skills.db"
EXPERIENCES_DB = DATABASE_DIR / "experiences.db"
AGENTS_DB = DATABASE_DIR / "agents.db"


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def normalize_text(value: str) -> str:
    return re.sub(r"\s+", " ", value.strip().lower())


def stable_fingerprint(value: str) -> str:
    normalized = re.sub(r"[^a-z0-9]+", " ", normalize_text(value))
    return " ".join(normalized.split()[:80])


def token_embedding(value: str) -> dict[str, float]:
    tokens = re.findall(r"[a-zA-Z0-9_]+", value.lower())
    counts = Counter(tokens)
    total = math.sqrt(sum(weight * weight for weight in counts.values())) or 1.0
    return {token: round(weight / total, 6) for token, weight in counts.items()}


def cosine_similarity(left: dict[str, float], right: dict[str, float]) -> float:
    if not left or not right:
        return 0.0
    keys = set(left) & set(right)
    return max(0.0, min(1.0, sum(left[key] * right[key] for key in keys)))


def dumps(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False, sort_keys=True)


def loads(value: str | None, fallback: Any = None) -> Any:
    if value is None:
        return fallback
    try:
        return json.loads(value)
    except Exception:
        return fallback


@dataclass(frozen=True)
class DatabaseFiles:
    memories: Path = MEMORIES_DB
    skills: Path = SKILLS_DB
    experiences: Path = EXPERIENCES_DB
    agents: Path = AGENTS_DB


class CognitiveStore:
    """Small, durable SQLite store split by domain for rollback and safety.

    The store uses standard-library sqlite3 to keep the cognitive layer portable
    and independent from the existing Akansha application database.
    """

    def __init__(self, files: DatabaseFiles | None = None) -> None:
        self.files = files or DatabaseFiles()
        self._lock = RLock()
        DATABASE_DIR.mkdir(parents=True, exist_ok=True)
        self.initialize()

    @contextmanager
    def connect(self, db_path: Path) -> Iterator[sqlite3.Connection]:
        with self._lock:
            conn = sqlite3.connect(db_path)
            conn.row_factory = sqlite3.Row
            conn.execute("PRAGMA journal_mode=WAL")
            conn.execute("PRAGMA foreign_keys=ON")
            try:
                yield conn
                conn.commit()
            finally:
                conn.close()

    def initialize(self) -> None:
        self._init_memories()
        self._init_skills()
        self._init_experiences()
        self._init_agents()
        self._init_operating_system()

    def _init_memories(self) -> None:
        with self.connect(self.files.memories) as conn:
            conn.executescript(
                """
                CREATE TABLE IF NOT EXISTS long_term_memories (
                    memory_id TEXT PRIMARY KEY,
                    category TEXT NOT NULL,
                    content TEXT NOT NULL,
                    importance_score REAL NOT NULL,
                    usage_count INTEGER NOT NULL DEFAULT 0,
                    last_accessed TEXT,
                    source TEXT NOT NULL,
                    confidence REAL NOT NULL,
                    embedding TEXT NOT NULL,
                    fingerprint TEXT NOT NULL UNIQUE,
                    archived INTEGER NOT NULL DEFAULT 0,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL
                );
                CREATE TABLE IF NOT EXISTS short_term_memory (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    session_id TEXT NOT NULL,
                    timestamp TEXT NOT NULL,
                    conversation TEXT NOT NULL,
                    tool_usage TEXT NOT NULL,
                    context_score REAL NOT NULL
                );
                CREATE INDEX IF NOT EXISTS idx_ltm_category ON long_term_memories(category);
                CREATE INDEX IF NOT EXISTS idx_stm_session ON short_term_memory(session_id, timestamp);
                CREATE TABLE IF NOT EXISTS cognitive_compressions (
                    id TEXT PRIMARY KEY,
                    summary TEXT NOT NULL,
                    decisions TEXT NOT NULL,
                    user_patterns TEXT NOT NULL,
                    lessons TEXT NOT NULL,
                    archived_memory_ids TEXT NOT NULL,
                    removed_noise INTEGER NOT NULL DEFAULT 0,
                    confidence REAL NOT NULL,
                    created_at TEXT NOT NULL
                );
                """
            )

    def _init_skills(self) -> None:
        with self.connect(self.files.skills) as conn:
            conn.executescript(
                """
                CREATE TABLE IF NOT EXISTS skills (
                    id TEXT PRIMARY KEY,
                    name TEXT NOT NULL,
                    description TEXT NOT NULL,
                    trigger_conditions TEXT NOT NULL,
                    required_tools TEXT NOT NULL,
                    execution_steps TEXT NOT NULL,
                    examples TEXT NOT NULL,
                    confidence REAL NOT NULL,
                    version INTEGER NOT NULL,
                    success_rate REAL NOT NULL,
                    usage_count INTEGER NOT NULL DEFAULT 0,
                    reward_score REAL NOT NULL,
                    status TEXT NOT NULL DEFAULT 'draft',
                    parent_id TEXT,
                    rollback_id TEXT,
                    fingerprint TEXT NOT NULL,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL,
                    UNIQUE(name, version)
                );
                CREATE TABLE IF NOT EXISTS skill_events (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    skill_id TEXT NOT NULL,
                    event_type TEXT NOT NULL,
                    payload TEXT NOT NULL,
                    created_at TEXT NOT NULL
                );
                CREATE TABLE IF NOT EXISTS skill_marketplace (
                    id TEXT PRIMARY KEY,
                    name TEXT NOT NULL,
                    description TEXT NOT NULL,
                    version INTEGER NOT NULL,
                    status TEXT NOT NULL,
                    skill_id TEXT,
                    manifest TEXT NOT NULL,
                    rollback_id TEXT,
                    fingerprint TEXT NOT NULL,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL,
                    UNIQUE(name, version)
                );
                CREATE TABLE IF NOT EXISTS marketplace_events (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    package_id TEXT,
                    skill_id TEXT,
                    action TEXT NOT NULL,
                    version INTEGER,
                    payload TEXT NOT NULL,
                    created_at TEXT NOT NULL
                );
                CREATE INDEX IF NOT EXISTS idx_skill_name ON skills(name);
                CREATE INDEX IF NOT EXISTS idx_skill_fingerprint ON skills(fingerprint);
                CREATE INDEX IF NOT EXISTS idx_skill_marketplace_name ON skill_marketplace(name);
                """
            )

    def _init_experiences(self) -> None:
        with self.connect(self.files.experiences) as conn:
            conn.executescript(
                """
                CREATE TABLE IF NOT EXISTS experiences (
                    id TEXT PRIMARY KEY,
                    task TEXT NOT NULL,
                    goal TEXT NOT NULL,
                    actions_taken TEXT NOT NULL,
                    tools_used TEXT NOT NULL,
                    agents_used TEXT NOT NULL,
                    errors TEXT NOT NULL,
                    successful_steps TEXT NOT NULL,
                    time_taken REAL NOT NULL,
                    feedback TEXT NOT NULL,
                    score REAL NOT NULL,
                    reward REAL NOT NULL,
                    created_at TEXT NOT NULL
                );
                CREATE TABLE IF NOT EXISTS reflections (
                    id TEXT PRIMARY KEY,
                    experience_id TEXT NOT NULL,
                    worked TEXT NOT NULL,
                    failed TEXT NOT NULL,
                    lessons TEXT NOT NULL,
                    candidate_skill TEXT,
                    confidence REAL NOT NULL,
                    created_at TEXT NOT NULL
                );
                CREATE TABLE IF NOT EXISTS failure_lessons (
                    id TEXT PRIMARY KEY,
                    task TEXT NOT NULL,
                    failure TEXT NOT NULL,
                    cause TEXT NOT NULL,
                    fix TEXT NOT NULL,
                    confidence REAL NOT NULL,
                    source TEXT NOT NULL,
                    status TEXT NOT NULL DEFAULT 'active',
                    fingerprint TEXT NOT NULL UNIQUE,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL
                );
                CREATE INDEX IF NOT EXISTS idx_experience_task ON experiences(task);
                CREATE INDEX IF NOT EXISTS idx_failure_lessons_task ON failure_lessons(task);
                """
            )

    def _init_agents(self) -> None:
        with self.connect(self.files.agents) as conn:
            conn.executescript(
                """
                CREATE TABLE IF NOT EXISTS agents (
                    id TEXT PRIMARY KEY,
                    agent_name TEXT NOT NULL UNIQUE,
                    specialization TEXT NOT NULL,
                    goals TEXT NOT NULL,
                    tools TEXT NOT NULL,
                    memory_scope TEXT NOT NULL,
                    communication_protocol TEXT NOT NULL,
                    status TEXT NOT NULL,
                    confidence REAL NOT NULL,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL,
                    last_active TEXT NOT NULL
                );
                CREATE TABLE IF NOT EXISTS agent_messages (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    sender TEXT NOT NULL,
                    receiver TEXT NOT NULL,
                    task TEXT NOT NULL,
                    status TEXT NOT NULL,
                    result TEXT NOT NULL,
                    confidence REAL NOT NULL,
                    created_at TEXT NOT NULL
                );
                CREATE TABLE IF NOT EXISTS plans (
                    id TEXT PRIMARY KEY,
                    task TEXT NOT NULL,
                    decomposition TEXT NOT NULL,
                    risk_level TEXT NOT NULL,
                    required_agents TEXT NOT NULL,
                    confidence REAL NOT NULL,
                    created_at TEXT NOT NULL
                );
                """
            )

    def _init_operating_system(self) -> None:
        with self.connect(self.files.agents) as conn:
            conn.executescript(
                """
                CREATE TABLE IF NOT EXISTS tool_registry (
                    id TEXT PRIMARY KEY,
                    name TEXT NOT NULL,
                    kind TEXT NOT NULL,
                    capabilities TEXT NOT NULL,
                    requires_approval INTEGER NOT NULL DEFAULT 0,
                    risk_level TEXT NOT NULL,
                    enabled INTEGER NOT NULL DEFAULT 1,
                    fingerprint TEXT NOT NULL UNIQUE,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL
                );
                CREATE TABLE IF NOT EXISTS world_nodes (
                    id TEXT PRIMARY KEY,
                    node_type TEXT NOT NULL,
                    name TEXT NOT NULL,
                    attributes TEXT NOT NULL,
                    confidence REAL NOT NULL,
                    fingerprint TEXT NOT NULL UNIQUE,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL
                );
                CREATE TABLE IF NOT EXISTS world_edges (
                    id TEXT PRIMARY KEY,
                    source_id TEXT NOT NULL,
                    target_id TEXT NOT NULL,
                    relationship TEXT NOT NULL,
                    attributes TEXT NOT NULL,
                    confidence REAL NOT NULL,
                    fingerprint TEXT NOT NULL UNIQUE,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL
                );
                CREATE TABLE IF NOT EXISTS workflow_templates (
                    id TEXT PRIMARY KEY,
                    name TEXT NOT NULL,
                    intent TEXT NOT NULL,
                    steps TEXT NOT NULL,
                    required_tools TEXT NOT NULL,
                    agent_types TEXT NOT NULL,
                    risk_level TEXT NOT NULL,
                    confidence REAL NOT NULL,
                    fingerprint TEXT NOT NULL UNIQUE,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL
                );
                CREATE TABLE IF NOT EXISTS background_jobs (
                    id TEXT PRIMARY KEY,
                    name TEXT NOT NULL,
                    kind TEXT NOT NULL,
                    payload TEXT NOT NULL,
                    schedule TEXT NOT NULL,
                    next_run_at TEXT,
                    last_run_at TEXT,
                    status TEXT NOT NULL,
                    run_count INTEGER NOT NULL DEFAULT 0,
                    max_runs INTEGER NOT NULL DEFAULT 1,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL
                );
                CREATE TABLE IF NOT EXISTS multimodal_contexts (
                    id TEXT PRIMARY KEY,
                    session_id TEXT NOT NULL,
                    modality TEXT NOT NULL,
                    content_ref TEXT NOT NULL,
                    summary TEXT NOT NULL,
                    metadata TEXT NOT NULL,
                    confidence REAL NOT NULL,
                    fingerprint TEXT NOT NULL UNIQUE,
                    created_at TEXT NOT NULL
                );
                CREATE INDEX IF NOT EXISTS idx_tool_registry_kind ON tool_registry(kind);
                CREATE INDEX IF NOT EXISTS idx_world_nodes_type ON world_nodes(node_type);
                CREATE INDEX IF NOT EXISTS idx_world_edges_source ON world_edges(source_id);
                CREATE INDEX IF NOT EXISTS idx_workflow_intent ON workflow_templates(intent);
                CREATE INDEX IF NOT EXISTS idx_background_jobs_due ON background_jobs(status, next_run_at);
                CREATE INDEX IF NOT EXISTS idx_multimodal_session ON multimodal_contexts(session_id, created_at);
                """
            )


_store: CognitiveStore | None = None


def get_cognitive_store() -> CognitiveStore:
    global _store
    if _store is None:
        _store = CognitiveStore()
    return _store
