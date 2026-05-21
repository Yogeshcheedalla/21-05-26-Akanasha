from __future__ import annotations

import asyncio
import logging
from dataclasses import dataclass

from .reflection_engine import ReflectionEngine
from ..database.store import CognitiveStore
from ..memory.memory_compression import MemoryCompressionEngine


logger = logging.getLogger("akansha.hermes.loop")


@dataclass
class LearningLoopConfig:
    interval_seconds: int = 300
    max_cycles: int = 1


class ContinuousLearningLoop:
    """Bounded maintenance loop; never runs forever inside request handlers."""

    def __init__(self, store: CognitiveStore, config: LearningLoopConfig | None = None) -> None:
        self.store = store
        self.config = config or LearningLoopConfig()
        self.compression = MemoryCompressionEngine(store)
        self.reflection = ReflectionEngine(store)
        self._running = False

    async def run_once(self) -> dict:
        compression = self.compression.compress()
        return {"memory_compression": compression}

    async def run_bounded(self) -> list[dict]:
        if self._running:
            return [{"skipped": "loop_already_running"}]
        self._running = True
        results: list[dict] = []
        try:
            for _ in range(max(1, min(self.config.max_cycles, 5))):
                results.append(await self.run_once())
                if self.config.max_cycles > 1:
                    await asyncio.sleep(max(1, min(self.config.interval_seconds, 3600)))
        finally:
            self._running = False
        return results
