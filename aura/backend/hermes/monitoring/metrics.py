from __future__ import annotations

from collections import defaultdict
from time import perf_counter
from typing import Any


class HermesMetrics:
    def __init__(self) -> None:
        self.counters: dict[str, int] = defaultdict(int)
        self.timings: dict[str, list[float]] = defaultdict(list)

    def increment(self, name: str, amount: int = 1) -> None:
        self.counters[name] += amount

    def observe(self, name: str, seconds: float) -> None:
        self.timings[name].append(max(0.0, seconds))

    def snapshot(self) -> dict[str, Any]:
        timing_summary = {}
        for name, values in self.timings.items():
            timing_summary[name] = {
                "count": len(values),
                "avg": round(sum(values) / len(values), 6) if values else 0,
                "max": round(max(values), 6) if values else 0,
            }
        return {"counters": dict(self.counters), "timings": timing_summary}

    def time_block(self, name: str):
        metrics = self

        class Timer:
            def __enter__(self):
                self.start = perf_counter()
                return self

            def __exit__(self, exc_type, exc, tb):
                metrics.observe(name, perf_counter() - self.start)

        return Timer()
