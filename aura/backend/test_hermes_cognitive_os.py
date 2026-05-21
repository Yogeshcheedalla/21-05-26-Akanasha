import tempfile
import unittest
from pathlib import Path

from backend.hermes.agents.agent_factory import AgentFactory
from backend.hermes.database.store import CognitiveStore, DatabaseFiles
from backend.hermes.learning.experience_engine import ExperienceEngine
from backend.hermes.learning.reflection_engine import ReflectionEngine
from backend.hermes.memory.long_term import LongTermMemory
from backend.hermes.memory.retrieval_engine import MemoryRetrievalEngine
from backend.hermes.orchestrator import HermesCognitiveOS
from backend.hermes.safety.validator import SafetyValidator
from backend.hermes.simulator import HermesSimulator
from backend.hermes.agents.task_analyzer import TaskAnalyzerAgent
from backend.hermes.agents.dynamic_hiring import DynamicHiringEngine
from backend.hermes.agents.result_merger import ResultMerger
from backend.hermes.agents.validation_agent import ValidationAgent
from backend.hermes.background.jobs import BackgroundJobEngine
from backend.hermes.memory.cognitive_compression import CognitiveCompressionEngine
from backend.hermes.multimodal.context_graph import MultimodalContextGraph
from backend.hermes.predictive.predictive_assistant import PredictiveAssistant
from backend.hermes.skills.marketplace import SkillMarketplace
from backend.hermes.skills.skill_generator import SkillGenerator
from backend.hermes.skills.skill_registry import SkillRegistry
from backend.hermes.skills.skill_retirement import SkillRetirement
from backend.hermes.skills.skill_validator import SkillValidator
from backend.hermes.tools.universal_tool_layer import ToolSpec, UniversalToolLayer
from backend.hermes.ui.adaptive_ui import AdaptiveUIEngine
from backend.hermes.workflows.workflow_generator import WorkflowGenerator
from backend.hermes.world.world_model import WorldModelEngine


