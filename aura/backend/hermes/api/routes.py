from __future__ import annotations

from typing import Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from ..learning.continuous_loop import ContinuousLearningLoop
from ..orchestrator import HermesCognitiveOS
from ..simulator import DEFAULT_SIMULATION_TASKS, HermesSimulator
from ..tools.universal_tool_layer import ToolSpec


router = APIRouter(prefix="/api/cognitive", tags=["Akansha Hermes Cognitive OS"])
_os = HermesCognitiveOS()


class MemoryCreateRequest(BaseModel):
    category: str
    content: str
    importance_score: float = Field(ge=0, le=1)
    source: str = "user"
    confidence: float = Field(default=0.75, ge=0, le=1)


class ShortTermRequest(BaseModel):
    session_id: str = "default"
    conversation: str
    tool_usage: list[str] = []
    context_score: float = Field(default=0.5, ge=0, le=1)


class RecallRequest(BaseModel):
    query: str
    limit: int = Field(default=10, ge=1, le=10)


class ExperienceRequest(BaseModel):
    task: str
    goal: str
    actions_taken: list[str]
    tools_used: list[str]
    agents_used: list[str] = []
    errors: list[str] = []
    successful_steps: list[str]
    time_taken: float = 0.0
    feedback: str = ""
    score: float = Field(default=0.5, ge=0, le=1)
    task_success: bool = False
    speed_score: float = Field(default=0.5, ge=0, le=1)
    user_feedback: float = Field(default=0.5, ge=0, le=1)
    tool_efficiency: float = Field(default=0.5, ge=0, le=1)
    error_penalty: float = Field(default=0.0, ge=0, le=1)


class PlanRequest(BaseModel):
    task: str
    approved: bool = False


class SimulationRequest(BaseModel):
    tasks: list[str] = DEFAULT_SIMULATION_TASKS
    approved: bool = False


class SkillGenerateRequest(BaseModel):
    task_family: str


class SkillPromoteRequest(BaseModel):
    skill_id: str


class SkillOptimizeRequest(BaseModel):
    skill_id: str
    success: bool
    latency_seconds: float = 0.0
    tool_failures: int = 0
    feedback_score: float = Field(default=0.5, ge=0, le=1)


class FailureLessonRequest(BaseModel):
    task: str
    failure: str
    cause: str
    fix: str
    confidence: float = Field(default=0.7, ge=0, le=1)
    source: str = "manual"


class ToolRegisterRequest(BaseModel):
    name: str
    kind: str
    capabilities: list[str]
    requires_approval: bool = False
    risk_level: str = "low"
    enabled: bool = True


class ToolPlanRequest(BaseModel):
    task: str
    required_tools: list[str] = []
    approved: bool = False


class WorldNodeRequest(BaseModel):
    node_type: str
    name: str
    attributes: dict[str, Any] = {}
    confidence: float = Field(default=0.7, ge=0, le=1)


class WorldEdgeRequest(BaseModel):
    source_id: str
    target_id: str
    relationship: str
    attributes: dict[str, Any] = {}
    confidence: float = Field(default=0.7, ge=0, le=1)


class PredictRequest(BaseModel):
    task: str


class MultimodalIngestRequest(BaseModel):
    session_id: str = "default"
    modality: str
    content_ref: str = ""
    summary: str = ""
    metadata: dict[str, Any] = {}
    confidence: float = Field(default=0.7, ge=0, le=1)


class BackgroundJobRequest(BaseModel):
    name: str
    kind: str
    payload: dict[str, Any] = {}
    schedule: dict[str, Any] = {}
    next_run_at: str | None = None
    max_runs: int = Field(default=1, ge=1, le=100)


class MarketplaceInstallRequest(BaseModel):
    manifest: dict[str, Any]


class MarketplaceUpdateRequest(BaseModel):
    name: str
    manifest: dict[str, Any]


class MarketplaceRemoveRequest(BaseModel):
    name: str


