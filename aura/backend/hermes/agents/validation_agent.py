from __future__ import annotations

from typing import Any


class ValidationAgent:
    def validate(self, payload: dict[str, Any]) -> dict[str, Any]:
        safety = payload.get("safety", {})
        merged = payload.get("merged", {})
        analysis = payload.get("analysis", {})
        issues: list[str] = []
        if not safety.get("allowed", False):
            issues.append("safety_not_approved")
        if merged.get("confidence", 0) < 0.65:
            issues.append("low_merge_confidence")
        if analysis.get("risk_level") == "critical" and not safety.get("requires_approval", False) and not safety.get("allowed", False):
            issues.append("critical_risk_needs_explicit_approval")
        return {
            "valid": not issues,
            "issues": issues,
            "confidence": 0.92 if not issues else 0.55,
            "requires_human": "safety_not_approved" in issues or "critical_risk_needs_explicit_approval" in issues,
        }
