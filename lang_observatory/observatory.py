"""Observatory: the main orchestrator for LLM behavior monitoring."""

import time
from pathlib import Path
from typing import Any, Callable, Optional

from .diff import BehaviorDiff, DiffReport
from .models import Observation
from .registry import PromptRegistry
from .store import ObservationStore


class Observatory:
    """
    Orchestrates the full LLM behavior observatory.

    Provides a unified interface for:
    - Logging observations (with or without live LLM calls)
    - Managing prompt versions via PromptRegistry
    - Querying and filtering stored observations
    - Generating drift reports between model runs

    Usage:
        obs = Observatory("./data")
        obs.register_prompt("summarize", "Summarize: {text}")
        # Record an observation:
        obs.log("gpt-4o", "summarize", response="...", latency_ms=312)
        # Compare two models:
        report = obs.drift_report("gpt-4o", "gpt-4o-mini")
        print(report.summary())
    """

    def __init__(
        self,
        data_dir: str | Path = "./observatory_data",
        drift_threshold: float = 0.85,
        regression_threshold: float = -20.0,
    ):
        self.data_dir = Path(data_dir)
        self.data_dir.mkdir(parents=True, exist_ok=True)
        self.store = ObservationStore(self.data_dir / "observations.jsonl")
        self.registry = PromptRegistry(self.data_dir / "prompts.json")
        self._differ = BehaviorDiff(
            drift_threshold=drift_threshold,
            regression_threshold=regression_threshold,
        )

    def register_prompt(self, name: str, text: str, notes: str = "") -> None:
        """Register a new named prompt (or add a new version if already exists)."""
        if name in self.registry:
            self.registry.update(name, text, notes=notes)
        else:
            self.registry.register(name, text, notes=notes)

    def log(
        self,
        model: str,
        prompt_id: str,
        response: str,
        prompt_text: Optional[str] = None,
        latency_ms: Optional[float] = None,
        metadata: Optional[dict[str, Any]] = None,
        timestamp: Optional[float] = None,
    ) -> Observation:
        """
        Log a single LLM observation.

        If prompt_text is not provided, looks up the current text from
        the PromptRegistry.
        """
        if prompt_text is None:
            prompt_text = self.registry.get(prompt_id) or ""

        obs = Observation(
            model=model,
            prompt_id=prompt_id,
            prompt_text=prompt_text,
            response=response,
            timestamp=timestamp or time.time(),
            latency_ms=latency_ms,
            metadata=metadata or {},
        )
        self.store.add(obs)
        return obs

    def log_call(
        self,
        model: str,
        prompt_id: str,
        llm_fn: Callable[[str], str],
        prompt_text: Optional[str] = None,
        metadata: Optional[dict[str, Any]] = None,
    ) -> Observation:
        """
        Call llm_fn(prompt_text) and log the result with timing.

        Args:
            model: Model name/identifier
            prompt_id: Prompt name in the registry
            llm_fn: Callable that takes prompt text and returns response string
            prompt_text: Override prompt text (defaults to registry lookup)
            metadata: Extra metadata to attach

        Returns:
            The logged Observation
        """
        if prompt_text is None:
            prompt_text = self.registry.get(prompt_id) or ""
        start = time.time()
        response = llm_fn(prompt_text)
        latency_ms = (time.time() - start) * 1000
        return self.log(
            model=model,
            prompt_id=prompt_id,
            response=response,
            prompt_text=prompt_text,
            latency_ms=latency_ms,
            metadata=metadata,
        )

    def observations(
        self,
        model: Optional[str] = None,
        prompt_id: Optional[str] = None,
        since: Optional[float] = None,
        until: Optional[float] = None,
    ) -> list[Observation]:
        """Query stored observations with optional filters."""
        return self.store.query(
            model=model, prompt_id=prompt_id, since=since, until=until
        )

    def drift_report(
        self,
        baseline_model: str,
        candidate_model: str,
        prompt_id: Optional[str] = None,
        since: Optional[float] = None,
    ) -> DiffReport:
        """
        Generate a drift report comparing two models.

        Args:
            baseline_model: Model to use as reference
            candidate_model: Model to compare against baseline
            prompt_id: Limit comparison to a single prompt (all prompts if None)
            since: Only compare observations after this timestamp

        Returns:
            DiffReport with drift/regression/format analysis per prompt
        """
        baseline = self.store.query(model=baseline_model, prompt_id=prompt_id, since=since)
        candidate = self.store.query(model=candidate_model, prompt_id=prompt_id, since=since)
        return self._differ.compare(
            baseline=baseline,
            candidate=candidate,
            baseline_label=baseline_model,
            candidate_label=candidate_model,
        )

    def compare_runs(
        self,
        baseline_obs: list[Observation],
        candidate_obs: list[Observation],
        baseline_label: str = "baseline",
        candidate_label: str = "candidate",
    ) -> DiffReport:
        """Compare two arbitrary sets of observations directly."""
        return self._differ.compare(
            baseline_obs, candidate_obs, baseline_label, candidate_label
        )

    def summary(self) -> str:
        """Return a human-readable summary of what's in the observatory."""
        models = self.store.models()
        prompt_ids = self.store.prompt_ids()
        total = self.store.count()
        lines = [
            "Observatory Summary",
            f"  Data dir     : {self.data_dir}",
            f"  Observations : {total}",
            f"  Models       : {len(models)}",
        ]
        for m in models:
            n = len(self.store.query(model=m))
            lines.append(f"    - {m}: {n} observation(s)")
        lines.append(f"  Prompts      : {len(prompt_ids)}")
        for pid in prompt_ids:
            lines.append(f"    - {pid}")
        return "\n".join(lines)

    def __repr__(self) -> str:
        return f"Observatory(data_dir={self.data_dir!r}, count={self.store.count()})"
