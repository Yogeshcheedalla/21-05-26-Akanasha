from __future__ import annotations

from typing import Any

from .long_term import LongTermMemory
from .memory_compression import MemoryCompressionEngine
from .retrieval_engine import MemoryRetrievalEngine
from .short_term import ShortTermMemory
from ..database.store import CognitiveStore


class SharedMemoryBus:
    """Single memory interface for persistent agents.

    Temporary workers do not write here directly; they report to the
    CoordinatorAgent, which decides what is safe and valuable enough to store.
    """

    channels = [
        "session_memory",
        "long_term_memory",
        "vector_memory",
        "episodic_memory",
        "tool_history",
        "skill_history",
        "user_profile",
    ]

    def __init__(self, store: CognitiveStore) -> None:
        self.short_term = ShortTermMemory(store)
        self.long_term = LongTermMemory(store)
        self.retrieval = MemoryRetrievalEngine(store)
        self.compression = MemoryCompressionEngine(store)

    def snapshot(self, query: str, session_id: str = "default") -> dict[str, Any]:
        return {
            "channels": self.channels,
            "recent_session": self.short_term.recent(session_id, limit=5),
            "recalled": self.retrieval.recall(query, limit=10),
        }
