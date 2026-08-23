---
name: zero-shot-fix
description: Diagnose and fix a problem in Dumpo — a bug description, a runtime error/stack trace, failing tests, or spec/code drift — then verify the fix. Calls qa-auditor first to classify and route, then the responsible code-generator (by surface) or spec-writer, then re-verifies. Runs autonomously to a verified result.
argument-hint: [bug description / error / "tests" / "drift" / capability or surface name]
allowed-tools: Bash(git*)
---

**Auto-invocation policy:** invoke this skill on your own analysis whenever the user reports a bug, pastes an error/stack trace, mentions a failing test, or the situation calls for a real diagnose-then-fix pass — they don't need to type `/zero-shot-fix` explicitly. When auto-invoking, `$ARGUMENTS` is the user's own description, not your guess.

You orchestrate a targeted fix by calling worker agents directly — no `agent-builder` needed for a single fix. The target is in `$ARGUMENTS`. **If `$ARGUMENTS` is empty (invoked with no context at all), ask the user in plain text to describe what's broken, and WAIT for their reply.** Do NOT use `AskUserQuestion` to guess the problem, and never invent one the user hasn't reported. Run autonomously: diagnose+classify → fix → verify, looping until the failure signal is gone. Pause only on a hard blocker or explicit request.

**`qa-auditor` runs FIRST** — diagnoses, captures the failing signal, classifies root cause (SPEC vs. CODE) and surface(s).

## Step 1 — Diagnose + classify

**Skip if already diagnosed:** if the caller has a `qa-auditor` verdict with exact file:line and classification, use it, go to Step 2.

Otherwise, invoke `qa-auditor`. It captures the red state, classifies root cause, names surface(s). State the classification in one line.

Done-when, by signal:

| Signal | Done when |
|---|---|
| Failing tests | `pytest` green (backend) — no equivalent runner for `app` yet, so "done" there means a real manual smoke confirmation |
| Bug description | wrong behavior no longer occurs, plus a `pytest` regression test where applicable |
| Runtime error | error no longer reproduces |
| Spec/code drift | `qa-auditor` (drift mode) reports the item resolved |

## Step 2 — Fix (routed by verdict)

- **SPEC root cause** → `spec-writer` corrects the spec, then the responsible `code-generator` brings code in line.
- **CODE root cause** → `code-generator`, named by surface(s).

If genuinely both surfaces, invoke both `code-generator` instances in one Agent message.

## Step 3 — Verify

`qa-auditor` (gate mode, scoped). Re-loop Step 2 if still BLOCKED.

## Step 4 — Ship + report

Commit + push to `main` (atomic, explicit files, never `git add -A`). Report: diagnosis, classification, what changed, verification result.