class HermesCognitiveOSTests(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        root = Path(self.temp_dir.name)
        self.store = CognitiveStore(
            DatabaseFiles(
                memories=root / "memories.db",
                skills=root / "skills.db",
                experiences=root / "experiences.db",
                agents=root / "agents.db",
            )
        )

    def tearDown(self):
        self.temp_dir.cleanup()

    def test_memory_deduplication_and_weighted_recall(self):
        memory = LongTermMemory(self.store)
        first = memory.upsert(
            "user_preferences",
            "Yogesh prefers Telugu plus English replies for voice conversations.",
            0.9,
            "user",
            0.95,
        )
        second = memory.upsert(
            "user_preferences",
            "Yogesh prefers Telugu plus English replies for voice conversations.",
            0.6,
            "user",
            0.8,
        )

        recalled = MemoryRetrievalEngine(self.store).recall("voice language Telugu English", limit=10)

        self.assertFalse(first["deduplicated"])
        self.assertTrue(second["deduplicated"])
        self.assertEqual(len(recalled), 1)
        self.assertGreater(recalled[0]["recall_score"], 0.5)

    def test_experience_reflection_and_skill_generation_require_three_successes(self):
        experiences = ExperienceEngine(self.store)
        reflection = ReflectionEngine(self.store)
        generator = SkillGenerator(self.store)

        for index in range(3):
            recorded = experiences.record(
                {
                    "task": "pdf creator workflow",
                    "goal": f"Create validated PDF report {index}",
                    "actions_taken": ["parse intent", "generate content", "write pdf"],
                    "tools_used": ["artifact_generation", "pdf_writer"],
                    "successful_steps": ["Detected PDF intent", "Generated content", "Created file"],
                    "errors": [],
                    "score": 0.92,
                    "task_success": True,
                    "speed_score": 0.9,
                    "user_feedback": 0.9,
                    "tool_efficiency": 0.88,
                }
            )
            result = reflection.reflect(recorded["experience_id"])
            self.assertIn("candidate", " ".join(result["lessons"]).lower())

        skill = generator.generate_from_repetitions("pdf creator workflow")

        self.assertIsNotNone(skill)
        assert skill is not None
        self.assertEqual(skill["version"], 1)
        self.assertGreaterEqual(skill["confidence"], 0.85)
        self.assertIn("artifact_generation", skill["required_tools"])

    def test_skill_promotion_requires_confidence_and_keeps_rollback(self):
        registry = SkillRegistry(self.store)
        draft = registry.create_version(
            name="ResearchSkill",
            description="Validated research workflow.",
            trigger_conditions=["research request"],
            required_tools=["web_search"],
            execution_steps=["search primary sources", "cite results"],
            examples=["latest AI news"],
            confidence=0.9,
            success_rate=0.9,
            reward_score=0.88,
        )
        stable = registry.promote(draft["id"])
        improved = registry.create_version(
            name="ResearchSkill",
            description="Validated research workflow with faster source ranking.",
            trigger_conditions=["research request"],
            required_tools=["web_search"],
            execution_steps=["rank primary sources", "cite results"],
            examples=["latest AI news"],
            confidence=0.91,
            success_rate=0.92,
            reward_score=0.9,
        )

        self.assertEqual(stable["status"], "stable")
        self.assertEqual(improved["version"], 2)
        self.assertEqual(registry.rollback_target(improved["id"])["id"], stable["id"])

    def test_agent_factory_prevents_duplicates_and_caps_persistent_core(self):
        factory = AgentFactory(self.store)
        first = factory.hire("ResearchAgent:test", "ResearchAgent", ["research"], ["web_search"])
        duplicate = factory.hire("ResearchAgent:test", "ResearchAgent", ["research"], ["web_search"])

        self.assertEqual(first["id"], duplicate["id"])

        factory.retire_inactive("2999-01-01T00:00:00+00:00")
        core = factory.ensure_persistent_core()
        self.assertEqual(len(core), 9)
        self.assertEqual({agent["status"] for agent in core}, {"active"})
        factory.hire("CreativeAgent:last-slot", "CreativeAgent", ["goal"], [])

        with self.assertRaises(ValueError):
            factory.hire("CreativeAgent:overflow", "CreativeAgent", ["goal"], [])

    def test_coordinator_uses_temporary_worker_thresholds(self):
        os = HermesCognitiveOS(self.store)

        simple = os.process_task("remember this preference for Telugu replies")
        medium = os.process_task("generate a PDF and Excel report with tables also validate the output")
        complex_task = os.process_task(
            "research latest AI news, generate PDF, Excel, PPT, validate sources, test links, and prepare summary",
            approved=True,
        )
        coding = os.process_task("debug the voice assistant, run tests, fix the issue, and summarize the patch")

        self.assertEqual(len(simple["temporary_workers"]), 0)
        self.assertIn(len(medium["temporary_workers"]), {2, 4})
        self.assertGreaterEqual(len(complex_task["temporary_workers"]), 4)
        self.assertLessEqual(len(complex_task["temporary_workers"]), 6)
        self.assertTrue(all(worker["memory_scope"] == "isolated_temporary" for worker in complex_task["temporary_workers"]))
        self.assertTrue(all(worker["communication_protocol"]["can_spawn_workers"] is False for worker in complex_task["temporary_workers"]))
        self.assertEqual(len(complex_task["persistent_core_agents"]), 9)
        self.assertIn("shared_memory_bus", {agent["memory_scope"] for agent in complex_task["persistent_core_agents"]})
        self.assertEqual(coding["analysis"]["intent"], "coding")
        self.assertIn("AutonomousDebugSkill", coding["skill_routes"])
        self.assertIn("final_output", complex_task)
        self.assertIn("hiring_plan", complex_task)
        self.assertIn("metrics", complex_task)

    def test_task_analyzer_dynamic_hiring_merger_and_validation_pipeline(self):
        analysis = TaskAnalyzerAgent().analyze(
            "research latest AI news, generate PDF, Excel, PPT, validate sources, test links, and prepare summary"
        ).to_dict()
        hiring = DynamicHiringEngine().hiring_plan(analysis)
        merged = ResultMerger().merge(
            [
                {"result": "ResearchWorker verified primary sources.", "confidence": 0.84},
                {"result": "AnalysisWorker prepared export structure.", "confidence": 0.8},
            ]
        )
        validation = ValidationAgent().validate(
            {"analysis": analysis, "safety": {"allowed": True}, "merged": merged}
        )

        self.assertEqual(analysis["intent"], "live_research")
        self.assertGreaterEqual(hiring["temporary_worker_count"], 4)
        self.assertIn("ResearchAgent", hiring["agent_types"])
        self.assertEqual(merged["status"], "merged")
        self.assertTrue(validation["valid"])

    def test_skill_validation_and_retirement(self):
        registry = SkillRegistry(self.store)
        skill = registry.create_version(
            name="WeakDraftSkill",
            description="Draft skill for retirement test.",
            trigger_conditions=["weak draft"],
            required_tools=["tool"],
            execution_steps=["step"],
            examples=["example"],
            confidence=0.8,
            success_rate=0.2,
            reward_score=0.7,
        )
        validation = SkillValidator().validate(skill)
        retirement = SkillRetirement(self.store).retire_low_performers(min_success_rate=0.35, min_usage=0)
        retired = registry.get(skill["id"])

        self.assertTrue(validation["valid"])
        self.assertGreaterEqual(retirement["retired"], 1)
        self.assertEqual(retired["status"], "retired")

    def test_safety_blocks_sensitive_learning_without_approval(self):
        validator = SafetyValidator()

        blocked = validator.validate_learning_action(
            {"type": "automation", "tools": ["desktop_control"], "risk_level": "high", "loop_key": "desktop"}
        )
        allowed = validator.validate_learning_action(
            {
                "type": "automation",
                "tools": ["desktop_control"],
                "risk_level": "high",
                "loop_key": "desktop-approved",
                "approved": True,
            }
        )

        self.assertFalse(blocked["allowed"])
        self.assertTrue(blocked["requires_approval"])
        self.assertTrue(allowed["allowed"])

    def test_orchestrator_plans_without_spawning_unapproved_sensitive_agents(self):
        os = HermesCognitiveOS(self.store)

        result = os.process_task("open browser and submit the form on the website", approved=False)
        approved = os.process_task("open browser and submit the form on the website", approved=True)

        self.assertEqual(result["plan"]["risk_level"], "critical")
        self.assertFalse(result["safety"]["allowed"])
        self.assertEqual(result["temporary_workers"], [])
        self.assertTrue(approved["safety"]["allowed"])
        self.assertLessEqual(len(approved["temporary_workers"]), 6)
        self.assertEqual(len(approved["persistent_core_agents"]), 9)

    def test_simulator_returns_inspectable_cognitive_routing(self):
        os = HermesCognitiveOS(self.store)
        results = HermesSimulator(os).run(
            [
                "remember my Telugu reply preference",
                "research latest AI news, generate PDF, Excel, PPT, validate sources, test links, and prepare summary",
            ],
            approved=True,
        )

        self.assertEqual(results[0]["intent"], "conversation")
        self.assertEqual(results[0]["temporary_workers"], [])
        self.assertIn("Core:ResearchAgent", results[1]["persistent_core_agents"])
        self.assertGreaterEqual(len(results[1]["temporary_workers"]), 2)
        self.assertIn("DeepResearchSkill", results[1]["skill_routes"])
        self.assertIn("token_reduction_estimate", results[1]["efficiency"])
        self.assertIn("final_output", results[1])
        self.assertIn("hiring_plan", results[1])

    def test_cognitive_compression_extracts_patterns_decisions_and_lessons(self):
        memory = LongTermMemory(self.store)
        memory.upsert(
            "user_preferences",
            "Yogesh prefers Telugu plus English replies and should never be asked identity repeatedly.",
            0.95,
            "user",
            0.92,
        )
        memory.upsert(
            "failures",
            "PDF generation failed because only an outline was written; fix by verifying page count.",
            0.8,
            "experience",
            0.82,
        )

        result = CognitiveCompressionEngine(self.store).compress_context()
        latest = CognitiveCompressionEngine(self.store).latest()

        self.assertIn("decisions", result)
        self.assertTrue(any("Telugu" in item for item in result["user_patterns"]))
        self.assertTrue(any("failed" in item.lower() for item in result["lessons"]))
        self.assertIsNotNone(latest)
        assert latest is not None
        self.assertEqual(latest["id"], result["id"])

    def test_universal_tool_layer_blocks_sensitive_tools_without_approval(self):
        tools = UniversalToolLayer(self.store)
        tools.register_tool(ToolSpec("Desktop Control", "desktop", ["window_control"], True, "critical"))

        blocked = tools.plan_for_task("open browser and submit the form", ["desktop_control"], approved=False)
        approved = tools.plan_for_task("open browser and submit the form", ["desktop_control"], approved=True)

        self.assertTrue(blocked["approval_required"])
        self.assertEqual(blocked["selected_tools"], [])
        self.assertTrue(any(item["kind"] == "desktop" for item in approved["selected_tools"]))

    def test_world_model_and_predictive_assistant_use_failure_lessons(self):
        world = WorldModelEngine(self.store)
        owner = world.upsert_node("user", "Yogesh", {"role": "owner"}, 0.95)
        project = world.upsert_node("project", "Akansha Hermes", {"stack": "FastAPI"}, 0.85)
        edge = world.add_edge(owner["id"], project["id"], "works_on", {}, 0.9)
        lesson = HermesCognitiveOS(self.store).failures.record_lesson(
            "deploy GitHub app",
            "deployment failed",
            "missing env variables",
            "validate env variables before deploy",
            0.88,
        )

        prediction = PredictiveAssistant(self.store).predict("deploy the GitHub app to production")
        graph = world.graph()

        self.assertEqual(edge["relationship"], "works_on")
        self.assertEqual(lesson["status"], "active")
        self.assertTrue(any("environment variables" in item["message"] for item in prediction["suggestions"]))
        self.assertGreaterEqual(len(graph["nodes"]), 2)

    def test_adaptive_ui_modes_are_task_aware(self):
        engine = AdaptiveUIEngine()

        self.assertEqual(engine.mode_for_task("debug the repo and run tests")["mode"], "coding")
        self.assertEqual(engine.mode_for_task("voice avatar lip sync is broken")["mode"], "voice")
        self.assertEqual(engine.mode_for_task("latest market report with charts")["mode"], "research")
        self.assertIn("primary_panels", engine.mode_for_task("create a business invoice report"))

    def test_multimodal_context_graph_deduplicates_and_combines_session_context(self):
        graph = MultimodalContextGraph(self.store)
        first = graph.ingest("s1", "screenshot", "clipboard://shot1", "Chat UI has a 404 PDF link.", {"pixels": "checked"}, 0.85)
        second = graph.ingest("s1", "screenshot", "clipboard://shot1", "Chat UI has a 404 PDF link.", {"pixels": "checked"}, 0.85)
        context = graph.session_context("s1")

        self.assertEqual(first["id"], second["id"])
        self.assertTrue(second["deduplicated"])
        self.assertEqual(context["modalities"], ["screenshot"])
        self.assertIn("404 PDF", context["combined_summary"])

    def test_workflow_generator_builds_intent_specific_steps(self):
        workflow = WorkflowGenerator(self.store).generate(
            "research latest AI news and create a PDF report with citations"
        )

        self.assertEqual(workflow["intent"], "live_research")
        self.assertIn("Fetch live sources", workflow["steps"])
        self.assertIn("ResearchAgent", workflow["agent_types"])
        self.assertFalse(workflow["deduplicated"])

    def test_background_jobs_are_bounded_and_auditable(self):
        jobs = BackgroundJobEngine(self.store)
        job = jobs.schedule(
            "Monitor IPL score",
            "monitor",
            {"query": "IPL live score"},
            {"interval_minutes": 15},
            "2026-05-21T00:00:00+00:00",
            max_runs=1,
        )
        result = jobs.run_due("2026-05-21T00:01:00+00:00")
        completed = jobs.get(job["id"])

        self.assertEqual(len(result["executed"]), 1)
        self.assertEqual(completed["status"], "completed")
        self.assertEqual(completed["run_count"], 1)

    def test_skill_marketplace_installs_updates_removes_with_rollback(self):
        marketplace = SkillMarketplace(self.store)
        manifest = {
            "name": "NewsIntelligenceSkill",
            "description": "Fetch, validate, cite, and summarize live news.",
            "trigger_conditions": ["latest news", "current updates"],
            "required_tools": ["web_search"],
            "execution_steps": ["search trusted sources", "verify timestamp", "summarize with citations"],
            "examples": ["latest Tamil Nadu news"],
            "confidence": 0.9,
            "reward_score": 0.86,
        }

        installed = marketplace.install(manifest)
        duplicate = marketplace.install(manifest)
        updated = marketplace.update(
            "NewsIntelligenceSkill",
            {**manifest, "description": "Validated live news workflow with source ranking."},
        )
        removed = marketplace.remove("NewsIntelligenceSkill")

        self.assertTrue(installed["installed"])
        self.assertFalse(duplicate["installed"])
        self.assertEqual(updated["package"]["version"], 2)
        self.assertEqual(updated["rollback_package"]["version"], 1)
        self.assertTrue(removed["removed"])

    def test_orchestrator_exposes_adaptive_os_outputs(self):
        os = HermesCognitiveOS(self.store)
        os.failures.record_lesson(
            "generate PDF",
            "link returned 404",
            "file route not verified",
            "verify artifact path before responding",
            0.9,
        )

        result = os.process_task("generate a PDF report with latest AI news and citations", approved=True)

        self.assertIn("workflow", result)
        self.assertIn("tool_plan", result)
        self.assertIn("world_context", result)
        self.assertIn("predictive_assistant", result)
        self.assertIn("adaptive_ui", result)
        self.assertTrue(any(item["type"] == "accuracy_guard" for item in result["predictive_assistant"]["suggestions"]))


if __name__ == "__main__":
    unittest.main()
