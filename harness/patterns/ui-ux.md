# UI/UX Standards

The bar Dumpo's one product surface (`app`) must clear. `spec/ui.md` says *what* the UI is; this file says *how good it has to be*. Ported via finwerse's own port of `smallTechOrg/zero-shot-claude-boilerplate`.

---

## First Principles

**Every state is designed, not just the happy one.** Empty (a new user's first-ever dashboard, before any dump — what does that look like?), loading (a `/process` call can take a few seconds given the LLM round-trip — the "no fake progress" rule below matters here), error (see the note below — Dumpo's errors are unusually often *silent successes with wrong content*, not failures), populated.

**The user is never guessing.** Given Dumpo's whole premise is removing a decision from the user, this principle cuts both ways: the user shouldn't have to think about where something went, but they also need to be able to *see* where it went, easily, to catch a misclassification (like the current Finance/Watchlist bug) before it becomes invisible clutter in Others.

**Feedback is immediate** — the product's own Doherty Threshold design rule already states this (`spec/roadmap.md`), optimistic UI over waiting for the backend round-trip.

---

## Honesty

- **Never fake progress** — root design rule already covers this (Doherty Threshold: real optimistic UI, not a fake spinner).
- **Destructive actions confirm** — except Dumpo's own design rule deliberately removes explicit delete confirmation in favor of clear-to-delete; that's a considered product choice, not an oversight, and this file doesn't override it.
- **A "successful" response can still be silently wrong** — this is Dumpo's sharpest edge case. A finance dump that gets misclassified into `others` returns a perfectly normal-looking `200` with a confirmation message. The UI's honesty obligation here isn't just "show errors clearly" — it's "make it easy for a user to notice their finance tracker has zero entries in it despite them dumping several," which a generic empty-state message won't do on its own.

---

## Visual & Interaction Quality

- **Hierarchy, consistency, whitespace, legibility, responsive/fluid** — standard bar, no Dumpo-specific override.
- **48px minimum tap targets** — this is a *product* design rule (Fitts's Law, `spec/roadmap.md`), not just a nice-to-have; treat it as a hard gate on any new tappable element, not a suggestion.

---

## Accessibility

Keyboard/focus (web target via Expo), semantic markup, text alternatives, `prefers-reduced-motion` — standard bar.

---

## Copy

**Plain, specific, human.** Dumpo's existing confirmation copy (`"'<title>' saved to <Bucket>."`) is a good model — specific, short, names the actual bucket.

---

## Chat Surface (the whole app, functionally — chat *is* the primary interaction model)

- The assistant states what it's doing implicitly through its confirmation text (already true); a slow `/process` call needs visible "thinking" feedback given the LLM round-trip is the single slowest thing in the product.
- Dumpo's replies are typically short confirmation strings, not long-form markdown-formatted prose the way finwerse's chatbot synthesizes — confirm whether markdown rendering is even a relevant concern here before assuming it needs the same treatment finwerse's chat screen does; check the actual `confirmation_text` content style (it doesn't appear to use markdown links/headers the way finwerse's does) before treating this as a gap.
- **No dual-representation** — a reclassified item's chat-message record and its actual bucket row must agree; `spec/capabilities/reclassification.md` already documents the one place this could drift (the chat-message-update step is best-effort and can fail independently of the move itself).

---

## Verification

Before calling a UI change done: walk the primary dump→classify→appear-in-bucket path live, confirm at least the empty/loading/populated states render for the view touched, and specifically check whether a "successful-looking but wrong" response (see Honesty above) would be noticeable to a real user in that view.
