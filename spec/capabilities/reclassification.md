# Capability: Reclassification

## What It Does
Moves an item from one bucket to another when the AI (or the user) got the original classification wrong — full transfer: read source, map fields to the target schema, write target, delete source, update the originating chat message's display, log the change.

## Inputs
| Input | Type | Source | Required |
|---|---|---|---|
| bucket, item_id | path params | the item being moved | yes |
| to_bucket | string | request body | yes |

## Outputs
| Output | Type | Destination |
|---|---|---|
| new_id, item | the newly-created row in the target bucket | client, plus the source row is deleted |
| Updated chat message | the original assistant confirmation message's `items`/`content`/`bucket_tags` are rewritten in place to reflect the new bucket | `chat_messages` |
| Change log row | `bucket_changes` | audit trail |

## External Calls
| System | Operation | On Failure |
|---|---|---|
| Supabase | SELECT source → INSERT target → DELETE source → UPDATE chat_messages → INSERT bucket_changes | see Business Rules — partial-failure handling is explicit and real here, not a generic catch-all |

## Business Rules
- Per-target-bucket field mapping (`routers/items.py`'s `reclassify_item`) — each `to_bucket` branch pulls the best-available source field (e.g. moving into `tasks` takes `title` from the source's `title`, or `description`, or `raw_text`, whichever exists first).
- **Explicit rollback:** if the target insert succeeds but the source delete then fails, the code deletes the just-created target row to prevent a duplicate, and returns `500` — a genuine two-phase-commit-style safeguard, not just a try/except.
- The chat-message-update step is best-effort — its own failure is caught and logged but does **not** fail the overall reclassification (the item has already moved; only the historical chat display might show stale bucket info).
- `bucket_changes.item_id` records the **new** item's id, not the original — the original id no longer exists after the move.

## Known Gap
Reclassifying an item **into** `finance` or `watchlist` sets a `category`/`genre` field on the target insert — the same dead-column bug as Dump Capture. Reclassifying **out of** those buckets is unaffected (the target bucket determines which fields get set).

## Success Criteria
- [x] A target-insert-succeeds/source-delete-fails sequence correctly rolls back the target insert (verified against the explicit rollback code path)
- [x] The change is logged with the new item's id, not the stale original id
- [ ] Reclassifying into finance/watchlist works — **currently fails**, same root cause as Dump Capture's Known Gap
