"""Tests for BehaviorDiff."""

import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from lang_observatory.diff import BehaviorDiff
from lang_observatory.models import Observation


def obs(model, prompt_id, response, latency=100.0):
    return Observation(
        model=model,
        prompt_id=prompt_id,
        prompt_text="test",
        response=response,
        timestamp=time.time(),
        latency_ms=latency,
    )


def test_identical_responses_no_drift():
    differ = BehaviorDiff(drift_threshold=0.85)
    text = "The quick brown fox jumps over the lazy dog"
    baseline = [obs("v1", "p1", text)]
    candidate = [obs("v2", "p1", text)]
    report = differ.compare(baseline, candidate, "v1", "v2")
    pd = report.prompt_diffs[0]
    assert pd.avg_cosine_similarity == pytest.approx(1.0, abs=0.001)
    assert not pd.drift_detected


def test_very_different_responses_drift():
    differ = BehaviorDiff(drift_threshold=0.85)
    baseline = [obs("v1", "p1", "cat sat mat hat fat")]
    candidate = [obs("v2", "p1", "quantum neural blockchain distributed")]
    report = differ.compare(baseline, candidate, "v1", "v2")
    pd = report.prompt_diffs[0]
    assert pd.avg_cosine_similarity < 0.5
    assert pd.drift_detected


def test_regression_detection():
    differ = BehaviorDiff(regression_threshold=-20.0)
    long_resp = "word " * 100
    short_resp = "word " * 10  # 90% shorter → regression
    baseline = [obs("v1", "p1", long_resp)]
    candidate = [obs("v2", "p1", short_resp)]
    report = differ.compare(baseline, candidate, "v1", "v2")
    pd = report.prompt_diffs[0]
    assert pd.length_delta_pct < -80
    assert pd.regression_detected


def test_no_regression_similar_length():
    differ = BehaviorDiff(regression_threshold=-20.0)
    baseline = [obs("v1", "p1", "a b c d e f g h i j")]
    candidate = [obs("v2", "p1", "a b c d e f g h i j k")]  # slightly longer
    report = differ.compare(baseline, candidate, "v1", "v2")
    pd = report.prompt_diffs[0]
    assert not pd.regression_detected


def test_format_change_detection():
    differ = BehaviorDiff()
    # baseline has a bullet list
    baseline = [obs("v1", "p1", "- item 1\n- item 2\n- item 3")]
    # candidate has no list
    candidate = [obs("v2", "p1", "item 1 item 2 item 3")]
    report = differ.compare(baseline, candidate, "v1", "v2")
    pd = report.prompt_diffs[0]
    assert pd.format_changed


def test_latency_delta():
    differ = BehaviorDiff()
    baseline = [obs("v1", "p1", "response", latency=200.0)]
    candidate = [obs("v2", "p1", "response", latency=400.0)]
    report = differ.compare(baseline, candidate, "v1", "v2")
    pd = report.prompt_diffs[0]
    assert pd.latency_delta_ms == pytest.approx(200.0)


def test_empty_baseline():
    differ = BehaviorDiff()
    candidate = [obs("v2", "p1", "some response")]
    report = differ.compare([], candidate, "v1", "v2")
    pd = report.prompt_diffs[0]
    assert pd.baseline_count == 0
    assert not pd.drift_detected  # Can't detect drift with no baseline


def test_report_summary_output():
    differ = BehaviorDiff(drift_threshold=0.99)  # Very strict → will detect drift
    baseline = [obs("v1", "p1", "cat sat on the mat")]
    candidate = [obs("v2", "p1", "quantum distributed blockchain")]
    report = differ.compare(baseline, candidate, "v1", "v2")
    summary = report.summary()
    assert "v1" in summary
    assert "v2" in summary
    assert "Drift" in summary or "drift" in summary


def test_multiple_prompts():
    differ = BehaviorDiff()
    baseline = [
        obs("v1", "p1", "hello world"),
        obs("v1", "p2", "foo bar baz"),
    ]
    candidate = [
        obs("v2", "p1", "hello world"),
        obs("v2", "p2", "something completely different"),
    ]
    report = differ.compare(baseline, candidate, "v1", "v2")
    assert len(report.prompt_diffs) == 2
    p1 = next(pd for pd in report.prompt_diffs if pd.prompt_id == "p1")
    p2 = next(pd for pd in report.prompt_diffs if pd.prompt_id == "p2")
    assert p1.avg_cosine_similarity > p2.avg_cosine_similarity


import pytest
