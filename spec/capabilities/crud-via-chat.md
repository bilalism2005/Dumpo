# Capability: CRUD via Chat

## What It Does
Lets a user update, delete, read, or append to an existing item purely through natural language — "mark the gym task done," "I watched Interstellar," "what are my pending tasks," "also add that I had pizza" (journal append) — without ever opening the item directly.

## Inputs
| Input | Type | Source | Required |
|---|---|---|---|
| Same as Dump Capture — this is one branch of the same `/process` call | — | — | — |

## Outputs
| Output | Type | Destination |
|---|---|---|
| A confirmation item (updated/deleted/read/appended) | `ProcessResponseItem` | applied to the target row, returned to client |
| A disambiguation question | string | when 2+ candidates match and no id was resolved |
| A not-found message | string | when 0 candidates match |

## External Calls
| System | Operation | On Failure |
|---|---|---|
| `get_live_user_memory` | grounds id resolution | empty memory → falls through to fuzzy search |
| `fuzzy_search_bucket` (ILIKE) | fallback id resolution when memory-grounding fails | empty result → "couldn't find anything" message, not an error |
| Supabase | UPDATE / DELETE / SELECT | caught per-operation, degrades to "something went wrong" confirmation text |

## Business Rules
- Resolution order: LLM-resolved id from memory context (validated — a hallucinated id not actually present in memory context is discarded) → ILIKE fuzzy search → disambiguation prompt if 2+ candidates, not-found if 0.
- A low-confidence CRUD classification (`confidence < 0.6`) on UPDATE/DELETE/APPEND discards any resolved id and forces the fuzzy-search/clarification path instead — a deliberate "don't guess destructively" safeguard.
- Update field names are normalized from LLM aliases (`status: "done"`, `is_done: true`, etc.) to exact column names per bucket before writing (`normalize_update_fields`).
- READ with no specific target queries the whole bucket and returns a formatted list, not a single item.

## Success Criteria
- [x] A high-confidence, memory-grounded update executes directly without a fuzzy search round-trip
- [x] A low-confidence destructive operation (UPDATE/DELETE/APPEND) never executes blind — forces clarification instead
- [ ] 2+ fuzzy matches produces a genuinely disambiguating list (distinct titles, not duplicates) — not verified against real data during this migration
