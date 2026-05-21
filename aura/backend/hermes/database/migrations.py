from __future__ import annotations

from .store import CognitiveStore


def migrate() -> dict:
    """Initialize or upgrade Hermes cognitive databases."""
    store = CognitiveStore()
    store.initialize()
    return {
        "status": "ok",
        "databases": {
            "memories": str(store.files.memories),
            "skills": str(store.files.skills),
            "experiences": str(store.files.experiences),
            "agents": str(store.files.agents),
        },
    }


if __name__ == "__main__":
    print(migrate())
