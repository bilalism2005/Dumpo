# Tech-Stack Rules

Rules for Dumpo's actual stack. Dumpo's chosen stack lives in `spec/architecture.md`'s `## Stack` section — this file is the permanent doctrine, not edited per feature.

---

## LLM Model Name Rule

Always use a current, verified Groq model name. Dumpo already has direct precedent for handling a deprecation cleanly: the 2026-08-16 migration from `llama-3.1-8b-instant` to `openai/gpt-oss-20b` (`context.md`) was a one-line constant change (`MODEL_NAME` in `llm_service.py`) — follow that same pattern (a single named constant, not the model string repeated inline) for any future model change.

## Test Environment Rule

`backend/tests/test_routers.py` is a real, working suite (`pytest`, `TestClient`) — run it via `pytest` from the repo root before claiming a backend change is done. It's small (3 tests) — extending it as new backend behavior is added is expected, not optional. `backend/scratch/test_pipeline.py` and `test_robustness.py` are developer probes, not the official suite — same convention as finwerse's `apps/api/scratch/*`, don't treat them as gates.

## No Migration Framework

`backend/schema.sql` is hand-edited, applied ad hoc (no Alembic, no versioned migration tool — `backend/migrations/01_add_indexes.sql` is a one-off incremental file, not a sequenced chain). A destructive schema change (dropping/renaming a column, as happened with `finance.category`/`watchlist.genre`) needs a **manual, coordinated update of every code path that references the old column** — there is no tooling that would catch a stale reference automatically. This is precisely the gap that produced the current Finance/Watchlist bug; until a real migration tool exists, treat any schema change as requiring an explicit "grep the whole codebase for the old column name" step before considering it done.

## Environment Configuration Rule

`app/src/config.ts` currently hardcodes `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `API_URL`. The Supabase values are fine as-is (anon key is meant to be public). `API_URL` pointing permanently at production is a real gap — any new environment-dependent value added to the app should go through an actual env-var/Expo-config mechanism (e.g. `app.config.js` + `EXPO_PUBLIC_*` vars), not get added as a fourth hardcoded constant next to the others.

## Backend Framework Notes

Folded in from the existing `backend/CLAUDE.md` (kept in place — this doesn't replace it, see `CLAUDE.md`'s note on directory-scoped files):

- **Try/catch everywhere, with a real fallback** — every endpoint, service function, and query wrapped; on failure, execute the documented default behavior (e.g. route to `others`) rather than letting an exception surface as a raw 500. See `harness/patterns/engineering-practices.md`'s note on preferring a *loud* fallback over a silent one going forward.
- **No direct Supabase queries in routers** — business logic and mutations live in `services/`, routers call into services.
- **Token extraction** — always extract `user_id` from the decoded JWT via `get_current_user_id`; never trust a `user_id` passed in a request body.
- **No markdown in Groq responses** — prompts must request raw, parsable JSON, no ` ```json ` fencing (already enforced by `ROUTER_SYSTEM_PROMPT`'s explicit instruction plus `response_format={"type": "json_object"}`).

## Frontend Framework Notes

Folded in from the existing `app/CLAUDE.md`:

- **Expo Router structure** — routing lives in `src/app/`, screens live in `src/screens/`, route files are thin wrappers importing from screens.
- **State** — shared state (auth, chat, dashboard) in Zustand stores under `src/store/`; no per-bucket store convention exists currently.
- **No direct Supabase calls** except `authStore.ts` for auth itself — everything else goes through `src/services/api.ts` → the FastAPI backend.
- **JWT storage** — `expo-secure-store`, never `AsyncStorage` (`SecureStore` is encrypted on-device, `AsyncStorage` is not).
- **Inline edits, debounced 500ms, no save/delete buttons** — see `spec/roadmap.md`'s Standing Design Rules.

Read `app/AGENTS.md` before writing any Expo code — Expo SDK 57 differs meaningfully from older versions, same warning finwerse's `apps/mobile/AGENTS.md` carries.
