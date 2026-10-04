# 0003: Every claim in the brief cites PRs, enforced by code

**Status:** accepted 2026-10-04

**Decision:** the LLM-written brief must cite PR numbers for every claim. A validator rejects the brief if it cites a PR number that wasn't in the input, or if a bullet has no citation. A rejected brief is retried once, then omitted. Nothing unvalidated is published.

**Why:** a bottleneck report is only useful if a reader can check it. A claim a reader can't trace back to its PRs is an opinion, not a finding.
