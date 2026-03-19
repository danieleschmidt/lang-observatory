"""PromptRegistry: named prompts with versioning."""

import json
import time
from dataclasses import dataclass, field, asdict
from pathlib import Path
from typing import Optional


@dataclass
class PromptVersion:
    """A single version of a named prompt."""

    version: int
    text: str
    created_at: float = field(default_factory=time.time)
    notes: str = ""

    def to_dict(self) -> dict:
        return asdict(self)

    @classmethod
    def from_dict(cls, d: dict) -> "PromptVersion":
        return cls(
            version=d["version"],
            text=d["text"],
            created_at=d.get("created_at", 0.0),
            notes=d.get("notes", ""),
        )


@dataclass
class Prompt:
    """A named prompt with a full version history."""

    name: str
    versions: list[PromptVersion] = field(default_factory=list)

    @property
    def current(self) -> Optional[PromptVersion]:
        return self.versions[-1] if self.versions else None

    @property
    def current_text(self) -> Optional[str]:
        v = self.current
        return v.text if v else None

    def get_version(self, version: int) -> Optional[PromptVersion]:
        for v in self.versions:
            if v.version == version:
                return v
        return None

    def add_version(self, text: str, notes: str = "") -> PromptVersion:
        next_ver = (self.versions[-1].version + 1) if self.versions else 1
        pv = PromptVersion(version=next_ver, text=text, notes=notes)
        self.versions.append(pv)
        return pv

    def to_dict(self) -> dict:
        return {
            "name": self.name,
            "versions": [v.to_dict() for v in self.versions],
        }

    @classmethod
    def from_dict(cls, d: dict) -> "Prompt":
        p = cls(name=d["name"])
        p.versions = [PromptVersion.from_dict(v) for v in d.get("versions", [])]
        return p


class PromptRegistry:
    """
    Registry of named prompts with full version history.

    Persisted as a single JSON file.

    Usage:
        reg = PromptRegistry("prompts.json")
        reg.register("summarize", "Summarize the following: {text}")
        # Later, update it:
        reg.update("summarize", "Please summarize concisely: {text}", notes="more concise")
        # Get current text:
        text = reg.get("summarize")
        # List all versions:
        history = reg.history("summarize")
    """

    def __init__(self, path: str | Path):
        self.path = Path(path)
        self._prompts: dict[str, Prompt] = {}
        self._load()

    def _load(self) -> None:
        if self.path.exists():
            with open(self.path, "r", encoding="utf-8") as f:
                data = json.load(f)
            for d in data.get("prompts", []):
                p = Prompt.from_dict(d)
                self._prompts[p.name] = p

    def _save(self) -> None:
        self.path.parent.mkdir(parents=True, exist_ok=True)
        data = {"prompts": [p.to_dict() for p in self._prompts.values()]}
        with open(self.path, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2)

    def register(self, name: str, text: str, notes: str = "") -> PromptVersion:
        """Register a new prompt (or add first version if new)."""
        if name not in self._prompts:
            self._prompts[name] = Prompt(name=name)
        pv = self._prompts[name].add_version(text, notes=notes)
        self._save()
        return pv

    def update(self, name: str, text: str, notes: str = "") -> PromptVersion:
        """Add a new version to an existing prompt."""
        if name not in self._prompts:
            raise KeyError(f"Prompt {name!r} not found. Use register() first.")
        pv = self._prompts[name].add_version(text, notes=notes)
        self._save()
        return pv

    def get(self, name: str, version: Optional[int] = None) -> Optional[str]:
        """
        Get prompt text by name (latest by default, or specific version).
        Returns None if not found.
        """
        prompt = self._prompts.get(name)
        if not prompt:
            return None
        if version is not None:
            pv = prompt.get_version(version)
            return pv.text if pv else None
        return prompt.current_text

    def get_prompt(self, name: str) -> Optional[Prompt]:
        return self._prompts.get(name)

    def history(self, name: str) -> list[PromptVersion]:
        """Return all versions of a prompt in order."""
        prompt = self._prompts.get(name)
        return prompt.versions if prompt else []

    def names(self) -> list[str]:
        return sorted(self._prompts.keys())

    def __contains__(self, name: str) -> bool:
        return name in self._prompts

    def __len__(self) -> int:
        return len(self._prompts)

    def __repr__(self) -> str:
        return f"PromptRegistry(path={self.path!r}, prompts={self.names()})"
