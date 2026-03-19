"""Tests for PromptRegistry."""

import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).parent.parent))

from lang_observatory.registry import PromptRegistry


def test_register_and_get(tmp_path):
    reg = PromptRegistry(tmp_path / "prompts.json")
    reg.register("summarize", "Please summarize: {text}")
    assert reg.get("summarize") == "Please summarize: {text}"


def test_update_adds_version(tmp_path):
    reg = PromptRegistry(tmp_path / "prompts.json")
    reg.register("summarize", "v1 text")
    reg.update("summarize", "v2 text", notes="more concise")
    assert reg.get("summarize") == "v2 text"
    history = reg.history("summarize")
    assert len(history) == 2
    assert history[0].text == "v1 text"
    assert history[1].text == "v2 text"
    assert history[1].notes == "more concise"


def test_get_specific_version(tmp_path):
    reg = PromptRegistry(tmp_path / "prompts.json")
    reg.register("p", "version 1")
    reg.update("p", "version 2")
    assert reg.get("p", version=1) == "version 1"
    assert reg.get("p", version=2) == "version 2"


def test_get_nonexistent_returns_none(tmp_path):
    reg = PromptRegistry(tmp_path / "prompts.json")
    assert reg.get("nonexistent") is None


def test_update_nonexistent_raises(tmp_path):
    reg = PromptRegistry(tmp_path / "prompts.json")
    with pytest.raises(KeyError):
        reg.update("missing", "text")


def test_names(tmp_path):
    reg = PromptRegistry(tmp_path / "prompts.json")
    reg.register("b_prompt", "B")
    reg.register("a_prompt", "A")
    assert reg.names() == ["a_prompt", "b_prompt"]


def test_contains(tmp_path):
    reg = PromptRegistry(tmp_path / "prompts.json")
    reg.register("exists", "text")
    assert "exists" in reg
    assert "missing" not in reg


def test_len(tmp_path):
    reg = PromptRegistry(tmp_path / "prompts.json")
    assert len(reg) == 0
    reg.register("p1", "t1")
    reg.register("p2", "t2")
    assert len(reg) == 2


def test_persists_across_instances(tmp_path):
    path = tmp_path / "prompts.json"
    reg1 = PromptRegistry(path)
    reg1.register("summarize", "original text")
    reg1.update("summarize", "updated text")

    reg2 = PromptRegistry(path)
    assert reg2.get("summarize") == "updated text"
    assert len(reg2.history("summarize")) == 2


def test_version_numbers(tmp_path):
    reg = PromptRegistry(tmp_path / "prompts.json")
    reg.register("p", "v1")
    reg.update("p", "v2")
    reg.update("p", "v3")
    history = reg.history("p")
    assert [v.version for v in history] == [1, 2, 3]
