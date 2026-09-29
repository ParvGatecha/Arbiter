import numpy as np
from scipy import stats
from pydantic import BaseModel
from typing import List, Optional

class StatisticalReport(BaseModel):
    baseline_mean: float
    candidate_mean: float
    mean_difference: float
    p_value: float
    ci_lower: float
    ci_upper: float
    outcome: str  # "REGRESSION" | "IMPROVEMENT" | "NO_CHANGE"
    is_significant: bool
    test_method: str = "WILCOXON_SIGNED_RANK"  # "WILCOXON_SIGNED_RANK" | "MANN_WHITNEY_U"
    cliffs_delta: float = 0.0
    effect_size_magnitude: str = "NEGLIGIBLE"  # "NEGLIGIBLE" | "SMALL" | "MEDIUM" | "LARGE"
    cohens_d: float = 0.0
    sample_size: int = 0
    sample_size_warning: bool = False

def calculate_cliffs_delta(baseline: np.ndarray, candidate: np.ndarray) -> tuple[float, str]:
    """
    Computes Cliff's Delta (d), a non-parametric effect size measure quantifying
    the degree of dominance of one sample over another.
    
    Returns (delta, magnitude_label) where magnitude is categorized per Romano et al. (2006).
    """
    n_base = len(baseline)
    n_cand = len(candidate)
    if n_base == 0 or n_cand == 0:
        return 0.0, "NEGLIGIBLE"

    # Vectorized computation of Cliff's Delta
    diff_matrix = candidate[:, np.newaxis] - baseline[np.newaxis, :]
    greater = np.sum(diff_matrix > 0)
    lesser = np.sum(diff_matrix < 0)
    delta = float((greater - lesser) / (n_base * n_cand))

    abs_delta = abs(delta)
    if abs_delta < 0.147:
        magnitude = "NEGLIGIBLE"
    elif abs_delta < 0.33:
        magnitude = "SMALL"
    elif abs_delta < 0.474:
        magnitude = "MEDIUM"
    else:
        magnitude = "LARGE"

    return delta, magnitude

def calculate_cohens_d(baseline: np.ndarray, candidate: np.ndarray) -> float:
    """Computes Cohen's d for standardized mean difference."""
    n_base = len(baseline)
    n_cand = len(candidate)
    if n_base < 2 or n_cand < 2:
        return 0.0
    
    var_base = np.var(baseline, ddof=1)
    var_cand = np.var(candidate, ddof=1)
    # Pooled standard deviation
    pooled_sd = np.sqrt(((n_base - 1) * var_base + (n_cand - 1) * var_cand) / (n_base + n_cand - 2))
    if pooled_sd == 0.0:
        return 0.0
    return float((np.mean(candidate) - np.mean(baseline)) / pooled_sd)

def compute_regression_analysis(
    baseline_scores: List[float], 
    candidate_scores: List[float], 
    alpha: float = 0.05, 
    bootstrap_iterations: int = 1000,
    paired: Optional[bool] = None
) -> StatisticalReport:
    """
    Computes statistical comparison to detect regressions or improvements.
    
    Uses paired Wilcoxon Signed-Rank Test when candidate and baseline scores
    have equal lengths (evaluating identical test cases), with fallback to
    Mann-Whitney U for unpaired/mismatched samples.
    
    Calculates bootstrap 95% Confidence Intervals, Cliff's Delta, and Cohen's d.
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
            is_significant=False,
            test_method="NONE",
            cliffs_delta=0.0,
            effect_size_magnitude="NEGLIGIBLE",
            cohens_d=0.0,
            sample_size=0,
            sample_size_warning=True
        )

    np_base = np.array(baseline_scores, dtype=float)
    np_cand = np.array(candidate_scores, dtype=float)
    n_base = len(np_base)
    n_cand = len(np_cand)
    total_n = max(n_base, n_cand)
    sample_size_warning = min(n_base, n_cand) < 30

    base_mean = float(np.mean(np_base))
    cand_mean = float(np.mean(np_cand))
    mean_diff = cand_mean - base_mean

    # Compute effect sizes
    cliffs_d, effect_mag = calculate_cliffs_delta(np_base, np_cand)
    cohens_d = calculate_cohens_d(np_base, np_cand)

    # 2. Handle single-element or very small lists
    if n_base < 2 or n_cand < 2:
        return StatisticalReport(
            baseline_mean=base_mean,
            candidate_mean=cand_mean,
            mean_difference=mean_diff,
            p_value=1.0,
            ci_lower=mean_diff,
            ci_upper=mean_diff,
            outcome="NO_CHANGE",
            is_significant=False,
            test_method="NONE",
            cliffs_delta=cliffs_d,
            effect_size_magnitude=effect_mag,
            cohens_d=cohens_d,
            sample_size=total_n,
            sample_size_warning=True
        )

    # 3. Determine if test is paired
    is_paired = (n_base == n_cand) if paired is None else paired
    test_method = "WILCOXON_SIGNED_RANK" if is_paired else "MANN_WHITNEY_U"

    # 4. Hypothesis Testing
    p_val = 1.0
    if np.all(np_base == np_base[0]) and np.all(np_cand == np_cand[0]):
        if np_base[0] == np_cand[0]:
            p_val = 1.0
        else:
            p_val = 0.0  # Fully separated distributions
    elif is_paired:
        deltas = np_cand - np_base
        if np.all(deltas == 0.0):
            p_val = 1.0
        else:
            try:
                # Wilcoxon signed-rank test for paired test cases
                # zero_method="wilcox" handles zero-differences cleanly
                res = stats.wilcoxon(np_cand, np_base, alternative="two-sided", zero_method="wilcox")
                p_val = float(res.pvalue)
            except Exception:
                # Fallback to Mann-Whitney U if Wilcoxon cannot compute (e.g. all ranks tie)
                try:
                    res = stats.mannwhitneyu(np_cand, np_base, alternative="two-sided")
                    p_val = float(res.pvalue)
                    test_method = "MANN_WHITNEY_U"
                except Exception:
                    p_val = 1.0
    else:
        try:
            res = stats.mannwhitneyu(np_cand, np_base, alternative="two-sided")
            p_val = float(res.pvalue)
        except Exception:
            p_val = 1.0

    # 5. Bootstrap Confidence Interval of the Difference in Means
    rng = np.random.default_rng(42)  # Deterministic seed for reproducible evaluation runs
    bootstrap_diffs = []

    if is_paired:
        # Paired bootstrap preserves case-by-case pairing
        indices = np.arange(n_base)
        for _ in range(bootstrap_iterations):
            sampled_idx = rng.choice(indices, size=n_base, replace=True)
            bootstrap_diffs.append(np.mean(np_cand[sampled_idx]) - np.mean(np_base[sampled_idx]))
    else:
        for _ in range(bootstrap_iterations):
            sample_base = rng.choice(np_base, size=n_base, replace=True)
            sample_cand = rng.choice(np_cand, size=n_cand, replace=True)
            bootstrap_diffs.append(np.mean(sample_cand) - np.mean(sample_base))

    ci_lower = float(np.percentile(bootstrap_diffs, 2.5))
    ci_upper = float(np.percentile(bootstrap_diffs, 97.5))

    # 6. Decision Logic
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
        is_significant=is_significant,
        test_method=test_method,
        cliffs_delta=cliffs_d,
        effect_size_magnitude=effect_mag,
        cohens_d=cohens_d,
        sample_size=total_n,
        sample_size_warning=sample_size_warning
    )
