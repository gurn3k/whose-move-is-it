# 0011: The page shows the snapshot's age, and the README's findings are generated

**Status:** accepted 2026-11-20. Builds on ADR 0009.

**Decision:**
- The byline gives the snapshot's age beside its date ("Snapshot of 4 October 2026 (47 days ago)"). From 30 days old, a note under the byline says the snapshot is that many days old and that open PRs may have moved since.
- The age is worked out in the visitor's browser. The prerendered copy in `index.html` has no clock, so it gives the date only.
- The README's findings section is written from `metrics.json` by `npm run prerender`, between markers. A test fails if it falls out of step with the snapshot, or if a snapshot figure is typed by hand elsewhere in the README.

**Alternatives:**
- A scheduled refresh. ADR 0009 rejected it: each brief is reviewed by a person before it's published.
- Hiding the page once it's stale. That would remove the evidence links along with the figures, and a dated snapshot is still true about its date.
- A test that compares hand-written README numbers with the data. That catches drift but still needs editing on every refresh. Generating the text removes the editing.

**Why:** the page answers "whose move is it right now?". On 2026-11-20 the live snapshot was 47 days old, and the page said so only through its date. In 47 days PRs merge, close and arrive, so a reader could act on a ranking that had already moved, with nothing on the page to warn them. The README had the same problem in a second place: every figure was typed by hand, so a refresh would leave it wrong.

**Consequences:**
- A stale page now tells the reader so, even when nobody refreshes it.
- The 30-day threshold is a judgment call, not a measured cut-off: a month is about four times the median merged PR's whole wait (7.3 days on the 2026-10-04 snapshot). It can be tuned once two snapshots show how fast the queues actually change.
- The README's findings wording is now set in `src/readme.js`. Changing it means editing code, not the README.
- The DevStats cross-check paragraph in the README is still written by hand. It's dated to the snapshot it was run on, and gets rerun and updated on each refresh.
