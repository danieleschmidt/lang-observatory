"""BehaviorDiff: detect drift, regression, and format changes across observation sets."""

import math
import re
from collections import Counter
from dataclasses import dataclass, field
from typing import Optional

from .models import Observation


def _tokenize(text: str) -> list[str]:
    """Simple word tokenizer — lowercase, strip punctuation."""
    return re.findall(r"\b[a-z0-9]+\b", text.lower())


def _token_bag(text: str) -> Counter:
    return Counter(_tokenize(text))


def _cosine_sim(a: Counter, b: Counter) -> float:
    """Cosine similarity between two token-count vectors."""
    if not a or not b:
        return 0.0
    dot = sum(a[t] * b[t] for t in a if t in b)
    mag_a = math.sqrt(sum(v * v for v in a.values()))
    mag_b = math.sqrt(sum(v * v for v in b.values()))
    if mag_a == 0 or mag_b == 0:
        return 0.0
    return dot / (mag_a * mag_b)


def _length_score(text: str) -> int:
    """Rough quality proxy: response length in tokens."""
    return len(_tokenize(text))


def _format_fingerprint(text: str) -> dict:
    """Detect structural features: lists, code blocks, headings."""
    return {
        "has_list": bool(re.search(r"^\s*([-*]|\d+[.)]) ", text, re.MULTILINE)),
        "has_code": "```" in text or "`" in text,
        "has_heading": bool(re.search(r"^#{1,6}\s", text, re.MULTILINE)),
        "line_count": text.count("\n") + 1,
        "avg_line_len": (
            sum(len(l) for l in text.splitlines()) / max(text.count("\n") + 1, 1)
        ),
    }


@dataclass
class PromptDiff:
    """Diff results for a single prompt_id between two sets of observations."""

    prompt_id: str
    baseline_count: int
    candidate_count: int

    # Drift: how different are the responses (on average)?
    avg_cosine_similarity: float  # 1.0 = identical, 0.0 = completely different
    drift_detected: bool  # True if avg similarity < threshold

    # Quality (length-proxy)
    baseline_avg_length: float
    candidate_avg_length: float
    length_delta_pct: float  # % change in avg response length
    regression_detected: bool  # True if candidate is significantly shorter

    # Format changes
    baseline_format: dict
    candidate_format: dict
    format_changed: bool

    # Latency
    baseline_avg_latency_ms: Optional[float]
    candidate_avg_latency_ms: Optional[float]
    latency_delta_ms: Optional[float]

    notes: list[str] = field(default_factory=list)


@dataclass
class DiffReport:
    """Full diff report across all prompts between two model runs."""

    baseline_label: str
    candidate_label: str
    prompt_diffs: list[PromptDiff]

    @property
    def drifted_prompts(self) -> list[PromptDiff]:
        return [p for p in self.prompt_diffs if p.drift_detected]

    @property
    def regressed_prompts(self) -> list[PromptDiff]:
        return [p for p in self.prompt_diffs if p.regression_detected]

    @property
    def format_changed_prompts(self) -> list[PromptDiff]:
        return [p for p in self.prompt_diffs if p.format_changed]

    def summary(self) -> str:
        lines = [
            f"Diff: {self.baseline_label} → {self.candidate_label}",
            f"  Prompts compared : {len(self.prompt_diffs)}",
            f"  Drift detected   : {len(self.drifted_prompts)} prompt(s)",
            f"  Regressions      : {len(self.regressed_prompts)} prompt(s)",
            f"  Format changes   : {len(self.format_changed_prompts)} prompt(s)",
        ]
        if self.drifted_prompts:
            lines.append("\n  Drifted prompts:")
            for pd in self.drifted_prompts:
                lines.append(
                    f"    [{pd.prompt_id}] cosine_sim={pd.avg_cosine_similarity:.3f}  "
                    f"length_delta={pd.length_delta_pct:+.1f}%"
                )
        if self.regressed_prompts:
            lines.append("\n  Regressed prompts:")
            for pd in self.regressed_prompts:
                lines.append(
                    f"    [{pd.prompt_id}] length_delta={pd.length_delta_pct:+.1f}%"
                )
        return "\n".join(lines)


