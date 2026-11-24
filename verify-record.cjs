#!/usr/bin/env node
// The live record on the home page (2026-11-17).
// The section shows figures read live from the backend (GET /api/public/record, the same sources and filters as the
// investor deck's record) and nothing else: it stays hidden until every figure arrives as a whole number, no figure is
// written into the page, and recordView() alone decides what is shown. This drives recordView() itself.
// Run: node verify-record.cjs           (exit 0 = every case holds)
//      node verify-record.cjs --prove   (also breaks the page in memory; every break must turn the check red)
'use strict';
const fs = require('fs');
const path = require('path');

const PAGE = path.join(__dirname, 'index.html');
const HOOK = path.join(__dirname, '.githooks', 'pre-push');
const URL_ = 'https://hala-backend-production.up.railway.app/api/public/record';
const REAL = { completed: 21, disputes: 0, refunds: 0, rated: 14, rated_five: 14, paid_up: 15, paid_n: 16 };
const KEYS = Object.keys(REAL);

function judge(src, hook) {
  let pass = 0;
  const fails = [];
  const check = (name, ok, detail) => { if (ok) pass += 1; else fails.push(name + (detail ? ' - ' + detail : '')); };
  const same = (name, got, want) => check(name, JSON.stringify(got) === JSON.stringify(want), 'got ' + JSON.stringify(got));

  const sec = src.match(/<section class="rec" id="record"[^>]*>[\s\S]*?<\/section>/);
  check('the record section exists', !!sec);
  check('the section is hidden until the figures arrive', !!sec && /^<section[^>]*\shidden>/.test(sec[0]));
  const words = sec ? sec[0].replace(/<!--[\s\S]*?-->/g, '').replace(/<[^>]+>/g, ' ') : '';
  check('no figure is written into the section', sec && !/[0-9]/.test(words), (words.match(/[^ ]*[0-9][^ ]*/) || [''])[0]);
  check('the figures come from the live record', src.includes("fetch('" + URL_ + "')"));
  check('the caption is written as text', src.includes(".rec-cap').textContent = v.caption"));
  check('a hidden figure stays hidden', src.includes('.rec [hidden]{display:none}'));
  check('the gate runs before every push', /GATES="[^"]*\bverify-record\.cjs\b/.test(hook));

  const m = src.match(/function recordView\(r\) \{[\s\S]*?\r?\n {2}\}\r?\n/);
  check('index.html defines recordView()', !!m);
  let view = null;
  if (m) {
    try { view = new Function(m[0] + '\nreturn recordView;')(); } catch (e) { check('recordView() parses', false, e.message); }
  }
  if (!view) return { pass, fails };
  const run = (r) => { try { return view(r); } catch (e) { return 'THREW ' + e.message; } };
  const kinds = (v) => v.marks.reduce((a, k) => { a[k] = (a[k] || 0) + 1; return a; }, {});

  const real = run(REAL);
  check('the real record is shown', real && typeof real === 'object');
  if (real && typeof real === 'object') {
    same('caption, the real record', real.caption, '21 deliveries completed. All 14 ratings are 5 stars.');
    same('one square per delivery, a star in each 5-star rating', kinds(real), { five: 14, plain: 7 });
    same('squares in balanced rows', real.cols, 11);
    same('disputes', real.disputes, ['0', 'disputes raised']);
    same('refunds', real.refunds, ['0', 'refunds on a completed delivery']);
    same('thumbs up after paying', real.paid, ['15 of 16', 'customers gave paying a thumbs up']);
  }

  for (const k of KEYS) {
    for (const bad of [null, undefined, '', '21', -1, 2.5, NaN, Infinity]) {
      const r = Object.assign({}, REAL, { [k]: bad });
      same('hidden when ' + k + ' is ' + String(bad === '' ? "''" : bad) + ' (' + typeof bad + ')', run(r), null);
    }
  }
  for (const bad of [null, undefined, 'x', 7, [], {}]) same('hidden for an answer of ' + JSON.stringify(bad), run(bad), null);
  same('hidden with no completed delivery', run(Object.assign({}, REAL, { completed: 0, rated: 0, rated_five: 0 })), null);
  same('hidden when more ratings than deliveries', run(Object.assign({}, REAL, { rated: 22, rated_five: 14 })), null);
  same('hidden when more 5-star ratings than ratings', run(Object.assign({}, REAL, { rated_five: 15 })), null);
  same('hidden when more thumbs up than answers', run(Object.assign({}, REAL, { paid_up: 17 })), null);

  const lower = run(Object.assign({}, REAL, { rated_five: 13 }));
  same('a rating below 5 changes the line', lower && lower.caption, '21 deliveries completed. 13 of 14 ratings are 5 stars.');
  same('a rating below 5 changes the picture', lower && kinds(lower), { five: 13, rated: 1, plain: 7 });
  same('one dispute is shown as one', run(Object.assign({}, REAL, { disputes: 1 })).disputes, ['1', 'dispute raised']);
  same('one refund is shown as one', run(Object.assign({}, REAL, { refunds: 1 })).refunds, ['1', 'refund on a completed delivery']);
  same('no thumbs answers, no thumbs figure', run(Object.assign({}, REAL, { paid_up: 0, paid_n: 0 })).paid, null);
  same('one delivery, unrated', run({ completed: 1, disputes: 0, refunds: 0, rated: 0, rated_five: 0, paid_up: 0, paid_n: 0 }).caption, '1 delivery completed.');
  const big = run(Object.assign({}, REAL, { completed: 200 }));
  same('past 120 deliveries the caption carries it alone', big && [big.marks.length, big.caption], [0, '200 deliveries completed. All 14 ratings are 5 stars.']);
  same('at most 12 squares a row', run(Object.assign({}, REAL, { completed: 60 })).cols, 12);
  return { pass, fails };
}

