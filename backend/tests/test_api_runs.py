import pytest
import httpx
from unittest.mock import AsyncMock, patch, MagicMock
from backend.app.main import app
from backend.app.core.database import get_db_session
from backend.app.models.db_models import Project, TestSuite, EvaluationRun, EvaluationResult

@pytest.fixture
def mock_db():
    session = MagicMock()
    session.get = AsyncMock()
    session.execute = MagicMock()  # Keep execute sync, or mock the return value properly
    session.commit = AsyncMock()
    session.refresh = AsyncMock()
    return session

@pytest.mark.asyncio
async def test_trigger_evaluation_run_success(mock_db):
    """Verify that triggering an evaluation run returns HTTP 202 and correct payload."""
    mock_project = Project(id=1, name="Arbiter Project")
    mock_suite = TestSuite(
        id=2, 
        project_id=1, 
        name="Guardrail Suite", 
        system_prompt="system", 
        target_model_config={}, 
        intent_definition={}
    )
    mock_run = EvaluationRun(id=5, suite_id=2, status="PENDING")

    async def mock_get(model, obj_id):
        if model == Project and obj_id == 1:
            return mock_project
        if model == TestSuite and obj_id == 2:
            return mock_suite
        return None

    mock_db.get.side_effect = mock_get
    
    # Overwrite refresh to simulate writing id
    async def mock_refresh(instance):
        instance.id = 5
        return instance
    mock_db.refresh.side_effect = mock_refresh

    # Override database session dependency
    app.dependency_overrides[get_db_session] = lambda: mock_db

    # Mock the Celery task delay
    with patch("backend.app.tasks.evaluation.run_evaluation_batch_task.delay") as mock_celery:
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as client:
            response = await client.post(
                "/api/runs/",
                json={
                    "project_id": 1,
                    "suite_id": 2,
                    "target_url": "http://mock-target/v1",
                    "commit_sha": "abc123sha",
                    "branch": "feature-branch"
                }
            )
        
        assert response.status_code == 202
        data = response.json()
        assert data["id"] == 5
        assert data["status"] == "PENDING"
        assert data["commit_sha"] == "abc123sha"
        mock_celery.assert_called_once_with(5)

    # Clean dependency overrides
    app.dependency_overrides.clear()

@pytest.mark.asyncio
async def test_compare_evaluation_runs_endpoint(mock_db):
    """Verify that comparing runs returns a correctly populated StatisticalReport."""
    mock_candidate_run = EvaluationRun(id=10, suite_id=1, status="COMPLETED")
    mock_baseline_run = EvaluationRun(id=5, suite_id=1, status="COMPLETED")

    async def mock_get(model, obj_id):
        if model == EvaluationRun and obj_id == 10:
            return mock_candidate_run
        if model == EvaluationRun and obj_id == 5:
            return mock_baseline_run
        return None

    mock_db.get.side_effect = mock_get

    # Mock DB executions returning scores
    mock_candidate_scores = MagicMock()
    mock_candidate_scores.scalars.return_value.all.return_value = [0.9, 0.95, 0.88, 0.92]
    
    mock_baseline_scores = MagicMock()
    mock_baseline_scores.scalars.return_value.all.return_value = [0.8, 0.85, 0.78, 0.82]

    # Mock execute as an async mock returning correct scalars
    async def mock_execute(stmt):
        stmt_str = str(stmt)
        if "10" in stmt_str or "run_id = 10" in stmt_str or "run_id = :run_id_1" in stmt_str:
            return mock_candidate_scores
        return mock_baseline_scores

    mock_db.execute = AsyncMock(side_effect=mock_execute)

    app.dependency_overrides[get_db_session] = lambda: mock_db

    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as client:
        response = await client.get("/api/runs/10/compare/5")
    
    assert response.status_code == 200
    data = response.json()
    assert "baseline_mean" in data
    assert "candidate_mean" in data
    assert "mean_difference" in data
    assert "outcome" in data
    assert "is_significant" in data

    app.dependency_overrides.clear()
