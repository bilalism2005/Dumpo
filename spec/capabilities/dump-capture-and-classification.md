# Capability: Dump Capture & Classification

## What It Does
Takes a raw, unstructured thought dump from the user and automatically formats, splits, classifies, and files it into the right bucket(s) — the core product loop. Full agent design in `spec/agent.md`.

## Inputs
| Input | Type | Source | Required |
|---|---|---|---|
| text | string | user typing or voice transcription | yes |
| message_id | string | client-generated | yes |
| current_time_context | ISO datetime string | client's local time | no |

## Outputs
| Output | Type | Destination |
|---|---|---|
| One or more classified items | `ProcessResponseItem[]` | written to the target bucket table(s) + `chat_messages`, returned to client for confirmation display |

## External Calls
| System | Operation | On Failure |
|---|---|---|
| Groq (router LLM) | classify + extract + split | 2 retries, then hard-coded fallback: everything becomes one `others` CREATE item with the raw text preserved |
| Supabase (bucket tables) | insert | per-bucket try/except in `write_to_bucket`, falls back to `others` on any write failure |

## Business Rules
- A single dump can produce multiple items across multiple action types (journal narrative + a task + a question, all at once) — see `spec/agent.md`'s conditional fan-out.
- Narrative content extracted into a journal segment must never also appear as a separate atomic item (explicit prompt instruction, `ROUTER_SYSTEM_PROMPT` STEP 3).
- Same-day journal entries merge via LLM narrative merge rather than creating a second row (`unique_user_journal_date` constraint enforces this at the DB level too).
- Text is truncated at 1500 chars before reaching the LLM.

## Known Gap
Finance and watchlist classification produces a `category`/`genre` field that no longer has a matching column — the item is classified correctly but the **write** then fails and silently redirects to `others`. See `spec/roadmap.md` → Known Gaps.

## Success Criteria
- [ ] A single-intent dump ("remind me to call mom") creates exactly one task item
- [ ] A mixed dump (narrative + task) produces both a journal write and a task write in one call
- [x] An LLM outage degrades to an `others` entry with the raw text preserved, never a lost dump (confirmed via code — not yet load-tested)
- [ ] Finance and watchlist dumps land in their correct bucket, not `others` — **currently fails**, see Known Gap
