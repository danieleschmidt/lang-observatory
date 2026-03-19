#!/usr/bin/env python3
"""
Demo: Simulate two model versions on 5 prompts and show drift detection.

This script simulates observations from two "models" with slightly different
response behaviors and runs the observatory's drift analysis against them.

Run from repo root:
    python examples/demo.py
"""

import random
import sys
import tempfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from lang_observatory import Observatory


# --- Simulated model responses ------------------------------------------

RESPONSES_V1 = {
    "translate_hello": "Hello",
    "summarize": (
        "The document describes a process for evaluating large language models "
        "across multiple axes including fluency, coherence, and factual accuracy. "
        "Several benchmarks are introduced and compared."
    ),
    "code_snippet": "```python\ndef add(a, b):\n    return a + b\n```",
    "list_capitals": (
        "- France: Paris\n- Germany: Berlin\n- Japan: Tokyo\n- Brazil: Brasília\n- Canada: Ottawa"
    ),
    "explain_concept": (
        "Gradient descent is an optimization algorithm used to minimize a function "
        "by iteratively moving in the direction of steepest descent as defined by the "
        "negative of the gradient. It is commonly used in machine learning to train models."
    ),
}

# v2 simulates drift:
# - translate_hello: shifted to formal/verbose style
# - summarize: much shorter (regression)
# - code_snippet: changed format (no code block)
# - list_capitals: same structure
# - explain_concept: same content, slightly shuffled
RESPONSES_V2 = {
    "translate_hello": "Greetings and salutations, how do you do.",
    "summarize": "The document is about LLM evaluation.",  # Much shorter → regression
    "code_snippet": "def add(a, b): return a + b",  # No code block → format change
    "list_capitals": (
        "- France: Paris\n- Germany: Berlin\n- Japan: Tokyo\n- Brazil: Brasília\n- Canada: Ottawa"
    ),
    "explain_concept": (
        "Gradient descent minimizes a function by moving along the steepest descent "
        "direction (negative gradient). It is a core training algorithm in machine learning, "
        "used iteratively to update model parameters."
    ),
}

PROMPT_TEXTS = {
    "translate_hello": 'Translate "Hello" to English.',
    "summarize": "Summarize the following research paper in 2-3 sentences: {doc}",
    "code_snippet": "Write a Python function that adds two numbers.",
    "list_capitals": "List the capitals of France, Germany, Japan, Brazil, and Canada.",
    "explain_concept": "Explain gradient descent in 2-3 sentences.",
}


def fake_model(responses: dict, noise: float = 0.0) -> callable:
    """Return a fake LLM callable that returns predefined responses."""
    def call(prompt_id: str) -> str:
        base = responses.get(prompt_id, "I don't know.")
        if noise > 0:
            # Occasionally append a filler word
            filler = random.choice(["", " Indeed.", " Certainly.", ""])
            return base + filler
        return base
    return call


def main():
    print("=" * 60)
    print("lang-observatory demo")
    print("=" * 60)

    # Use a temp dir so demo doesn't pollute the repo
    with tempfile.TemporaryDirectory() as tmpdir:
        obs = Observatory(data_dir=tmpdir)

        # Register prompts
        for pid, text in PROMPT_TEXTS.items():
            obs.register_prompt(pid, text)

        print(f"\n✓ Registered {len(PROMPT_TEXTS)} prompts\n")

        # Simulate 3 runs per prompt per model
        model_v1 = "llm-v1"
        model_v2 = "llm-v2"
        call_v1 = fake_model(RESPONSES_V1)
        call_v2 = fake_model(RESPONSES_V2)

        for _ in range(3):
            for pid in PROMPT_TEXTS:
                obs.log(model_v1, pid, response=call_v1(pid), latency_ms=random.uniform(200, 400))
                obs.log(model_v2, pid, response=call_v2(pid), latency_ms=random.uniform(300, 600))

        print(obs.summary())
        print()

        # Generate drift report
        report = obs.drift_report(baseline_model=model_v1, candidate_model=model_v2)
        print(report.summary())
        print()

        # Per-prompt details
        print("-" * 60)
        print("Per-prompt details:")
        for pd in report.prompt_diffs:
            flags = []
            if pd.drift_detected:
                flags.append("DRIFT")
            if pd.regression_detected:
                flags.append("REGRESSION")
            if pd.format_changed:
                flags.append("FORMAT CHANGE")
            status = ", ".join(flags) if flags else "OK"
            print(
                f"  [{pd.prompt_id}]  sim={pd.avg_cosine_similarity:.3f}  "
                f"len_delta={pd.length_delta_pct:+.1f}%  status={status}"
            )
            if pd.latency_delta_ms is not None:
                print(f"    latency: {pd.baseline_avg_latency_ms:.0f}ms → "
                      f"{pd.candidate_avg_latency_ms:.0f}ms "
                      f"({pd.latency_delta_ms:+.0f}ms)")

    print()
    print("✓ Demo complete.")


if __name__ == "__main__":
    main()
