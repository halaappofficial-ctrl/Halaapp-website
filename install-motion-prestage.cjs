// install-motion-prestage.cjs
// Inserts the synchronous pre-stage block (inline <script> + <style>) into
// every in-scope HTML page. This block runs BEFORE first paint and prevents
// the flash-of-visible-then-invisible that would otherwise occur when
// motion.js applies opacity:0 after DOMContentLoaded (per code review I-2).
//
// Idempotent — safe to re-run. Mirrors the install-motion-one.cjs pattern.
// Inserts immediately BEFORE the Motion One CDN tag so both blocks end up
// together in the <head>.

const fs = require('fs');
const path = require('path');

const ROOT = __dirname;

// Only the 7 pages that actually animate (spec §6). Legal + about + faq
// don't need pre-staging because no animations run on those pages.
const IN_SCOPE = [
  'index.html',
  'bakkie-hire-durban.html',
  'student-moving-durban.html',
  'business-transport-durban.html',
  'furniture-removal-durban.html',
  'panel-van-hire-durban.html',
  'truck-hire-durban.html',
  'same-day-delivery-durban.html',
];

// The block inserted verbatim. CRLF line endings to match the repo.
// Keeps the CSS selectors matched to exactly what motion.js animates:
//   - .stats-bar .stat-item   (Task 3)
//   - .how .step              (Task 4)
//   - .reveal                 (Task 4.5, anywhere in body)
//   - .hero [data-motion-hero-el]  (Task 11 + 12)
const BLOCK =
  '<!-- Motion pre-stage (spec §9.2) — prevents FOUC on above-the-fold animated elements. -->\r\n' +
  '<script>document.documentElement.classList.add(\'js-ready\')</script>\r\n' +
  '<style>\r\n' +
  'html.js-ready .stats-bar .stat-item,\r\n' +
  'html.js-ready .how .step,\r\n' +
  'html.js-ready .reveal,\r\n' +
  'html.js-ready .hero [data-motion-hero-el]{opacity:0;transform:translateY(16px);transition:none}\r\n' +
  '@media (max-width:768px){\r\n' +
  'html.js-ready .stats-bar .stat-item,\r\n' +
  'html.js-ready .how .step,\r\n' +
  'html.js-ready .reveal,\r\n' +
  'html.js-ready .hero [data-motion-hero-el]{transform:translateY(10px)}\r\n' +
  '}\r\n' +
  '</style>\r\n';

const MARKER = 'Motion pre-stage';
// Insert immediately before the Motion One comment marker so the pre-stage
// block ends up above the Motion One + motion.js script tags.
const ANCHOR = /(<!-- Motion One \(animation library\) - pinned -->)/;

const results = [];
for (const name of IN_SCOPE) {
  const file = path.join(ROOT, name);
  if (!fs.existsSync(file)) {
    results.push({ name, status: 'MISS (file not found)' });
    continue;
  }
  const src = fs.readFileSync(file, 'utf8');
  if (src.includes(MARKER)) {
    results.push({ name, status: 'SKIP (already installed)' });
    continue;
  }
  const m = src.match(ANCHOR);
  if (!m) {
    results.push({ name, status: 'MISS (no Motion One anchor)' });
    continue;
  }
  const out = src.replace(ANCHOR, BLOCK + m[1]);
  fs.writeFileSync(file, out, 'utf8');
  results.push({ name, status: 'OK (installed)' });
}

console.log('Motion pre-stage install:');
for (const r of results) {
  console.log('  ' + r.status.padEnd(32) + ' ' + r.name);
}