class BehaviorDiff:
    """
    Compares two sets of Observations and produces a DiffReport.

    Drift detection uses cosine similarity on token bags.
    Regression detection is based on response length change.
    Format detection looks for structural markers (lists, code, headings).

    Usage:
        differ = BehaviorDiff(drift_threshold=0.85, regression_threshold=-20.0)
        report = differ.compare(baseline_obs, candidate_obs, "v1", "v2")
        print(report.summary())
    """

    def __init__(
        self,
        drift_threshold: float = 0.85,
        regression_threshold: float = -20.0,  # % length drop considered a regression
    ):
        """
        Args:
            drift_threshold: Cosine similarity below this = drift detected
            regression_threshold: Length % drop below this = regression detected
        """
        self.drift_threshold = drift_threshold
        self.regression_threshold = regression_threshold

    def compare(
        self,
        baseline: list[Observation],
        candidate: list[Observation],
        baseline_label: str = "baseline",
        candidate_label: str = "candidate",
    ) -> DiffReport:
        """
        Compare two sets of observations and return a DiffReport.

        Observations are grouped by prompt_id and compared pairwise.
        """
        # Group by prompt_id
        baseline_by_prompt: dict[str, list[Observation]] = {}
        for obs in baseline:
            baseline_by_prompt.setdefault(obs.prompt_id, []).append(obs)

        candidate_by_prompt: dict[str, list[Observation]] = {}
        for obs in candidate:
            candidate_by_prompt.setdefault(obs.prompt_id, []).append(obs)

        all_prompts = set(baseline_by_prompt) | set(candidate_by_prompt)
        diffs = []

        for pid in sorted(all_prompts):
            b_obs = baseline_by_prompt.get(pid, [])
            c_obs = candidate_by_prompt.get(pid, [])
            diffs.append(self._diff_prompt(pid, b_obs, c_obs))

        return DiffReport(
            baseline_label=baseline_label,
            candidate_label=candidate_label,
            prompt_diffs=diffs,
        )

    def _diff_prompt(
        self,
        prompt_id: str,
        baseline: list[Observation],
        candidate: list[Observation],
    ) -> PromptDiff:
        notes = []

        if not baseline:
            notes.append("No baseline observations for this prompt")
        if not candidate:
            notes.append("No candidate observations for this prompt")

        # Aggregate baseline
        b_texts = [o.response for o in baseline]
        c_texts = [o.response for o in candidate]

        # Cosine similarity: compare aggregate bags
        b_bag = Counter()
        for t in b_texts:
            b_bag.update(_token_bag(t))
        c_bag = Counter()
        for t in c_texts:
            c_bag.update(_token_bag(t))

        avg_sim = _cosine_sim(b_bag, c_bag)
        drift = avg_sim < self.drift_threshold and bool(b_texts) and bool(c_texts)

        # Quality / length
        b_lengths = [_length_score(t) for t in b_texts]
        c_lengths = [_length_score(t) for t in c_texts]
        b_avg_len = sum(b_lengths) / max(len(b_lengths), 1)
        c_avg_len = sum(c_lengths) / max(len(c_lengths), 1)
        if b_avg_len > 0:
            len_delta_pct = (c_avg_len - b_avg_len) / b_avg_len * 100
        else:
            len_delta_pct = 0.0
        regression = len_delta_pct < self.regression_threshold and bool(b_texts) and bool(c_texts)

        # Format
        b_fmt = _format_fingerprint(" ".join(b_texts)) if b_texts else {}
        c_fmt = _format_fingerprint(" ".join(c_texts)) if c_texts else {}
        fmt_changed = bool(b_fmt) and bool(c_fmt) and (
            b_fmt.get("has_list") != c_fmt.get("has_list")
            or b_fmt.get("has_code") != c_fmt.get("has_code")
            or b_fmt.get("has_heading") != c_fmt.get("has_heading")
        )

        # Latency
        b_lats = [o.latency_ms for o in baseline if o.latency_ms is not None]
        c_lats = [o.latency_ms for o in candidate if o.latency_ms is not None]
        b_lat = sum(b_lats) / len(b_lats) if b_lats else None
        c_lat = sum(c_lats) / len(c_lats) if c_lats else None
        lat_delta = (c_lat - b_lat) if (b_lat is not None and c_lat is not None) else None

        return PromptDiff(
            prompt_id=prompt_id,
            baseline_count=len(baseline),
            candidate_count=len(candidate),
            avg_cosine_similarity=avg_sim,
            drift_detected=drift,
            baseline_avg_length=b_avg_len,
            candidate_avg_length=c_avg_len,
            length_delta_pct=len_delta_pct,
            regression_detected=regression,
            baseline_format=b_fmt,
            candidate_format=c_fmt,
            format_changed=fmt_changed,
            baseline_avg_latency_ms=b_lat,
            candidate_avg_latency_ms=c_lat,
            latency_delta_ms=lat_delta,
            notes=notes,
        )
