import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { renderSite } from '../src/fake-dom.js';
import { prerender } from '../src/prerender.js';
import { readmeFindings, fillReadme } from '../src/readme.js';

// Expected values are computed from the committed snapshot, the same files the
// live page reads, so a refreshed snapshot keeps these tests meaningful.
const metrics = JSON.parse(readFileSync('site/data/metrics.json', 'utf8'));
const brief = JSON.parse(readFileSync('site/data/brief.json', 'utf8'));
const html = readFileSync('site/index.html', 'utf8');
const o = metrics.overall;

const count = (n) => n.toLocaleString('en-US');
// The page's duration rule: hours under a day, one decimal under 10 days, whole days after.
const dur = (d, h = ' h', dd = ' d') => (d < 1 ? `${(d * 24).toFixed(1)}${h}` : `${d < 10 ? d.toFixed(1) : count(Math.round(d))}${dd}`);
const days = (d) => dur(d, ' hours', ' days');
const meta = (attr, key) => html.match(new RegExp(`<meta ${attr}="${key}" content="([^"]*)"`))[1];
const textOf = (el) => el.textContent.replace(/\s+/g, ' ').trim();

const site = await renderSite({ metrics, brief });
const page = textOf(site.main);
const headline = textOf(site.main.all('h1')[0]);
const reviewDays = Math.round(o.merged.review.median);
const mergeHours = Math.ceil(o.merged.mergeWait.median * 24);

test('the headline states the snapshot’s review and merge medians', () => {
  assert.equal(headline, `A Kubernetes pull request waits ${reviewDays} days for review, then merges in under ${mergeHours} hours`);
});

test('the hand-written share card and meta tags match the rendered headline', () => {
  // index.html is static, so a refreshed snapshot can leave it stale. Update the
  // meta tags (and share.png) whenever this fails.
  assert.equal(meta('property', 'og:title'), headline);
  assert.ok(meta('property', 'og:image:alt').includes(headline), 'og:image:alt');
  assert.ok(meta('name', 'description').includes(`${reviewDays} days for review, then merges in under ${mergeHours} hours`), 'description');
  const tail = textOf(site.main.all('p', 'summary')[0]);
  assert.ok(tail.length > 0 && meta('property', 'og:description').startsWith(tail), 'og:description');
});

test('key findings and byline show the snapshot’s numbers', () => {
  const findings = textOf(site.main.all('ol', 'findings')[0]);
  assert.ok(findings.includes(`a median ${days(o.merged.review.median)}`));
  assert.ok(findings.includes(`about ${days(o.merged.review.p90)} or longer`));
  assert.ok(findings.includes(`merging took a median ${days(o.merged.mergeWait.median)}`));
  assert.ok(findings.includes(`${count(o.backlog.untouched.count)} open PRs, ${Math.round((o.backlog.untouched.count / o.backlog.n) * 100)}% of the backlog`));
  assert.ok(page.includes(`${count(o.merged.n)} merged and ${count(o.backlog.n)} open pull requests in ${metrics.repo}`));
});

test('figure 1 has one row per stage with its median and p90', () => {
  const rows = site.main.byId('figure-1').all('button', 'row').map(textOf);
  assert.equal(rows.length, 4);
  for (const [i, key] of ['firstResponse', 'review', 'approval', 'mergeWait'].entries()) {
    const { median, p90 } = o.merged[key];
    assert.ok(rows[i].includes(`median ${dur(median)} · p90 ${dur(p90)}`), rows[i]);
  }
});

test('figure 1 splits merged PRs into stages that add up to 100%', () => {
  const segs = site.main.byId('figure-1').all('button', 'seg');
  assert.equal(segs.length, 4);
  const shares = segs.map((b) => Number(textOf(b).replace('%', '')));
  assert.ok(Math.abs(shares.reduce((a, b) => a + b, 0) - 100) <= 2, shares.join(' + '));
});

test('figure 2 draws one square per open PR, grouped by whose move it is', () => {
  const fig = site.main.byId('figure-2');
  assert.equal(fig.all('span', 'dot').length, o.backlog.n);
  for (const band of fig.all('button', 'band')) {
    const n = Number(band.getAttribute('aria-label').match(/^([\d,]+) PRs/)[1].replace(/,/g, ''));
    assert.equal(band.all('span', 'dot').length, n, band.getAttribute('aria-label'));
  }
});

