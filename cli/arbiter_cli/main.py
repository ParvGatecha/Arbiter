import time
import sys
from typing import Optional
import httpx
import typer
from rich.console import Console
from rich.table import Table
from rich.progress import Progress, SpinnerColumn, TextColumn
from rich.panel import Panel

app = typer.Typer(help="ARBITER CLI: CI/CD Evaluation Trigger & Regression Assertion Client")
console = Console()

def get_git_info() -> tuple[Optional[str], Optional[str]]:
    """Retrieves git commit SHA and branch from the local workspace."""
    import subprocess
    try:
        commit_sha = subprocess.check_output(["git", "rev-parse", "HEAD"]).decode().strip()
        branch = subprocess.check_output(["git", "rev-parse", "--abbrev-ref", "HEAD"]).decode().strip()
        return commit_sha, branch
    except Exception:
        return None, None

@app.command()
def evaluate(
    api_url: str = typer.Option("http://localhost:8000", "--api-url", "-u", help="URL of the ARBITER backend"),
    project_id: int = typer.Option(..., "--project-id", "-p", help="ID of the target project"),
    suite_id: int = typer.Option(..., "--suite-id", "-s", help="ID of the test suite"),
    target_url: str = typer.Option(..., "--target-url", "-d", help="URL of the model/endpoint under test"),
    commit_sha: Optional[str] = typer.Option(None, "--commit-sha", "-c", help="Git commit hash (auto-detected if omitted)"),
    branch: Optional[str] = typer.Option(None, "--branch", "-b", help="Git branch name (auto-detected if omitted)"),
    baseline_run_id: Optional[int] = typer.Option(None, "--baseline-run-id", "-r", help="Specific baseline Run ID for regression check"),
    poll_interval: int = typer.Option(5, "--poll-interval", "-i", help="Status polling interval in seconds"),
    timeout: int = typer.Option(300, "--timeout", "-t", help="Timeout in seconds for evaluation run completion"),
):
    """
    Triggers an evaluation run, polls for completion, runs statistical
    regression checks, and exits with code 1 if performance drops.
    """
    # 1. Resolve Git Info
    git_sha, git_branch = get_git_info()
    final_sha = commit_sha or git_sha or "unknown-commit"
    final_branch = branch or git_branch or "main"

    console.print(Panel.fit("[bold blue]ARBITER CI Evaluation Client[/bold blue]", border_style="blue"))

    # 2. Trigger Run
    payload = {
        "project_id": project_id,
        "suite_id": suite_id,
        "target_url": target_url,
        "commit_sha": final_sha,
        "branch": final_branch
    }

    client = httpx.Client(base_url=api_url, timeout=30.0)
    try:
        response = client.post("/api/runs/", json=payload)
        if response.status_code != 202:
            console.print(f"[bold red][-] Failed to trigger run: {response.text}[/bold red]")
            sys.exit(2)
        
        run_data = response.json()
        run_id = run_data["id"]
        console.print(f"[bold green][+] Triggered Run #{run_id}[/bold green] (Status: PENDING)")
    except Exception as e:
        console.print(f"[bold red][-] Connection error: {str(e)}[/bold red]")
        sys.exit(2)

    # 3. Poll for Completion using rich Progress
    completed_run_data = None
    start_time = time.time()
    
    with Progress(
        SpinnerColumn(),
        TextColumn("[progress.description]{task.description}"),
        console=console
    ) as progress:
        task = progress.add_task(description=f"Executing Run #{run_id} tasks...", total=None)
        
        while time.time() - start_time < timeout:
            try:
                run_resp = client.get(f"/api/runs/{run_id}")
                if run_resp.status_code == 200:
                    run_info = run_resp.json()
                    status = run_info["status"]
                    
                    if status == "COMPLETED":
                        completed_run_data = run_info
                        progress.update(task, description=f"Run #{run_id} completed successfully!")
                        break
                    elif status == "FAILED":
                        console.print(f"\n[bold red][-] Run #{run_id} failed on the backend worker.[/bold red]")
                        sys.exit(2)
                else:
                    progress.update(task, description=f"Warning: HTTP {run_resp.status_code} while polling...")
            except Exception as e:
                progress.update(task, description=f"Polling issue: {str(e)}...")
            
            time.sleep(poll_interval)

    if not completed_run_data:
        console.print("\n[bold red][-] Timeout waiting for evaluation execution.[/bold red]")
        sys.exit(2)

    # 4. Auto-resolve Baseline if not provided
    selected_baseline_id = baseline_run_id
    if not selected_baseline_id:
        console.print("[bold yellow][*] Auto-resolving baseline run...[/bold yellow]")
        try:
            runs_resp = client.get("/api/runs/")
            if runs_resp.status_code == 200:
                all_runs = runs_resp.json()
                # Find the latest completed run on the target branch (or main) that is not the current run
                baseline_runs = [
                    r for r in all_runs 
                    if r["suite_id"] == suite_id 
                    and r["status"] == "COMPLETED" 
                    and r["id"] != run_id
                    and (r["branch"] == final_branch or r["branch"] == "main")
                ]
                if baseline_runs:
                    selected_baseline_id = baseline_runs[0]["id"]
                    console.print(f"[bold green][+] Auto-selected baseline Run #{selected_baseline_id}[/bold green]")
                else:
                    console.print("[bold yellow][*] No prior runs available to compare against. Skipping regression check.[/bold yellow]")
        except Exception as e:
            console.print(f"[bold red][-] Failed to auto-resolve baseline: {str(e)}[/bold red]")
            sys.exit(2)

    # 5. Display Run Report
    run_table = Table(title=f"Evaluation Run #{run_id} Details", border_style="blue")
    run_table.add_column("Field", style="cyan")
    run_table.add_column("Value", style="magenta")
    run_table.add_row("Commit SHA", completed_run_data["commit_sha"])
    run_table.add_row("Branch", completed_run_data["branch"])
    run_table.add_row("Target Endpoint", completed_run_data["target_url"])
    run_table.add_row("Total Test Cases", str(len(completed_run_data["results"])))
    console.print(run_table)

    # 6. Compare & Assert
    if selected_baseline_id:
        try:
            compare_resp = client.get(f"/api/runs/{run_id}/compare/{selected_baseline_id}")
            if compare_resp.status_code != 200:
                console.print(f"[bold red][-] Failed to compare runs: {compare_resp.text}[/bold red]")
                sys.exit(2)
            
            report = compare_resp.json()
            
            # Print Comparative Stats
            stats_table = Table(title="Statistical Comparison Report", border_style="cyan")
            stats_table.add_column("Metric", style="green")
            stats_table.add_column("Value", style="white")
            stats_table.add_row("Baseline Mean", f"{report['baseline_mean']:.4f}")
            stats_table.add_row("Candidate Mean", f"{report['candidate_mean']:.4f}")
            stats_table.add_row("Mean Difference", f"{report['mean_difference']:.4f}")
            stats_table.add_row("Mann-Whitney U P-Value", f"{report['p_value']:.6f}")
            stats_table.add_row("95% Bootstrap CI", f"[{report['ci_lower']:.4f}, {report['ci_upper']:.4f}]")
            stats_table.add_row("Significance Check", "SIGNIFICANT" if report['is_significant'] else "NOT SIGNIFICANT")
            stats_table.add_row("Outcome Decision", report['outcome'])
            console.print(stats_table)

            # Check if there are failing cases (score < 0.5)
            failing_results = [r for r in completed_run_data["results"] if r["score"] < 0.5]
            if failing_results:
                fail_table = Table(title="Failing Test Scenarios (Score < 0.5)", border_style="red")
                fail_table.add_column("Test Case ID", style="cyan")
                fail_table.add_column("Score", style="red")
                fail_table.add_column("Rationale", style="yellow")
                
                for item in failing_results[:10]:  # Cap at 10 items for display
                    fail_table.add_row(
                        str(item["test_case_id"]),
                        f"{item['score']:.2f}",
                        item["rationale"]
                    )
                console.print(fail_table)

            # Exit Code Enforcement
            if report["outcome"] == "REGRESSION":
                console.print("\n[bold red][-] REGRESSION DETECTED. Blocking build.[/bold red]", style="blink")
                sys.exit(1)
            elif report["outcome"] in ["IMPROVEMENT", "NO_CHANGE"]:
                console.print("\n[bold green][+] Evaluation passed.[/bold green]")
                sys.exit(0)
            
        except Exception as e:
            console.print(f"[bold red][-] Regression check failed: {str(e)}[/bold red]")
            sys.exit(2)
    else:
        # Check basic thresholds if no baseline is available
        results = completed_run_data["results"]
        scores = [r["score"] for r in results]
        avg_score = sum(scores) / len(scores) if scores else 0.0
        console.print(f"\nNo baseline compared. Candidate Avg Score: [bold cyan]{avg_score:.4f}[/bold cyan]")
        
        if avg_score < 0.5:
            console.print("[bold red][-] Average score below threshold 0.5. Blocking build.[/bold red]")
            sys.exit(1)
        else:
            console.print("[bold green][+] Evaluation passed threshold checks.[/bold green]")
            sys.exit(0)

if __name__ == "__main__":
    app()
