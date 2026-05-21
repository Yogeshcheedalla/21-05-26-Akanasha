from __future__ import annotations

from typing import Any

from .loop_guard import LoopGuard
from .permissions import PermissionSystem


class SafetyValidator:
    def __init__(self) -> None:
        self.permissions = PermissionSystem()
        self.loop_guard = LoopGuard()

    def validate_learning_action(self, action: dict[str, Any]) -> dict[str, Any]:
        action_type = str(action.get("type", "unknown"))
        tools = list(action.get("tools", []))
        risk_level = str(action.get("risk_level", "low"))
        loop_key = str(action.get("loop_key", action_type))
        approved = bool(action.get("approved", False))
        allowed = self.loop_guard.check(loop_key)
        requires_approval = self.permissions.requires_approval(tools, risk_level)
        permitted_tools = self.permissions.allowed_tools(tools, approved=approved)
        return {
            "allowed": allowed and (approved or not requires_approval),
            "requires_approval": requires_approval and not approved,
            "permitted_tools": permitted_tools,
            "risk_level": risk_level,
            "reason": "ok" if allowed else "loop_guard_blocked",
        }
