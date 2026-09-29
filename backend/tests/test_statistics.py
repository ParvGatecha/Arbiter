import pytest
from backend.app.services.statistics import compute_regression_analysis, StatisticalReport

def test_statistics_no_change():
    """Verify that identical distributions result in no change detection."""
    base_scores = [0.8, 0.9, 0.85, 0.7, 0.95, 0.88, 0.82, 0.78, 0.84, 0.9]
    cand_scores = [0.8, 0.9, 0.85, 0.7, 0.95, 0.88, 0.82, 0.78, 0.84, 0.9]
    
    result = compute_regression_analysis(base_scores, cand_scores, alpha=0.05, bootstrap_iterations=100)
    
    assert isinstance(result, StatisticalReport)
    assert result.p_value == pytest.approx(1.0)
    assert not result.is_significant
    assert result.outcome == "NO_CHANGE"
    assert result.mean_difference == pytest.approx(0.0)

def test_statistics_regression():
    """Verify that a significantly worse candidate is flagged as a regression."""
    base_scores = [0.95, 0.98, 0.96, 0.94, 0.97, 0.99, 0.93, 0.95, 0.97, 0.96]
    cand_scores = [0.2, 0.15, 0.3, 0.1, 0.25, 0.18, 0.22, 0.14, 0.28, 0.2]
    
    result = compute_regression_analysis(base_scores, cand_scores, alpha=0.05, bootstrap_iterations=100)
    
    assert isinstance(result, StatisticalReport)
    assert result.p_value < 0.05
    assert result.is_significant
    assert result.outcome == "REGRESSION"
    assert result.mean_difference < 0.0
    assert result.ci_lower < 0.0
    assert result.ci_upper < 0.0

def test_statistics_improvement():
    """Verify that a significantly better candidate is flagged as an improvement."""
    base_scores = [0.2, 0.15, 0.3, 0.1, 0.25, 0.18, 0.22, 0.14, 0.28, 0.2]
    cand_scores = [0.95, 0.98, 0.96, 0.94, 0.97, 0.99, 0.93, 0.95, 0.97, 0.96]
    
    result = compute_regression_analysis(base_scores, cand_scores, alpha=0.05, bootstrap_iterations=100)
    
    assert isinstance(result, StatisticalReport)
    assert result.p_value < 0.05
    assert result.is_significant
    assert result.outcome == "IMPROVEMENT"
    assert result.mean_difference > 0.0
    assert result.ci_lower > 0.0
    assert result.ci_upper > 0.0

def test_statistics_empty_inputs():
    """Verify that empty inputs are handled gracefully without exceptions."""
    result = compute_regression_analysis([], [])
    assert isinstance(result, StatisticalReport)
    assert result.p_value == 1.0
    assert not result.is_significant
    assert result.outcome == "NO_CHANGE"
    assert result.mean_difference == 0.0
    assert result.sample_size_warning is True

def test_statistics_paired_wilcoxon():
    """Verify paired Wilcoxon test and Cliff's Delta effect size computation."""
    base_scores = [0.90, 0.95, 0.85, 0.88, 0.92, 0.91, 0.89, 0.94, 0.87, 0.93]
    cand_scores = [0.40, 0.45, 0.35, 0.38, 0.42, 0.41, 0.39, 0.44, 0.37, 0.43]
    
    result = compute_regression_analysis(base_scores, cand_scores, alpha=0.05)
    assert result.test_method == "WILCOXON_SIGNED_RANK"
    assert result.outcome == "REGRESSION"
    assert result.is_significant is True
    assert result.cliffs_delta == pytest.approx(-1.0)
    assert result.effect_size_magnitude == "LARGE"
    assert result.cohens_d < -1.0
    assert result.sample_size == 10
    assert result.sample_size_warning is True  # n < 30

def test_statistics_unpaired_mismatched_lengths():
    """Verify fallback to Mann-Whitney U for mismatched length samples."""
    base_scores = [0.90, 0.95, 0.85, 0.88, 0.92]
    cand_scores = [0.40, 0.45, 0.35, 0.38, 0.42, 0.41, 0.39]
    
    result = compute_regression_analysis(base_scores, cand_scores, alpha=0.05)
    assert result.test_method == "MANN_WHITNEY_U"
    assert result.outcome == "REGRESSION"
    assert result.is_significant is True
    assert result.sample_size == 7

