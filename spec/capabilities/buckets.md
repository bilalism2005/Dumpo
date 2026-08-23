# Capability: Buckets (view, edit, delete, toggle)

## What It Does
The 7 structured views over classified data — Tasks, Ideas, Journals, Finance, Health, Watchlist, Others — each with pagination, inline editing (autosave), clear-to-delete, and bucket-specific quick-toggles (task completion, watchlist watched, finance settled).

## Inputs
| Input | Type | Source | Required |
|---|---|---|---|
| bucket_name | enum (7 values) | route param | yes |
| limit, offset | int | pagination | no (defaults 50/0) |
| field edits | varies per bucket | inline text editing, debounced 500ms | — |

## Outputs
| Output | Type | Destination |
|---|---|---|
| Merged item list (primary + secondary-bucket cross-listed items) | list, sorted by `created_at` desc | bucket screen |
| Updated/deleted item | object | applied in place |

## External Calls
| System | Operation | On Failure |
|---|---|---|
| Supabase (7 tables) | SELECT (primary + secondary fan-out, run concurrently), UPDATE, DELETE | `500` with the raw exception message — this endpoint group does NOT have the graceful degrade-to-`others` pattern the dump-creation path has; a fetch failure is a real error here |

## Business Rules
- A bucket view shows items where it's the **primary** table, plus items from other tables that list this bucket in `secondary_buckets` — cross-listing, not duplication of storage.
- `others` is never a secondary-bucket target — items are never cross-listed into Others.
- Clearing an item's primary text field(s) to empty deletes it — the exact "what counts as primary text" mapping is per-bucket (title for tasks/watchlist, description for finance, content for journals, title+description for ideas/health, raw_text for others).
- Quick-toggles (task complete, watchlist watched, finance settled) set a paired timestamp (`completed_at`/`watched_at`/`settled_at`) alongside the boolean.

## Known Gap
Finance and Watchlist inline edits that touch `category`/`genre` will hit the same dead-column problem as creation (`spec/data.md`). Other fields on those two buckets should still edit fine.

## Success Criteria
- [x] A bucket's primary + secondary-listed items merge and sort correctly (verified against `items.py`'s `get_bucket_items` logic)
- [ ] Clearing a task's title actually deletes it end-to-end (not yet runtime-verified)
- [x] Task/watchlist/finance toggles correctly pair the boolean with its timestamp field
- [ ] Finance/watchlist inline edits of non-category/genre fields work correctly — likely fine, not yet runtime-verified in isolation from the broader Known Gap
