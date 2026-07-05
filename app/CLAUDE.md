# Dumpo Frontend Guidelines

## Commands
* Start app locally: `npm run start` or `npx expo start`
* Run web dev server: `npm run web` or `npx expo start --web`
* Run Android build/emulator: `npm run android`
* Run iOS simulator: `npm run ios`

## Key Patterns & Rules
1. **Routing**: Managed entirely via Expo Router under `src/app/`. Wrappers import complex screens from `src/screens/` to keep routing definitions clean.
2. **State Management**: Shared states (auth, chat, dashboard) are managed in Zustand stores under `src/store/`.
3. **No Direct Supabase Calls**: Components and screens must never interact with the Supabase client directly (except for authentication in `authStore.ts`). All backend database modifications must go through the FastAPI backend via `src/services/api.ts`.
4. **JWT Storage**: The session JWT is stored in `SecureStore` (under key `supabase_jwt_token`) for security, not in `AsyncStorage`.
5. **Inline Edits**: All cards support inline editing. Save actions are debounced by 500ms using the `InlineEditText` component. No explicit save buttons.
6. **No Deletion Buttons**: Tapping a delete button is prohibited. Items are deleted automatically when all of their text fields are cleared.
7. **Premium Styling**: Custom progress bar with gradient transitions and a glowing end dot. Minimalist design system.
