# AI Agent Rules

**These rules apply to every Claude Code session in this repo.**

Read this file completely before doing anything else. Adapted from finwerse's own port of `smallTechOrg/zero-shot-claude-boilerplate`'s `harness/rules/ai-agents.md`, rewritten for Dumpo's 2-surface stack (`app`: Expo/TypeScript, `backend`: FastAPI/Python) and its simpler direct-to-`main` git workflow.

---

## ⚠ Non-Negotiable Rules

1. **README must always be accurate.** Every command in the root `README.md`, `app/README.md`, and `backend/CLAUDE.md`'s command list must work exactly as written. Fix the docs before ending a session if you find one that doesn't.

2. **Never claim a test passed if you didn't run it.** Run the real command (see Test Commands below), show the output.

3. **Commands use the right tool per surface.** `backend`: `pytest` (repo root or `backend/`, per `backend/CLAUDE.md`'s documented command — confirm whether a `venv` is expected before assuming a bare `pip install` is enough). `app`: `npm run <script>` per `app/package.json` — no `bun`/`yarn` lockfile present, unlike finwerse.

4. **Working directory must be explicit** — Dumpo is a 2-folder repo (`app`, `backend`), state which one any command block applies to.

5. **No mocking Supabase/Postgres for anything that needs RLS to be exercised.** Dumpo's security model leans on RLS more than finwerse's app-level scoping does (`spec/data.md`) — a test against a mocked DB can't prove RLS is actually enforcing anything.

6. **Golden-path verification before calling a change done.** Walk the primary path (a dump → classification → landing in the right bucket) for anything touching the pipeline, not just a unit test in isolation.

7. **Real-key testing is the default** for anything hitting Groq. A stub is acceptable only for a CI run genuinely lacking keys, guarded with a skip, never presented as a passing gate.

8. **Every commit must be pushed immediately, to `main`.** See `harness/rules/git.md` — no staging branch here, so this is even more load-bearing than in finwerse: there's no intermediate branch to catch a half-finished push.

9. **Never resurrect the `category`/`genre` columns, and never add a similar dead-column reference.** If a schema change removes a column, grep the entire codebase (`app` and `backend`) for every reference to it before considering the change done — this is exactly the process gap that produced the current Finance/Watchlist bug (`spec/roadmap.md`).

10. **Never hardcode a secret.** See `harness/rules/secret-hygiene.md` for the one deliberate exception (Supabase anon key) and why it's not actually an exception to this rule's spirit.

---

## Test Commands

| Surface | Command | Working dir | Notes |
|---|---|---|---|
| `backend` | `pytest` | repo root or `backend/` | Real, small suite (`backend/tests/test_routers.py`, 3 tests) — confirmed working. `backend/scratch/*` are dev probes, not the gate. |
| `app` | **No test script confirmed** (`package.json` scripts: `start`, `reset-project`, `android`, `ios`, `web`, `lint` — no `test`) | `app/` | Verification here means manual smoke-testing via `expo start`, not an automated run, until a real test convention is established. |

## Session Start Checklist

- [ ] Read `spec/roadmap.md` — know what's built, what's a known gap (especially the Finance/Watchlist bug), what's next
- [ ] Read the relevant `spec/capabilities/*.md` for the task at hand
- [ ] `git status` — clean tree, on `main`
- [ ] Confirm which surface(s) (`app`/`backend`) you're touching and use the right tooling per the table above

## Spec-First Rule

No code change without a spec backing it (`harness/patterns/spec-driven.md`). If asked to build something not in `spec/`, stop, propose the addition, wait for confirmation.

## Test Before Claiming Done

Real test output for `backend`; a real manual smoke walk-through for `app` until it has a test convention. "It looks right" is not verification.

## Error Resilience

Match the existing pattern (`backend/CLAUDE.md`'s try/catch-everywhere-with-fallback rule) but prefer a **loud, informative** fallback over the current silent-degrade pattern that let the Finance/Watchlist bug go undetected — log enough detail that the failure would actually be found, don't just catch-and-move-on.

## No Gold-Plating

Build what the spec says. No refactoring outside the current task's scope, no premature abstractions.

## When Stuck

Stop, state the specific question or ambiguity, propose an interpretation if you have one, wait for confirmation.

## Closing a Session

- [ ] Working tree clean, committed and pushed to `main`
- [ ] Whatever surface(s) touched have been verified per the Test Commands table
- [ ] `spec/` updated if behavior changed
