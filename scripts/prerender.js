// Writes the drawn report into site/index.html, so the page has its findings as
// plain HTML before any script runs. Link scanners, search engines and readers
// without JavaScript see the report; app.js redraws it on load with the
// interactive evidence panels. Also writes the README's findings from the same
// snapshot. Run after metrics.json or brief.json changes.
import { readFileSync, writeFileSync } from 'node:fs';
import { prerender } from '../src/prerender.js';
import { renderSite } from '../src/fake-dom.js';
import { readmeFindings, fillReadme } from '../src/readme.js';

const metrics = JSON.parse(readFileSync('site/data/metrics.json', 'utf8'));
const brief = (() => { try { return JSON.parse(readFileSync('site/data/brief.json', 'utf8')); } catch { return null; } })();

function write(path, before, after, what) {
  if (after !== before) writeFileSync(path, after);
  console.log(after === before ? `${path} already up to date` : `Wrote ${what} into ${path} (${Buffer.byteLength(after).toLocaleString('en-US')} bytes)`);
}

const page = 'site/index.html';
const html = readFileSync(page, 'utf8');
write(page, html, await prerender(html, { metrics, brief }), 'the report');

const { main } = await renderSite({ metrics, brief });
const headline = main.all('h1')[0].textContent.replace(/\s+/g, ' ').trim();
const readme = readFileSync('README.md', 'utf8');
write('README.md', readme, fillReadme(readme, readmeFindings(metrics, headline)), 'the findings');
