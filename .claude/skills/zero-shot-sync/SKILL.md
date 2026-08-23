---
name: zero-shot-sync
description: Reconcile Dumpo's spec/ and code so they match — spec wins, except where a divergence reveals the spec itself is wrong (surfaced, never silently auto-corrected). Audits the whole tree for drift, routes fixes to the responsible surface's code-generator (or spec-writer), verifies, repeats to a CLEAN audit.
argument-hint: [optional path, capability name, or surface to scope to]
allowed-tools: Bash(git*)
---

**Auto-invocation policy:** invoke this skill on your own analysis whenever the user asks for an audit, a drift check, "does spec match code," or before something ships to `main` — they do not need to type `/zero-shot-sync` explicitly. Also reasonable to invoke proactively after a change you're not fully confident stayed spec-aligned.

You orchestrate a spec↔code sync for Dumpo by calling worker agents directly. **Spec is the source of truth — when spec and code disagree, fix the code** (`harness/patterns/spec-driven.md`), unless the divergence reveals the *spec* is wrong, in which case surface it for a human decision. Optional scope in `$ARGUMENTS`; otherwise the whole project.

**`qa-auditor` runs FIRST** — read-only, finds and classifies every divergence, direction, and surface(s). You own the commit + push to `main`.

## Step 1 — Audit (`qa-auditor`, drift mode)

Invoke `qa-auditor` in drift mode, scoped per `$ARGUMENTS` if given, else whole-tree. CLEAN → report and stop.

**Before treating anything as new:** several divergences are already tracked as Known Gaps in `spec/roadmap.md` and the affected capability files (the Finance/Watchlist dead-column bug being the headline one, plus a handful of "not yet runtime-verified" items). `qa-auditor` checks these against current status rather than re-reporting them fresh.

## Step 2 — Triage by direction

- **Code wrong, spec right** (default) → fix the code, routed to the surface(s) named.
- **Spec wrong, code right** → surface to the user with the mismatch and a proposed spec change; wait.
- **Undocumented behavior** → remove, or surface as a spec addition for confirmation.

Handle High severity first (the Finance/Watchlist bug and anything like it), then Medium, Low only if in scope.

## Step 3 — Reconcile code (routed by surface, parallel where independent)

Group "code wrong" divergences by surface (`app` / `backend`), invoke the responsible **code-generator** per surface concurrently if both are affected. Give each generator the spec section + offending file(s).

## Step 4 — Verify (`qa-auditor`, gate mode)

Scoped to the affected surface(s). BLOCKED → re-invoke the responsible generator with detail; loop.

## Step 5 — Re-audit

Repeat 2-4 until CLEAN (modulo spec-is-wrong items surfaced for the user).

## Step 6 — Ship + report

Commit + push to `main` (atomic, explicit files staged, never `git add -A`, per `harness/rules/git.md`). Summarize: divergences by severity and surface, what was fixed, what's still open awaiting a user decision.
