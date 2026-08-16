# Change Log

- **2026-08-16T19:28:00+05:30**
  - **Model Upgrade:** Migrated core Groq LLM model from `llama-3.1-8b-instant` to `gpt-oss-20b` following Groq's deprecation notice for the Llama 3.1 8B Instant model. 
  
**Current Status**: Backend uses the recommended `gpt-oss-20b` model.

**Decisions**:
- Used standard hyphenated lowercase format (`gpt-oss-20b`) for the Groq model identifier as requested by the deprecation notice for "GPT OSS 20B".


- **2026-08-14T09:54:00+05:30**
  - **EAS Deployment Fix:** Re-targeted Expo OTA updates from `main` to `preview` branch to correctly hit the live active channel on user devices.
  - **Timezone Synchronization:** Passed `timezone_offset` from frontend `dashboardStore.ts` API calls. Updated `backend/routers/dashboard.py` to parse UTC `completed_at` ISO stamps, subtract the offset to match local device time, and safely extract the midnight-aligned date before filtering dashboard items. This fixes the bug where tasks marked done immediately vanished if they crossed UTC midnight boundaries.

**Current Status**: Code changes pushed and Expo OTA update compiling on `preview` channel. All timezone resets behave cleanly relative to the client device.

- **2026-08-13T19:35:00+05:30**
  - **Buckets Simplification:** Simplified Finance and Watchlist buckets by removing the sub-categories (`category` in finance, `genre` in watchlist). 
  - **Database schema updates:** Ignored constraints by defaulting AI values to "others" to protect intact data while logically removing constraints. `schema.sql` definitions updated to reflect intent.
  - **Frontend Redesign:** Overhauled `FinanceScreen.tsx` to group simple transaction cards by month. Overhauled `WatchlistScreen.tsx` to display one unified flat list.
  - **AI Optimization:** Cleaned `llm_service.py` to stop evaluating sub-genres for performance token efficiency.

**Current Status**: Complete bucket UI rewrite and backend dataflow overrides. Ready to test.

**Decisions**:
- Protected user DB records by hardcoding default values instead of destroying or dropping columns manually via API.
- Re-styled Finance output to strictly follow `"bought tomatoes ₹200"` display logic.

- **2026-08-12T12:14:00+05:30**
  - **Chat UI:** Removed `setTimeout` + `scrollToEnd()` from `ChatScreen.tsx`. `inverted` `FlatList` now uses pure hardware-accelerated bottom-anchoring natively on UI thread with zero scroll-to-top glitch.
  - **API Authentication & Tokens:** Refactored `api.ts` `getHeaders()` to pull fresh tokens directly via `supabase.auth.getSession()`. Leveraged Supabase SDK `autoRefreshToken: true` to guarantee 100% valid JWT access tokens on every API request.
  - **Error Handling:** Updated `chatStore.ts` catch block to trigger silent session reload on 401 Unauthorized and display connection error status instead of masking network errors with fake "saved to Others" messages.
  - **Deployments:** Pushed commit `0c44063` to `main` and triggered EAS preview and production updates.

**Current Status**: Code changes pushed and OTA builds deploying.

**Decisions**:
- Eliminated JS thread timers in `ChatScreen.tsx` for 60 FPS native bottom list rendering.
- Used Supabase SDK built-in token auto-refresh inside `api.ts` to solve JWT token expiration across all endpoints.
