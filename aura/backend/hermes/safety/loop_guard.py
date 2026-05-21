from __future__ import annotations

from collections import defaultdict
from time import time


class LoopGuard:
    def __init__(self, max_iterations: int = 5, window_seconds: int = 120) -> None:
        self.max_iterations = max_iterations
        self.window_seconds = window_seconds
        self._events: dict[str, list[float]] = defaultdict(list)

    def check(self, loop_key: str) -> bool:
        now = time()
        events = [value for value in self._events[loop_key] if now - value <= self.window_seconds]
        events.append(now)
        self._events[loop_key] = events
        return len(events) <= self.max_iterations
