# 0008: Code computes facts; the model only narrates

**Status:** accepted 2026-10-04

**Decision:** every number (durations, counts, rankings) is computed in deterministic code. The LLM receives the computed metrics and example PRs, and writes prose around them. It never calculates anything.

**Why:** a model asked to count or locate things gets them wrong some of the time, and the error looks just like a right answer. LLMs are unreliable at arithmetic and can't be audited. Deterministic numbers can be tested.
