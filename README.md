# lang-observatory

Monitor, track, and compare LLM outputs across prompts and models over time.

If you run LLMs in production, behavior changes. A model update, a prompt tweak, a temperature change — any of it can shift responses in ways that are hard to see without a paper trail. `lang-observatory` gives you that paper trail and the tools to analyze it.

**No dependencies beyond Python stdlib.**

---

## What it does

- **Records observations** — every LLM response logged with model, prompt, timestamp, latency, and metadata
- **Persists as JSONL** — append-only, human-readable, trivially queryable
- **Tracks prompt evolution** — named prompts with full version history so you know what changed and when
- **Detects drift** — compares two sets of observations using cosine similarity on token bags
- **Flags regressions** — catches when responses get significantly shorter (quality proxy)
- **Spots format changes** — detects shifts in structure: lists, code blocks, headings
- **Generates reports** — per-prompt diff summaries with latency deltas

---

## Core concepts

### `Observation`
A single recorded LLM response. Fields: `model`, `prompt_id`, `prompt_text`, `response`, `timestamp`, `latency_ms`, `metadata`.

### `ObservationStore`
JSONL-backed persistent store. Supports filtering by model, prompt ID, and time range.

### `PromptRegistry`
Named prompts with versioning. Know exactly which prompt text was used for each observation.

### `BehaviorDiff`
Compares two sets of observations. Returns a `DiffReport` with drift, regression, and format analysis per prompt.

### `Observatory`
Orchestrates everything. Single entry point for logging, querying, and generating drift reports.

---

## Quick start

```python
from lang_observatory import Observatory

obs = Observatory("./data")

# Register a prompt
obs.register_prompt("summarize", "Summarize the following: {text}")

# Log observations (from your LLM calls)
obs.log("gpt-4o", "summarize", response="The paper introduces...", latency_ms=312)
obs.log("gpt-4o-mini", "summarize", response="Summary: ...", latency_ms=89)

# Compare models
report = obs.drift_report("gpt-4o", "gpt-4o-mini")
print(report.summary())
```

Output:
```
Diff: gpt-4o → gpt-4o-mini
  Prompts compared : 1
  Drift detected   : 0 prompt(s)
  Regressions      : 0 prompt(s)
  Format changes   : 0 prompt(s)
```

### With live LLM calls

```python
import anthropic

client = anthropic.Anthropic()

def call_claude(prompt: str) -> str:
    msg = client.messages.create(
        model="claude-3-5-sonnet-20241022",
        max_tokens=1024,
        messages=[{"role": "user", "content": prompt}],
    )
    return msg.content[0].text

obs = Observatory("./data")
obs.register_prompt("explain", "Explain gradient descent in 2 sentences.")
obs.log_call("claude-3-5-sonnet", "explain", call_claude)
```

### Tracking prompt evolution

```python
obs.register_prompt("summarize", "Summarize this: {text}")
# ... collect observations ...

# Later, you improve the prompt
obs.register_prompt("summarize", "Summarize concisely in 2-3 sentences: {text}", )

# Full history
for v in obs.registry.history("summarize"):
    print(f"v{v.version}: {v.text}")
```

---

## Demo

```bash
python examples/demo.py
```

Simulates two model versions on 5 prompts and shows drift/regression/format detection.

---

## Running tests

```bash
python -m pytest tests/ -v
```

All tests use stdlib only — no test framework dependencies beyond `pytest`.

---

## Structure

```
lang_observatory/
  __init__.py       # Public API
  models.py         # Observation dataclass
  store.py          # ObservationStore (JSONL)
  diff.py           # BehaviorDiff + DiffReport
  registry.py       # PromptRegistry with versioning
  observatory.py    # Observatory orchestrator
examples/
  demo.py           # End-to-end demo
tests/
  test_models.py
  test_store.py
  test_diff.py
  test_registry.py
  test_observatory.py
```

---

## Design decisions

**Stdlib only.** No numpy, no sklearn, no pandas. Cosine similarity on token bag Counters is fast enough and keeps the install footprint zero.

**JSONL for storage.** Append-only, human-readable, trivially parseable with `jq` or any language. Easy to feed into other tools.

**Length as quality proxy.** Without ground-truth labels, response length is a reasonable regression signal. If a model suddenly returns 80% shorter responses, that's worth flagging even if you don't know why.

**Opt-in LLM calls.** The observatory doesn't call any LLM itself — you bring the client. `log()` for pre-recorded responses, `log_call()` for live calls with timing.

---

## License

MIT
