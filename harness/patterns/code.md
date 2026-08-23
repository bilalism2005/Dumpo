# Code Style

Generic conventions across both Dumpo surfaces, plus surface-specific notes. Adapted from finwerse's own port of `smallTechOrg/zero-shot-claude-boilerplate` — the universal top section kept, the framework-gotcha section rewritten for Dumpo's stack (no Starlette-template concern here either, same as finwerse — Dumpo's API is pure JSON).

---

## Universal Rules

1. **Types at boundaries** — Pydantic on `backend`, TypeScript interfaces on `app` — never raw dicts or `any`.
2. **One responsibility per file** — a file does one thing.
3. **No comments explaining WHAT** — only comment WHY something non-obvious is done. `graph_service.py`'s `operator.add` annotation comment is a good example of this done right (explains *why* — so parallel nodes' outputs merge instead of overwrite — not what the type hint is).
4. **No dead code** — remove unused imports/functions immediately. Note: the `category`/`genre` references throughout `llm_service.py`/`bucket_service.py`/`items.py` are the opposite failure mode — not unused code, but code still actively running against a schema that no longer supports it. Different bug, same root cause (a change made in one place without checking every place that assumed the old shape).
5. **Fail loudly at startup** — validate required config at import time (already true — `backend/config.py`'s `Settings` has no defaults for the required keys, so a missing env var fails immediately rather than at first use).
6. **No hardcoding** — see `harness/patterns/tech-stack.md`'s Environment Configuration Rule for the one place this is currently violated in `app/`.

## Naming Conventions

- Python (`backend`): `snake_case` functions/variables, `PascalCase` Pydantic models — matches the existing codebase.
- TypeScript (`app`): `camelCase` functions/variables, `PascalCase` components/screens — matches existing screens (`FinanceScreen.tsx`, `ChatScreen.tsx`).

## File Organization

`backend` is organized by layer: `routers/` (HTTP), `services/` (business logic + the LangGraph pipeline), `models/schemas.py` (all Pydantic schemas in one file, not split per-domain). Follow this pattern for new domains.

`app/src` splits routing (`app/`) from screens (`screens/`) deliberately (`app/CLAUDE.md` rule 1) — a new screen gets a thin route file in `src/app/` that imports the real implementation from `src/screens/`, not inline logic in the route file itself.

## Error Handling Pattern

`backend`: `HTTPException` with a status code and detail message for request-level errors; catch-and-degrade for internal pipeline failures per `backend/CLAUDE.md`'s existing rule — but prefer degrading *loudly* (a clear log line with enough context to actually debug it, per `harness/patterns/engineering-practices.md`) over the silent catch-all pattern that let the Finance/Watchlist bug go unnoticed.

## Logging Pattern

Plain-text Python `logging`, module-level `logger = logging.getLogger(__name__)` — matches the existing pattern throughout `backend/`. No structured/JSON logging currently — a real gap (`harness/patterns/engineering-practices.md`), not something to silently work around with a different ad hoc approach in new code.

## Testing Conventions

`pytest` + `TestClient`, `backend/tests/` — real and established (unlike finwerse's `apps/api`, which had none). Follow `backend/tests/test_routers.py`'s existing style (plain `def test_*`, direct `TestClient` calls, no fixtures file yet — add one if a second test file needs shared setup). No test convention exists yet for `app` — confirm before assuming one, and if adding tests there for the first time, that's a real convention-setting decision worth flagging rather than picking silently.

## What NOT to Do

- Don't add a `category`/`genre` reference anywhere new — those columns don't exist; if a future feature genuinely needs sub-categorization for finance or watchlist, that's a new spec decision (`spec-writer`'s job), not a resurrection of the removed columns.
- Don't bypass the "no direct Supabase calls except auth" rule from either surface.
- Don't add a delete button or a save button — the product's core interaction model depends on their absence.

---

## Framework Notes

### FastAPI / Pydantic

Pure JSON API, no templates. Request/response models are separate Pydantic classes per operation where the shapes genuinely differ (e.g. `BucketItemUpdateRequest` is one shared schema across all 7 buckets, unlike finwerse's per-operation split — this is an intentional simplification given how structurally similar the 7 buckets are; don't "fix" it into 7 separate schemas without a concrete reason).

### LangGraph state mutation

Every node function returns a **partial state update** (a dict of only the keys it's changing), never the full state object — LangGraph merges these automatically, and for the `Annotated[..., operator.add]` fields (`items`, `bucket_tags`, `response_messages`) it *appends* rather than replaces. Writing a node that returns the full state (instead of just its own updates) would silently break this merge behavior for any field a node doesn't intend to touch.

### Supabase client usage

Backend uses the **service-role client** (`get_supabase_client()`, bypasses RLS) for all system writes — this is correct and expected for a trusted backend, but means the backend's own code is the only thing standing between one user's request and another user's row unless every query explicitly filters `.eq("user_id", user_id)`. Grep for any Supabase query missing that filter before trusting it's safe; RLS won't catch a backend-side mistake the way it would a client-side one.
