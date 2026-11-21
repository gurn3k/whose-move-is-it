# Findings: live test of https://delivery-bottleneck-analyzer-site.vercel.app

Tested 2026-10-06, the day it launched, against what PRODUCT.md and the direction contract promise: a hiring manager gets the finding in 30 seconds, every number opens its PRs, it works on a phone, and nothing on the page blames people.

How it was tested: `curl` for files, headers and weight; headless Chrome (Windows) for rendering, at 1440px in light and dark, at 2x zoom, and with JavaScript off; a scripted test page (served locally without the CSP, which otherwise blocks framing) for keyboard behavior, phone widths and scroll position. No paid calls were made.

## Findings

All five were fixed and redeployed the same day (commit 8a66983) and re-checked on the live site.

### 1. A shared link showed no preview card

Steps: fetch the page and look for Open Graph or Twitter tags.
Seen: none. On LinkedIn, the most likely place a hiring manager meets this link, the post would show a bare URL or a plain title.
Fix: Open Graph and Twitter tags, plus a 1200×630 share image (`site/share.png`) rendered from the page's own font and the real snapshot numbers. Every number on the image was checked against `metrics.json`; the merge bar is drawn at a 1% minimum width so it stays visible (its true width would be 0.14% of the scale), and its value is printed beside it.

### 2. Links to a section landed at the top of the page

Steps: open `…/#teams` (or `#queues`, `#method`).
Seen: the page opened at the top. The report sections are drawn by script after load, so the browser's jump to the anchor found nothing.
Fix: after the report renders, scroll to the anchor. Measured afterwards: the Teams section lands 72px from the top, just under the sticky masthead.

### 3. No favicon

Steps: request `/favicon.ico`.
Seen: 404, and a blank tab icon.
Fix: an SVG mark in the report blue (`site/favicon.svg`).

### 4. With JavaScript off, the page said "Loading the snapshot…" forever