@router.get("/health")
def cognitive_health() -> dict[str, Any]:
    return {
        "status": "ok",
        "layers": [
            "input_understanding",
            "memory",
            "learning",
            "skills",
            "agents",
            "planning",
            "safety",
            "cognitive_compression",
            "universal_tools",
            "world_model",
            "predictive_assistant",
            "adaptive_ui",
            "multimodal_context",
            "workflow_generation",
            "background_jobs",
            "skill_marketplace",
        ],
        "agent_limit": 10,
        "persistent_core_agents": 9,
        "temporary_worker_limit": 6,
        "recall_limit": 10,
    }


@router.post("/memory/short-term")
def add_short_term_memory(request: ShortTermRequest) -> dict[str, Any]:
    memory_id = _os.short_term.add(
        request.session_id,
        request.conversation,
        request.tool_usage,
        request.context_score,
    )
    return {"id": memory_id, "status": "stored"}


@router.post("/memory/long-term")
def add_long_term_memory(request: MemoryCreateRequest) -> dict[str, Any]:
    try:
        return _os.long_term.upsert(
            request.category,
            request.content,
            request.importance_score,
            request.source,
            request.confidence,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/memory/recall")
def recall_memory(request: RecallRequest) -> dict[str, Any]:
    return {"memories": _os.retrieval.recall(request.query, request.limit)}


@router.post("/memory/compress")
def compress_memory() -> dict[str, Any]:
    return _os.compression.compress()


@router.post("/memory/cognitive-compress")
def cognitive_compress_memory() -> dict[str, Any]:
    return _os.cognitive_compression.compress_context()


@router.get("/memory/cognitive-compress/latest")
def latest_cognitive_compression() -> dict[str, Any]:
    latest = _os.cognitive_compression.latest()
    return {"compression": latest}


@router.post("/experience")
def record_experience(request: ExperienceRequest) -> dict[str, Any]:
    try:
        experience = _os.experiences.record(request.dict())
        reflection = _os.reflection.reflect(experience["experience_id"])
        return {"experience": experience, "reflection": reflection}
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/skills/generate")
def generate_skill(request: SkillGenerateRequest) -> dict[str, Any]:
    skill = _os.skill_generator.generate_from_repetitions(request.task_family)
    return {"generated": bool(skill), "skill": skill}


@router.post("/skills/promote")
def promote_skill(request: SkillPromoteRequest) -> dict[str, Any]:
    try:
        return _os.skills.promote(request.skill_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/skills/optimize")
def optimize_skill(request: SkillOptimizeRequest) -> dict[str, Any]:
    try:
        return _os.skill_optimizer.improve_after_use(
            request.skill_id,
            request.success,
            request.latency_seconds,
            request.tool_failures,
            request.feedback_score,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.get("/skills/search")
def search_skills(q: str, limit: int = 10) -> dict[str, Any]:
    return {"skills": _os.skills.search(q, limit)}


@router.post("/plan")
def plan_task(request: PlanRequest) -> dict[str, Any]:
    return _os.process_task(request.task, approved=request.approved)


@router.post("/analyze")
def analyze_task(request: PlanRequest) -> dict[str, Any]:
    analysis = _os.task_analyzer.analyze(request.task).to_dict()
    return {"analysis": analysis, "hiring_plan": _os.hiring_engine.hiring_plan(analysis)}


@router.post("/simulate")
def simulate_tasks(request: SimulationRequest) -> dict[str, Any]:
    return {"results": HermesSimulator(_os).run(request.tasks, approved=request.approved)}


@router.get("/failures")
def recent_failures(limit: int = 10) -> dict[str, Any]:
    return _os.failures.recommendations(limit)


@router.post("/failures/lesson")
def record_failure_lesson(request: FailureLessonRequest) -> dict[str, Any]:
    try:
        return _os.failures.record_lesson(
            request.task,
            request.failure,
            request.cause,
            request.fix,
            request.confidence,
            request.source,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/tools/register")
def register_tool(request: ToolRegisterRequest) -> dict[str, Any]:
    try:
        return _os.tools.register_tool(
            ToolSpec(
                name=request.name,
                kind=request.kind,
                capabilities=request.capabilities,
                requires_approval=request.requires_approval,
                risk_level=request.risk_level,
                enabled=request.enabled,
            )
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.get("/tools")
def list_tools(enabled_only: bool = True) -> dict[str, Any]:
    return {"tools": _os.tools.list_tools(enabled_only=enabled_only)}


@router.post("/tools/plan")
def plan_tools(request: ToolPlanRequest) -> dict[str, Any]:
    return _os.tools.plan_for_task(request.task, request.required_tools, request.approved)


@router.post("/world/node")
def upsert_world_node(request: WorldNodeRequest) -> dict[str, Any]:
    try:
        return _os.world_model.upsert_node(
            request.node_type,
            request.name,
            request.attributes,
            request.confidence,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/world/edge")
def add_world_edge(request: WorldEdgeRequest) -> dict[str, Any]:
    try:
        return _os.world_model.add_edge(
            request.source_id,
            request.target_id,
            request.relationship,
            request.attributes,
            request.confidence,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.get("/world")
def world_graph(limit: int = 100) -> dict[str, Any]:
    return _os.world_model.graph(limit=limit)


@router.post("/predict")
def predict_next_actions(request: PredictRequest) -> dict[str, Any]:
    analysis = _os.task_analyzer.analyze(request.task).to_dict()
    return _os.predictive.predict(request.task, analysis)


@router.post("/ui/mode")
def adaptive_ui_mode(request: PredictRequest) -> dict[str, Any]:
    analysis = _os.task_analyzer.analyze(request.task).to_dict()
    return _os.adaptive_ui.mode_for_task(request.task, analysis)


@router.post("/multimodal/ingest")
def ingest_multimodal_context(request: MultimodalIngestRequest) -> dict[str, Any]:
    try:
        return _os.multimodal.ingest(
            request.session_id,
            request.modality,
            request.content_ref,
            request.summary,
            request.metadata,
            request.confidence,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.get("/multimodal/session/{session_id}")
def multimodal_session_context(session_id: str, limit: int = 20) -> dict[str, Any]:
    return _os.multimodal.session_context(session_id, limit=limit)


@router.post("/workflows/generate")
def generate_workflow(request: PredictRequest) -> dict[str, Any]:
    return _os.workflow_generator.generate(request.task)


@router.post("/background/jobs")
def schedule_background_job(request: BackgroundJobRequest) -> dict[str, Any]:
    try:
        return _os.background_jobs.schedule(
            request.name,
            request.kind,
            request.payload,
            request.schedule,
            request.next_run_at,
            request.max_runs,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.get("/background/jobs")
def list_background_jobs(status: str | None = None, limit: int = 50) -> dict[str, Any]:
    return {"jobs": _os.background_jobs.list_jobs(status=status, limit=limit)}


@router.post("/background/jobs/run-due")
def run_due_background_jobs() -> dict[str, Any]:
    return _os.background_jobs.run_due()


@router.post("/marketplace/install")
def marketplace_install(request: MarketplaceInstallRequest) -> dict[str, Any]:
    try:
        return _os.marketplace.install(request.manifest)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/marketplace/update")
def marketplace_update(request: MarketplaceUpdateRequest) -> dict[str, Any]:
    try:
        return _os.marketplace.update(request.name, request.manifest)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/marketplace/remove")
def marketplace_remove(request: MarketplaceRemoveRequest) -> dict[str, Any]:
    return _os.marketplace.remove(request.name)


@router.get("/marketplace")
def marketplace_list(status: str | None = None, limit: int = 50) -> dict[str, Any]:
    return {"packages": _os.marketplace.list_packages(status=status, limit=limit)}


@router.get("/metrics")
def cognitive_metrics() -> dict[str, Any]:
    return _os.metrics.snapshot()


@router.post("/loop/run-once")
async def run_learning_maintenance() -> dict[str, Any]:
    loop = ContinuousLearningLoop(_os.store)
    return await loop.run_once()