test('figure 3 draws the same queues as table 1, in rank order', () => {
  const bars = site.main.byId('figure-3').all('button', 'qbar').map((b) => b.getAttribute('aria-label'));
  const top = metrics.bottlenecks.slice(0, 10);
  assert.equal(bars.length, top.length);
  for (const [i, q] of top.entries()) assert.ok(bars[i].startsWith(`${q.rank}. sig/${q.sig}`) && bars[i].includes(`${count(q.prDays)} PR-days`), bars[i]);
});

test('each section heading carries its finding, in the order of the key findings', () => {
  const heads = site.main.all('strong', 'finding-head').map((e) => textOf(e).replace(/\.$/, ''));
  const h2 = ['backlog-h', 'queues-h', 'teams-h'].map((id) => textOf(site.main.byId(id)));
  assert.equal(heads.length, 4);
  for (const [i, h] of h2.entries()) assert.equal(h, `${i + 2}. ${heads[i + 1]}`);
});

test('table 1 lists the top 10 queues in rank order', () => {
  const rows = site.main.byId('queues').all('table', 'ranked')[0].all('tbody')[0].all('tr');
  const top = metrics.bottlenecks.slice(0, 10);
  assert.equal(rows.length, top.length);
  rows.forEach((tr, i) => {
    const t = textOf(tr);
    assert.ok(t.startsWith(`${top[i].rank}sig/${top[i].sig}`), t);
    assert.ok(t.includes(count(top[i].prDays)), t);
    for (const n of top[i].examples) assert.ok(t.includes(`#${n}`), `#${n}`);
  });
});

test('the brief shows every bullet with its cited PRs', () => {
  const items = site.main.byId('brief').all('li');
  assert.equal(items.length, brief.bullets.length);
  brief.bullets.forEach((b, i) => {
    assert.ok(textOf(items[i]).startsWith(b.text));
    const links = items[i].all('a').map((a) => a.getAttribute('href'));
    assert.deepEqual(links, b.prs.map((n) => `https://github.com/kubernetes/kubernetes/pull/${n}`));
  });
});

