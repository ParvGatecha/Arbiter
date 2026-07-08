import yaml
import logging
from typing import Dict, Any, List, Tuple
from backend.app.services.security_scanner import SecurityScanner

logger = logging.getLogger("arbiter.policy_evaluator")

class PolicyEvaluator:
    def __init__(self, scanner: SecurityScanner = None):
        self.scanner = scanner or SecurityScanner()

    def evaluate_rules(self, policy_yaml: str, context: Dict[str, Any]) -> Dict[str, Any]:
        """
        Evaluate a prompt/transaction context against a YAML declarative policy.
        Returns:
            Dict containing 'verdict' ("allow" or "block" or "mask" or "approval"),
            'violated_rules' list, and 'modified_text' (if masked).
        """
        try:
            policy = yaml.safe_load(policy_yaml)
        except Exception as e:
            logger.error(f"Failed to parse policy YAML: {str(e)}")
            return {"verdict": "allow", "violated_rules": [], "error": "Invalid YAML"}

        violated_rules = []
        verdict = "allow"
        text = context.get("prompt", "")
        cost = context.get("cost", 0.0)
        accumulated_cost_24h = context.get("accumulated_cost_24h", 0.0)
        tool_calls = context.get("tool_calls", [])

        rules = policy.get("rules", [])
        for rule in rules:
            rule_name = rule.get("name", "unnamed-rule")
            rule_type = rule.get("type")
            action = rule.get("action", "block")

            if rule_type == "credential-scanner":
                # Check for secrets
                _, threats = self.scanner.scan_output(text)  # scan output extracts secrets
                if any(t["category"] == "Credential Leakage" for t in threats):
                    violated_rules.append(rule_name)
                    if action == "block":
                        verdict = "block"

            elif rule_type == "pii-detector":
                # Check if specific PII is violating or needs masking
                types = rule.get("types", [])
                _, threats, masked_text = self.scanner.scan_prompt(text)
                has_pii = False
                for t in threats:
                    if t["category"] == "PII Leakage":
                        for pii_type in types:
                            if pii_type in t.get("details", ""):
                                has_pii = True
                                break
                if has_pii:
                    violated_rules.append(rule_name)
                    if action == "block":
                        verdict = "block"
                    elif action == "mask":
                        text = masked_text
                        if verdict != "block":
                            verdict = "mask"

            elif rule_type == "cost-threshold":
                limit = rule.get("limit_per_day", 100.0)
                if (accumulated_cost_24h + cost) > limit:
                    violated_rules.append(rule_name)
                    if action == "block":
                        verdict = "block"
                    elif action == "approval-required" and verdict not in ["block"]:
                        verdict = "approval"

            elif rule_type == "unsafe-tool":
                blacklist = rule.get("blacklist", [])
                for tool in tool_calls:
                    if tool in blacklist:
                        violated_rules.append(rule_name)
                        if action == "block":
                            verdict = "block"
                        elif action == "approval-required" and verdict not in ["block"]:
                            verdict = "approval"

            elif rule_type == "restricted-terms":
                terms = rule.get("terms", [])
                for term in terms:
                    if term.lower() in text.lower():
                        violated_rules.append(rule_name)
                        if action == "block":
                            verdict = "block"

        return {
            "verdict": verdict,
            "violated_rules": violated_rules,
            "modified_text": text
        }

    def simulate_policy(self, policy_yaml: str, historical_logs: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        Simulate a policy yaml against past gateway logs to predict violation rates.
        """
        violations_count = 0
        total_logs = len(historical_logs)
        results = []

        for log in historical_logs:
            res = self.evaluate_rules(policy_yaml, log)
            if res["verdict"] != "allow":
                violations_count += 1
            results.append({
                "log_id": log.get("id"),
                "verdict": res["verdict"],
                "violated_rules": res["violated_rules"]
            })

        return {
            "total_evaluated": total_logs,
            "total_violations": violations_count,
            "violation_rate": (violations_count / total_logs) if total_logs > 0 else 0.0,
            "details": results
        }
