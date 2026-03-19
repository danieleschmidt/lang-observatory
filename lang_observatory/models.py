"""Core data models for lang-observatory."""

import json
import time
from dataclasses import dataclass, field, asdict
from typing import Any, Optional


@dataclass
class Observation:
    """
    A single recorded LLM response.

    Captures everything needed to replay, compare, and analyze
    a model's behavior at a point in time.
    """

    model: str
    prompt_id: str
    prompt_text: str
    response: str
    timestamp: float = field(default_factory=time.time)
    latency_ms: Optional[float] = None
    metadata: dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> dict:
        return asdict(self)

    def to_json(self) -> str:
        return json.dumps(self.to_dict())

    @classmethod
    def from_dict(cls, d: dict) -> "Observation":
        return cls(
            model=d["model"],
            prompt_id=d["prompt_id"],
            prompt_text=d["prompt_text"],
            response=d["response"],
            timestamp=d.get("timestamp", time.time()),
            latency_ms=d.get("latency_ms"),
            metadata=d.get("metadata", {}),
        )

    @classmethod
    def from_json(cls, s: str) -> "Observation":
        return cls.from_dict(json.loads(s))

    def __repr__(self) -> str:
        preview = self.response[:60].replace("\n", " ")
        return (
            f"Observation(model={self.model!r}, prompt_id={self.prompt_id!r}, "
            f"latency_ms={self.latency_ms}, response={preview!r}...)"
        )
