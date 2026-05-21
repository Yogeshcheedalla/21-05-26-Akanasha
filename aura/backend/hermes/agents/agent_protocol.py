from __future__ import annotations

from dataclasses import dataclass, asdict


@dataclass(frozen=True)
class AgentMessage:
    sender: str
    receiver: str
    task: str
    status: str
    result: str
    confidence: float

    def to_dict(self) -> dict:
        data = asdict(self)
        data["confidence"] = max(0.0, min(1.0, self.confidence))
        return data
