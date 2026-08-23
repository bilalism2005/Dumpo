---
description: Reconcile Dumpo's spec/ and code so they match — spec wins, except where the divergence reveals spec itself is wrong (alias for the zero-shot-sync skill).
argument-hint: [optional path, capability name, or surface to scope to]
---

Run the **zero-shot-sync** skill with the optional scope: `$ARGUMENTS`.

The skill at `.claude/skills/zero-shot-sync/SKILL.md` is the source of truth — invoke it and follow it exactly. This command exists only so `/zero-shot-sync` works as a slash command in addition to the skill.
