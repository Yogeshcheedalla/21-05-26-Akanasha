from __future__ import annotations

from typing import Any


class ResultMerger:
    def merge(self, results: list[dict[str, Any]]) -> dict[str, Any]:
        if not results:
            return {
                "status": "no_worker_results",
                "confidence": 0.7,
                "summary": "Persistent core agents can handle this task without temporary worker output.",
                "findings": [],
            }
        findings = [str(result.get("result", "")).strip() for result in results if result.get("result")]
        confidence = sum(float(result.get("confidence", 0.5)) for result in results) / len(results)
        conflicts = self._detect_conflicts(findings)
        if conflicts:
            confidence = min(confidence, 0.72)
        return {
            "status": "merged_with_conflicts" if conflicts else "merged",
            "confidence": round(confidence, 4),
            "summary": " ".join(findings[:3])[:700],
            "findings": findings,
            "conflicts": conflicts,
        }

    def _detect_conflicts(self, findings: list[str]) -> list[str]:
        lowered = [finding.lower() for finding in findings]
        conflicts: list[str] = []
        if any("not verified" in item for item in lowered) and any("verified" in item and "not verified" not in item for item in lowered):
            conflicts.append("verification_disagreement")
        if any("blocked" in item for item in lowered) and any("allowed" in item for item in lowered):
            conflicts.append("safety_disagreement")
        return conflicts
