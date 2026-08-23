# API

## API Style

REST (FastAPI), all routes prefixed `/api/v1` except the public health check. All routers mounted in `backend/main.py`: `chat`, `dashboard`, `items` (note: `auth.py` is **not** a router — it's a dependency module providing `get_current_user_id`, imported by the other three).

## Authentication

`get_current_user_id` (`backend/routers/auth.py`): reads `Authorization: Bearer <token>`, calls Supabase's `auth.get_user(token)` to verify and extract the user id. `401` if the header is missing, malformed, or the token doesn't resolve to a user. Every endpoint below requires this except `/api/health`.

## Cross-cutting: rate limiting

`backend/main.py`'s middleware — 60 requests/minute per client (keyed by the `Authorization` header value, falling back to client IP for unauthenticated requests), in-memory (not distributed — resets on backend restart, and won't hold a limit consistently across multiple server instances if ever scaled horizontally). `429` on excess. `/api/health` is exempt.

## Endpoints

### `GET /api/health`
**Purpose:** Public health check, no auth.
**Response:** `{"status": "ok", "timestamp": <float>}`

### `POST /api/v1/process`
**Purpose:** The core capability — submit a raw thought dump for classification. See `spec/agent.md` for the full LangGraph pipeline.
**Request:** `{message_id: string, text: string, current_time_context?: string}`
**Response:** `{success: bool, items: ProcessResponseItem[]}` — one item per classified action (create/CRUD/chat), each with `primary_bucket`, `secondary_buckets`, `bucket_tags`, `confirmation_text`, `reminder_set`, `reminder_text`, `extracted`.
**Error cases:** `400` empty text; `500` pipeline failure (rare — the graph degrades internally rather than raising, see `spec/agent.md`).

### `GET /api/v1/chat/history`
**Purpose:** Paginated raw chat log (both dumps and assistant replies) for the chat screen.
**Query params:** `limit` (default 50), `offset` (default 0)
**Response:** `{success, messages: [...], has_more: bool}` — returned in chronological order (fetched newest-first, reversed server-side).

### `POST /api/v1/transcribe`
**Purpose:** Voice-to-text for the dump input, via Groq Whisper (`whisper-large-v3`).
**Request:** multipart file upload.
**Response:** `{success: bool, text: string}`

### `GET /api/v1/dashboard`
**Purpose:** Today's tasks, someday (undated) tasks, overdue tasks, ideas preview, journals preview.
**Query params:** `current_date` (client's local YYYY-MM-DD, defaults server-side to UTC today if omitted — **timezone bug risk**: an omitted `current_date` near midnight will use UTC "today," not the client's local "today"), `timezone_offset` (JS `getTimezoneOffset()` minutes)
**Response:** `{success, today_tasks, someday_tasks, overdue_tasks, overdue_count, ideas_preview, journals_preview}`
**Business rule:** a task/idea completed on a prior local day is filtered out of "today" even if its `due_date` still reads today, so daily progress resets at local midnight (`is_completed_on_prior_day` — this is the fix `context.md`'s 2026-08-14 changelog entry describes).

### `GET /api/v1/buckets/{bucket_name}`
**Purpose:** Fetch one bucket's items — primary items from that table, **plus** any item in another table that lists this bucket in its `secondary_buckets`, merged and sorted by `created_at`.
**Path param:** `bucket_name` — one of `tasks`\|`ideas`\|`journals`\|`finance`\|`health`\|`watchlist`\|`others`
**Query params:** `limit` (default 50), `offset` (default 0)
**Response:** `{success, bucket, items: [...], has_more}` — each item tagged `source_table` + `is_primary`.
**Error cases:** `400` invalid bucket name.
**Note:** `others` is excluded from every other bucket's secondary-bucket fan-out query (`items.py` line ~53) — items are never cross-listed into `others`.

### `PATCH /api/v1/tasks/{task_id}/complete`
**Purpose:** Toggle (or explicitly set via `is_complete` query param) task completion; sets/clears `completed_at`.

### `PATCH /api/v1/tasks/{task_id}/reminder`
**Purpose:** Toggle `reminder_set`.

### `PATCH /api/v1/watchlist/{item_id}/toggle`
**Purpose:** Toggle `is_watched`; sets/clears `watched_at`.

### `PATCH /api/v1/finance/{item_id}/settle`
**Purpose:** Toggle `is_settled`; sets/clears `settled_at`.

### `PATCH /api/v1/items/{bucket}/{item_id}`
**Purpose:** Inline-edit an item's content. **If the edit clears all of a bucket's primary text field(s), the item is deleted instead of updated** — this is the product's "no delete button" design rule (root `CLAUDE.md`) implemented at the API layer.
**Request:** `BucketItemUpdateRequest` — any subset of title/description/raw_text/content/amount/is_settled/is_complete/is_watched/health_type/due_date/due_time.
**Known Gap:** the field whitelist (`fields_map`) allows `category` for `finance` and `genre` for `watchlist` — **both columns no longer exist on those tables** (see `spec/data.md`). An inline edit attempting to set either will likely fail at the Supabase layer. Same root cause as the create-path bug tracked in `spec/roadmap.md`.
**Error cases:** `400` invalid bucket, or no valid fields in the payload.

### `DELETE /api/v1/items/{bucket}/{item_id}`
**Purpose:** Explicit delete (used when "clear all fields" isn't the interaction — e.g. a swipe-to-delete gesture, if the UI has one; confirm against the actual screens before assuming both delete paths are user-reachable, since root `CLAUDE.md` says "no delete buttons").

### `PATCH /api/v1/items/{bucket}/{item_id}/reclassify`
**Purpose:** Move an item from one bucket to another — full read-map-write-delete-log cycle. See `spec/capabilities/reclassification.md` for the field-mapping rules and the rollback-on-partial-failure behavior.
**Request:** `{to_bucket: string}`
**Known Gap:** the field-mapping logic sets `category`/`genre` when reclassifying *into* `finance`/`watchlist` (same dead-column bug as above) — reclassifying an item into either bucket will likely fail the same way a fresh dump does.
**Error cases:** `400` invalid bucket name(s); `404` item not found in source bucket; `500` with an explicit rollback (deletes the just-created target row) if the source-side delete fails after the target-side insert succeeds.
