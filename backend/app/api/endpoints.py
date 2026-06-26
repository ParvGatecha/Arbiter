from typing import List, Dict, Any, Optional
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, status
from sqlalchemy.future import select
from sqlmodel import Session
from sqlmodel.ext.asyncio.session import AsyncSession
from pydantic import BaseModel, Field

from backend.app.core.database import get_db_session
from backend.app.models.db_models import Project, TestSuite, TestCase, EvaluationRun, EvaluationResult
from backend.app.services.adversarial import generate_adversarial_variants
from backend.app.tasks.evaluation import run_evaluation_batch_task

router = APIRouter()

# --- Pydantic Schemas for API Requests/Responses ---

class ProjectCreate(BaseModel):
    name: str = Field(..., min_length=1)
    description: Optional[str] = None

class TestSuiteCreate(BaseModel):
    project_id: int
    name: str = Field(..., min_length=1)
    system_prompt: str
    target_model_config: Dict[str, Any] = Field(
        default_factory=lambda: {"provider": "ollama", "model": "llama3", "temperature": 0.7}
    )
    intent_definition: Dict[str, str] = Field(
        default_factory=dict,
        description="Key-value mapping of category name to human-readable intent description"
    )

class TestCaseCreate(BaseModel):
    suite_id: int
    input_prompt: str
    expected_output: Optional[str] = None
    intent_category: str
    adversarial_flag: bool = False

class EvaluationRunCreate(BaseModel):
    suite_id: int
    commit_sha: Optional[str] = None
    branch: Optional[str] = None

# --- API Endpoints ---

# Projects
@router.post("/projects", response_model=Project, status_code=status.HTTP_201_CREATED)
async def create_project(project_in: ProjectCreate, db: AsyncSession = Depends(get_db_session)):
    project = Project(name=project_in.name, description=project_in.description)
    db.add(project)
    await db.commit()
    await db.refresh(project)
    return project

@router.get("/projects", response_model=List[Project])
async def list_projects(db: AsyncSession = Depends(get_db_session)):
    stmt = select(Project)
    result = await db.execute(stmt)
    return result.scalars().all()

@router.get("/projects/{project_id}", response_model=Project)
async def get_project(project_id: int, db: AsyncSession = Depends(get_db_session)):
    project = await db.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return project

# TestSuites
@router.post("/suites", response_model=TestSuite, status_code=status.HTTP_201_CREATED)
async def create_suite(suite_in: TestSuiteCreate, db: AsyncSession = Depends(get_db_session)):
    # Verify project exists
    project = await db.get(Project, suite_in.project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    suite = TestSuite(
        project_id=suite_in.project_id,
        name=suite_in.name,
        system_prompt=suite_in.system_prompt,
        target_model_config=suite_in.target_model_config,
        intent_definition=suite_in.intent_definition
    )
    db.add(suite)
    await db.commit()
    await db.refresh(suite)
    return suite

@router.get("/suites/{suite_id}", response_model=TestSuite)
async def get_suite(suite_id: int, db: AsyncSession = Depends(get_db_session)):
    suite = await db.get(TestSuite, suite_id)
    if not suite:
        raise HTTPException(status_code=404, detail="TestSuite not found")
    return suite

@router.get("/suites", response_model=List[TestSuite])
async def list_suites(db: AsyncSession = Depends(get_db_session)):
    stmt = select(TestSuite)
    result = await db.execute(stmt)
    return result.scalars().all()

@router.get("/suites/{suite_id}/cases", response_model=List[TestCase])
async def list_suite_cases(suite_id: int, db: AsyncSession = Depends(get_db_session)):
    stmt = select(TestCase).where(TestCase.suite_id == suite_id)
    result = await db.execute(stmt)
    return result.scalars().all()

# Adversarial Generator Trigger
@router.post("/suites/{suite_id}/generate-adversarial", status_code=status.HTTP_202_ACCEPTED)
async def generate_adversarial_tests_endpoint(
    suite_id: int, 
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db_session)
):
    """
    Triggers automated red-teaming generation via Pydantic AI for all defined suite intents.
    """
    suite = await db.get(TestSuite, suite_id)
    if not suite:
        raise HTTPException(status_code=404, detail="TestSuite not found")
    
    if not suite.intent_definition:
        raise HTTPException(
            status_code=400, 
            detail="TestSuite has no intent definitions. Define intents to generate adversarial cases."
        )

    async def generate_and_save():
        for intent_cat, intent_desc in suite.intent_definition.items():
            try:
                batch = await generate_adversarial_variants(intent_desc, suite.system_prompt)
                for variant in batch.variants:
                    db_case = TestCase(
                        suite_id=suite.id,
                        input_prompt=variant.input_prompt,
                        intent_category=intent_cat,
                        adversarial_flag=True
                    )
                    db.add(db_case)
                await db.commit()
            except Exception as e:
                # Log and continue with next category
                print(f"Error generating adversarial tests for {intent_cat}: {str(e)}")

    background_tasks.add_task(generate_and_save)
    return {"message": "Adversarial test generation started in background."}

# TestCases CRUD
@router.post("/cases", response_model=TestCase, status_code=status.HTTP_201_CREATED)
async def create_test_case(case_in: TestCaseCreate, db: AsyncSession = Depends(get_db_session)):
    suite = await db.get(TestSuite, case_in.suite_id)
    if not suite:
        raise HTTPException(status_code=404, detail="TestSuite not found")
    
    case = TestCase(
        suite_id=case_in.suite_id,
        input_prompt=case_in.input_prompt,
        expected_output=case_in.expected_output,
        intent_category=case_in.intent_category,
        adversarial_flag=case_in.adversarial_flag
    )
    db.add(case)
    await db.commit()
    await db.refresh(case)
    return case
