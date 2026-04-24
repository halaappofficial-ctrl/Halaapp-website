// Installs Motion One across every top-level HTML page in this site.
// Inserts a pinned, defer-loaded Motion One script tag immediately before </head>.
// Idempotent: re-runs are safe. Writes a .bak file per page on first install.

const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const VERSION = '11.15.0';
const SCRIPT_TAG =
  '<!-- Motion One (animation library) - pinned -->\r\n' +
  '<script defer src="https://cdn.jsdelivr.net/npm/motion@' + VERSION + '/dist/motion.min.js"></script>\r\n';

const MARKER = 'cdn.jsdelivr.net/npm/motion@';

const files = fs
  .readdirSync(ROOT)
  .filter((f) => f.endsWith('.html'))
  .map((f) => path.join(ROOT, f));

const results = [];

for (const file of files) {
  const src = fs.readFileSync(file, 'utf8');

  if (src.includes(MARKER)) {
    results.push({ file, status: 'SKIP (already installed)' });
    continue;
  }

  const re = /(\r?\n)<\/head>/;
  const m = src.match(re);
  if (!m) {
    results.push({ file, status: 'MISS (no </head> found)' });
    continue;
  }

  const eol = m[1];
  const out = src.replace(re, eol + SCRIPT_TAG + '</head>');

  if (!fs.existsSync(file + '.bak')) {
    fs.writeFileSync(file + '.bak', src, 'utf8');
  }
  fs.writeFileSync(file, out, 'utf8');
  results.push({ file, status: 'OK (installed)' });
}

console.log('Motion One v' + VERSION + ' install:');
for (const r of results) {
  console.log('  ' + r.status.padEnd(28) + ' ' + path.basename(r.file));
}
