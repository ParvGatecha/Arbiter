import base64
import hashlib
import hmac
import logging
from datetime import datetime, timedelta
from typing import Dict, Any, Optional, Tuple

logger = logging.getLogger("arbiter.memory_manager")

from cryptography.fernet import Fernet

class SecureMemoryManager:
    def __init__(self, encryption_key: str, hmac_key: str = "arbiter-hmac-integrity-key"):
        self.hmac_key = hmac_key.encode("utf-8")
        try:
            # Ensure key is valid 32-byte urlsafe base64
            key_hash = hashlib.sha256(encryption_key.encode()).digest()
            b64_key = base64.urlsafe_b64encode(key_hash)
            self.cipher = Fernet(b64_key)
        except Exception as e:
            logger.error(f"Failed to initialize Fernet cipher: {str(e)}")
            raise RuntimeError(f"Failed to initialize Fernet cipher: {str(e)}")

    def create_memory(self, agent_id: int, content: str, ttl_days: int = 30) -> Dict[str, Any]:
        """
        Processes memory text, encrypts it, generates integrity signature, and calculates metadata.
        """
        # 1. Generate text hash
        memory_hash = hashlib.sha256(content.encode("utf-8")).hexdigest()

        # 2. Encrypt text content
        encrypted_content = self._encrypt(content)

        # 3. Calculate initial trust score (heuristic scan for credentials/injections)
        trust_score = self._assess_initial_trust(content)

        # 4. Generate integrity signature
        signature = self._generate_signature(memory_hash, encrypted_content, trust_score)

        expires_at = datetime.utcnow() + timedelta(days=ttl_days)

        return {
            "agent_config_id": agent_id,
            "memory_hash": memory_hash,
            "encrypted_content": encrypted_content,
            "trust_score": trust_score,
            "integrity_signature": signature,
            "expires_at": expires_at
        }

    def verify_and_decrypt(self, memory_record: Dict[str, Any]) -> Tuple[bool, str]:
        """
        Verifies the cryptographic signature of the memory block and decrypts it.
        Returns:
            Tuple[is_valid, decrypted_text]
        """
        expected_sig = self._generate_signature(
            memory_record["memory_hash"],
            memory_record["encrypted_content"],
            memory_record["trust_score"]
        )

        if not hmac.compare_digest(expected_sig, memory_record["integrity_signature"]):
            logger.error("Memory integrity verification failed: Signature mismatch.")
            return False, ""

        try:
            decrypted = self._decrypt(memory_record["encrypted_content"])
            # Validate hash
            current_hash = hashlib.sha256(decrypted.encode("utf-8")).hexdigest()
            if current_hash != memory_record["memory_hash"]:
                logger.error("Memory integrity verification failed: Content hash mismatch.")
                return False, ""
            return True, decrypted
        except Exception as e:
            logger.error(f"Decryption failed: {str(e)}")
            return False, ""

    def _encrypt(self, text: str) -> str:
        return self.cipher.encrypt(text.encode("utf-8")).decode("utf-8")

    def _decrypt(self, encrypted_b64: str) -> str:
        return self.cipher.decrypt(encrypted_b64.encode("utf-8")).decode("utf-8")

    def _generate_signature(self, memory_hash: str, encrypted_content: str, trust_score: float) -> str:
        payload = f"{memory_hash}:{encrypted_content}:{trust_score:.4f}".encode("utf-8")
        return hmac.new(self.hmac_key, payload, hashlib.sha256).hexdigest()

    def _assess_initial_trust(self, content: str) -> float:
        # Check basic safety indicators.
        # If the content matches standard jailbreak keywords, trust score degrades.
        score = 1.0
        degrade_keywords = ["ignore prompt", "bypass", "override", "instruction injection"]
        for kw in degrade_keywords:
            if kw in content.lower():
                score -= 0.3
        return max(0.1, score)
