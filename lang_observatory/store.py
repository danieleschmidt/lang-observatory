"""JSONL-backed persistent store for Observations."""

import json
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Callable, Iterator, Optional

from .models import Observation


class ObservationStore:
    """
    Persistent store for LLM observations backed by a JSONL file.

    Each line is one JSON-serialized Observation. Append-only writes
    ensure no data loss; reads support filtering by model, prompt, and date.

    Usage:
        store = ObservationStore("observations.jsonl")
        store.add(obs)
        results = store.query(model="gpt-4", prompt_id="summarize")
    """

    def __init__(self, path: str | Path):
        self.path = Path(path)
        self.path.parent.mkdir(parents=True, exist_ok=True)
        # Touch file if it doesn't exist
        if not self.path.exists():
            self.path.touch()

    def add(self, obs: Observation) -> None:
        """Append a single observation to the store."""
        with open(self.path, "a", encoding="utf-8") as f:
            f.write(obs.to_json() + "\n")

    def add_many(self, observations: list[Observation]) -> None:
        """Batch append multiple observations."""
        with open(self.path, "a", encoding="utf-8") as f:
            for obs in observations:
                f.write(obs.to_json() + "\n")

    def _iter_all(self) -> Iterator[Observation]:
        """Iterate over all observations in order."""
        if not self.path.exists():
            return
        with open(self.path, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if line:
                    try:
                        yield Observation.from_json(line)
                    except (json.JSONDecodeError, KeyError):
                        continue  # Skip corrupt lines

    def query(
        self,
        model: Optional[str] = None,
        prompt_id: Optional[str] = None,
        since: Optional[float] = None,
        until: Optional[float] = None,
        filter_fn: Optional[Callable[[Observation], bool]] = None,
    ) -> list[Observation]:
        """
        Filter observations by model, prompt, and/or time range.

        Args:
            model: Exact model name to match (e.g. "gpt-4o")
            prompt_id: Exact prompt_id to match
            since: Unix timestamp — only return observations after this time
            until: Unix timestamp — only return observations before this time
            filter_fn: Optional custom filter predicate

        Returns:
            List of matching Observations in chronological order
        """
        results = []
        for obs in self._iter_all():
            if model and obs.model != model:
                continue
            if prompt_id and obs.prompt_id != prompt_id:
                continue
            if since and obs.timestamp < since:
                continue
            if until and obs.timestamp > until:
                continue
            if filter_fn and not filter_fn(obs):
                continue
            results.append(obs)
        return results

    def all(self) -> list[Observation]:
        """Return all observations."""
        return list(self._iter_all())

    def models(self) -> list[str]:
        """Return sorted list of unique model names in the store."""
        return sorted(set(obs.model for obs in self._iter_all()))

    def prompt_ids(self) -> list[str]:
        """Return sorted list of unique prompt IDs in the store."""
        return sorted(set(obs.prompt_id for obs in self._iter_all()))

    def count(self) -> int:
        """Return total number of observations."""
        return sum(1 for _ in self._iter_all())

    def clear(self) -> None:
        """Wipe all observations (truncates the file)."""
        with open(self.path, "w", encoding="utf-8") as f:
            f.truncate(0)

    def __len__(self) -> int:
        return self.count()

    def __repr__(self) -> str:
        return f"ObservationStore(path={self.path!r}, count={self.count()})"
