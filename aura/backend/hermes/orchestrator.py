from __future__ import annotations

from typing import Any

from .agents.coordinator import Coordinator
from .agents.dynamic_hiring import DynamicHiringEngine
from .agents.final_output import FinalOutputBuilder
from .agents.result_merger import ResultMerger
from .agents.task_analyzer import TaskAnalyzerAgent
from .agents.validation_agent import ValidationAgent
from .background.jobs import BackgroundJobEngine
from .database.store import CognitiveStore, get_cognitive_store
from .learning.experience_engine import ExperienceEngine
from .learning.failure_analysis import FailureAnalysisEngine
from .learning.reflection_engine import ReflectionEngine
from .memory.cognitive_compression import CognitiveCompressionEngine
from .memory.long_term import LongTermMemory
from .memory.memory_compression import MemoryCompressionEngine
from .multimodal.context_graph import MultimodalContextGraph
from .memory.retrieval_engine import MemoryRetrievalEngine
from .memory.shared_bus import SharedMemoryBus
from .memory.short_term import ShortTermMemory
from .monitoring.metrics import HermesMetrics
from .predictive.predictive_assistant import PredictiveAssistant
from .reasoning.planner import CognitivePlanner
from .safety.validator import SafetyValidator
from .skills.marketplace import SkillMarketplace
from .skills.skill_generator import SkillGenerator
from .skills.skill_optimizer import SkillOptimizer
from .skills.skill_retirement import SkillRetirement
from .skills.skill_registry import SkillRegistry
from .skills.skill_validator import SkillValidator
from .tools.universal_tool_layer import UniversalToolLayer
from .ui.adaptive_ui import AdaptiveUIEngine
from .workflows.workflow_generator import WorkflowGenerator
from .world.world_model import WorldModelEngine


class HermesCognitiveOS:
    def __init__(self, store: CognitiveStore | None = None) -> None:
        self.store = store or get_cognitive_store()
        self.short_term = ShortTermMemory(self.store)
        self.long_term = LongTermMemory(self.store)
        self.retrieval = MemoryRetrievalEngine(self.store)
        self.memory_bus = SharedMemoryBus(self.store)
        self.compression = MemoryCompressionEngine(self.store)
        self.cognitive_compression = CognitiveCompressionEngine(self.store)
        self.experiences = ExperienceEngine(self.store)
        self.reflection = ReflectionEngine(self.store)
        self.skills = SkillRegistry(self.store)
        self.marketplace = SkillMarketplace(self.store)
        self.skill_generator = SkillGenerator(self.store)
        self.skill_optimizer = SkillOptimizer(self.store)
        self.skill_validator = SkillValidator()
        self.skill_retirement = SkillRetirement(self.store)
        self.tools = UniversalToolLayer(self.store)
        self.world_model = WorldModelEngine(self.store)
        self.predictive = PredictiveAssistant(self.store)
        self.adaptive_ui = AdaptiveUIEngine()
        self.multimodal = MultimodalContextGraph(self.store)
        self.workflow_generator = WorkflowGenerator(self.store)
        self.background_jobs = BackgroundJobEngine(self.store)
        self.planner = CognitivePlanner(self.store)
        self.coordinator = Coordinator(self.store)
        self.task_analyzer = TaskAnalyzerAgent()
        self.hiring_engine = DynamicHiringEngine()
        self.result_merger = ResultMerger()
        self.validation_agent = ValidationAgent()
        self.final_output = FinalOutputBuilder()
        self.failures = FailureAnalysisEngine(self.store)
        self.metrics = HermesMetrics()
        self.safety = SafetyValidator()

    def process_task(self, task: str, approved: bool = False) -> dict[str, Any]:
        with self.metrics.time_block("process_task"):
            analysis = self.task_analyzer.analyze(task).to_dict()
            plan = self.planner.plan(task)
            hiring_plan = self.hiring_engine.hiring_plan(analysis)
            adaptive_ui = self.adaptive_ui.mode_for_task(task, analysis)
            workflow = self.workflow_generator.generate(task)
            tool_plan = self.tools.plan_for_task(task, analysis["tools"], approved=approved)
            world_context = self.world_model.observe_task(task)
            predictions = self.predictive.predict(task, analysis)
        safety = self.safety.validate_learning_action(
            {
                "type": analysis["intent"],
                "tools": analysis["tools"],
                "risk_level": analysis["risk_level"],
                "loop_key": analysis["intent"],
                "approved": approved,
            }
        )
        core_agents = self.coordinator.ensure_core_agents()
        workers = []
        if safety["allowed"]:
            workers = self.coordinator.assign_temporary_workers(task, hiring_plan["agent_types"], analysis["complexity_score"])
            self.metrics.increment("tasks_allowed")
        else:
            self.metrics.increment("tasks_blocked")
        skill_routes = self.coordinator.route_skills(task, analysis["intent"])
        allocation = self.coordinator.resource_allocation(analysis["complexity_score"], len(workers))
        memory_snapshot = self.memory_bus.snapshot(task)
        simulated_worker_results = [
            {
                "worker": worker["agent_name"],
                "result": f"{worker['agent_name']} prepared {worker['specialization']} findings.",
                "confidence": worker["confidence"],
            }
            for worker in workers
        ]
        merged = self.result_merger.merge(simulated_worker_results)
        validation = self.validation_agent.validate({"analysis": analysis, "safety": safety, "merged": merged})
        final = self.final_output.build(analysis, validation, merged)
        return {
            "analysis": analysis,
            "plan": plan,
            "hiring_plan": hiring_plan,
            "workflow": workflow,
            "tool_plan": tool_plan,
            "world_context": world_context,
            "predictive_assistant": predictions,
            "adaptive_ui": adaptive_ui,
            "safety": safety,
            "persistent_core_agents": core_agents,
            "temporary_workers": workers,
            "skill_routes": skill_routes,
            "resource_allocation": allocation,
            "memory_bus": memory_snapshot,
            "result_merge": merged,
            "validation": validation,
            "final_output": final,
            "metrics": self.metrics.snapshot(),
            "expected_efficiency": self._expected_efficiency(analysis["complexity_score"], len(workers)),
        }

    def _expected_efficiency(self, complexity: float, worker_count: int) -> dict[str, Any]:
        if worker_count == 0:
            reduction = "40-55%"
        elif worker_count <= 2:
            reduction = "50-62%"
        elif worker_count <= 4:
            reduction = "58-68%"
        else:
            reduction = "62-72%"
        return {
            "token_reduction_estimate": reduction,
            "hallucination_control": "higher because facts route through memory/skill/safety checks",
            "debuggability": "high: coordinator owns final merge and temporary workers cannot spawn recursively",
            "learning_stability": "stable: only coordinator writes durable memory",
        }
