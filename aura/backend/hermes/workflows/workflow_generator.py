from __future__ import annotations

from typing import Any
from uuid import uuid4

from ..agents.dynamic_hiring import DynamicHiringEngine
from ..agents.task_analyzer import TaskAnalyzerAgent
from ..database.store import CognitiveStore, dumps, loads, stable_fingerprint, utc_now


class WorkflowGenerator:
    """Builds auditable workflow chains from user intent."""

    def __init__(self, store: CognitiveStore) -> None:
        self.store = store
        self.analyzer = TaskAnalyzerAgent()
        self.hiring = DynamicHiringEngine()

    def generate(self, task: str) -> dict[str, Any]:
        analysis = self.analyzer.analyze(task).to_dict()
        hiring_plan = self.hiring.hiring_plan(analysis)
        steps = self._steps(task, analysis, hiring_plan)
        name = self._name(task, analysis["intent"])
        fingerprint = stable_fingerprint(f"{name}:{analysis['intent']}:{'|'.join(steps)}")
        now = utc_now()
        with self.store.connect(self.store.files.agents) as conn:
            existing = conn.execute("SELECT * FROM workflow_templates WHERE fingerprint = ?", (fingerprint,)).fetchone()
            if existing:
                return self._decode(existing, analysis, hiring_plan, deduplicated=True)
            workflow_id = f"workflow_{uuid4().hex}"
            conn.execute(
                """
                INSERT INTO workflow_templates(
                    id, name, intent, steps, required_tools, agent_types,
                    risk_level, confidence, fingerprint, created_at, updated_at
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    workflow_id,
                    name,
                    analysis["intent"],
                    dumps(steps),
                    dumps(analysis["tools"]),
                    dumps(hiring_plan["agent_types"]),
                    analysis["risk_level"],
                    self._confidence(analysis),
                    fingerprint,
                    now,
                    now,
                ),
            )
            row = conn.execute("SELECT * FROM workflow_templates WHERE id = ?", (workflow_id,)).fetchone()
        return self._decode(row, analysis, hiring_plan) if row else {"id": workflow_id}

    def _steps(self, task: str, analysis: dict[str, Any], hiring_plan: dict[str, Any]) -> list[str]:
        steps = ["Understand user goal and constraints"]
        if analysis["intent"] == "live_research":
            steps.extend(["Fetch live sources", "Cross-check source timestamp", "Extract answer with citations"])
        elif analysis["intent"] == "artifact_generation":
            steps.extend(["Plan artifact structure", "Generate content", "Write file", "Verify file opens"])
        elif analysis["intent"] == "coding":
            steps.extend(["Inspect repository", "Patch scoped files", "Run targeted tests", "Summarize changes"])
        elif analysis["intent"] == "automation":
            steps.extend(["Validate permission", "Plan desktop/browser action", "Execute only approved steps", "Confirm result"])
        else:
            steps.append("Answer conversationally with memory-aware context")
        if hiring_plan["temporary_worker_count"]:
            steps.append(f"Spawn {hiring_plan['temporary_worker_count']} isolated temporary workers")
        steps.extend(["Run validation agent", "Record experience and lessons"])
        return steps

    def _name(self, task: str, intent: str) -> str:
        words = [word for word in task.replace("/", " ").split() if word.strip()]
        return f"{intent.title()} Workflow: {' '.join(words[:8])}"[:120]

    def _confidence(self, analysis: dict[str, Any]) -> float:
        uncertainty = float(analysis.get("uncertainty_score", 0.5))
        return round(max(0.45, min(0.92, 1.0 - (uncertainty * 0.45))), 3)

    def _decode(
        self,
        row: Any,
        analysis: dict[str, Any],
        hiring_plan: dict[str, Any],
        deduplicated: bool = False,
    ) -> dict[str, Any]:
        data = dict(row)
        data["steps"] = loads(data.get("steps"), [])
        data["required_tools"] = loads(data.get("required_tools"), [])
        data["agent_types"] = loads(data.get("agent_types"), [])
        data["analysis"] = analysis
        data["hiring_plan"] = hiring_plan
        data["deduplicated"] = deduplicated
        return data
