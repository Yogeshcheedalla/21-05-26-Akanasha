from __future__ import annotations


SENSITIVE_TOOLS = {"filesystem_write", "desktop_control", "browser_submit", "email_send", "payments", "delete"}


class PermissionSystem:
    def requires_approval(self, tools: list[str], risk_level: str) -> bool:
        return risk_level in {"high", "critical"} or bool(SENSITIVE_TOOLS & set(tools))

    def allowed_tools(self, tools: list[str], approved: bool = False) -> list[str]:
        if approved:
            return tools
        return [tool for tool in tools if tool not in SENSITIVE_TOOLS]
