# 0006: Brief uses OpenRouter with a cheap model; cost is announced first

**Status:** accepted 2026-10-04

**Decision:** the brief calls OpenRouter (`OPENROUTER_API_KEY`, model set by `OPENROUTER_MODEL`). Before calling, the script prints an estimated cost from the input size. Input is capped so a run stays under US$0.05.

**Why:** The owner already has an OpenRouter account with spend limits set. The brief is short narrative writing, so a small model is enough. The cost rule matches how the owner runs every paid tool.
