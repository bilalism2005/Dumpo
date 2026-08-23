# Data Model

## Storage Technology

Supabase Postgres, with Row Level Security enforced on every table (`auth.uid() = user_id`, or `= id` for `users`). Schema lives in `backend/schema.sql` (created ad hoc via `CREATE TABLE IF NOT EXISTS`, plus one incremental file `backend/migrations/01_add_indexes.sql` — no migration framework/versioning tool). The backend's service-role client (`backend/services/supabase_service.py`) bypasses RLS for system writes; a per-request anon-key client exists (`get_user_supabase_client`) but is not used by any router read during this migration — confirm before assuming it's dead code.

## Entities

### Entity: users
Synced automatically from Supabase `auth.users` via trigger (`handle_new_user`) on signup — never written directly by the app.

| Field | Type | Required | Description |
|---|---|---|---|
| id | UUID | yes | Primary key, same as `auth.users.id` |
| display_name | Text | no | From signup metadata, falls back to email |
| avatar_url | Text | no | Falls back to a generated `avatar.vercel.sh` URL |
| created_at, updated_at | Timestamptz | yes | |

### Entity: chat_messages
The unified log of every dump and every assistant reply — both raw conversation history and the record of what got classified where.

| Field | Type | Required | Description |
|---|---|---|---|
| id | UUID | yes | PK |
| user_id | UUID | yes | FK → users, cascade delete |
| content | Text | yes | The message text (user's raw dump, or assistant's confirmation/reply) |
| role | Text | yes | `user` \| `assistant` |
| bucket_tags | Text[] | yes | e.g. `["✅ Tasks"]` — display tags for the assistant's reply |
| reminder_set | Boolean | yes | |
| reminder_text | Text | no | |
| items | JSONB | yes | The structured `ProcessResponseItem[]` payload attached to an assistant reply |
| created_at | Timestamptz | yes | |

### Entity: tasks
| Field | Type | Required | Description |
|---|---|---|---|
| id | UUID | yes | PK |
| user_id | UUID | yes | |
| dump_id | UUID | no | FK → chat_messages, set null on delete — traces which dump created this |
| title | Text | yes | |
| due_date | Date | no | |
| due_time | Time | no | |
| reminder_set, reminder_sent | Boolean | yes | |
| is_complete | Boolean | yes | |
| completed_at | Timestamptz | no | Used to reset "today's progress" at local midnight — see `spec/api.md`'s `/dashboard` endpoint |
| secondary_buckets | Text[] | yes | Cross-listing into other bucket views |
| created_at | Timestamptz | yes | |

### Entity: ideas
| Field | Type | Required | Description |
|---|---|---|---|
| id, user_id, dump_id, secondary_buckets, created_at | — | — | Same shape as `tasks` |
| title | Text | yes | |
| description | Text | no | |

### Entity: journals
One row per user per calendar day — same-day dumps merge into the existing entry via LLM narrative merge (`spec/agent.md`), they don't create a second row.

| Field | Type | Required | Description |
|---|---|---|---|
| id, user_id, dump_id, secondary_buckets, created_at | — | — | Same shape |
| journal_date | Date | yes | **Unique with user_id** (`unique_user_journal_date`) — enforces the one-entry-per-day rule at the DB level |
| title | Text | yes | |
| content | Text | yes | |
| mood_signal | Text | no | `positive` \| `negative` \| `neutral` |

### Entity: finance
| Field | Type | Required | Description |
|---|---|---|---|
| id, user_id, dump_id, secondary_buckets, created_at | — | — | Same shape |
| description | Text | yes | |
| amount | Numeric | yes | |
| currency | Text | yes | Default `INR` |
| is_settled, settled_at | — | yes/no | Pay/receive tracking |

