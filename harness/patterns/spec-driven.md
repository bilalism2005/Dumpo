# Spec-Driven Development

Dumpo follows a strict spec-first discipline, same philosophy as finwerse's own `harness/patterns/spec-driven.md` (which this is adapted from), repointed at Dumpo's `spec/`.

## The Rule

**The spec is always written before the code.** No exceptions going forward. If you're about to write code for something not in `spec/`, stop and spec it first.

> **Bootstrap exception, not repeated:** this `spec/` was built by reading Dumpo's already-existing code (there was no PRD/TRD, unlike finwerse which at least had one) — a one-time backwards derivation. From here forward, spec precedes code.

## Why

Code without a spec means inconsistent assumptions, guesswork testing, and silent drift. This already happened once in Dumpo's own history: the 2026-08-13 "Buckets Simplification" removed the `category`/`genre` columns from the schema but never updated the three code paths (`llm_service.py`, `bucket_service.py`, `items.py`) that still reference them — a real bug that sat undetected until this spec migration's code-first read caught it. That's exactly the class of problem spec-driven development (and, once `qa-auditor` is ported, automated drift auditing) exists to prevent.

## What Goes in the Spec

**Product spec (`spec/`):** what Dumpo does — `roadmap.md`, `capabilities/*.md`, `data.md`, `api.md`, `ui.md`, `agent.md` (the LangGraph pipeline).

**Chosen stack:** `spec/architecture.md`'s `## Stack` section.

**Engineering harness (`harness/`):** how to build it — universal patterns plus Dumpo-specific rewrites.

**Does NOT go in the spec:** implementation line-by-line, temporary workarounds, session-specific debug notes (those belong in commit messages).

## What to Do When Requirements Change

1. Update the relevant `spec/` file first
2. Then update the code
3. Once `/zero-shot-sync` is ported, run it to confirm code matches

## Spec vs. Implementation Conflicts

Code wrong relative to a correct spec → fix the code. Spec wrong → fix the spec first, get it reviewed, then fix the code. The Finance/Watchlist Known Gap (`spec/roadmap.md`) is deliberately left as an open item for exactly this reason — it needs a human decision (fix the code to match the simplified schema, since the schema change was clearly intentional) rather than a silent auto-resolution.

## Adding a New Capability

Once `/zero-shot-build` is ported, run it — it drives a `spec-writer` pass to add the capability, then builds and verifies it.
