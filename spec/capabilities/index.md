# Capabilities Index

## What Is a Capability?

A single, discrete action or behavior Dumpo performs — e.g. "classify a raw dump into the right bucket," "let a user reclassify a miscategorized item."

## Capabilities in This Project

| Capability | File | Status |
|---|---|---|
| Dump Capture & Classification | [dump-capture-and-classification.md](dump-capture-and-classification.md) | Built (1 known gap) |
| CRUD via Chat | [crud-via-chat.md](crud-via-chat.md) | Built |
| Chitchat | [chitchat.md](chitchat.md) | Built (1 known gap) |
| Buckets (view/edit/delete/toggle) | [buckets.md](buckets.md) | Built (1 known gap) |
| Dashboard | [dashboard.md](dashboard.md) | Built (1 known gap) |
| Voice Dump | [voice-dump.md](voice-dump.md) | Built, client wiring unconfirmed |
| Reclassification | [reclassification.md](reclassification.md) | Built (1 known gap) |

See `spec/roadmap.md` → Build Status and Known Gaps for the full picture, especially the Finance/Watchlist bug that touches 4 of these 7 files.

## How to Add a New Capability

Once `/zero-shot-build` is ported (see `CLAUDE.md`), run it with the capability description. The `spec-writer` sub-agent creates a new file here, updates this index, and flags dependencies on existing capabilities before returning.

## Capability File Template

Each file answers: **What it does** (one sentence) · **Inputs** · **Outputs** · **External calls** · **Business rules** · **Success criteria** (checked `[x]` where verified against running code during the 2026-08-16 migration, unchecked `[ ]` where unverified or a known gap).
