<div align="center">

# ⚖️ ARBITER
### Enterprise AI Trust Platform, Reverse Proxy Gateway & Statistical Regression Engine

*Zero-Trust AI Guardrails, Real-Time Sub-Millisecond Proxy Security, Cryptographic Memory Defense, and Non-Parametric LLM Statistical Auditing.*

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg?style=for-the-badge)](https://opensource.org/licenses/MIT)
[![Python 3.11+](https://img.shields.io/badge/Python-3.11%2B-3776AB.svg?style=for-the-badge&logo=python&logoColor=white)](https://python.org)
[![FastAPI](https://img.shields.io/badge/FastAPI-005571?style=for-the-badge&logo=fastapi)](https://fastapi.tiangolo.com/)
[![React](https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)](https://react.dev/)
[![Celery](https://img.shields.io/badge/Celery-37814A?style=for-the-badge&logo=celery&logoColor=white)](https://docs.celeryq.dev/)
[![Docker](https://img.shields.io/badge/Docker-2496ED?style=for-the-badge&logo=docker&logoColor=white)](https://docker.com)
[![Kubernetes](https://img.shields.io/badge/Kubernetes-326CE5?style=for-the-badge&logo=kubernetes&logoColor=white)](https://kubernetes.io)
[![OpenTelemetry](https://img.shields.io/badge/OpenTelemetry-F15A24?style=for-the-badge&logo=opentelemetry&logoColor=white)](https://opentelemetry.io/)

[ 📖 Features ](#-key-features) • [ ⚡ 2-Min Quickstart ](#-quickstart) • [ 🏛️ Architecture ](#️-architectural-overview) • [ 🛡️ Gateway & Policies ](#-gateway-api--policy-engine) • [ 📊 Statistical Engine ](#-statistical-regression-engine) • [ ⚖️ LLM Judge ](#️-multi-dimensional-rubric-llm-as-a-judge) • [ 🔄 Flywheel ](#-production-to-benchmark-flywheel) • [ 💻 CLI & CI/CD ](#-command-line-interface-cli--cicd) • [ ☸️ Production Deploy ](#️-production-deployment-docker--k8s)

---

</div>

## 🚀 Overview

**ARBITER** is a production-ready, enterprise-grade **AI Trust Platform and Reverse Proxy Gateway**. It acts as a zero-trust control plane for Large Language Model (LLM) deployments, securing model interactions in real time via a sub-millisecond reverse proxy while providing automated statistical regression testing, adversarial red-teaming pipelines, and cryptographic agent memory protection.

As LLMs transition into enterprise workflows and autonomous agentic loops, traditional software testing and static firewalls fall short. ARBITER fills this void by intercepting model calls, enforcing dynamic declarative security policies, shielding long-term agent memory from corruption, and mathematically asserting model performance across CI/CD rollouts using non-parametric statistics.

---

## ✨ Key Features

| Capability | Description | Core Module |
| :--- | :--- | :--- |
| 🛡️ **Reverse Proxy Gateway** | Intercepts `chat/completions` calls in real time. Compatible drop-in replacement for OpenAI, Anthropic, Gemini, Ollama, and vLLM. | `backend/app/api/gateway.py` |
| 🕵️ **Real-Time Threat Scanner** | Scans for prompt injections, jailbreaks, PII leakage (SSN, Email, CC), credentials, and obfuscated payloads mapped to MITRE ATT&CK & OWASP LLM Top 10. | `backend/app/services/security_scanner.py` |
| 📋 **Declarative YAML Policies** | Compile dynamic policy rules to `block`, `mask`, `flag`, or restrict tool executions per project without re-deploying code. | `backend/app/services/policy_evaluator.py` |
| 📊 **Statistical Regression Engine** | **Paired Wilcoxon Signed-Rank** & **Mann-Whitney U** testing with **Cliff's Delta ($\delta$) Effect Sizes** and **Bootstrap 95% CIs** prevent false positives in CI/CD. | `backend/app/services/statistics.py` |
| ⚖️ **Multi-Dimensional LLM Judge** | Decomposed rubric scoring (*Faithfulness, Safety, Instruction Following, Conciseness*) with structured Pydantic outputs and OTel telemetry. | `backend/app/services/evaluator.py` |
| 🔄 **Production-to-Benchmark Flywheel** | One-click promotion of live production Gateway security events and failure cases into persistent regression test cases. | `backend/app/api/endpoints.py` |
| 🔐 **Cryptographic Memory Guard** | Fernet (AES-128) payload encryption and HMAC-SHA256 integrity signatures protect agent state against memory poisoning attacks. | `backend/app/services/memory_manager.py` |
| 🤖 **Asynchronous Red-Teaming** | Celery & Redis pipeline executing automated red-teaming prompt synthesis across 5 attack vectors using Pydantic AI. | `backend/app/services/adversarial.py` |
| 💻 **CLI & CI/CD Gating** | Developer CLI with auto Git SHA detection that exits with code `1` on detected statistical performance regressions. | `cli/arbiter_cli/main.py` |
| 🔭 **OpenTelemetry Tracing** | Full OTel span integration for distributed tracing across gateway proxying, evaluation tasks, and judge evaluations. | `backend/app/core/config.py` |

---

## 🏛️ Architectural Overview

ARBITER operates across three coordinated execution planes:

```
                                +-----------------------------------+
                                |  Client App / Agent Framework     |
                                |  (LangChain, LlamaIndex, AutoGen) |
                                +-----------------+-----------------+
                                                  |
                                                  v  (POST /api/gateway/chat/completions)
+------------------------+   HTTP       +---------+-------------------------+   OpenTelemetry
|  React Web Dashboard   |<------------>|  ARBITER Reverse Proxy Gateway    +---------------> [OTel Collector]
|  (Monitoring & Audits) |              |  (Security Scan & Policy Check)  |
+------------------------+              +----+-------------------------+----+
                                             |                         |
                                     SQLModel|                         | Async Task
                                             v                         v
                                      +--------------+          +--------------+
                                      | PostgreSQL   |          | Redis Broker |
                                      +--------------+          +------+-------+
                                                                       |
                                                                       v
                                                                +--------------+
                                                                | Celery Worker|
                                                                +------+-------+
                                                                       |
                                         +-----------------------------+-----------------------------+
                                         |                                                           |
                                         v                                                           v
                             +-----------------------+                                   +-----------------------+
                             | Target Model Endpoint |                                   | LLM Judge Model       |
                             | (Ollama / OAI / SGL)  |                                   | (Alignment Auditing)  |
                             +-----------------------+                                   +-----------------------+
```

1. **Proxy & Control Plane (`backend/app/`)**: High-throughput FastAPI reverse proxy running inline security filters and dynamic YAML policy evaluations.
2. **Distributed Queue & Asynchronous Workers (`tasks/`, `Celery`)**: Offloads long-running test suites, red-teaming suites, and statistical calculations with `asyncio.Semaphore` rate-limiting.
3. **Storage & Observability (`PostgreSQL`, `Redis`, `OpenTelemetry`)**: Persistent database audit logs, security event vectors, encrypted agent memories, and telemetry spans.

---

## ⚡ Quickstart

Launch the complete ARBITER stack (Backend, Frontend, PostgreSQL, Redis, and Celery) in less than two minutes using Docker Compose.

### Prerequisites
* [Docker Desktop](https://www.docker.com/products/docker-desktop/) or Docker Engine with Docker Compose installed.
* Python 3.11+ (optional, if using the CLI locally).

### 1. Clone & Configure Environment
```bash
git clone https://github.com/ParvGatecha/Arbiter.git
cd Arbiter
```

Create your `.env` configuration file in the project root:

```env
# Storage Credentials
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres_prod_secure_pass
POSTGRES_DB=arbiter
POSTGRES_SERVER=db
REDIS_URL=redis://redis:6379/0

# System Ciphers (32-byte Fernet Key for Memory Security)
SECRET_KEY=arbiter-secret-key-jwt-signing-token-verification-12345
ENCRYPTION_KEY=Z3VpZGVsaW5lc19mb3JfZW5jcnlwdGlvbl9rZXlfMzJieXRlcw==

# LLM Providers (Required for downstream gateway routing & judging)
JUDGE_PROVIDER=openai
JUDGE_MODEL=gpt-4o-mini
OPENAI_API_KEY=your_openai_api_key_here

# Optional Provider API Keys
ANTHROPIC_API_KEY=your_anthropic_api_key
GEMINI_API_KEY=your_gemini_api_key

# Frontend API Base URL
VITE_API_URL=http://localhost:8000
```

### 2. Launch the Stack
```bash
docker-compose up --build -d
```

### 3. Access Services
* **React Web Dashboard**: [`http://localhost:80`](http://localhost:80)
* **FastAPI Gateway & OpenAPI Docs**: [`http://localhost:8000/docs`](http://localhost:8000/docs)
* **Gateway Proxy Endpoint**: `http://localhost:8000/api/gateway/chat/completions`

---

## 🛡️ Gateway API & Policy Engine

### Drop-in OpenAI SDK Integration
You can use ARBITER as a drop-in replacement for OpenAI or any compatible LLM provider by simply overriding the `base_url`:

```python
from openai import OpenAI

client = OpenAI(
    base_url="http://localhost:8000/api/gateway",
    api_key="your_openai_api_key"
)

response = client.chat.completions.create(
    model="gpt-4o",
    messages=[
        {"role": "user", "content": "Please contact customer support at support@company.com"}
    ],
    extra_body={"project_id": 1}  # Route through project policy rules
)

print(response.choices[0].message.content)
```

### Direct HTTP Request Example
```bash
curl -X POST http://localhost:8000/api/gateway/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "project_id": 1,
    "model": "gpt-4o",
    "messages": [
      {"role": "user", "content": "Hello, email me at john.doe@example.com"}
    ],
    "temperature": 0.7
  }'
```

### Dynamic Declarative YAML Policies
Define project-level rules in YAML format to block dangerous requests, redact PII in real time, or restrict tool executions:

```yaml
name: enterprise-finance-shield
scope: project
version: "1.0"
rules:
  # Redact PII automatically before reaching downstream model
  - name: mask-sensitive-pii
    type: pii-detector
    action: mask
    types: [EMAIL, SSN, CREDIT_CARD]

  # Block prompt injections and credential leaks
  - name: block-jailbreak-attempts
    type: prompt-injection
    action: block

  - name: prevent-secret-leakage
    type: credential-scanner
    action: block

  # Restrict unauthorized agent tool execution
  - name: restrict-production-db-access
    type: unsafe-tool
    action: block
    blacklist: [execute_sql, write_database]
```

---

## 📊 Statistical Regression Engine

Evaluating LLM performance using simple average score differences often leads to **false positives** due to extreme score outliers and high variance across prompt evaluation suites.

ARBITER solves this with **non-parametric statistical analysis and effect size estimation**:

1. **Paired Wilcoxon Signed-Rank Test**: When comparing candidate and baseline runs on identical benchmark test cases, ARBITER pairs the observations to eliminate case-difficulty variance:
   $$W = \sum_{i=1}^{N_r} \left[ \text{sgn}(x_{2,i} - x_{1,i}) \cdot R_i \right]$$
   *(Falls back to Mann-Whitney U rank-sum for unpaired / unequal sample sizes).*

2. **Cliff’s Delta ($\delta$) Effect Size**: Non-parametric effect size quantifying the practical dominance of one distribution over another:
   $$\delta = \frac{\#(\text{candidate} > \text{baseline}) - \#(\text{candidate} < \text{baseline})}{n_1 n_2}$$
   Categorized into `NEGLIGIBLE` ($|\delta| < 0.147$), `SMALL` ($0.147 \le |\delta| < 0.33$), `MEDIUM` ($0.33 \le |\delta| < 0.474$), and `LARGE` ($|\delta| \ge 0.474$).

3. **Bootstrap Resampling (95% Confidence Interval)**: 1,000 resamples of paired score differences to establish empirical bounds ($CI_{lower}, CI_{upper}$).

4. **Sample Size & Statistical Power Warning**: Flags when $n < 30$ test cases to alert developers to lower statistical power.

```
                             Score Distribution Comparison
      Baseline Run  [░░░▒▒▓▓▓▓▓▓▒▒░░]
      Candidate Run [░░▒▒▓▓▓▓▒▒░░░░░]  --> Shift Detected (p < 0.05, Cliff's d = -0.62 [LARGE])
```

* **REGRESSION Trigger**: If $p < 0.05$ and $CI_{upper} < 0.0$, ARBITER flags the candidate as a **statistically significant regression** and fails the CI/CD build.

---

## ⚖️ Multi-Dimensional Rubric LLM-as-a-Judge

Rather than reducing model quality to a single vague score, ARBITER's judge engine (`backend/app/services/evaluator.py`) evaluates outputs across four decomposed rubric dimensions via structured JSON schema:

* **Faithfulness Score ($0.0 - 1.0$)**: Factual adherence and grounding against the reference answer.
* **Safety Score ($0.0 - 1.0$)**: Guardrail resistance ($1.0 =$ zero jailbreak, prompt injection, or credential leak).
* **Instruction Following ($0.0 - 1.0$)**: Compliance with format, schema, and intent constraints.
* **Conciseness Score ($0.0 - 1.0$)**: Density and avoidance of boilerplate disclaimers.

---

## 🔄 Production-to-Benchmark Flywheel

Convert real-world adversarial attacks and edge cases into permanent regression test cases with a single API call:

```bash
curl -X POST http://localhost:8000/api/gateway/logs/42/promote-to-testcase \
  -H "Content-Type: application/json" \
  -d '{
    "suite_id": 1,
    "intent_category": "prompt_injection",
    "adversarial_flag": true
  }'
```


---

## 🔐 Cryptographic Agent Memory Guard

Autonomous agents rely heavily on long-term memory fragments. If malicious actors tamper with these memory stores, agents can be compromised permanently.

ARBITER implements a dual-layer cryptographic protection system (`backend/app/services/memory_manager.py`):

* **Fernet Symmetric Encryption (AES-128)**: Encrypts memory content payloads prior to database insertion using keys derived via PBKDF2-HMAC-SHA256.
* **Integrity Signatures (HMAC-SHA256)**: Signs each memory record. During retrieval, ARBITER verifies the payload signature; if tampering is detected, the memory is rejected instantly.

```python
from backend.app.services.memory_manager import MemoryManager

memory_mgr = MemoryManager(secret_key="your-system-secret-key")

# Store memory securely
encrypted_payload = memory_mgr.encrypt_memory({"context": "User prefers concise summaries"})
signature = memory_mgr.sign_memory(encrypted_payload)

# Read & Verify memory
is_valid = memory_mgr.verify_signature(encrypted_payload, signature)
decrypted_payload = memory_mgr.decrypt_memory(encrypted_payload)
```

---

## 💻 Command Line Interface (CLI) & CI/CD

ARBITER includes a terminal client (`arbiter_cli`) built with `Typer` and `Rich` designed for seamless CI/CD integration.

### Installation
```bash
pip install -e ./cli
```

### Trigger Evaluation & Assert Regression
The CLI automatically resolves your local Git commit SHA and branch, triggers an evaluation run, polls status, performs statistical comparison against baseline runs, and exits with status `1` if a regression is found:

```bash
arbiter evaluate \
  --api-url http://localhost:8000 \
  --project-id 1 \
  --suite-id 2 \
  --target-url http://localhost:8000/api/gateway/chat/completions
```

### GitHub Actions CI/CD Integration
Include ARBITER as a quality gate in your GitHub Actions workflows:

```yaml
name: AI Evaluation & Safety Regression Gate

on:
  push:
    branches: [ main, develop ]
  pull_request:

jobs:
  arbiter-eval:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Set up Python
        uses: actions/setup-python@v4
        with:
          python-version: "3.11"

      - name: Install Arbiter CLI
        run: pip install -e ./cli

      - name: Execute Statistical Evaluation
        env:
          ARBITER_API_URL: ${{ secrets.ARBITER_API_URL }}
        run: |
          arbiter evaluate \
            --api-url $ARBITER_API_URL \
            --project-id 1 \
            --suite-id 1 \
            --target-url https://api.yourdomain.com/v1/chat/completions
```

---

## ☸️ Production Deployment (Docker & K8s)

### Kubernetes Infrastructure
Manifests for deploying ARBITER into high-availability Kubernetes environments (EKS, GKE, AKS) are located in `deploy/k8s/`:

```bash
# Apply ConfigMaps, Secrets, Deployments, and Ingress
kubectl apply -f deploy/k8s/deployment.yaml
```

### Included Kubernetes Resources:
* **Gateway & API Deployment**: Horizontal scaling reverse proxy pods.
* **Celery Workers Deployment**: Asynchronous worker scaling.
* **Redis & PostgreSQL Services**: Production state management.
* **ConfigMaps & Secrets**: Secure environment variable bindings.

---

## ⚖️ Feature Matrix & Comparison

| Feature | ARBITER | Traditional Guardrails | Gateway Routers | Eval Frameworks |
| :--- | :---: | :---: | :---: | :---: |
| **Real-Time Reverse Proxy** | ✅ | ❌ | ✅ | ❌ |
| **Sub-Millisecond PII Redaction** | ✅ | ✅ | ⚠️ Partial | ❌ |
| **OWASP / MITRE Threat Scans** | ✅ | ⚠️ Basic | ❌ | ❌ |
| **Declarative YAML Policies** | ✅ | ⚠️ Python Code | ⚠️ Basic | ❌ |
| **Paired Non-Parametric Regressions** | ✅ (Wilcoxon + Bootstrap) | ❌ | ❌ | ❌ (Means only) |
| **Cliff's Delta Effect Sizes ($\delta$)** | ✅ | ❌ | ❌ | ❌ |
| **Multi-Dimensional LLM Rubrics** | ✅ | ❌ | ❌ | ⚠️ Manual |
| **Production-to-Benchmark Flywheel**| ✅ | ❌ | ❌ | ❌ |
| **Cryptographic Agent Memory** | ✅ | ❌ | ❌ | ❌ |
| **CI/CD Build Blocking (Exit Code 1)**| ✅ | ❌ | ❌ | ⚠️ Manual |
| **Native OpenTelemetry Tracing** | ✅ | ⚠️ Plugin | ⚠️ Plugin | ⚠️ Basic |


---

## 🧪 Testing & Development

Run backend test suites locally using `pytest`:

```bash
cd backend
python -m venv venv
source venv/bin/activate  # On Windows: .\venv\Scripts\activate
pip install -r requirements.txt

# Run complete pytest test suite
PYTHONPATH=. pytest tests/
```

---

## 📂 Project Structure

```
Arbiter/
├── backend/
│   ├── app/
│   │   ├── api/          # FastAPI endpoints (Gateway proxy, runs, management)
│   │   ├── core/         # Settings, database connection, Celery configuration
│   │   ├── models/       # SQLModel database schemas (Project, Policy, GatewayLog)
│   │   ├── services/     # Security scanner, YAML policy engine, stats, memory
│   │   └── tasks/        # Asynchronous Celery task runners
│   └── tests/            # Pytest suite (Gateway proxy, security, evaluation)
├── frontend/             # React dashboard (Vite, Tailwind CSS, Recharts)
├── cli/                  # Typer CLI application for CI/CD test enforcement
├── deploy/               # Kubernetes manifests and Cloud deployment templates
├── docker-compose.yml    # Main stack orchestration (Backend, UI, Postgres, Redis)
└── README.md             # Project documentation
```

---

## 🤝 Contributing

Contributions are welcome! Whether you are interested in expanding security scan rules, adding new policy handlers, improving UI analytics, or enhancing statistical models:

1. Fork the Repository.
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`).
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`).
4. Push to the Branch (`git push origin feature/AmazingFeature`).
5. Open a Pull Request.

---

## 📜 License

Distributed under the **MIT License**. See `LICENSE` for more information.

---

<div align="center">

**Built with ❤️ for AI Engineers & Security Teams.**

</div>
