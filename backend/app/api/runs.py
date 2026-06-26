from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.future import select
from sqlmodel.ext.asyncio.session import AsyncSession
from pydantic import BaseModel, Field

from backend.app.core.database import get_db_session
from backend.app.models.db_models import Project, TestSuite, TestCase, EvaluationRun, EvaluationResult
from backend.app.services.statistics import compute_regression_analysis, StatisticalReport
from backend.app.tasks.evaluation import run_evaluation_batch_task

router = APIRouter()

# --- Pydantic Request Schemas ---

class TriggerRunRequest(BaseModel):
    project_id: int
    suite_id: int
    target_url: str = Field(..., description="URL of the model/endpoint under test")
    commit_sha: str = Field(..., description="Git commit hash")
    branch: str = Field(..., description="Git branch name")

# --- API Endpoints ---

@router.post("/", response_model=EvaluationRun, status_code=status.HTTP_202_ACCEPTED)
async def trigger_evaluation_run(
    run_in: TriggerRunRequest, 
    db: AsyncSession = Depends(get_db_session)
):
    """
    Triggers an asynchronous evaluation run using the Celery worker pipeline.
    """
    # Verify project exists
    project = await db.get(Project, run_in.project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    # Verify suite exists
    suite = await db.get(TestSuite, run_in.suite_id)
    if not suite:
        raise HTTPException(status_code=404, detail="TestSuite not found")
    
    # Save the run status as PENDING
    db_run = EvaluationRun(
        suite_id=run_in.suite_id,
        status="PENDING",
        commit_sha=run_in.commit_sha,
        branch=run_in.branch,
        target_url=run_in.target_url
    )
    db.add(db_run)
    await db.commit()
    await db.refresh(db_run)

    # Dispatch evaluation to Celery queue worker
    run_evaluation_batch_task.delay(db_run.id)
    
    return db_run


@router.get("/", response_model=List[EvaluationRun])
async def list_evaluation_runs(db: AsyncSession = Depends(get_db_session)):
    """
    Lists all evaluation runs ordered by creation timestamp.
    """
    stmt = select(EvaluationRun).order_by(EvaluationRun.created_at.desc())
    result = await db.execute(stmt)
    return result.scalars().all()


@router.get("/{run_id}")
async def get_evaluation_run(
    run_id: int, 
    db: AsyncSession = Depends(get_db_session)
):
    """
    Retrieves the detailed run metrics, metadata, overall status, and specific test execution items.
    """
    run = await db.get(EvaluationRun, run_id)
    if not run:
        raise HTTPException(status_code=404, detail="EvaluationRun not found")

    # Fetch execution result items
    stmt = select(EvaluationResult).where(EvaluationResult.run_id == run_id)
    result = await db.execute(stmt)
    results = result.scalars().all()

    return {
        "id": run.id,
        "suite_id": run.suite_id,
        "status": run.status,
        "commit_sha": run.commit_sha,
        "branch": run.branch,
        "target_url": run.target_url,
        "created_at": run.created_at,
        "completed_at": run.completed_at,
        "results": results
    }


@router.get("/{run_id}/compare/{baseline_run_id}", response_model=StatisticalReport)
async def compare_evaluation_runs(
    run_id: int, 
    baseline_run_id: int, 
    db: AsyncSession = Depends(get_db_session)
):
    """
    Fetches all results for both runs, extracts the scores,
    feeds them into compute_regression_analysis, and returns the StatisticalReport.
    """
    candidate_run = await db.get(EvaluationRun, run_id)
    baseline_run = await db.get(EvaluationRun, baseline_run_id)
    if not candidate_run or not baseline_run:
        raise HTTPException(status_code=404, detail="One or both evaluation runs not found")

    # Fetch candidate scores
    cand_stmt = select(EvaluationResult.score).where(EvaluationResult.run_id == run_id)
    cand_result = await db.execute(cand_stmt)
    cand_scores = list(cand_result.scalars().all())

    # Fetch baseline scores
    base_stmt = select(EvaluationResult.score).where(EvaluationResult.run_id == baseline_run_id)
    base_result = await db.execute(base_stmt)
    base_scores = list(base_result.scalars().all())

    # Compute regression metrics
    report = compute_regression_analysis(base_scores, cand_scores)
    return report
