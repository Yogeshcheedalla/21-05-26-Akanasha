from __future__ import annotations

from typing import Any

from .orchestrator import HermesCognitiveOS


DEFAULT_SIMULATION_TASKS = [
    "remember that I prefer Telugu plus English voice replies",
    "generate a PDF and Excel report with tables also validate the output",
    "research latest AI news, generate PDF, Excel, PPT, validate sources, test links, and prepare summary",
    "open browser and submit the payment form after filling my details",
    "debug the voice assistant, run tests, fix the issue, and summarize the patch",
]


class HermesSimulator:
    def __init__(self, os: HermesCognitiveOS | None = None) -> None:
        self.os = os or HermesCognitiveOS()

    def run(self, tasks: list[str] | None = None, approved: bool = False) -> list[dict[str, Any]]:
        results: list[dict[str, Any]] = []
        for task in tasks or DEFAULT_SIMULATION_TASKS:
            result = self.os.process_task(task, approved=approved)
            plan = result["plan"]
            results.append(
                {
                    "task": task,
                    "analysis": result["analysis"],
                    "intent": plan["understanding"]["intent"],
                    "risk": plan["risk_level"],
                    "priority": plan["understanding"]["priority"],
                    "complexity_score": result["analysis"]["complexity_score"],
                    "hiring_plan": result["hiring_plan"],
                    "persistent_core_agents": [agent["agent_name"] for agent in result["persistent_core_agents"]],
                    "temporary_workers": [worker["agent_name"] for worker in result["temporary_workers"]],
                    "skill_routes": result["skill_routes"],
                    "safety": result["safety"],
                    "resource_allocation": result["resource_allocation"],
                    "efficiency": result["expected_efficiency"],
                    "merge_confidence": result["result_merge"]["confidence"],
                    "validation": result["validation"],
                    "final_output": result["final_output"],
                }
            )
        return results
