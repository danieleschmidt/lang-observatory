"""
lang-observatory: Monitor, track, and compare LLM outputs across prompts and models over time.
"""

from .models import Observation
from .store import ObservationStore
from .diff import BehaviorDiff
from .registry import PromptRegistry
from .observatory import Observatory

__all__ = [
    "Observation",
    "ObservationStore",
    "BehaviorDiff",
    "PromptRegistry",
    "Observatory",
]

__version__ = "0.1.0"
