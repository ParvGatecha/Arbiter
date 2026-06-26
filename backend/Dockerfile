FROM python:3.11-slim

WORKDIR /workspace

# Install essential system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libpq-dev \
    git \
    && rm -rf /var/lib/apt/lists/*

# Install python requirements
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy source code files
COPY . .

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
