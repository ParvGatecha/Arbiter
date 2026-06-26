import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from backend.app.services.inference_client import InferenceClient, EvaluationJudgeOutput

@pytest.mark.asyncio
async def test_inference_client_raw_completion():
    """Verify raw completions trigger the target openai API with prompt values."""
    client = InferenceClient()
    
    # Mock the internal AsyncOpenAI client completion call
    mock_choice = MagicMock()
    mock_choice.message.content = "SQL Query Result"
    mock_response = MagicMock()
    mock_response.choices = [mock_choice]
    
    client.openai_client.chat.completions.create = AsyncMock(return_value=mock_response)
    
    output = await client.call_raw(
        prompt="Generate SQL",
        system_prompt="You are SQL coder",
        model="llama3",
        temperature=0.0
    )
    
    assert output == "SQL Query Result"
    client.openai_client.chat.completions.create.assert_called_once()

@pytest.mark.asyncio
async def test_inference_client_structured_judge():
    """Verify structured LLM-as-a-judge output behaves correctly when mocked."""
    client = InferenceClient()
    
    # Mock return value for instructor patched client
    expected_output = EvaluationJudgeOutput(
        score=0.9,
        alignment_justification="The query matches constraints.",
        violation_detected=False
    )
    
    client.instructor_client.chat.completions.create = AsyncMock(return_value=expected_output)
    
    output = await client.generate_structured(
        prompt="Analyze code output",
        response_model=EvaluationJudgeOutput,
        system_prompt="You are judge"
    )
    
    assert output.score == 0.9
    assert output.violation_detected is False
    assert "matches constraints" in output.alignment_justification
    client.instructor_client.chat.completions.create.assert_called_once()
