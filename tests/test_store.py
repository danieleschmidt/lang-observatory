"""Tests for ObservationStore."""

import sys
import time
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).parent.parent))

from lang_observatory.models import Observation
from lang_observatory.store import ObservationStore


def make_obs(model="gpt-4", prompt_id="p1", response="hello", ts=None, latency=None):
    return Observation(
        model=model,
        prompt_id=prompt_id,
        prompt_text="test prompt",
        response=response,
        timestamp=ts or time.time(),
        latency_ms=latency,
    )


def test_store_add_and_count(tmp_path):
    store = ObservationStore(tmp_path / "obs.jsonl")
    assert store.count() == 0
    store.add(make_obs())
    assert store.count() == 1
    store.add(make_obs())
    assert store.count() == 2
    assert len(store) == 2


def test_store_all(tmp_path):
    store = ObservationStore(tmp_path / "obs.jsonl")
    obs = [make_obs(model=f"m{i}") for i in range(5)]
    for o in obs:
        store.add(o)
    all_obs = store.all()
    assert len(all_obs) == 5


def test_store_add_many(tmp_path):
    store = ObservationStore(tmp_path / "obs.jsonl")
    obs = [make_obs() for _ in range(10)]
    store.add_many(obs)
    assert store.count() == 10


def test_store_query_by_model(tmp_path):
    store = ObservationStore(tmp_path / "obs.jsonl")
    store.add_many([
        make_obs(model="gpt-4"),
        make_obs(model="gpt-4"),
        make_obs(model="claude-3"),
    ])
    results = store.query(model="gpt-4")
    assert len(results) == 2
    assert all(o.model == "gpt-4" for o in results)


def test_store_query_by_prompt_id(tmp_path):
    store = ObservationStore(tmp_path / "obs.jsonl")
    store.add_many([
        make_obs(prompt_id="summarize"),
        make_obs(prompt_id="translate"),
        make_obs(prompt_id="summarize"),
    ])
    results = store.query(prompt_id="summarize")
    assert len(results) == 2


def test_store_query_by_time(tmp_path):
    store = ObservationStore(tmp_path / "obs.jsonl")
    now = time.time()
    store.add_many([
        make_obs(ts=now - 3600),  # 1h ago
        make_obs(ts=now - 100),   # recent
        make_obs(ts=now),          # now
    ])
    results = store.query(since=now - 200)
    assert len(results) == 2


def test_store_models_and_prompt_ids(tmp_path):
    store = ObservationStore(tmp_path / "obs.jsonl")
    store.add_many([
        make_obs(model="gpt-4", prompt_id="p1"),
        make_obs(model="gpt-3.5", prompt_id="p2"),
        make_obs(model="gpt-4", prompt_id="p3"),
    ])
    assert set(store.models()) == {"gpt-4", "gpt-3.5"}
    assert set(store.prompt_ids()) == {"p1", "p2", "p3"}


def test_store_clear(tmp_path):
    store = ObservationStore(tmp_path / "obs.jsonl")
    store.add_many([make_obs() for _ in range(5)])
    assert store.count() == 5
    store.clear()
    assert store.count() == 0


def test_store_persists_across_instances(tmp_path):
    path = tmp_path / "obs.jsonl"
    store1 = ObservationStore(path)
    store1.add(make_obs(model="gpt-4", response="first"))
    store1.add(make_obs(model="claude", response="second"))

    store2 = ObservationStore(path)
    assert store2.count() == 2
    models = store2.models()
    assert "gpt-4" in models
    assert "claude" in models
