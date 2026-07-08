import re
import base64
import logging
from typing import Dict, Any, List, Tuple, Optional

logger = logging.getLogger("arbiter.security_scanner")

# Threat classification mappings
THREAT_MAPPINGS = {
    "Prompt Injection": {
        "severity": "HIGH",
        "mitre_mapping": "AML.T0054 (LLM Prompt Injection)",
        "owasp_mapping": "LLM01: Prompt Injection"
    },
    "Jailbreak Attempt": {
        "severity": "CRITICAL",
        "mitre_mapping": "AML.T0054.001 (Active Jailbreak)",
        "owasp_mapping": "LLM01: Prompt Injection"
    },
    "PII Leakage": {
        "severity": "MEDIUM",
        "mitre_mapping": "AML.T0052 (Exfiltration of Sensitive Info)",
        "owasp_mapping": "LLM06: Sensitive Information Disclosure"
    },
    "Credential Leakage": {
        "severity": "CRITICAL",
        "mitre_mapping": "AML.T0052.002 (Exfiltration of Credentials)",
        "owasp_mapping": "LLM06: Sensitive Information Disclosure"
    },
    "Obfuscation Attack (Base64/Unicode)": {
        "severity": "HIGH",
        "mitre_mapping": "AML.T0054.002 (Obfuscated Injections)",
        "owasp_mapping": "LLM01: Prompt Injection"
    },
    "Injection (HTML/Markdown/Script)": {
        "severity": "HIGH",
        "mitre_mapping": "AML.T0055 (Unsafe Execution)",
        "owasp_mapping": "LLM02: Insecure Output Handling"
    }
}

