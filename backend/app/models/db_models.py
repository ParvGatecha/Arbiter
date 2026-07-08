from datetime import datetime
from typing import List, Optional, Dict, Any
from sqlmodel import SQLModel, Field, Relationship, Column, JSON

class Organization(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str = Field(index=True)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    
    # Relationships
    projects: List["Project"] = Relationship(back_populates="organization", sa_relationship_kwargs={"cascade": "all, delete-orphan"})


class Project(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    organization_id: Optional[int] = Field(default=None, foreign_key="organization.id")
    name: str = Field(index=True)
    description: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    # Relationships
    organization: Optional[Organization] = Relationship(back_populates="projects")
    test_suites: List["TestSuite"] = Relationship(back_populates="project", sa_relationship_kwargs={"cascade": "all, delete-orphan"})
    agent_configs: List["AgentConfig"] = Relationship(back_populates="project", sa_relationship_kwargs={"cascade": "all, delete-orphan"})
    policies: List["Policy"] = Relationship(back_populates="project", sa_relationship_kwargs={"cascade": "all, delete-orphan"})
    gateway_logs: List["GatewayLog"] = Relationship(back_populates="project", sa_relationship_kwargs={"cascade": "all, delete-orphan"})


class AgentConfig(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    project_id: int = Field(foreign_key="project.id")
    name: str = Field(index=True)
    role: str = Field(default="assistant")
    allowed_models: str = Field(default="gpt-4o,claude-3-5-sonnet")  # Comma-separated
    allowed_tools: str = Field(default="*")
    budget_limit: float = Field(default=100.0)
    rate_limit_rpm: int = Field(default=60)
    human_approval_required: bool = Field(default=False)
    created_at: datetime = Field(default_factory=datetime.utcnow)

    # Relationships
    project: Project = Relationship(back_populates="agent_configs")
    memories: List["SecureMemory"] = Relationship(back_populates="agent", sa_relationship_kwargs={"cascade": "all, delete-orphan"})
    gateway_logs: List["GatewayLog"] = Relationship(back_populates="agent_config")


class Policy(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    project_id: int = Field(foreign_key="project.id")
    name: str = Field(index=True)
    is_active: bool = Field(default=True)
    created_at: datetime = Field(default_factory=datetime.utcnow)

    # Relationships
    project: Project = Relationship(back_populates="policies")
    rules: List["PolicyRule"] = Relationship(back_populates="policy", sa_relationship_kwargs={"cascade": "all, delete-orphan"})


class PolicyRule(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    policy_id: int = Field(foreign_key="policy.id")
    name: str
    rule_type: str = Field(index=True)  # "credential", "pii", "budget", etc.
    action: str = Field(default="block")  # "block", "flag", "mask", "approval"
    configuration: str = Field(default="{}")  # JSON string config
    created_at: datetime = Field(default_factory=datetime.utcnow)

    # Relationships
    policy: Policy = Relationship(back_populates="rules")


class GatewayLog(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    project_id: int = Field(foreign_key="project.id")
    agent_config_id: Optional[int] = Field(default=None, foreign_key="agentconfig.id")
    prompt_text: str
    response_text: Optional[str] = None
    latency_ms: float = Field(default=0.0)
    prompt_tokens: int = Field(default=0)
    completion_tokens: int = Field(default=0)
    cost: float = Field(default=0.0)
    timestamp: datetime = Field(default_factory=datetime.utcnow)

    # Relationships
    project: Project = Relationship(back_populates="gateway_logs")
    agent_config: Optional[AgentConfig] = Relationship(back_populates="gateway_logs")
    security_events: List["SecurityEvent"] = Relationship(back_populates="gateway_log", sa_relationship_kwargs={"cascade": "all, delete-orphan"})


class SecurityEvent(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    gateway_log_id: Optional[int] = Field(default=None, foreign_key="gatewaylog.id")
    threat_category: str = Field(index=True)  # "Jailbreak", "Prompt Injection", etc.
    risk_score: float = Field(default=0.0)
    severity: str = Field(default="MEDIUM")  # "LOW", "MEDIUM", "HIGH", "CRITICAL"
    mitre_mapping: Optional[str] = None
    action_taken: str = Field(default="blocked")
    timestamp: datetime = Field(default_factory=datetime.utcnow)

    # Relationships
    gateway_log: Optional[GatewayLog] = Relationship(back_populates="security_events")


class SecureMemory(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    agent_config_id: int = Field(foreign_key="agentconfig.id")
    memory_hash: str = Field(index=True)
    encrypted_content: str
    trust_score: float = Field(default=1.0)
    integrity_signature: str
    created_at: datetime = Field(default_factory=datetime.utcnow)
    expires_at: Optional[datetime] = None

    # Relationships
    agent: AgentConfig = Relationship(back_populates="memories")
    audit_logs: List["MemoryAuditLog"] = Relationship(back_populates="memory", sa_relationship_kwargs={"cascade": "all, delete-orphan"})


class MemoryAuditLog(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    memory_id: int = Field(foreign_key="securememory.id")
    action: str  # "create", "update", "delete", "rollback"
    previous_hash: Optional[str] = None
    timestamp: datetime = Field(default_factory=datetime.utcnow)

    # Relationships
    memory: SecureMemory = Relationship(back_populates="audit_logs")


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
    results: List["EvaluationResult"] = Relationship(back_populates="test_case")


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
