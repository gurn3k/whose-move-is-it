# Cross-check against DevStats

Two runs: the first on the 2026-10-04 snapshot, the second on the 2026-11-21 snapshot ([below](#rerun-on-the-2026-11-21-snapshot)).

## First run, on the 2026-10-04 snapshot

Run 2026-10-06 with `node scripts/cross-check-devstats.js 2026-08 2026-09`. It compares DevStats' "PR Time to Approve and Merge" for `kubernetes/kubernetes` (monthly, all sizes and kinds, read from its public Grafana API) with **DevStats' own definitions recomputed on this project's data**, so like is compared with like.

DevStats' definitions, from [`metrics/kubernetes/time_metrics.sql`](https://github.com/cncf/devstats/blob/master/metrics/kubernetes/time_metrics.sql): merged PRs grouped by the month they were **created**, clock starting at **open**, the **first** `lgtm` and `approved` label adds, missing stages falling back to the next event or to zero, and `percentile_disc` (nearest rank) median and 85th percentile.

### Cohorts are complete

PRs created in each month and merged, counted with GitHub search on 2026-10-06:

| Created | Merged PRs on GitHub | In our data | Merged after our fetch |
|---|---|---|---|
| 2026-08 | 198 | 198 | 0 |
| 2026-09 | 265 | 263 | 2 |

July is left out: our data starts with merges on 2026-07-06, so July's cohort is missing its fastest PRs.

### Results

| Stage | Aug: DevStats | Aug: ours | Sep: DevStats | Sep: ours |
|---|---|---|---|---|
| open → lgtm, median | 8.9 d | 6.4 d | 32.3 h | 27.0 h |
| open → lgtm, 85th | 28.3 d | 27.8 d | 6.5 d | 5.9 d |
| lgtm → approve, median | 0 h | 0 h | 0 h | 0 h |
| lgtm → approve, 85th | 2.7 d | 7.9 d | 0 h | 4.7 h |
| approve → merge, median | 2.6 h | 3.5 h | 3.8 h | 2.5 h |
| approve → merge, 85th | 10.1 d | 13.0 d | 24.0 h | 30.5 h |

### What agrees

- **The main finding.** In both datasets nearly all the time is in getting to lgtm, and merging after approval takes hours at the median. This is the finding the dashboard and brief lead with.
- **Scale and month-to-month change.** Both show August PRs taking several times longer to reach lgtm than September PRs (DevStats 8.9 d vs 32 h; ours 6.4 d vs 27 h). The slowdown shows up independently in both sources. *Why August was slower isn't in either dataset.*
- **The 85th percentile time to lgtm** is within 10% in both months.

### What differs, and the likely reasons

- **Our median time to lgtm is 16-28% lower.** One plausible reason is DevStats' documented data gap: its GH Archive source is missing events, and when a PR's `lgtm` label event is missing, its SQL falls back to the approve or merge time, which makes time to lgtm longer. *This is an explanation, not a measurement. We can't see which events DevStats is missing.*
- **Our lgtm → approve and approve → merge tails are longer.** Same possible cause in the other direction: a missing label event in DevStats would collapse a stage to zero or move time into another stage.
- **We can't compare PR counts.** DevStats' series doesn't publish how many PRs each month's figure covers.

### What this means for the README

- Reasonable to say: "The main finding agrees with Kubernetes' own DevStats: most of a merged PR's time is spent waiting for lgtm, and merging after approval takes hours."
- Not supportable: "more accurate than DevStats." The two disagree by up to 28% on the median, and we can't tell which is closer to the truth without the missing-event data.
- Draft time made no difference in these cohorts (median and 85th percentile 0 h between opening and ready for review), so the clock-start difference doesn't explain the gap.

## Rerun on the 2026-11-21 snapshot

Run 2026-11-21 with `node scripts/cross-check-devstats.js 2026-09 2026-10`. The snapshot's merged window now starts on 2026-08-23, so August's cohort is missing its earliest merges and is left out, as July was before.

### Cohorts are complete

| Created | Merged PRs on GitHub | In our data |
|---|---|---|
| 2026-09 | 355 | 355 |
| 2026-10 | 517 | 516 |

### Results

| Stage | Sep: DevStats | Sep: ours | Oct: DevStats | Oct: ours |
|---|---|---|---|---|
| open → lgtm, median | 32.3 h | 2.1 d | 7.0 h | 22.6 h |
| open → lgtm, 85th | 6.5 d | 19.4 d | 6.0 d | 11.3 d |
| lgtm → approve, median | 0 h | 0 h | 0 h | 0 h |
| lgtm → approve, 85th | 0 h | 2.9 d | 0 h | 22.5 h |
| approve → merge, median | 3.8 h | 2.3 h | 3.5 h | 2.5 h |
| approve → merge, 85th | 24.0 h | 46.5 h | 21.5 h | 37.7 h |

### What agrees

- **The main finding still holds in both.** Reaching lgtm is the longest stage at the median, and merging after approval takes a few hours.

### What differs

- **The gap on time to lgtm grew.** Our median is 1.6 times DevStats' for September (2.1 d against 32.3 h) and 3.2 times for October (22.6 h against 7.0 h). On the first run, ours was 16-28% lower.
- **DevStats' September figures haven't moved.** All six are identical to the first run's reading of 2026-10-06, while the September cohort in our data grew from 263 to 355 merged PRs. The PRs that merged late are the slow ones, so a figure that leaves them out would read faster. *That DevStats stopped counting September early is a likely explanation, not a measurement: we can't see which PRs its figure covers.* Reading the same series again later would show whether its months ever update.
- **The October cohort is still open.** PRs created in October that haven't merged yet are missing from both sources, so both October figures will rise as they merge.

### What this means for the README

- Still reasonable to say the main finding agrees with DevStats.
- No longer reasonable to say the medians are close. The README now gives the size of the gap and points here.
