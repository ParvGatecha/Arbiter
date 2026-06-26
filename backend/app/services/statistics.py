import numpy as np
from scipy import stats
from pydantic import BaseModel
from typing import List

class StatisticalReport(BaseModel):
    baseline_mean: float
    candidate_mean: float
    mean_difference: float
    p_value: float
    ci_lower: float
    ci_upper: float
    outcome: str  # "REGRESSION" | "IMPROVEMENT" | "NO_CHANGE"
    is_significant: bool

def compute_regression_analysis(
    baseline_scores: List[float], 
    candidate_scores: List[float], 
    alpha: float = 0.05, 
    bootstrap_iterations: int = 1000
) -> StatisticalReport:
    """
    Computes Mann-Whitney U test and a bootstrap confidence interval to detect
    statistically significant performance improvements or regressions.
    
    Handles empty lists or single-element inputs gracefully.
    """
    # 1. Handle empty inputs
    if not baseline_scores or not candidate_scores:
        return StatisticalReport(
            baseline_mean=0.0,
            candidate_mean=0.0,
            mean_difference=0.0,
            p_value=1.0,
            ci_lower=0.0,
            ci_upper=0.0,
            outcome="NO_CHANGE",
            is_significant=False
        )

    base_mean = float(np.mean(baseline_scores))
    cand_mean = float(np.mean(candidate_scores))
    mean_diff = cand_mean - base_mean

    # 2. Handle single-element or very small lists
    if len(baseline_scores) < 2 or len(candidate_scores) < 2:
        return StatisticalReport(
            baseline_mean=base_mean,
            candidate_mean=cand_mean,
            mean_difference=mean_diff,
            p_value=1.0,
            ci_lower=mean_diff,
            ci_upper=mean_diff,
            outcome="NO_CHANGE",
            is_significant=False
        )

    # 3. Mann-Whitney U Test (two-sided)
    # If all values are identical in both, stats.mannwhitneyu might raise or return pvalue=nan
    if np.all(np.array(baseline_scores) == baseline_scores[0]) and np.all(np.array(candidate_scores) == candidate_scores[0]):
        if baseline_scores[0] == candidate_scores[0]:
            p_val = 1.0
        else:
            p_val = 0.0  # Fully separated
    else:
        try:
            _, p_val = stats.mannwhitneyu(candidate_scores, baseline_scores, alternative="two-sided")
            p_val = float(p_val)
        except Exception:
            p_val = 1.0

    # 4. Bootstrap Confidence Interval of the Difference in Means
    rng = np.random.default_rng(42)  # Set seed for deterministic outcomes
    bootstrap_diffs = []
    np_base = np.array(baseline_scores)
    np_cand = np.array(candidate_scores)
    n_base = len(baseline_scores)
    n_cand = len(candidate_scores)

    for _ in range(bootstrap_iterations):
        sample_base = rng.choice(np_base, size=n_base, replace=True)
        sample_cand = rng.choice(np_cand, size=n_cand, replace=True)
        bootstrap_diffs.append(np.mean(sample_cand) - np.mean(sample_base))

    ci_lower = float(np.percentile(bootstrap_diffs, 2.5))
    ci_upper = float(np.percentile(bootstrap_diffs, 97.5))

    # 5. Decision Logic
    is_significant = p_val < alpha
    
    if is_significant:
        if mean_diff > 0 and ci_lower > 0:
            outcome = "IMPROVEMENT"
        elif mean_diff < 0 and ci_upper < 0:
            outcome = "REGRESSION"
        else:
            # CI crosses 0
            outcome = "NO_CHANGE"
            is_significant = False
    else:
        outcome = "NO_CHANGE"

    return StatisticalReport(
        baseline_mean=base_mean,
        candidate_mean=cand_mean,
        mean_difference=mean_diff,
        p_value=p_val,
        ci_lower=ci_lower,
        ci_upper=ci_upper,
        outcome=outcome,
        is_significant=is_significant
    )
