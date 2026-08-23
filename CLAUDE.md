# Claude Code — Entry Point

Dumpo is a spec-driven product. Read this file first, then follow the instructions below.

## What This Repo Is

An AI-powered mobile productivity app — users dump raw thoughts, ideas, tasks, and anything on their mind into a chat interface, and the AI automatically reads, formats, classifies, and organises everything into structured buckets. No manual sorting, no folders, no effort from the user. **People do not organise. They dump. Dumpo organises automatically.**

Two surfaces: `app` (Expo/React Native + TypeScript frontend) and `backend` (FastAPI + Python, Groq for classification, Supabase for Auth + Postgres + Realtime). `spec/` is the single source of truth, built 2026-08-16 by reading `app`/`backend` directly (there was no PRD/TRD) using the same structure finwerse's own harness uses, itself adapted from `smallTechOrg/zero-shot-claude-boilerplate`. `context.md` (the prior running changelog) stays in the repo as historical narrative, no longer authoritative.

## Your First Action Every Session

1. Read `harness/rules/ai-agents.md` — mandatory rules for all sessions.
2. Read `harness/rules/git.md` — this repo commits and pushes **directly to `main`** (confirmed with the user: solo project, no staging branch, no separate reviewer) — simpler than finwerse's staging model, but the same rigor.
3. Run `git status` — confirm a clean tree on `main` before starting.

## Spec Manifest

```
spec/roadmap.md          ← what's built, standing design rules, known gaps — read this first,
                            especially the Finance/Watchlist bug tracked there
spec/architecture.md     ← system design, data flow, ## Stack
spec/capabilities/       ← one file per capability — read the one(s) you're touching
spec/data.md             ← the 10-table schema
spec/api.md              ← the REST surface
spec/ui.md               ← the app's screens
spec/agent.md            ← the LangGraph dump-classification pipeline (the product's core)

harness/rules/ai-agents.md          ← session rules, per-surface test commands
harness/rules/git.md                ← direct-to-main workflow
harness/rules/secret-hygiene.md     ← secrets discipline (incl. the Supabase-anon-key non-exception-exception)
harness/patterns/spec-driven.md     ← spec-first discipline
harness/patterns/tech-stack.md      ← Dumpo's real stack rules, incl. the folded-in app/CLAUDE.md + backend/CLAUDE.md rules
harness/patterns/code.md            ← naming, structure, framework notes per surface
harness/patterns/engineering-practices.md
harness/patterns/test-driven.md
harness/patterns/ui-ux.md
harness/patterns/agentic-ai.md      ← pattern catalogue, with Dumpo's actual usage noted inline
```

## Directory-Scoped Files (still in effect — not replaced by this file)

`app/CLAUDE.md` and `backend/CLAUDE.md` remain in place, unmodified, and Claude Code layers them automatically alongside this root file when you're working in those directories. Their content has also been folded into `harness/patterns/tech-stack.md`/`code.md` so it's part of the harness proper — but the directory-scoped files themselves aren't duplicative dead weight, they're the same convention finwerse's `apps/mobile/CLAUDE.md` uses. `app/AGENTS.md` (Expo SDK 57 version warning) also still applies.

## Standing Design Rules (from `spec/roadmap.md` — repeated here because they're easy to violate by accident)

1. **No Save Buttons** — autosave on type, debounced 500ms.
2. **No Delete Buttons** — clearing all of an item's text fields deletes it.
3. **No Direct Client API Calls** — `app` only calls `backend`; `backend` owns all DB/LLM calls. One documented exception: `authStore.ts` calls Supabase directly for auth itself.
4. **Fitts's Law** — every tappable element ≥48px.
5. **Doherty Threshold** — interactions <400ms, optimistic UI shown immediately.

## Known Gaps (tracked deliberately — don't silently "fix" without surfacing the decision first)

See `spec/roadmap.md` → Known Gaps for the full list, headlined by: **Finance and Watchlist item creation is likely silently broken** — a schema simplification (`context.md`, 2026-08-13) removed the `category`/`genre` columns, but `llm_service.py`, `bucket_service.py`, and `items.py` still reference them, so those writes almost certainly fail and get silently redirected into `others`. Found by code trace during this migration, not yet runtime-verified or fixed — user asked to note it and continue the harness build first.

## Skills (entry points)

| Skill / command | Purpose |
|---|---|
| `/zero-shot-build [idea]` | New capability, or a substantial change — intake → `spec-writer` → build across whichever surface(s) it touches. |
| `/zero-shot-fix [target]` | Diagnose + fix a bug, error, failing test, or spec/code drift, then verify. |
| `/zero-shot-sync [scope]` | Reconcile `spec/` ↔ code so they match (spec wins, except where spec itself is wrong). |

**Auto-invocation is the default.** Analyze every prompt for whether it calls for one of these — a described feature/change → `/zero-shot-build`; a reported bug/error/failing test → `/zero-shot-fix`; a request for an audit, drift check, or "does spec match code" → `/zero-shot-sync`. Invoke the matching skill yourself; the user does not need to type the slash command. `$ARGUMENTS` still comes from the user's own words, never invented. All three also work as an explicit `/slash-command`.

## Sub-agents (the team)

| Agent | Role |
|---|---|
| `spec-writer` | Single design authority — writes/updates `spec/` for a capability, self-reviews. |
| `code-generator` | Implements ONE surface (`app` \| `backend`) per invocation, plus its tests. |
| `qa-auditor` | Independent, read-only: reviews + runs tests/smoke (Mode A), audits whole-tree spec↔code drift (Mode B) — including the three-way data-model check (spec vs. schema vs. every write path) that would have caught the Finance/Watchlist bug immediately. Classifies SPEC-vs-CODE and routes fixes in `/zero-shot-fix` and `/zero-shot-sync`. |
| `agent-builder` | Orchestrator for a change spanning both surfaces or needing staged delivery. Skip for a single-surface, well-scoped change — call `spec-writer`/`code-generator`/`qa-auditor` directly instead. |

Pattern: `spec-writer` designs → `agent-builder` (or you, directly, for small changes) fans out `code-generator` per surface → `qa-auditor` gates each independently and audits drift. Nobody but the orchestrating skill/agent (or you) touches git — always to `main`, always with an immediate push.

## For a task that doesn't fit any of the above

Not every change needs the multi-agent machinery — a small, well-scoped, single-surface fix can be done directly. **"Direct" scales down the orchestration, never the rigor**: still read the relevant `spec/` file(s) and `harness/rules/ai-agents.md` first, still actually run `pytest` (backend) or do a real manual smoke check (app) and show the result, still update `spec/` if behavior changed, still commit and push to `main`. Reach for the skills/`agent-builder` when the task is big enough, ambiguous enough, or spans both surfaces enough that the orchestration overhead earns its keep.
