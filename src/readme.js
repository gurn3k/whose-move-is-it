// The README's findings, written from the snapshot so a refresh can't leave
// stale figures behind. scripts/prerender.js writes them between the markers;
// test/site.test.js fails if the README and the snapshot disagree.

import { compareCounts } from './compare.js';

const count = (n) => n.toLocaleString('en-US');
const pct = (part, whole) => Math.round((part / whole) * 100);
// The page's duration rule: hours under a day, one decimal under 10 days, whole days after.
const days = (d) => (d < 1 ? `${(d * 24).toFixed(1)} hours` : `${d < 10 ? d.toFixed(1) : count(Math.round(d))} days`);
const isoDay = (iso) => iso.slice(0, 10);
const ORDINAL = ['', 'largest', 'second-largest', 'third-largest', 'fourth-largest', 'fifth-largest'];
const nth = (n) => ORDINAL[n] ?? `${n}${[11, 12, 13].includes(n % 100) ? 'th' : ({ 1: 'st', 2: 'nd', 3: 'rd' })[n % 10] ?? 'th'}-largest`;
const QUEUE = {
  untouched: 'with no human response',
  reviewer: 'waiting for review',
  approver: 'waiting for approval',
  'merge-pending': 'waiting to merge',
  author: 'waiting on their author',
};

/** Markdown for the README's findings section. `headline` is the page's rendered h1. */
export function readmeFindings(m, headline) {
  const o = m.overall;
  const b = o.backlog;
  const r = o.merged.review;
  const out = [];

  out.push(`## Findings (snapshot of ${isoDay(m.fetchedAt)})`);
  out.push(`These come from ${count(o.merged.n)} PRs merged between ${isoDay(m.window.from)} and ${isoDay(m.window.to)} and all ${count(b.n)} PRs open on ${isoDay(m.fetchedAt)}.`);

  const weeks = Math.round(r.p90 / 7);
  out.push(`${headline}. The median merged PR took ${days(o.merged.cycle.median)} from ready to merged. ` +
    `Reaching lgtm took ${days(r.median)} at the median, and about ${days(r.p90)} or longer for the slowest 1 in 10` +
    `${weeks >= 2 ? ` (roughly ${weeks} weeks)` : ''}. ` +
    `Once both labels were set, the median PR merged in ${days(o.merged.mergeWait.median)}.`);

  const [q1, q2] = m.bottlenecks;
  if (q1 && q2) {
    const bothReview = q1.state === 'reviewer' && q2.state === 'reviewer';
    const queue = (q) => `sig/${q.sig} has ${count(q.count)} open PRs ${QUEUE[q.state]}, with a median wait of ${days(q.medianWaitDays)} (${count(q.prDays)} PR-days).`;
    out.push(`Two ${bothReview ? 'review queues' : 'queues'} hold the most waiting. ${queue(q1)} ${queue(q2)}`);
  }

  const untouched = m.bottlenecks.find((q) => q.state === 'untouched');
  out.push(`${count(b.untouched.count)} open PRs, ${pct(b.untouched.count, b.n)}% of the backlog, have had no human response. ` +
    `Their median wait is ${days(b.untouched.waitingDays.median)}` +
    (untouched ? `, and ${count(untouched.count)} of them belong to sig/${untouched.sig}, the ${nth(untouched.rank)} queue overall.` : '.'));

  // Same grouping as the page's second finding: no response, waiting for lgtm, waiting for approval.
  const reviewSide = b.untouched.count + b.reviewer.count + b.approver.count;
  out.push(`${count(reviewSide)} of ${count(b.n)} open PRs (${pct(reviewSide, b.n)}%) wait on a reviewer or approver. ` +
    `${count(b.author.count)} (${pct(b.author.count, b.n)}%) wait on their author for a rebase, requested changes or a process label, ` +
    `${compareCounts(b.author.count, b.reviewer.count).than} the ${count(b.reviewer.count)} that have had a response but no lgtm yet.`);

  return out.join('\n\n');
}

/** Replace the text between the README's findings markers. */
export function fillReadme(readme, findings) {
  const open = '<!-- generated:findings -->';
  const close = '<!-- /generated:findings -->';
  const start = readme.indexOf(open);
  const end = readme.indexOf(close);
  if (readme.indexOf(open, start + 1) >= 0 || readme.indexOf(close, end + 1) >= 0) throw new Error('README.md has the findings markers more than once');
  if (start < 0 || end < start) throw new Error(`README.md is missing the ${open} … ${close} markers`);
  // Keep the README's own line endings: a Windows checkout may have CRLF.
  const eol = readme.includes('\r\n') ? '\r\n' : '\n';
  const body = findings.replace(/\r?\n/g, eol);
  return `${readme.slice(0, start + open.length)}${eol}${body}${eol}${readme.slice(end)}`;
}