> **No `category` column.** Removed 2026-08-13 per `context.md`'s "Buckets Simplification" entry. **Live bug, not yet fixed:** `backend/services/llm_service.py` and `backend/services/bucket_service.py` still unconditionally set/insert a `category` field on every finance write — see `spec/roadmap.md` → Known Gaps.

### Entity: health
| Field | Type | Required | Description |
|---|---|---|---|
| id, user_id, dump_id, secondary_buckets, created_at | — | — | Same shape |
| title, description | Text | yes | |
| health_type | Text | yes | `physical` \| `mental` \| `medical` \| `nutrition` |

### Entity: watchlist
| Field | Type | Required | Description |
|---|---|---|---|
| id, user_id, dump_id, secondary_buckets, created_at | — | — | Same shape |
| title | Text | yes | |
| content_type | Text | no | `movie` \| `show` \| `documentary` \| `anime` |
| platform, year_of_launch, language | Text | no | |
| is_watched, watched_at | — | yes/no | |

> **No `genre` column.** Removed 2026-08-13, same changelog entry as `finance.category`. **Same live bug** — `llm_service.py`/`bucket_service.py` still set/insert `genre` on every watchlist write. See `spec/roadmap.md` → Known Gaps.

### Entity: others
The catch-all bucket — also the silent landing spot for the finance/watchlist bug above.

| Field | Type | Required | Description |
|---|---|---|---|
| id, user_id, dump_id, created_at | — | — | Same shape (no `secondary_buckets` on this table — the only bucket without one) |
| raw_text | Text | yes | |

### Entity: bucket_changes
Audit log of reclassifications (`spec/capabilities/reclassification.md`).

| Field | Type | Required | Description |
|---|---|---|---|
| id | UUID | yes | PK |
| user_id | UUID | yes | |
| item_id | UUID | yes | The **new** item's id (in the target bucket), not the original — see `routers/items.py`'s `reclassify_item` |
| from_bucket, to_bucket | Text | yes | |
| created_at | Timestamptz | yes | |

### Relationships
All bucket tables (`tasks`/`ideas`/`journals`/`finance`/`health`/`watchlist`/`others`) relate to `chat_messages` via `dump_id` (nullable FK, `ON DELETE SET NULL` — a deleted dump doesn't cascade-delete the items it created). All relate to `users` via `user_id` (`ON DELETE CASCADE`). No table has a SQLAlchemy-style ORM relationship — every join happens at query time via the Supabase client (same pattern as finwerse's `apps/api`).

## Data Lifecycle

- `chat_messages`, and every bucket table, are written by `backend/services/graph_service.py`'s LangGraph pipeline (`spec/agent.md`) in response to a `POST /api/v1/process` call — this is the only write path for new items (plus direct CRUD via `routers/items.py` for edits/deletes/reclassification/toggles).
- `bucket_changes` is written only by `reclassify_item`.
- Nothing in this schema is currently archived or time-boxed.
- Realtime is enabled (`ALTER PUBLICATION supabase_realtime ADD TABLE ...`) on every bucket table except `chat_messages` — worth confirming whether the frontend actually subscribes to these channels or polls instead, before assuming realtime sync is live end-to-end.

## Sensitive Data

- Every table is scoped to `user_id` via Postgres RLS (`auth.uid() = user_id`), enforced at the database level — stronger than finwerse's app-level-only scoping.
- `SUPABASE_SERVICE_KEY` (bypasses RLS entirely) and `GROQ_API_KEY` are backend-only env vars (`backend/config.py`, loaded from root `.env`) — never in the frontend.
- `app/src/config.ts` hardcodes `SUPABASE_URL` and `SUPABASE_ANON_KEY` directly in committed source — **this is expected/normal** for a Supabase mobile client (the anon key is designed to be public; RLS is the actual security boundary, not key secrecy). Also hardcodes `API_URL` pointing at the production Render backend with no dev/env override — not a secret, but a `harness/patterns/code.md` "no hardcoding" violation worth fixing (no way to point the app at a local backend without editing source).
