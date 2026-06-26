import asyncio
import logging
from datetime import datetime
from sqlalchemy.future import select
from backend.app.core.celery_app import celery_app
from backend.app.core.database import async_session_maker
from backend.app.models.db_models import EvaluationRun, TestSuite, TestCase, EvaluationResult
from backend.app.services.evaluator import EvaluationRunnerService
from backend.app.services.inference_client import InferenceClient
from backend.app.core.config import settings

logger = logging.getLogger(__name__)

async def run_evaluation_pipeline_async(run_id: int) -> None:
    """
    Asynchronous executor of the evaluation run batch.
    Handles DB retrieval, concurrency limiting, error catching, and average score compiling.
    """
    async with async_session_maker() as session:
        # 1. DB State Update to RUNNING
        run = await session.get(EvaluationRun, run_id)
        if not run:
            logger.error(f"EvaluationRun {run_id} not found in database.")
            return

        run.status = "RUNNING"
        await session.commit()
        await session.refresh(run)
        logger.info(f"Transitioned Run #{run_id} status to RUNNING.")

        try:
            # Fetch Test Suite
            suite = await session.get(TestSuite, run.suite_id)
            if not suite:
                raise ValueError(f"TestSuite {run.suite_id} not found for Run #{run_id}")

            # Fetch Test Cases
            stmt = select(TestCase).where(TestCase.suite_id == suite.id)
            result = await session.execute(stmt)
            test_cases = result.scalars().all()

            if not test_cases:
                logger.warning(f"No test cases found for Suite {suite.id}. Completing run immediately.")
                run.status = "COMPLETED"
                run.completed_at = datetime.utcnow()
                await session.commit()
                return

            # Resolve target URL and headers from target configuration
            target_config = suite.target_model_config
            provider = target_config.get("provider", "ollama").lower()
            
            if provider == "ollama":
                target_url = f"{settings.OLLAMA_URL}/v1/chat/completions"
                target_headers = {"Authorization": "Bearer ollama"}
            elif provider == "sglang":
                target_url = f"{settings.SGLANG_URL}/v1/chat/completions"
                target_headers = {"Authorization": "Bearer sglang"}
            else:
                target_url = target_config.get("url") or f"{settings.OLLAMA_URL}/v1/chat/completions"
                target_headers = target_config.get("headers") or {}

            # Instantiates InferenceClient for the Judge
            judge_client = InferenceClient()
            runner = EvaluationRunnerService(
                target_url=target_url,
                target_headers=target_headers,
                judge_model_client=judge_client
            )

            # 2. Concurrency limiting using asyncio.Semaphore
            concurrency_limit = 5
            sem = asyncio.Semaphore(concurrency_limit)
            
            scores = []

            async def process_case(case: TestCase) -> None:
                async with sem:
                    try:
                        intent_desc = suite.intent_definition.get(
                            case.intent_category, 
                            "System must behave according to standard guidelines."
                        )
                        # Execute and evaluate single case
                        eval_result = await runner.execute_and_evaluate(
                            test_case=case, 
                            run_id=run_id, 
                            intent_constraints=intent_desc
                        )
                        
                        # Save step-by-step EvaluationResult entries
                        # We use a separate connection/session or commit each result individually to preserve DB logs
                        # in case of subsequent failures
                        async with async_session_maker() as item_session:
                            item_session.add(eval_result)
                            await item_session.commit()
                        
                        scores.append(eval_result.score)
                        logger.info(f"Processed TestCase #{case.id} for Run #{run_id} with score {eval_result.score}")
                    except Exception as case_err:
                        # 3. Fault Tolerance: Catch individual test errors, save run record as failed, and proceed.
                        logger.error(f"Error processing TestCase #{case.id} in Run #{run_id}: {str(case_err)}")
                        failed_result = EvaluationResult(
                            run_id=run_id,
                            test_case_id=case.id,
                            actual_output=f"[Exception Occurred]: {str(case_err)}",
                            score=0.0,
                            rationale=f"Individual test execution crashed: {str(case_err)}",
                            latency_ms=0.0,
                            token_count=0,
                            cost=0.0
                        )
                        async with async_session_maker() as item_session:
                            item_session.add(failed_result)
                            await item_session.commit()
                        
                        scores.append(0.0)

            # Run all test cases within bounded concurrency
            await asyncio.gather(*(process_case(case) for case in test_cases))

            # 4. Completion State: Update EvaluationRun with status COMPLETED and log details
            # Reload run object in current transaction context
            run = await session.get(EvaluationRun, run_id)
            run.status = "COMPLETED"
            run.completed_at = datetime.utcnow()
            await session.commit()
            logger.info(f"Successfully finalized Run #{run_id} as COMPLETED. Average Score: {sum(scores)/len(scores) if scores else 0.0}")

        except Exception as err:
            logger.exception(f"Fatal error occurred during execution of Run #{run_id}")
            # Ensure database state transitions to FAILED
            run = await session.get(EvaluationRun, run_id)
            if run:
                run.status = "FAILED"
                run.completed_at = datetime.utcnow()
                await session.commit()
            raise err


@celery_app.task(
    name="tasks.run_evaluation_batch_task", 
    bind=True, 
    max_retries=3,
    autoretry_for=(Exception,),
    default_retry_delay=10
)
def run_evaluation_batch_task(self, run_id: int) -> str:
    """
    Celery task that executes evaluation suites asynchronously with DB updates.
    """
    logger.info(f"Celery batch task triggered for Run #{run_id}")
    try:
        # Establish async DB session context and run evaluation pipeline
        asyncio.run(run_evaluation_pipeline_async(run_id))
        return f"SUCCESS: Completed Run {run_id}"
    except Exception as exc:
        logger.error(f"Celery task run failed for Run #{run_id}: {str(exc)}")
        # Let Celery handle retries if applicable
        try:
            self.retry(exc=exc)
        except Exception:
            # If retry limit reached, fail task completely
            pass
        return f"FAILED: Run {run_id} failed with error {str(exc)}"
