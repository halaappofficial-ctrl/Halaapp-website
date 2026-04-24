// patch-motion-onerror.cjs
// Adds an onerror handler to the Motion One CDN <script> and the motion.js
// <script> tags on every HTML page that has them. Needed because the
// pre-stage CSS hides animated elements via `html.js-ready` and the ONLY
// path to "unhide them again if motion fails" is motion.js adding the
// motion-failed class. If motion.js itself 404s or throws at parse time,
// setupMotion never runs and elements stay hidden forever.
//
// The onerror on each <script> tag adds `motion-failed` synchronously so
// the CSS override fires even before motion.js has a chance to run.
//
// Idempotent. Safe to re-run. One-shot patcher; when retiring this, delete
// the file.

const fs = require('fs');
const path = require('path');

const ROOT = __dirname;

// Every HTML page that has either tag (in-scope + out-of-scope both have
// the Motion One CDN tag because of the original install).
const ALL_HTML = fs.readdirSync(ROOT).filter(f => f.endsWith('.html'));

// Regex for each tag. Matches only tags without onerror already present.
// Using two passes because the Motion One tag has no leading `onerror` in
// its canonical form and neither does motion.js.
const MOTION_ONE_MATCH = /<script defer src="https:\/\/cdn\.jsdelivr\.net\/npm\/motion@([^"]+)"><\/script>/;
const MOTION_ONE_REPLACE = '<script defer src="https://cdn.jsdelivr.net/npm/motion@$1" onerror="document.documentElement.classList.add(\'motion-failed\')"></script>';

const MOTION_JS_MATCH = /<script defer src="assets\/motion\.js"><\/script>/;
const MOTION_JS_REPLACE = '<script defer src="assets/motion.js" onerror="document.documentElement.classList.add(\'motion-failed\')"></script>';

const results = [];
for (const name of ALL_HTML) {
  const file = path.join(ROOT, name);
  const src = fs.readFileSync(file, 'utf8');
  let out = src;
  const hits = [];

  // Motion One tag
  if (MOTION_ONE_MATCH.test(out) && !/<script defer src="https:\/\/cdn\.jsdelivr\.net\/npm\/motion@[^"]+" onerror=/.test(out)) {
    out = out.replace(MOTION_ONE_MATCH, MOTION_ONE_REPLACE);
    hits.push('motion-one');
  }
  // motion.js tag
  if (MOTION_JS_MATCH.test(out) && !/<script defer src="assets\/motion\.js" onerror=/.test(out)) {
    out = out.replace(MOTION_JS_MATCH, MOTION_JS_REPLACE);
    hits.push('motion-js');
  }

  if (out !== src) {
    fs.writeFileSync(file, out, 'utf8');
    results.push({ name, status: 'OK: patched ' + hits.join(' + ') });
  } else {
    results.push({ name, status: 'SKIP (already patched or no tags)' });
  }
}

console.log('onerror patch:');
for (const r of results) {
  console.log('  ' + r.status.padEnd(40) + ' ' + r.name);
}