test('the teams table has a row for every group, 10 shown at first', () => {
  const full = site.main.byId('teams').all('details', 'how')[0];
  const rows = full.all('tbody')[0].all('tr').filter((tr) => !tr.className.includes('group-sep'));
  assert.equal(rows.length, Object.keys(metrics.groups).length);
  const named = rows.filter((tr) => /^sig\//.test(textOf(tr.all('th')[0])));
  assert.equal(named.filter((tr) => !tr.hidden).length, Math.min(10, named.length));
});

test('figure 4 has a row for every team with enough open PRs', () => {
  const teams = Object.keys(metrics.groups).filter((g) => g !== 'cross-cutting' && g !== 'no-sig' && metrics.groups[g].backlog.n >= metrics.minSample);
  assert.equal(site.main.byId('figure-4').all('tbody')[0].all('tr').length, teams.length);
});

test('every count that opens evidence opens exactly that many PRs', () => {
  const buttons = site.main.all('button', 'num').filter((b) => /^[\d,]+$/.test(textOf(b)));
  assert.ok(buttons.length > 50, `only ${buttons.length} count buttons`);
  for (const b of buttons) {
    b.click();
    const panel = site.main.all('section', 'evidence')[0];
    assert.ok(panel, `no panel for ${b.getAttribute('aria-label')}`);
    assert.ok(textOf(panel.all('p', 'note')[0]).startsWith(`${textOf(b)} PRs.`), b.getAttribute('aria-label'));
    b.click();
    assert.equal(site.main.all('section', 'evidence').length, 0);
  }
});

test('no value renders as undefined, NaN or null', () => {
  assert.doesNotMatch(page, /undefined|NaN|null|\[object/);
  assert.doesNotMatch(textOf(site.colophon), /undefined|NaN|null/);
});

test('a missing value shows —, never 0, and the headline falls back', async () => {
  const m = structuredClone(metrics);
  m.overall.merged.review.median = null;
  m.overall.merged.review.p90 = null;
  const { main } = await renderSite({ metrics: m, brief });
  assert.equal(textOf(main.all('h1')[0]), 'Where Kubernetes pull requests wait');
  const reviewRow = textOf(main.byId('figure-1').all('button', 'row')[1]);
  assert.ok(reviewRow.includes('median — · p90 —'), reviewRow);
  assert.equal(textOf(main.all('p', 'summary')[0]), '');
});

test('the report still renders without a brief', async () => {
  const { main } = await renderSite({ metrics, brief: null });
  assert.ok(textOf(main.byId('brief')).includes('No brief for this snapshot.'));
  assert.equal(textOf(main.all('h1')[0]), headline);
});

test('a failed data load explains how to serve the site', async () => {
  const { main } = await renderSite({ metrics: null, brief: null });
  assert.match(textOf(main), /snapshot data couldn’t load.*npm run serve/);
});

test('index.html carries the report as static HTML, matching this snapshot', async () => {
  // Scanners and no-JS readers see this copy. Run npm run prerender when this fails.
  assert.equal(html, await prerender(html, { metrics, brief }), 'index.html is stale: run npm run prerender');
  assert.ok(html.includes(`<h1>${headline}</h1>`));
  assert.doesNotMatch(html, /Loading the snapshot/);
  assert.doesNotMatch(html, / style="/, 'inline styles would break the CSP');
});

// ---- snapshot age (ADR 0011) ----
const fetched = Date.parse(metrics.fetchedAt);
const DAY = 86_400_000;
const bylineAt = async (now) => {
  const { main } = await renderSite({ metrics, brief, now });
  return { byline: textOf(main.all('p', 'byline')[0]), stale: main.all('p', 'stale-note').map(textOf) };
};

test('the prerendered copy states the snapshot date with no age, since it has no clock', async () => {
  const { byline, stale } = await bylineAt(null);
  assert.doesNotMatch(byline, /ago|today/);
  assert.deepEqual(stale, []);
  assert.doesNotMatch(html, /days ago|stale-note/);
});

test('a fresh snapshot shows its age and no warning', async () => {
  assert.match((await bylineAt(fetched + 2 * 60_000)).byline, /\(today\)/);
  assert.match((await bylineAt(fetched + DAY + 1)).byline, /\(1 day ago\)/);
  const at29 = await bylineAt(fetched + 29 * DAY + 1);
  assert.match(at29.byline, /\(29 days ago\)/);
  assert.deepEqual(at29.stale, []);
});

test('a snapshot 30 or more days old says so above the findings', async () => {
  const at30 = await bylineAt(fetched + 30 * DAY + 1);
  assert.match(at30.byline, /\(30 days ago\)/);
  assert.equal(at30.stale.length, 1);
  assert.match(at30.stale[0], /^This snapshot is 30 days old\. Open PRs may have moved since/);
  assert.match((await bylineAt(fetched + 400 * DAY)).stale[0], /400 days old/);
});

test('a clock behind the snapshot shows no age rather than a negative one', async () => {
  const { byline, stale } = await bylineAt(fetched - 5 * DAY);
  assert.doesNotMatch(byline, /ago|today|-/);
  assert.deepEqual(stale, []);
});

// ---- README figures come from the snapshot ----
test('the README findings match this snapshot', async () => {
  const readme = readFileSync('README.md', 'utf8');
  // Run npm run prerender when this fails.
  assert.equal(readme, fillReadme(readme, readmeFindings(metrics, headline)), 'README.md findings are stale: run npm run prerender');
  const block = readme.slice(readme.indexOf('<!-- generated:findings -->'), readme.indexOf('<!-- /generated:findings -->'));
  for (const figure of [count(o.merged.n), count(o.backlog.n), count(o.backlog.untouched.count), count(metrics.bottlenecks[0].prDays), days(o.merged.review.median)]) {
    assert.ok(block.includes(figure), `README findings should state ${figure}`);
  }
  assert.ok(block.includes(`snapshot of ${metrics.fetchedAt.slice(0, 10)}`));
});

test('no snapshot figure is typed by hand outside the generated README section', () => {
  const readme = readFileSync('README.md', 'utf8');
  const outside = readme.slice(0, readme.indexOf('<!-- generated:findings -->')) + readme.slice(readme.indexOf('<!-- /generated:findings -->'));
  for (const figure of [count(o.merged.n), count(o.backlog.n), days(o.merged.review.median), days(o.merged.cycle.median), count(metrics.bottlenecks[0].prDays)]) {
    assert.ok(!outside.includes(figure), `${figure} appears outside the generated findings; move it inside or drop it`);
  }
});

// ---- the brief belongs to its snapshot ----
test('the committed brief was written for the committed snapshot', () => {
  // Run npm run brief (or ship without one) after refreshing the snapshot.
  assert.equal(brief.metricsFetchedAt, metrics.fetchedAt, 'brief.json was written for another snapshot');
});

test('a brief written for another snapshot is not shown', async () => {
  const old = { ...brief, metricsFetchedAt: '2020-01-01T00:00:00.000Z' };
  const { main } = await renderSite({ metrics, brief: old });
  const section = textOf(main.byId('brief'));
  assert.match(section, /written for a different snapshot, so it isn’t shown/);
  for (const b of brief.bullets) assert.ok(!section.includes(b.text.slice(0, 40)), 'an old bullet is on the page');
  assert.equal(textOf(main.all('h1')[0]), headline, 'the rest of the report still draws');
});

test('the README findings keep the README’s own line endings', () => {
  const lf = 'intro\n<!-- generated:findings -->\nold\n<!-- /generated:findings -->\nend\n';
  const crlf = lf.replace(/\n/g, '\r\n');
  const findings = 'line one\n\nline two';
  assert.ok(!/\r/.test(fillReadme(lf, findings)));
  const out = fillReadme(crlf, findings);
  assert.ok(!/[^\r]\n/.test(out), 'every newline in a CRLF README stays CRLF');
  assert.equal(fillReadme(out, findings), out, 'filling twice changes nothing');
});

// ---- damaged data files fail closed ----
test('a damaged brief shows no brief, and the rest of the report still draws', async () => {
  const damaged = [
    { ...brief, bullets: 'oops' },
    { ...brief, bullets: [{ text: 'a bullet with no citations' }] },
    { ...brief, bullets: [{ text: 'bad citation', prs: ['#1'] }] },
    { ...brief, bullets: [{ text: '', prs: [1] }] },
    { ...brief, generatedAt: 'not a date' },
    { ...brief, review: { reviewedAt: '2026-11-21', edits: 'x' } },
    [1, 2],
    'hello',
  ];
  for (const b of damaged) {
    const { main } = await renderSite({ metrics, brief: b });
    assert.match(textOf(main.byId('brief')), /No brief for this snapshot\./, JSON.stringify(b).slice(0, 80));
    assert.equal(textOf(main.all('h1')[0]), headline);
  }
});

test('brief text is drawn as text, never as markup', async () => {
  const b = { ...brief, bullets: [{ text: '<img src=x onerror=alert(1)>', prs: [1] }] };
  const { main } = await renderSite({ metrics, brief: b });
  assert.ok(!main.innerHTML.includes('<img src=x'));
  assert.ok(textOf(main.byId('brief')).includes('<img src=x onerror=alert(1)>'));
});

test('a snapshot without a valid date draws no numbers', async () => {
  for (const fetchedAt of ['not a date', undefined, 12]) {
    const { main } = await renderSite({ metrics: { ...metrics, fetchedAt }, brief });
    assert.equal(main.all('p', 'load-error').length, 1, String(fetchedAt));
    assert.equal(main.all('h1').length, 0);
  }
});

test('the age counts calendar days in UTC, like the date beside it', async () => {
  const d = new Date(metrics.fetchedAt);
  const utc = (dayOffset, h, min = 0) => Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + dayOffset, h, min);
  assert.match((await bylineAt(utc(0, 23, 59))).byline, /\(today\)/);
  assert.match((await bylineAt(utc(1, 0, 1))).byline, /\(1 day ago\)/, 'just after midnight UTC the next day');
  assert.match((await bylineAt(utc(30, 0, 1))).byline, /\(30 days ago\)/);
  assert.equal((await bylineAt(utc(30, 0, 1))).stale.length, 1);
});

test('the README compares the author queue with the reviewer side the way the page does', async () => {
  const readme = readFileSync('README.md', 'utf8');
  const b = o.backlog;
  const reviewSide = b.untouched.count + b.reviewer.count + b.approver.count;
  const pctOf = (n) => Math.round((n / b.n) * 100);
  const sentence = `${count(reviewSide)} of ${count(b.n)} open PRs (${pctOf(reviewSide)}%) wait on a reviewer or approver`;
  assert.ok(page.includes(sentence), 'the page states it');
  assert.ok(readme.includes(sentence), 'the README states it the same way');
  assert.ok(!/author is more common than waiting on a reviewer/.test(readme));
});

test('the README markers must appear exactly once', () => {
  const twice = '<!-- generated:findings -->\n<!-- /generated:findings -->\n<!-- generated:findings -->\n<!-- /generated:findings -->\n';
  assert.throws(() => fillReadme(twice, 'x'), /more than once/);
  assert.throws(() => fillReadme('no markers', 'x'), /missing/);
});
