// install-motion-js.cjs
// Inserts the <script defer src="assets/motion.js"> tag immediately after the
// Motion One CDN tag on the 7 in-scope pages. index.html already has the tag
// (added manually in Task 5); this run will SKIP it.
//
// Idempotent. Mirror of install-motion-one.cjs / install-motion-prestage.cjs.

const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
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

const TAG = '<!-- HALA motion wiring -->\r\n<script defer src="assets/motion.js"></script>\r\n';
const MARKER = 'assets/motion.js';
// Insert immediately after the Motion One script tag so load order is correct.
const ANCHOR = /(<script defer src="https:\/\/cdn\.jsdelivr\.net\/npm\/motion@[^"]+"><\/script>)(\r?\n)/;

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
    results.push({ name, status: 'MISS (no Motion One tag to anchor to)' });
    continue;
  }
  const out = src.replace(ANCHOR, m[1] + m[2] + TAG);
  fs.writeFileSync(file, out, 'utf8');
  results.push({ name, status: 'OK (installed)' });
}

console.log('motion.js install:');
for (const r of results) {
  console.log('  ' + r.status.padEnd(32) + ' ' + r.name);
}
