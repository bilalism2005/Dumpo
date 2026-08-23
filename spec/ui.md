# UI

## UI Type

One client: `app` (Expo/React Native + TypeScript, Expo Router, Zustand). Runs on iOS, Android, and web (Expo's web target) — not a separate web app the way finwerse has one; same codebase, one product surface. Routes live in `app/src/app/` (Expo Router file-based routing); screens themselves live in `app/src/screens/` and are imported into thin route wrappers (`app/CLAUDE.md` rule 1 — keeps routing definitions clean).

## Tech Stack

Expo Router, Zustand (`authStore`, `chatStore`, `dashboardStore` — no per-bucket store; bucket screens call `app/src/services/api.ts` directly), `expo-secure-store` for JWT storage (never `AsyncStorage` — `app/CLAUDE.md` rule 4, a real security-relevant distinction since `AsyncStorage` is unencrypted on-device).

## Routes (`app/src/app/`)

| Route | Screen | Purpose |
|---|---|---|
| `/` (`index.tsx`) | — | Entry point, likely redirects based on auth state — confirm before assuming this is a real screen vs. a redirect stub |
| `auth/login`, `auth/signup` | `LoginScreen`, `SignupScreen` | Supabase Auth — the one place the app calls Supabase directly (`authStore.ts`) |
| `(app)/index` | `DashboardScreen` | Today's tasks, someday tasks, overdue count, ideas/journals preview — see `spec/api.md`'s `/dashboard` |
| `buckets/tasks` | `TasksScreen` | |
| `buckets/ideas` | `IdeasScreen` | |
| `buckets/journals` | `JournalScreen` (list) + `JournalEntryScreen` (single day/entry) | Two screens for one bucket — list view and entry-detail view |
| `buckets/finance` | `FinanceScreen` | **Creation path confirmed broken server-side** — see `spec/roadmap.md` Known Gaps. The screen itself may render fine against whatever items *did* land correctly (or wrongly landed in Others) |
| `buckets/health` | `HealthScreen` | |
| `buckets/watchlist` | `WatchlistScreen` | **Same broken creation path as Finance** |
| `buckets/others` | `OthersScreen` | Also the silent landing spot for failed Finance/Watchlist writes — items here may look like legitimate "others" dumps but actually be misclassified Finance/Watchlist items |
| `explore` | `TabTwoScreen` | **Confirmed dead code** — unmodified Expo Router default template scaffold (`ExternalLink`, `Collapsible`, `WebBadge` boilerplate components), same pattern as finwerse mobile's `two.tsx`. Candidate for removal. |

Chat itself (`ChatScreen.tsx`) is reached via the `(app)` tab layout, not listed as a standalone top-level route above — confirm its exact route path against `app/src/app/(app)/_layout.tsx` before relying on this file for exact navigation structure; this document captures screen inventory and purpose, not pixel-exact routing.

## Cross-Cutting UI Rules

All 5 apply from `spec/roadmap.md`'s Key Constraints — restated here only as a pointer, not duplicated:
- No save buttons (autosave, 500ms debounce)
- No delete buttons (clear-to-delete)
- 48px minimum tap targets (Fitts's Law)
- <400ms interactions + optimistic UI (Doherty Threshold)
- No direct Supabase calls except auth

## Error States

Not verified screen-by-screen during this migration. `backend/CLAUDE.md`'s existing rule ("Exceptions should never crash the server; default/fallback behaviors... must be executed") means the backend rarely returns a hard error — most failures degrade to a valid-looking response (an item silently landing in `others`, a confirmation message saying something went wrong). This has a direct UI consequence worth being deliberate about: **a screen that only handles "the request succeeded, render the response" will not surface the Finance/Watchlist bug to the user at all** — the response looks successful, it's just pointing at the wrong bucket. `harness/patterns/ui-ux.md`'s empty/loading/error/populated states bar still applies, but "error" here often means "the backend's fallback behavior kicked in," not "the request failed" — worth designing for that distinction specifically, more than in a typical app.
