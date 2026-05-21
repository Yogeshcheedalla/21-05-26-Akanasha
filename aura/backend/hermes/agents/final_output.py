from __future__ import annotations

from typing import Any


class FinalOutputBuilder:
    def build(self, analysis: dict[str, Any], validation: dict[str, Any], merged: dict[str, Any]) -> dict[str, Any]:
        if validation["valid"]:
            status = "ready"
            message = f"Task routed as {analysis['intent']} with confidence-controlled execution."
        else:
            status = "blocked_or_needs_approval"
            message = f"Task is paused because: {', '.join(validation['issues'])}."
        return {
            "status": status,
            "message": message,
            "intent": analysis["intent"],
            "risk_level": analysis["risk_level"],
            "confidence": min(float(validation["confidence"]), float(merged.get("confidence", 0.7))),
            "next_action": "execute" if status == "ready" else "request_approval_or_clarification",
        }
