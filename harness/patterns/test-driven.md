# Test-Driven Development

Stack-agnostic discipline, ported via finwerse's own port of `smallTechOrg/zero-shot-claude-boilerplate`. Applies on both surfaces. `backend/tests/test_routers.py` is a real, if small (3 tests), existing suite — extend it rather than starting a parallel convention. No test convention currently exists for `app` — confirm this before assuming otherwise.

---

## The Loop

**Red → Green → Refactor.** Write a failing test for the right reason, minimum code to pass, then clean up with the green bar as a safety net.

## Test-First Is Not Negotiable for New Behaviour

- A bug fix starts with a regression test that reproduces the bug — it must fail on current code, then pass after the fix. **The Finance/Watchlist creation bug (`spec/roadmap.md`) is the concrete example to use**: a test that dumps a finance transaction and asserts it lands in the `finance` table (not `others`) would fail today and should be the first thing written when that fix is picked up.

## What a Good Test Asserts

- **Behaviour, not implementation.**
- **One concept per test, named as a sentence:** `test_finance_dump_lands_in_finance_table`, not `test_finance`.
- **Arrange / Act / Assert**, visibly separated.

## Determinism Is a Hard Requirement

- No wall clock (Dumpo's dashboard local-midnight logic is exactly the kind of code that needs injected/frozen time to test correctly — see `spec/capabilities/dashboard.md`).
- No unseeded randomness.
- Integration/e2e tests hit the real Groq API; assert on structural shape (does the response have the right `action_type`, the right `primary_bucket`), not exact LLM prose.

## If a Stub Is Used, Don't Mock

Prefer a thin real implementation over a framework mock for pure-unit isolation. Integration/e2e tests use the real Groq + real Supabase, not stubs.

## Stateful Capabilities Need a Second Interaction

Dumpo has more of these than a typical app: same-day journal merging (does dumping twice on the same day correctly merge into one row, not create two?), CRUD memory-grounding (does a second dump correctly resolve an id created by the first dump?), the "fires exactly once" trigger patterns finwerse has don't apply here, but the equivalent risk is real — a single-dump happy-path test proves nothing about the merge/resolution logic that only exercises on a second interaction.

## Data-Processing Capabilities Need Full-Data Gates

Less relevant to Dumpo than finwerse (no daily batch, no large-dataset aggregation) — the closest analogue is `get_live_user_memory`'s per-bucket caps (30 tasks, 25 watchlist, etc.); a test with 3 tasks can't prove the cap actually applies correctly at 31.

## The Pyramid

| Level | Scope |
|---|---|
| Unit | one function, deps stubbed — e.g. `normalize_update_fields`, `is_completed_on_prior_day` |
| Integration | real Supabase + real Groq boundary — e.g. a full `/process` call |
| E2E/smoke | a real running backend, golden-path journey |

## Coverage Is a Floor, Not a Goal

Cover every branch of business logic and documented error path; don't chase 100% on trivial glue.

## Before You Claim Done

Run the actual `pytest` suite (from repo root or `backend/`, per `backend/CLAUDE.md`'s documented command) and show the output — never claim a pass you didn't run.
