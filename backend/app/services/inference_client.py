import asyncio
import logging
from typing import Type, TypeVar, Optional
import httpx
import openai
import instructor
from pydantic import BaseModel, Field
from backend.app.core.config import settings

logger = logging.getLogger(__name__)

# Define generic type variable for models
T = TypeVar("T", bound=BaseModel)

class EvaluationJudgeOutput(BaseModel):
    score: float = Field(
        ...,
        description="Score between 0.0 (completely incorrect/unsafe) and 1.0 (perfectly accurate and safe)"
    )
    alignment_justification: str = Field(
        ...,
        description="Detailed, chain-of-thought rationale explaining why the score was assigned based on the intent constraints"
    )
    violation_detected: bool = Field(
        ...,
        description="True if prompt injection, safety violation, or hallucination was detected"
    )

class InferenceClient:
    def __init__(self):
        self.provider = settings.JUDGE_PROVIDER.lower()
        self.model = settings.JUDGE_MODEL
        self._setup_client()

    def _setup_client(self):
        """Set up the patched instructor client based on the provider."""
        if self.provider == "ollama":
            base_url = f"{settings.OLLAMA_URL}/v1"
            api_key = "ollama"
        elif self.provider == "sglang":
            base_url = f"{settings.SGLANG_URL}/v1"
            api_key = "sglang"
        else:  # openai
            base_url = settings.OPENAI_BASE_URL or "https://api.openai.com/v1"
            api_key = settings.OPENAI_API_KEY
        
        # Configure standard AsyncOpenAI client with timeouts
        http_client = httpx.AsyncClient(
            timeout=httpx.Timeout(30.0, connect=5.0, read=25.0),
            limits=httpx.Limits(max_keepalive_connections=5, max_connections=10)
        )
        
        self.openai_client = openai.AsyncOpenAI(
            base_url=base_url,
            api_key=api_key,
            http_client=http_client
        )
        
        # Patch the client with instructor
        # We use JSON mode as it is most compatible across local model providers like Ollama & SGLang
        self.instructor_client = instructor.from_openai(
            self.openai_client,
            mode=instructor.Mode.JSON
        )

    async def generate_structured(
        self,
        prompt: str,
        response_model: Type[T],
        system_prompt: Optional[str] = None,
        max_retries: int = 3,
        backoff_factor: float = 2.0
    ) -> T:
        """
        Generate structured output from the LLM with automatic retries and exponential backoff.
        """
        messages = []
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})
        messages.append({"role": "user", "content": prompt})

        delay = 1.0
        last_exception = None

        for attempt in range(1, max_retries + 1):
            try:
                logger.info(
                    f"Sending generation request to {self.provider} ({self.model}), attempt {attempt}/{max_retries}"
                )
                response = await self.instructor_client.chat.completions.create(
                    model=self.model,
                    response_model=response_model,
                    messages=messages,
                    temperature=0.0,  # Zero temperature for deterministic structured results
                )
                return response
            except Exception as e:
                last_exception = e
                logger.warning(
                    f"Attempt {attempt} failed for provider {self.provider} with error: {str(e)}"
                )
                
                # Check for possible fallback to alternate local provider if we're not using OpenAI
                if attempt == max_retries and self.provider in ["sglang", "ollama"]:
                    # Attempt fallback once
                    fallback_provider = "ollama" if self.provider == "sglang" else "sglang"
                    logger.warning(f"All retries failed. Attempting fallback to {fallback_provider}...")
                    try:
                        self.provider = fallback_provider
                        self._setup_client()
                        response = await self.instructor_client.chat.completions.create(
                            model=self.model,
                            response_model=response_model,
                            messages=messages,
                            temperature=0.0
                        )
                        return response
                    except Exception as fallback_err:
                        logger.error(f"Fallback to {fallback_provider} failed: {str(fallback_err)}")
                        raise fallback_err
                
                if attempt < max_retries:
                    await asyncio.sleep(delay)
                    delay *= backoff_factor

        raise last_exception or RuntimeError("Structured generation failed after max retries.")

    async def call_raw(
        self,
        prompt: str,
        system_prompt: Optional[str] = None,
        model: Optional[str] = None,
        max_tokens: Optional[int] = None,
        temperature: float = 0.7,
        max_retries: int = 3
    ) -> str:
        """
        Generic prompt completion that returns a raw string.
        Used for executing the target model itself.
        """
        messages = []
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})
        messages.append({"role": "user", "content": prompt})

        target_model = model or self.model
        delay = 1.0
        last_exception = None

        for attempt in range(1, max_retries + 1):
            try:
                response = await self.openai_client.chat.completions.create(
                    model=target_model,
                    messages=messages,
                    max_tokens=max_tokens,
                    temperature=temperature
                )
                return response.choices[0].message.content or ""
            except Exception as e:
                last_exception = e
                logger.warning(f"Raw completion attempt {attempt} failed: {str(e)}")
                if attempt < max_retries:
                    await asyncio.sleep(delay)
                    delay *= 2.0

        raise last_exception or RuntimeError("Raw generation failed after max retries.")
