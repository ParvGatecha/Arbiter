# ⚖️ ARBITER: Enterprise AI Trust Platform & Operating System

[![FastAPI](https://img.shields.io/badge/FastAPI-005571?style=for-the-badge&logo=fastapi)](https://fastapi.tiangolo.com/)
[![React](https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)](https://react.dev/)
[![Celery](https://img.shields.io/badge/Celery-37814A?style=for-the-badge&logo=celery&logoColor=white)](https://docs.celeryq.dev/)
[![SQLModel](https://img.shields.io/badge/SQLModel-009688?style=for-the-badge&logo=pydantic&logoColor=white)](https://sqlmodel.tiangolo.com/)
[![SciPy](https://img.shields.io/badge/SciPy-8CAAE6?style=for-the-badge&logo=scipy&logoColor=white)](https://scipy.org/)
[![OpenTelemetry](https://img.shields.io/badge/OpenTelemetry-F15A24?style=for-the-badge&logo=opentelemetry&logoColor=white)](https://opentelemetry.io/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)

ARBITER is a production-ready, self-hosted LLM evaluation framework and Enterprise AI Trust Platform. It secures, policy-checks, audits, and monitors model interactions in real time via a sub-millisecond reverse proxy gateway while retaining its reliable asynchronous Celery evaluation pipelines, adversarial red-teaming generation, and statistical regression testing gates.

---

## 🏛️ Architectural Overview

ARBITER integrates three primary execution planes:

```
                            +--------------------------+
                            |    Agent Client / SDK    |
                            +------------+-------------+
                                         |
                                         v (POST /api/gateway/chat/completions)
+-----------------------+   HTTP   +-----+---------------------+   OpenTelemetry
|  React Web Dashboard  |<-------->|   Arbiter Secure Gateway  +--------------> [OTel Collector]
| (Served on Port 80)   |          +-----+----------+----------+
+-----------------------+                |          |
                                         |          | SQLModel
                                         v          v
                                    +----+---+  +----+----+
                                    | Redis  |  |Postgres |
                                    +----+---+  +---------+
                                         |
                                         v
                                  +------+--------+
                                  | Celery Worker |
                                  +------+--------+
                                         |
                          +--------------+--------------+
                          v                             v
              +-----------+-----------+     +-----------+-----------+
              | Target Model Endpoint |     | LLM Judge Model (OTel)|
              | (Ollama / SGLang/OAI) |     | (Ollama / SGLang/OAI) |
              +-----------------------+     +-----------------------+
```

1. **Arbiter Secure Gateway Proxy (`backend/app/api/gateway.py`)**: Intercepts chat completions, executes inline security scans, checks rules against dynamic YAML policies, routes requests to LLM providers (OpenAI, Anthropic, Gemini, Ollama), audits generated outputs, and returns audited payloads.
2. **FastAPI Control Plane Server (`backend/app/main.py`)**: Orchestrates admin routing, API key configuration, organizations, test suites, policy rules, and historical audit lookups.
3. **Celery Worker & Redis Broker (`backend/app/tasks/`)**: Handles long-running evaluation suites, statistical drift calculations, and adversarial testing asynchronously.
4. **Security Scanner Shield (`backend/app/services/security_scanner.py`)**: Rule-based and pattern matching detection for prompt injections, jailbreaks, PII (SSN, credit card, email) masking, credentials leakage, and HTML/Unicode obfuscations mapped directly to MITRE ATT&CK and OWASP LLM Top 10 vectors.
5. **Declarative Policy Engine (`backend/app/services/policy_evaluator.py`)**: Compiles and simulates active project-level YAML files to block, mask, flag, or request approval for transactions.
6. **Secure Cryptographic Memory (`backend/app/services/memory_manager.py`)**: Encrypts agent memory fragments with Fernet (AES-128) and signs payloads using HMAC-SHA256 integrity signatures to defend against memory poisoning.
7. **Statistical Regression Engine (`backend/app/services/statistics.py`)**: Compares score distributions using non-parametric Wilcoxon rank-sum analysis and bootstrap resampling to flag regressions compared to baseline runs.

---

## 📂 Project Structure

```
Arbiter/
├── backend/
│   ├── app/
│   │   ├── api/          # FastAPI routers (endpoints, runs, gateway proxy)
│   │   ├── core/         # Core settings, database connection, Celery configuration
│   │   ├── models/       # SQLModel database schemas (Project, Org, Policy, Log, Memory)
│   │   ├── services/     # Security scanner, YAML policy evaluator, memory manager, stats
│   │   └── tasks/        # Celery task definitions
│   └── tests/            # Pytest test suite (including test_security_gateway.py)
├── frontend/
│   ├── src/              # React code (App, components, pages)
│   ├── Dockerfile        # Production Vite + Nginx container config
│   └── index.html
├── cli/
│   ├── arbiter_cli/      # Typer CLI application
│   └── pyproject.toml    # CLI package configuration
├── deploy/
│   └── k8s/              # Kubernetes manifests (deployments, configmaps, services)
├── .env                  # Project secrets and system configurations
└── docker-compose.yml    # Core local development stack orchestrator
```

---

## ⚡ 1. Quickstart (Docker Compose)

Launch the core Arbiter backend database, Redis queue broker, and React dashboard:

### Step 1: Create your `.env` file
Duplicate the configurations below into a file named `.env` in the root folder of the project:

```env
# Database Credentials
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres_prod_secure_pass
POSTGRES_DB=arbiter

# Security Ciphers
SECRET_KEY=arbiter-secret-key-jwt-signing-token-verification-12345
ENCRYPTION_KEY=Z3VpZGVsaW5lc19mb3JfZW5jcnlwdGlvbl9rZXlfMzJieXRlcw==

# LLM Configs for red-teaming and alignment judging
JUDGE_PROVIDER=openai
JUDGE_MODEL=gpt-4o-mini
OPENAI_API_KEY=your_openai_api_key_here
OPENAI_BASE_URL=

# Provider keys for Gateway routing
ANTHROPIC_API_KEY=your_anthropic_key_here
GEMINI_API_KEY=your_gemini_key_here

# Frontend variables
VITE_API_URL=http://localhost:8000
REDIS_URL=redis://redis:6379/0
```

### Step 2: Build and Launch the Stack
```bash
docker-compose up --build
```

---

## 🛡️ 2. Gateway API & Policy Configuration

Submit request transactions directly through the proxy to gain immediate safety metrics.

### Gateway Completion Request
```bash
curl -X POST http://localhost:8000/api/gateway/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "project_id": 1,
    "model": "gpt-4o",
    "messages": [
      {"role": "user", "content": "Hello, email me at contact@domain.com"}
    ],
    "temperature": 0.5
  }'
```

### Example YAML Policy Definition
```yaml
name: strict-finance-shield
scope: project
rules:
  - name: mask-emails
    type: pii-detector
    action: mask
    types: [EMAIL]
  - name: block-aws-keys
    type: credential-scanner
    action: block
```

---

## 📈 3. Statistical Regression Engine

Standard LLM evaluations rely on mean score changes, which are easily skewed by outliers. ARBITER solves this by comparing score distributions using non-parametric analysis:

1. **Mann-Whitney U Test (Wilcoxon Rank-Sum)**: Evaluates the null hypothesis $H_0$: the probability that a random draw from the candidate distribution is greater than a random draw from the baseline is equal to 0.5.
2. **Bootstrap Confidence Interval**: Computes the distribution shift by bootstrapping the difference in means across 1,000 resamples.

If the p-value indicates significance ($p < 0.05$) and the confidence interval is entirely negative, the candidate run is flagged as a **statistically significant regression**.

---

## 💻 4. Command Line Interface (CLI)

The CLI client allows developers to trigger and monitor runs from terminal sessions or automated integration runners.

### Installation
```bash
pip install -e ./cli
```

### Automated CI/CD Verification
Running comparisons returns exit code `1` if a significant performance regression is found, preventing broken updates from shipping:
```bash
arbiter compare --candidate-run-id 42 --baseline-run-id 12 || echo "Regression detected, blocking deploy!"
```

---

## ☸️ 5. Kubernetes Production Deployment

Production manifests are located in `deploy/k8s/` to spin up high-availability clusters:

```bash
# Deploy all pods (Gateway, Backend, Celery, Redis Configs) to EKS
kubectl apply -f deploy/k8s/deployment.yaml
```

---

## 🧪 6. Local Development & Testing

Run the security test suite inside the isolated python virtual environment:

```bash
# Setup backend venv
cd backend
python -m venv venv
source venv/bin/activate  # Or `.\venv\Scripts\activate` on Windows
pip install -r requirements.txt

# Run security and gateway test suites
PYTHONPATH=. pytest tests/test_security_gateway.py
```
