# ⚖️ ARBITER: Self-Hosted Production-Grade LLM Evaluation Platform

[![FastAPI](https://img.shields.io/badge/FastAPI-005571?style=for-the-badge&logo=fastapi)](https://fastapi.tiangolo.com/)
[![React](https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)](https://react.dev/)
[![Celery](https://img.shields.io/badge/Celery-37814A?style=for-the-badge&logo=celery&logoColor=white)](https://docs.celeryq.dev/)
[![SQLModel](https://img.shields.io/badge/SQLModel-009688?style=for-the-badge&logo=pydantic&logoColor=white)](https://sqlmodel.tiangolo.com/)
[![SciPy](https://img.shields.io/badge/SciPy-8CAAE6?style=for-the-badge&logo=scipy&logoColor=white)](https://scipy.org/)
[![OpenTelemetry](https://img.shields.io/badge/OpenTelemetry-F15A24?style=for-the-badge&logo=opentelemetry&logoColor=white)](https://opentelemetry.io/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)

ARBITER is a production-ready, self-hosted LLM evaluation framework. It automates adversarial test generation, executes evaluation runs through a reliable asynchronous Celery task pipeline, analyzes performance regressions using non-parametric statistical hypothesis testing, and functions as an automated gate in CI/CD pipelines.

---

## 🏛️ Architectural Overview

ARBITER consists of five main components working in tandem:

```
                          +------------------------+
                          |   Developer / CI CLI   |
                          +-----------+------------+
                                      |
                                      v (POST /api/runs)
+-----------------------+  HTTP  +----+-------------------+
|  React Web Dashboard  +------->|   FastAPI Backend Server|
| (Served on Port 80)   |        +----+-----------+--------+
+-----------------------+             |           |
                                      | Celery    | SQLModel
                                      v           v
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

1. **FastAPI Backend (`backend/`)**: Manages the API endpoints, triggers runs, resolves statistical calculations, and maintains projects and evaluation results.
2. **Celery Worker & Redis Broker (`backend/app/tasks/`)**: Offloads evaluation runs into queues to handle long-running LLM calls asynchronously without blocking HTTP threads.
3. **Pydantic AI Red-Teamer (`backend/app/services/adversarial.py`)**: Automatically crafts targeted adversarial prompt variations (jailbreaks, edge cases, and implicit violations) based on application intent definitions.
4. **Statistical Regression Engine (`backend/app/services/statistics.py`)**: Uses non-parametric Wilcoxon/Mann-Whitney U tests alongside bootstrap resampling to determine if a candidate run has significantly regressed compared to a baseline.
5. **Nginx-Served React Dashboard (`frontend/`)**: Renders project layouts, latency reports, evaluation breakdowns, and Recharts statistical confidence intervals.
6. **Typer CLI (`cli/`)**: A developer-facing CLI tool to trigger runs and block CI pipelines (exiting with code `1` if a regression is detected).

---

## 📂 Project Structure

```
Arbiter/
├── backend/
│   ├── app/
│   │   ├── api/          # FastAPI routers (endpoints, runs)
│   │   ├── core/         # Settings configuration, database engine, Celery app
│   │   ├── models/       # SQLModel database schemas (Project, TestSuite, TestCase, Runs)
│   │   ├── services/     # Red-teaming, inference, evaluator service, statistics engine
│   │   └── tasks/        # Celery task definitions
│   └── tests/            # Pytest suite
├── frontend/
│   ├── src/              # React code (App, components, pages)
│   ├── Dockerfile        # Production multi-stage container build (Vite + Nginx)
│   └── index.html
├── cli/
│   ├── arbiter_cli/      # Typer CLI application source code
│   └── pyproject.toml    # CLI package configuration
├── .env                  # Project secrets and system configurations
└── docker-compose.yml    # Main services orchestrator
```

---

## ⚡ 1. Quickstart (Docker Compose)

The easiest way to get ARBITER running is using Docker Compose. All secrets and dynamic variables are loaded from the root `.env` file.

### Step 1: Create your `.env` file
Duplicate the configurations below into a file named `.env` in the root folder of the project:

```env
# Database Credentials
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres_prod_secure_pass
POSTGRES_DB=arbiter

# LLM Configs for red-teaming and alignment judging
JUDGE_PROVIDER=openai
JUDGE_MODEL=gpt-4.1-mini
OPENAI_API_KEY=your_openai_api_key_here
OPENAI_BASE_URL=

# Hugging Face Access Token (Required for local gated models like Llama-3 in SGLang)
HF_TOKEN=your_hugging_face_token_here

# CORS Allowed Origins
ALLOWED_ORIGINS=http://localhost,http://localhost:80,http://localhost:5173

# Frontend variables
VITE_API_URL=http://localhost:8000

# Redis & Queue Configuration
REDIS_URL=redis://redis:6379/0
# REDIS_URL=redis://localhost:6379/0  # Uncomment for local dev run outside Docker
```

### Step 2: Build and Launch the Stack
Run the following command in the project root:

```bash
docker-compose up --build
```

> [!IMPORTANT]
> **Vite Environment Variables & Docker Rebuilds**:
> Vite compiles environment variables (prefixed with `VITE_`) into static JavaScript assets *at build-time*. If you modify `VITE_API_URL` or other settings in `.env`, you must rebuild the frontend container using `docker-compose up --build` or `docker compose build frontend` for changes to take effect in the client.


This starts:
- **Database (PostgreSQL)** at `localhost:5432`
- **Queue Broker (Redis)** at `localhost:6379`
- **FastAPI API** at `http://localhost:8000`
- **Nginx Web Server (React Static Assets)** at `http://localhost:80`
- **Celery Worker** (running task queues)

---

## 🧪 2. How to Configure & Test LLMs

ARBITER is fully configurable to support both local models (Ollama, SGLang) and external model APIs (OpenAI, Anthropic).

### Testing `gpt-4o-mini` using `gpt-4.1-mini` as Judge

To compare target applications running on `gpt-4o-mini` while using `gpt-4.1-mini` as your evaluation Judge:

1. **Configure the Judge in `.env`**:
   ```env
   JUDGE_PROVIDER=openai
   JUDGE_MODEL=gpt-4.1-mini
   OPENAI_API_KEY=sk-proj-xxxx...
   ```
2. **Define target LLM in the Project setup**:
   When creating or editing a project's `TestSuite` through the REST API or Dashboard, configure the `TargetModelConfig` json payload to request the desired model. For example:
   ```json
   {
     "provider": "openai",
     "model": "gpt-4o-mini",
     "temperature": 0.0,
     "api_key_env_var": "OPENAI_API_KEY"
   }
   ```
3. When an evaluation run is triggered, the backend service will:
   - Call the target endpoint (`gpt-4o-mini`) using the configuration parameters.
   - Forward both the original input and the target's output to the judge client.
   - Restrict the judge client to structured JSON conforming to `EvaluationJudgeOutput` via the fine-tuned `gpt-4.1-mini` model.

---

## 📈 3. Statistical Regression Engine

Standard LLM evaluations rely on mean score changes, which are easily skewed by outliers and fail to prove statistical significance. ARBITER solves this by comparing score distributions using non-parametric analysis.

### The Mathematics

When a candidate evaluation run $Y = \{y_1, y_2, \dots, y_n\}$ is compared against a baseline run $X = \{x_1, x_2, \dots, x_m\}$:

1. **Mann-Whitney U Test (Wilcoxon Rank-Sum)**:
   We evaluate the null hypothesis $H_0$: the probability that a random draw from the candidate distribution is greater than a random draw from the baseline is equal to 0.5 ($P(Y > X) = 0.5$).
   $$U = \sum_{i=1}^n \sum_{j=1}^m S(y_i, x_j)$$
   where
   $$S(y, x) = \begin{cases} 1 & \text{if } y > x \\ 0.5 & \text{if } y = x \\ 0 & \text{if } y < x \end{cases}$$
   We reject the null hypothesis if the resulting $p\text{-value} < 0.05$.
   
2. **Bootstrap Confidence Interval**:
   We calculate the distribution shift by bootstrapping the difference in means. We perform $B = 1000$ iterations:
   - Resample $X^*$ from $X$ with replacement.
   - Resample $Y^*$ from $Y$ with replacement.
   - Calculate $\Delta^* = \text{mean}(Y^*) - \text{mean}(X^*)$.
   - Sort all $\Delta^*$ values. The **95% Confidence Interval** is the range bounded by the 2.5th and 97.5th percentiles.

If the p-value indicates significance ($p < 0.05$) and the confidence interval is entirely negative (below 0), the candidate run is flagged as a **statistically significant regression**.

---

## 💻 4. Command Line Interface (CLI)

The CLI client allows developers to trigger and monitor runs from terminal sessions or automated integration runners.

### Installation
Install the CLI locally in editable mode:
```bash
pip install -e ./cli
```

### Usage Examples

1. **Trigger an evaluation run**:
   ```bash
   arbiter evaluate --project-id 1 --suite-id 2 --target-url "http://localhost:8000"
   ```
2. **Compare a Candidate run with a Baseline**:
   ```bash
   arbiter compare --candidate-run-id 42 --baseline-run-id 12
   ```
3. **Automated CI/CD Verification**:
   Running comparisons returns exit code `1` if a significant performance regression is found, preventing broken updates from shipping:
   ```bash
   arbiter compare --candidate-run-id 42 --baseline-run-id 12 || echo "Regression detected, blocking deploy!"
   ```

---

## 🐋 5. Advanced GPU/VRAM Mounts for Local Models

If you are running target models or judge models locally, you can use the NVIDIA GPU Container Toolkit to mount models into local inference environments.

### SGLang / Ollama docker-compose.gpu.yml Integration

Create a file named `docker-compose.gpu.yml` to spin up GPU accelerated inference nodes alongside ARBITER:

```yaml
version: '3.8'

services:
  sglang:
    image: lmsysorg/sglang:latest
    container_name: arbiter_sglang
    deploy:
      resources:
        reservations:
          devices:
            - driver: nvidia
              count: all
              capabilities: [gpu]
    environment:
      - NCCL_DEBUG=INFO
      - HF_TOKEN=${HF_TOKEN}
    volumes:
      - ~/.cache/huggingface:/root/.cache/huggingface
    ports:
      - "30000:30000"
    ipc: host # Enforce shared memory for fast pre-fill prefix caching
    command: python3 -m sglang.launch_server --model-path meta-llama/Meta-Llama-3-8B-Instruct --port 30000 --host 0.0.0.0 --mem-fraction-static 0.8

  ollama:
    image: ollama/ollama:latest
    container_name: arbiter_ollama
    deploy:
      resources:
        reservations:
          devices:
            - driver: nvidia
              count: all
              capabilities: [gpu]
    volumes:
      - ollama_storage:/root/.ollama
    ports:
      - "11434:11434"

volumes:
  ollama_storage:
```

---

## 🔎 6. Observability

ARBITER has built-in support for distributed trace extraction and logging targets.

### OpenTelemetry
Every evaluation runner execution is fully instrumented. Spans track model response times, API latencies, and Postgres read/write times.
To export traces to **Jaeger** or another OTel Collector:
1. Mount a Jaeger container:
   ```yaml
   jaeger:
     image: jaegertracing/all-in-one:latest
     ports:
       - "16686:16686"
       - "4317:4317"
   ```
2. Configure variables in `.env`:
   ```env
   OTEL_EXPORTER_OTLP_ENDPOINT=http://jaeger:4317
   ```

### Weights & Biases (W&B) Logging
To log evaluation results as interactive tables to Weights & Biases, execute a script inside your pipelines:

```python
import wandb
import httpx

def export_run_to_wandb(run_id: int, api_url: str = "http://localhost:8000"):
    wandb.init(project="arbiter-evaluations", name=f"run-{run_id}")
    
    client = httpx.Client(base_url=api_url)
    results = client.get(f"/api/runs/{run_id}/results").json()
    
    columns = ["ID", "Score", "Latency (ms)", "Tokens", "Cost ($)", "Rationale"]
    data = []
    for r in results:
        data.append([
            r["id"], r["score"], r["latency_ms"],
            r["token_count"], r["cost"], r["rationale"]
        ])
        
    table = wandb.Table(data=data, columns=columns)
    wandb.log({"evaluation_results_table": table})
    wandb.finish()
```

---

## 🛠️ 7. Local Development & Testing

If you are modifying backend code or adding algorithms, you can run tests locally.

### Setup Backend Environment
```bash
cd backend
python -m venv venv
source venv/bin/activate  # Or `.\venv\Scripts\activate` on Windows
pip install -r requirements.txt
```

### Run Tests
```bash
# Windows (PowerShell)
$env:PYTHONPATH="." ; pytest backend/tests

# Linux / macOS / Git Bash
PYTHONPATH=. pytest backend/tests
```

### Setup Frontend Environment
To run the React app with hot reloading during local development:
```bash
cd frontend
npm install
npm run dev
```

---

## 🤝 Contributing & Support

We welcome contributions to ARBITER! If you want to add support for new LLM providers, statistical evaluation metrics, or Dashboard page layouts, please open a PR.

*If you find ARBITER useful, consider dropping a ⭐ on the [GitHub repository](https://github.com/your-username/Arbiter) to help other engineers discover it!*
