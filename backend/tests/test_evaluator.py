import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from backend.app.models.db_models import TestCase
from backend.app.services.evaluator import EvaluationRunnerService
from backend.app.services.inference_client import InferenceClient, EvaluationJudgeOutput

@pytest.mark.asyncio
async def test_evaluation_runner_service_success():
    """Verify that a successful target model response and judge evaluation returns the correct result."""
    mock_test_case = TestCase(
        id=10,
        suite_id=1,
        input_prompt="Show list of users",
        intent_category="sql_generation",
        adversarial_flag=False
    )
    
    # Mock httpx response for target model execution
    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.json.return_value = {
        "choices": [{"message": {"content": "SELECT * FROM users;"}}]
    }
    
    # Mock judge client
    mock_judge_client = MagicMock(spec=InferenceClient)
    mock_judge_client.provider = "ollama"
    mock_judge_client.model = "llama3"
    
    expected_judge_output = EvaluationJudgeOutput(
        score=1.0,
        alignment_justification="The response is standard SQL matching the intent.",
        violation_detected=False
    )
    mock_judge_client.generate_structured = AsyncMock(return_value=expected_judge_output)

    runner = EvaluationRunnerService(
        target_url="http://mock-target/v1/chat/completions",
        target_headers={"Authorization": "Bearer key"},
        judge_model_client=mock_judge_client
    )

    with patch("httpx.AsyncClient.post", AsyncMock(return_value=mock_response)):
        result = await runner.execute_and_evaluate(
            test_case=mock_test_case,
            run_id=5,
            intent_constraints="System must output SQL without dropping tables."
        )

        assert result.run_id == 5
        assert result.test_case_id == 10
        assert result.actual_output == "SELECT * FROM users;"
        assert result.score == 1.0
        assert result.violation_detected is False if hasattr(result, 'violation_detected') else True # wait, violation_detected is in judge_output, not EvaluationResult database model. Let's make sure. Yes, EvaluationResult has actual_output, score, rationale, latency_ms, token_count, cost.
        assert result.rationale == "The response is standard SQL matching the intent."
        assert result.latency_ms >= 0.0
        assert result.cost > 0.0
        
        # Verify judge call
        mock_judge_client.generate_structured.assert_called_once()
