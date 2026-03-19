"""Integration tests for Observatory."""

import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from lang_observatory import Observatory


def test_observatory_basic_flow(tmp_path):
    obs = Observatory(data_dir=tmp_path)
    obs.register_prompt("greet", "Say hello.")
    obs.log("gpt-4", "greet", response="Hello there!")
    obs.log("gpt-4", "greet", response="Hi!")
    observations = obs.observations(model="gpt-4")
    assert len(observations) == 2


def test_observatory_log_call(tmp_path):
    obs_sys = Observatory(data_dir=tmp_path)
    obs_sys.register_prompt("echo", "Echo this: {text}")

    def fake_llm(prompt: str) -> str:
        return f"echoed: {prompt[:10]}"

    result = obs_sys.log_call("my-model", "echo", fake_llm)
    assert result.latency_ms is not None
    assert result.latency_ms >= 0
    assert "echoed" in result.response


def test_observatory_drift_report(tmp_path):
    obs = Observatory(data_dir=tmp_path)
    obs.register_prompt("qa", "Answer the question.")

    # log baseline
    obs.log("v1", "qa", response="The answer is forty two. This is a well-known result from research.")
    # log candidate (very different)
    obs.log("v2", "qa", response="blockchain quantum neural")

    report = obs.drift_report("v1", "v2")
    assert len(report.prompt_diffs) == 1
    assert report.prompt_diffs[0].drift_detected


def test_observatory_summary(tmp_path):
    obs = Observatory(data_dir=tmp_path)
    obs.register_prompt("p", "text")
    obs.log("gpt-4", "p", response="resp1")
    obs.log("claude", "p", response="resp2")
    summary = obs.summary()
    assert "gpt-4" in summary
    assert "claude" in summary
    assert "Observatory Summary" in summary


def test_observatory_prompt_registry_auto_update(tmp_path):
    obs = Observatory(data_dir=tmp_path)
    obs.register_prompt("p", "v1 text")
    obs.register_prompt("p", "v2 text")  # should auto-update
    assert obs.registry.get("p") == "v2 text"
    assert len(obs.registry.history("p")) == 2


def test_observatory_filter_by_prompt(tmp_path):
    obs = Observatory(data_dir=tmp_path)
    obs.register_prompt("alpha", "a")
    obs.register_prompt("beta", "b")
    obs.log("gpt-4", "alpha", response="response a")
    obs.log("gpt-4", "beta", response="response b")
    obs.log("gpt-4", "alpha", response="response a2")

    alpha_obs = obs.observations(prompt_id="alpha")
    assert len(alpha_obs) == 2
    beta_obs = obs.observations(prompt_id="beta")
    assert len(beta_obs) == 1
