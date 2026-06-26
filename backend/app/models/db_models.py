from datetime import datetime
from typing import List, Optional, Dict, Any
from sqlmodel import SQLModel, Field, Relationship, Column, JSON

class Project(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str = Field(index=True)
    description: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    # Relationships
    test_suites: List["TestSuite"] = Relationship(back_populates="project", sa_relationship_kwargs={"cascade": "all, delete-orphan"})


class TestSuite(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    project_id: int = Field(foreign_key="project.id")
    name: str = Field(index=True)
    system_prompt: str
    target_model_config: Dict[str, Any] = Field(default_factory=dict, sa_column=Column(JSON))
    intent_definition: Dict[str, Any] = Field(default_factory=dict, sa_column=Column(JSON))
    created_at: datetime = Field(default_factory=datetime.utcnow)

    # Relationships
    project: Project = Relationship(back_populates="test_suites")
    test_cases: List["TestCase"] = Relationship(back_populates="test_suite", sa_relationship_kwargs={"cascade": "all, delete-orphan"})
    runs: List["EvaluationRun"] = Relationship(back_populates="test_suite", sa_relationship_kwargs={"cascade": "all, delete-orphan"})


class TestCase(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    suite_id: int = Field(foreign_key="testsuite.id")
    input_prompt: str
    expected_output: Optional[str] = None
    intent_category: str = Field(index=True)
    adversarial_flag: bool = Field(default=False, index=True)
    created_at: datetime = Field(default_factory=datetime.utcnow)

    # Relationships
    test_suite: TestSuite = Relationship(back_populates="test_cases")
    results: List["EvaluationResult"] = Relationship(back_populates="test_case", sa_relationship_kwargs={"cascade": "all, delete-orphan"})


class EvaluationRun(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    suite_id: int = Field(foreign_key="testsuite.id")
    status: str = Field(default="PENDING", index=True)  # PENDING, RUNNING, COMPLETED, FAILED
    commit_sha: Optional[str] = Field(default=None, index=True)
    branch: Optional[str] = Field(default=None, index=True)
    target_url: Optional[str] = Field(default=None)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    completed_at: Optional[datetime] = Field(default=None)

    # Relationships
    test_suite: TestSuite = Relationship(back_populates="runs")
    results: List["EvaluationResult"] = Relationship(back_populates="run", sa_relationship_kwargs={"cascade": "all, delete-orphan"})


class EvaluationResult(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    run_id: int = Field(foreign_key="evaluationrun.id")
    test_case_id: int = Field(foreign_key="testcase.id")
    actual_output: str
    score: float = Field(default=0.0)  # 0.0 to 1.0
    rationale: str
    latency_ms: float = Field(default=0.0)
    token_count: int = Field(default=0)
    cost: float = Field(default=0.0)

    # Relationships
    run: EvaluationRun = Relationship(back_populates="results")
    test_case: TestCase = Relationship(back_populates="results")
