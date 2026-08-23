# Roadmap

## What This Product Does

Dumpo is an AI-powered mobile productivity app. Users dump raw thoughts, ideas, tasks, and anything on their mind into a chat interface; the AI automatically reads, formats, classifies, and organises everything into structured buckets on a dashboard — no manual sorting, no folders, no effort from the user.

## Core Philosophy

People do not organise. They dump. Dumpo organises automatically. (Migrated verbatim from the original root `CLAUDE.md` — this line is load-bearing enough to keep exactly as written.)

## Who Uses It

Anyone who wants to capture a thought the instant it occurs — a task, an idea, a journal entry, an expense, a health note, something to watch — without deciding in the moment where it belongs. The product's entire pitch is removing that decision from the user.

## Core Problem Being Solved

Manual organisation apps (separate todo list, separate notes app, separate expense tracker, separate watchlist) all share the same failure mode: the friction of deciding *where* something goes, at capture time, causes people to not capture it at all. Dumpo removes the decision — you just talk, the AI decides.

## Success Criteria

- [ ] A raw dump correctly splits into the right number of atomic items and classifies each into the right bucket
- [ ] A dump combining multiple intents (journal narrative + a task + a question) is handled correctly in one request, not just single-intent dumps
- [ ] CRUD-via-chat ("mark the gym task done") correctly resolves the right existing item, or asks for disambiguation rather than guessing wrong
- [ ] Every one of the 7 buckets (tasks, ideas, journals, finance, health, watchlist, others) can be created into, read, updated, and deleted purely through natural-language dumps or inline edits — **currently false for finance and watchlist creation**, see Known Gaps
- [ ] No save button, no delete button, anywhere in the product (root design rules, still true per this migration's review of `items.py`'s clear-to-delete logic)

## What This Product Does NOT Do (Out of Scope)

- Manual folder/category creation — the entire point is that the AI decides, not the user
- Save buttons, delete buttons — clearing a field's text is the only delete mechanism (`app/CLAUDE.md`, `backend/CLAUDE.md`)
- Direct client-to-Supabase database calls for anything except authentication — every data operation goes through the FastAPI backend (`app/CLAUDE.md` rule 3)
- Reddit/other social sources, F&O-style domain restrictions, or anything finwerse-specific — this is a different product, listed here only to be explicit that no finwerse platform rule carries over by default

## Key Constraints — Standing Design Rules

> Migrated verbatim from the original root `CLAUDE.md`, which called these "Design Rules." Treated here as finwerse's "Standing Platform Rules" are treated — binding across every capability, not restated per capability file.

1. **No Save Buttons** — autosave on type, debounced 500ms.
2. **No Delete Buttons** — clearing all of an item's text fields deletes it (see `spec/api.md`'s `/items/{bucket}/{item_id}` PATCH endpoint for the exact per-bucket "what counts as cleared" logic).
3. **No Direct Client API Calls** — the frontend only calls the FastAPI backend; the backend owns all database and LLM calls. (Exception, confirmed during this migration: `app/src/store/authStore.ts` calls Supabase directly for auth itself — `app/CLAUDE.md` already documents this as the one allowed exception.)
4. **Fitts's Law** — every tappable element is at least 48px.
5. **Doherty Threshold** — interactions stay under 400ms; optimistic UI shows immediately rather than waiting for the backend round-trip.

## Build Status

> Derived from `context.md`'s changelog plus a direct read of `backend/` and `app/src/` during this migration (2026-08-16 checkout). Unlike finwerse, there was no PRD/TRD to check against — everything below is code-first.

