"""Akansha/Hermes cognitive operating system.

This package is intentionally isolated from the existing chat and voice paths.
It provides explicit APIs for memory, learning, skill versioning, agent hiring,
planning, reflection, and safety validation without mutating stable workflows.
"""

from .orchestrator import HermesCognitiveOS

__all__ = ["HermesCognitiveOS"]