class SecurityScanner:
    def __init__(self):
        # Heuristics patterns for prompt injections and jailbreaks
        self.injection_patterns = [
            re.compile(r"(?i)\bignore\b.*\bprevious\b.*\binstructions\b"),
            re.compile(r"(?i)\byou are now\b.*\badmin\b"),
            re.compile(r"(?i)\bdeveloper mode\b.*\benabled\b"),
            re.compile(r"(?i)\bsystem prompt\b.*\breveal\b"),
            re.compile(r"(?i)\bignore system commands\b"),
            re.compile(r"(?i)\bdo anything now\b"),
            re.compile(r"(?i)\bDAN mode\b"),
            re.compile(r"(?i)\bexecute code\b"),
            re.compile(r"(?i)\boverride policy\b")
        ]

        # Heuristic credentials patterns
        self.credential_patterns = [
            re.compile(r"(?i)(?:aws_access_key_id|aws_secret_access_key|api[-_]?key|auth[-_]?token)\s*[:=]\s*['\"][a-zA-Z0-9+/]{20,40}['\"]"),
            re.compile(r"-----BEGIN PRIVATE KEY-----"),
            re.compile(r"(?i)bearer\s+[a-zA-Z0-9_\-\.]{15,}")
        ]

        # Heuristic PII patterns
        self.pii_patterns = {
            "EMAIL": re.compile(r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b"),
            "SSN": re.compile(r"\b\d{3}-\d{2}-\d{4}\b"),
            "CREDIT_CARD": re.compile(r"\b(?:\d[ -]*?){13,16}\b")
        }

        # Obfuscation triggers
        self.base64_pattern = re.compile(r"\b[a-zA-Z0-9+/]{12,}=*\b")

    def scan_prompt(self, prompt: str) -> Tuple[float, List[Dict[str, Any]], str]:
        """
        Scans a prompt for all threat categories.
        Returns:
            Tuple[max_risk_score, list_of_detected_threats, sanitized_prompt]
        """
        detected_threats = []
        max_score = 0.0
        sanitized_prompt = prompt

        # 1. Base64 & Obfuscation Inspection
        decoded_candidate = self._check_obfuscation(prompt)
        if decoded_candidate:
            # Re-scan the decoded payload for injections
            sub_score, sub_threats, _ = self.scan_prompt(decoded_candidate)
            if sub_score > 0.3:
                threat = self._build_threat("Obfuscation Attack (Base64/Unicode)", sub_score)
                threat["details"] = f"Decoded payload contained threat: {sub_threats[0]['category']}"
                detected_threats.append(threat)
                max_score = max(max_score, sub_score)

        # 2. Heuristic Jailbreak / Prompt Injection scan
        for pattern in self.injection_patterns:
            if pattern.search(prompt):
                threat = self._build_threat("Jailbreak Attempt", 0.95)
                detected_threats.append(threat)
                max_score = max(max_score, 0.95)
                break

        # 3. Secret Detection
        for pattern in self.credential_patterns:
            if pattern.search(prompt):
                threat = self._build_threat("Credential Leakage", 0.98)
                detected_threats.append(threat)
                max_score = max(max_score, 0.98)
                break

        # 4. PII Detection & Masking
        for pii_type, pattern in self.pii_patterns.items():
            matches = list(pattern.finditer(sanitized_prompt))
            if matches:
                threat = self._build_threat("PII Leakage", 0.60)
                threat["details"] = f"Detected {pii_type} pattern"
                detected_threats.append(threat)
                max_score = max(max_score, 0.60)
                # Apply masking for downstream usage
                for match in matches:
                    sanitized_prompt = sanitized_prompt.replace(match.group(), f"[{pii_type}_MASKED]")

        # 5. Invisible Characters / Unicode homoglyphs check
        if self._has_invisible_characters(prompt):
            threat = self._build_threat("Obfuscation Attack (Base64/Unicode)", 0.70)
            threat["details"] = "Contains zero-width spaces or hidden Unicode sequences."
            detected_threats.append(threat)
            max_score = max(max_score, 0.70)

        # 6. HTML / Script / SQL injection check in text
        if self._has_injection_codes(prompt):
            threat = self._build_threat("Injection (HTML/Markdown/Script)", 0.85)
            detected_threats.append(threat)
            max_score = max(max_score, 0.85)

        return max_score, detected_threats, sanitized_prompt

    def scan_output(self, response_text: str) -> Tuple[float, List[Dict[str, Any]]]:
        """
        Scans generated output before sending it back to user (preventing leakage, toxicity).
        """
        detected_threats = []
        max_score = 0.0

        # Check credentials leakage in outputs
        for pattern in self.credential_patterns:
            if pattern.search(response_text):
                threat = self._build_threat("Credential Leakage", 0.99)
                detected_threats.append(threat)
                max_score = max(max_score, 0.99)

        # Check PII leakage in outputs
        for pii_type, pattern in self.pii_patterns.items():
            if pattern.search(response_text):
                threat = self._build_threat("PII Leakage", 0.80)
                threat["details"] = f"Output contains unmasked {pii_type}"
                detected_threats.append(threat)
                max_score = max(max_score, 0.80)

        return max_score, detected_threats

    def _build_threat(self, category: str, risk_score: float) -> Dict[str, Any]:
        mapping = THREAT_MAPPINGS.get(category, {"severity": "MEDIUM", "mitre_mapping": "Unknown", "owasp_mapping": "Unknown"})
        return {
            "category": category,
            "risk_score": risk_score,
            "severity": mapping["severity"],
            "mitre_mapping": mapping["mitre_mapping"],
            "owasp_mapping": mapping["owasp_mapping"],
            "details": f"Triggered heuristic patterns for {category}."
        }

    def _check_obfuscation(self, text: str) -> Optional[str]:
        """Check if base64 blocks can be decoded successfully and return string."""
        for match in self.base64_pattern.finditer(text):
            try:
                candidate = match.group()
                # pad base64 string if necessary
                padded = candidate + "=" * ((4 - len(candidate) % 4) % 4)
                decoded = base64.b64decode(padded).decode('utf-8', errors='ignore')
                if any(k in decoded.lower() for k in ["ignore", "system", "admin", "password", "secret"]):
                    return decoded
            except Exception:
                pass
        return None

    def _has_invisible_characters(self, text: str) -> bool:
        # Check Zero Width Spaces (U+200B to U+200D, U+FEFF, etc)
        zero_width_chars = ['\u200b', '\u200c', '\u200d', '\ufeff']
        for c in zero_width_chars:
            if c in text:
                return True
        return False

    def _has_injection_codes(self, text: str) -> bool:
        # Check script blocks or basic SQL syntax heuristics
        if "<script" in text.lower() or "javascript:" in text.lower():
            return True
        if "union select" in text.lower() or "or 1=1" in text.lower():
            return True
        return False