| Capability | Backend | App | Notes |
|---|---|---|---|
| Dump capture + classification | Built — `graph_service.py`, real LangGraph pipeline | Built — chat screen calls `POST /api/v1/process` via `api.ts` | Core product loop, confirmed wired end-to-end |
| CRUD via chat | Built — `crud_node` + fuzzy-search fallback | consumed via the same chat flow | |
| General chitchat | Built — `chatbot_node` | consumed via the same chat flow | No server-side "is this really unrelated to my data" gate beyond the router LLM's own judgment |
| Voice dump | Built — `/transcribe`, Groq Whisper | Assume wired given a dedicated endpoint exists — **not directly confirmed against the chat screen's mic button code during this migration** | Verify before relying on this row |
| Dashboard | Built — `/dashboard`, local-midnight-aware filtering | Built, but **the local-midnight fix only applies on initial load** — every post-action refresh in `dashboardStore.ts` omits `current_date`, reintroducing the UTC-default bug the fix was meant to solve. Confirmed via code, not just suspected — see `spec/capabilities/dashboard.md` |
| 7 buckets (tasks/ideas/journals/finance/health/watchlist/others) | **Finance and Watchlist creation is broken** — see Known Gaps below | Screens exist for all 7 (`app/src/screens/buckets/`) | Tasks/Ideas/Journals/Health/Others creation confirmed sound; Finance/Watchlist confirmed structurally broken by code trace, not yet runtime-verified |
| Reclassification | Built, with rollback-on-partial-failure — but **inherits the same Finance/Watchlist bug** when reclassifying *into* those buckets | consumed via `dashboardStore.reclassifyBucketItem` — confirmed wired | |
| Realtime sync | Enabled at the DB level (`ALTER PUBLICATION supabase_realtime`) on every bucket table | **Confirmed wired** — `dashboardStore.subscribeRealtime` binds `postgres_changes` listeners on all 7 bucket tables, filtered by `user_id`, triggering silent background refreshes on any change | Positive finding — this capability genuinely works, corrected up from "not confirmed" during the final verification pass |

## Known Gaps

### 🔴 Finance and Watchlist item creation is likely broken (high severity, found 2026-08-16 during this migration)

`backend/services/llm_service.py`'s `validate_extracted_fields` unconditionally sets `category` (finance) / `genre` (watchlist) on every extraction, and `backend/services/bucket_service.py`'s `write_to_bucket` includes those keys directly in the Supabase insert — but `schema.sql` no longer has either column (removed 2026-08-13 per `context.md`'s "Buckets Simplification" entry). The insert almost certainly fails at the Supabase layer, and `write_to_bucket`'s catch-all exception handler silently redirects the item into `others` instead of surfacing an error. The same dead fields also appear in `routers/items.py`'s `fields_map` (inline-edit whitelist) and `reclassify_item`'s field-mapping (reclassifying *into* finance/watchlist). **Not yet runtime-verified — traced from code only.** See `spec/data.md` and `spec/api.md` for the exact locations. User has asked to note this and continue the harness migration first; fixing it is a follow-up, not done as part of this pass.

### Hardcoded environment config in `app/src/config.ts`
`SUPABASE_URL`, `SUPABASE_ANON_KEY` (expected/normal for a Supabase client), and `API_URL` (pointing at production — not expected/normal) are hardcoded rather than env-configured. No way to point a dev build at a local backend without editing source.

### 🟡 Dashboard's local-midnight fix doesn't survive a post-action refresh (confirmed 2026-08-16)
`dashboardStore.ts` calls `fetchDashboard(undefined, true)` after every toggle/edit/delete/reclassify action — omitting `current_date` entirely, which makes the server fall back to UTC "today." The 2026-08-14 fix (`context.md`) only actually holds on the dashboard's initial load. See `spec/capabilities/dashboard.md`.

### `app/src/app/explore.tsx` is dead Expo template scaffold (confirmed 2026-08-16)
Unmodified default template code (`TabTwoScreen`), same as finwerse mobile's `two.tsx`. Candidate for removal.

## Phases of Development

> Same framing as finwerse's roadmap: this describes an existing, working product, so "phases" means next increments, not a from-scratch build ladder.

### Next — Fix the Finance/Watchlist creation bug
Runtime-verify the Known Gap above (dump a finance or watchlist item, confirm where it actually lands), then remove the dead `category`/`genre` references from `llm_service.py`, `bucket_service.py`, and `items.py`. Good first real test of the ported `/zero-shot-fix` skill once sub-agents are registered.

### Next — Verify voice dump and realtime sync end-to-end
Both rows in Build Status above are marked "not confirmed" — worth a direct check before either is trusted.

### Deferred
- Fixing the hardcoded `app/src/config.ts` values to be environment-configurable — not urgent (anon key exposure is expected; the production-only API URL is a dev-convenience gap, not a security one) but worth doing before this becomes a bigger refactor.