Steps: read `index.html` (headless Chrome won't dump a page with scripts disabled, so this was confirmed from the source, not observed).
Seen: the static page holds only the masthead and the loading line.
Fix: a `<noscript>` message that says why the report can't draw and links to the repository; the loading line is hidden when scripting is off.

### 5. In-sentence numbers had no screen-reader context

Steps: read the key-findings markup.
Seen: the clickable numbers in the key findings ("4.1 days", "63%", "272") would be announced as just the number and "button". Figure rows and table numbers already had labels.
Fix: each now says what it opens, for example "272: show the open PRs with no human response".

## Not tested

- Firefox and Safari, and real phones. Only Chromium was available; phone widths were simulated at 390, 360 and 320px.
- A real screen reader (NVDA or VoiceOver). Labels and focus order were checked in the markup and by script, not by listening.
- The page on a slow connection. It weighs about 145 KB compressed and every file returned in under a quarter of a second from here.

## What held up

- **Only the page is public.** With Vercel's root set to `site/`, repository files (`package.json`, `PRD.md`, `.env`, `vercel.json`) all return 404.
- **Security headers are served as configured:** the strict CSP (`default-src 'none'`, scripts, styles and fonts from the site only, no framing), `nosniff`, a referrer policy and a permissions policy, plus HSTS added by Vercel.
- **Weight:** about 145 KB compressed for everything, 104 KB of it the snapshot data.
- **The page as built:** the headline, the plain-English opening, four report sections, 170 numbers that open their PRs and 75 direct PR links, and the reviewed brief, with the "Source" link pointing at the real repository. Every repository link on the page returns 200.
- **Zoom to 200%:** the layout reflows to one column with nothing clipped.
- **Evidence panels** (scripted locally before launch): open with focus on their heading, "Show all" expands, Escape closes and returns focus, a second click toggles closed, and every external link opens with `rel=noopener`.
- **No blame:** the page names teams and stages, never people, and says why.

---

# Second round: snapshot refresh, tested locally 2026-11-21

Tested before deploy, on the 2026-11-21 snapshot, against the same promises plus one more: the page says how old its snapshot is (ADR 0011). The live site still serves the 2026-10-04 snapshot, so this round runs again on https://whosemoveisit.gurn3k.com once it's deployed.

How it was tested: the page's script run against damaged data files through the same small DOM the tests use; Chrome over its DevTools protocol, with the site's real CSP, at 320, 360, 390, 599, 600, 768 and 1024px, each again with a wider fallback font, in light and dark; hostile URL fragments and query strings; raw HTTP requests against the local preview server; and an independent review of the diff by a reviewer who didn't write it. No paid calls were made for testing.

## Findings

All fixed, each with a test shown to fail without its fix.

### 1. A damaged brief file stopped the whole report from drawing

Steps: serve a `brief.json` whose bullet has no `prs` list.
Promise broken: "If no brief passes, the snapshot ships without one" (README); the brief must never block the metrics.
What happened: drawing the brief threw, so the report stopped at "Loading". (The prerendered copy would still have shown, and `npm run prerender` fails on such a file, so a visitor was unlikely to see it.)
Status: Fixed. The page checks the brief's whole shape first and shows "No brief for this snapshot" for anything it can't draw in full.

### 2. A refreshed snapshot would have shown last month's brief

Steps: refresh `metrics.json` without rewriting `brief.json`.
Promise broken: every brief claim cites PRs from its input (ADR 0003).
What happened: the page drew any brief beside any snapshot. October's brief, citing October's PRs, would have sat under November's numbers.
Status: Fixed. A brief shows only beside the snapshot it was written for, and a test checks the committed pair.

### 3. The README and the page disagreed about whose move dominates

Steps: read the README's last finding, then the page's second finding.
Promise broken: the README reports only measured results (PRD).
What happened: the README said waiting on the author (383) outnumbers waiting on a reviewer (303). The page counts every reviewer-side state and says 641 open PRs (47%) wait on a reviewer or approver. Both sets of numbers were right; the README's comparison wasn't.
Status: Fixed. The README groups the backlog the way the page does, and a test ties the two sentences.

### 4. The model was told two counts were "close" whatever they were

Steps: read the brief's input facts for the 2026-11-21 snapshot.
Promise broken: code computes facts, the model only words them (ADR 0008).
What happened: the author-versus-reviewer fact always said "close to". It was true in October (337 against 368), false in November (383 against 303), and the first November brief repeated it.
Status: Fixed. The comparison is computed, and the brief was written again from the corrected facts.

### 5. The age could say "today" beside yesterday's date

Steps: open the page just after midnight UTC on the day after the fetch.
What happened: age counted 24-hour periods from the fetch time, while the date beside it is a UTC calendar date.
Status: Fixed; age counts UTC calendar days.

### 6. A snapshot without a date showed "Snapshot of Invalid Date"

Status: Fixed. The page shows its load error instead of undated numbers.

### 7. The local preview server answered 404 for `/` on Windows

Status: Fixed. It normalised URL paths with Windows' rules. The fix converts a decoded backslash to `/` before normalising; traversal attempts (`/../.env`, `/..%5C..%5C.env`, `/%2e%2e%5c.env`) all return 404. Production is Vercel and wasn't affected.

## Not tested

- The deployed site. This round repeats on the live domain after deploy.
- Firefox, Safari and real phones; a real screen reader.
- The brief's wording is checked by code; whether each bullet is a fair reading is the person's review, not done yet at the time of writing.

## What held up

- **No horizontal scroll** at any tested width, with the self-hosted font or a wider fallback, and the stale note fits at 320px.
- **Hostile URLs are inert:** markup and script in the fragment or query string drew nothing and opened no dialog; the CSP logged no violations from the page itself.
- **Text stays text:** a brief bullet containing an `<img onerror>` tag is drawn as literal text.
- **Every generated figure** in the README and on the page matches `metrics.json` (checked independently).

## Live recheck, 2026-11-21

Rerun on https://whosemoveisit.gurn3k.com after the deploy: the page serves the 2026-11-21 snapshot, with the same CSP, `nosniff`, referrer and permissions policies, and HSTS. Repository files (`package.json`, `README.md`, `docs/`, `src/`, `test/`, `scripts/`, `eval/`, `.env`, `.git/config`, `vercel.json`) all return 404. No horizontal scroll at 320 to 1024px, with the page's font or a wider fallback. Markup and script in the fragment or query string drew nothing and opened no dialog, and the console showed no errors. No new findings.
