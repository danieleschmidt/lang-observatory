"""Tests for Observation model."""

import json
import time

import pytest
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from lang_observatory.models import Observation


def test_observation_defaults():
    obs = Observation(
        model="gpt-4",
        prompt_id="test",
        prompt_text="Hello",
        response="Hi there",
    )
    assert obs.model == "gpt-4"
    assert obs.prompt_id == "test"
    assert obs.latency_ms is None
    assert obs.metadata == {}
    assert obs.timestamp > 0


def test_observation_roundtrip_dict():
    obs = Observation(
        model="gpt-4",
        prompt_id="p1",
        prompt_text="Prompt text",
        response="Response text",
        latency_ms=123.4,
        metadata={"run": 1},
        timestamp=1_700_000_000.0,
    )
    d = obs.to_dict()
    obs2 = Observation.from_dict(d)
    assert obs2.model == obs.model
    assert obs2.prompt_id == obs.prompt_id
    assert obs2.prompt_text == obs.prompt_text
    assert obs2.response == obs.response
    assert obs2.latency_ms == obs.latency_ms
    assert obs2.metadata == obs.metadata
    assert obs2.timestamp == obs.timestamp


def test_observation_roundtrip_json():
    obs = Observation(
        model="claude-3",
        prompt_id="summarize",
        prompt_text="Summarize this",
        response="It is summarized.",
        latency_ms=200.0,
    )
    json_str = obs.to_json()
    obs2 = Observation.from_json(json_str)
    assert obs2.model == obs.model
    assert obs2.response == obs.response


def test_observation_repr():
    obs = Observation(model="m", prompt_id="p", prompt_text="t", response="r")
    r = repr(obs)
    assert "Observation" in r
    assert "m" in r
