from __future__ import annotations

from typing import Any

from .agent_factory import AGENT_TYPES


class DynamicHiringEngine:
    """Computes bounded specialized-agent plans from task complexity."""

    def recommended_army_size(self, complexity_score: float) -> int:
        if complexity_score < 30:
            return 2
        if complexity_score < 60:
            return 5
        if complexity_score < 90:
            return 8
        return 10

    def recommended_temporary_workers(self, complexity_score: float) -> int:
        if complexity_score < 30:
            return 0
        if complexity_score < 60:
            return 2
        if complexity_score < 90:
            return 4
        return 6

    def select_agent_types(self, intent: str, tools: list[str], dependencies: list[str]) -> list[str]:
        selected = ["PlanningAgent", "QualityAgent"]
        selected.extend(agent for agent in dependencies if agent in AGENT_TYPES)
        if intent == "live_research":
            selected.extend(["ResearchAgent", "AnalysisAgent"])
        if intent == "artifact_generation":
            selected.extend(["FileAgent", "DataAgent"])
        if intent == "coding":
            selected.extend(["CodingAgent", "TestingAgent", "SecurityAgent"])
        if "browser_automation" in tools:
            selected.extend(["BrowserAgent", "AutomationAgent", "SecurityAgent"])
        if "desktop_control" in tools:
            selected.extend(["AutomationAgent", "SecurityAgent"])
        return list(dict.fromkeys(selected))[:10]

    def hiring_plan(self, analysis: dict[str, Any]) -> dict[str, Any]:
        agent_types = self.select_agent_types(
            analysis["intent"],
            analysis["tools"],
            analysis["dependencies"],
        )
        return {
            "complexity_score": analysis["complexity_score"],
            "persistent_army_size": min(self.recommended_army_size(analysis["complexity_score"]), len(agent_types)),
            "temporary_worker_count": self.recommended_temporary_workers(analysis["complexity_score"]),
            "agent_types": agent_types,
            "policy": "bounded_no_recursive_spawning",
        }