const src = fs.readFileSync(PAGE, 'utf8');
const hook = fs.existsSync(HOOK) ? fs.readFileSync(HOOK, 'utf8') : '';
const res = judge(src, hook);
res.fails.forEach((f) => console.log('FAIL ' + f));
let ok = res.fails.length === 0 && res.pass > 0;

if (process.argv.includes('--prove')) {
  const breaks = [
    ['the section shown before the figures arrive', (s) => s.replace(/(<section class="rec" id="record"[^>]*)\shidden>/, '$1>')],
    ['a figure written into the heading', (s) => s.replace('Every delivery, on the record.', '21 deliveries, on the record.')],
    ['the figures read from somewhere else', (s) => s.replace(URL_, 'https://example.com/record')],
    ['any present value accepted as a figure', (s) => s.replace("if (typeof v !== 'number' || !isFinite(v) || Math.floor(v) !== v || v < 0) return null;", 'if (v === undefined) return null;')],
    ['figures that contradict each other shown', (s) => s.replace(' || r.rated_five > r.rated', '')],
    ['a lower rating shown as 5 stars', (s) => s.replace("k < r.rated_five ? 'five'", "k < r.rated ? 'five'")],
    ['a hidden figure shown', (s) => s.replace('.rec [hidden]{display:none}', '')],
    ['the caption written as markup', (s) => s.replace(".rec-cap').textContent = v.caption", ".rec-cap').innerHTML = v.caption")],
  ];
  let caught = 0;
  for (const [name, mutate] of breaks) {
    const broken = mutate(src);
    if (broken === src) { console.log('PROVE: break did not apply: ' + name); continue; }
    if (judge(broken, hook).fails.length > 0) caught += 1; else console.log('PROVE: break NOT caught: ' + name);
  }
  if (judge(src, hook.replace('verify-record.cjs', '')).fails.length > 0) caught += 1; else console.log('PROVE: break NOT caught: gate dropped from pre-push');
  console.log('  PROVE: ' + caught + '/' + (breaks.length + 1) + ' breaks turn the check red');
  if (caught !== breaks.length + 1) ok = false;
}

console.log('  RECORD: ' + (ok ? 'PASS' : 'FAIL') + ' - ' + res.pass + ' checks, ' + res.fails.length + ' failed');
process.exit(ok ? 0 : 1);
