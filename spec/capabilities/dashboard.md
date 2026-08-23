# Capability: Dashboard

## What It Does
The home screen — today's tasks, undated "someday" tasks, overdue tasks, and a preview of recent ideas and journal entries, all local-timezone-aware so daily progress resets at the user's actual midnight, not UTC midnight.

## Inputs
| Input | Type | Source | Required |
|---|---|---|---|
| current_date | string (YYYY-MM-DD) | client's local date | no (defaults to UTC today if omitted — see Known Gap) |
| timezone_offset | int | `Date.getTimezoneOffset()` from the client | no (defaults 0) |

## Outputs
| Output | Type | Destination |
|---|---|---|
| today_tasks, someday_tasks, overdue_tasks, overdue_count, ideas_preview, journals_preview | object | Dashboard screen |

## External Calls
| System | Operation | On Failure |
|---|---|---|
| Supabase (5 concurrent queries: tasks×3 shapes, ideas, journals) | SELECT | `500` — no graceful degrade here either |

## Business Rules
- A task/idea marked complete on a **prior local day** is filtered out of today's list even if its `due_date` is still today — this is the fix for the bug described in `context.md`'s 2026-08-14 entry (tasks vanishing immediately if completion crossed a UTC midnight boundary). Implemented via `is_completed_on_prior_day`, which converts `completed_at` (UTC) to local time using `timezone_offset` before comparing dates.
- Overdue = incomplete AND `due_date` before `current_date`.
- Someday = no `due_date` set at all (not the same as "not overdue").

## Known Gap — CONFIRMED (not just suspected)
`app/src/store/dashboardStore.ts` calls `fetchDashboard(undefined, true)` from **every single post-action refresh** — `toggleTaskComplete`, `toggleTaskReminder`, `updateBucketItem`, `reclassifyBucketItem`, `deleteBucketItem` all pass `currentDate: undefined`. The store's own `dateParam` construction confirms the consequence: when `currentDate` is falsy, the request omits `current_date` entirely and sends only `timezone_offset`. So every dashboard refresh triggered by a user action (not just the initial screen load) hits the server's UTC-default path, reintroducing the exact class of bug the 2026-08-14 local-midnight fix was written to solve — just via a missing-param path instead of the original raw-comparison bug. Only the initial mount call (wherever `DashboardScreen.tsx` triggers it — not traced in this migration) might pass an explicit date.

## Success Criteria
- [x] A task completed yesterday (locally) doesn't appear in today's list even if it's technically still "today" in UTC, **for the initial dashboard load** (verified against `is_completed_on_prior_day`'s logic)
- [ ] The same holds true after any in-app action (toggle/edit/delete/reclassify) — **currently fails**, confirmed via `dashboardStore.ts`, see Known Gap
