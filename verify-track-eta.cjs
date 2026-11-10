#!/usr/bin/env node
// The trip-link ETA counts down between server refreshes, the way the apps do.
// The server refreshes a live ETA at most once a minute and says how old the figure is (eta.age_s),
// so the page anchors the figure to when the server computed it and subtracts whole minutes since.
// Run: node verify-track-eta.cjs   (exit 0 = every case holds)
'use strict';
const fs = require('fs');
const path = require('path');

const src = fs.readFileSync(path.join(__dirname, 'track.html'), 'utf8');
let pass = 0, fail = 0;
function check(name, ok, detail) {
  if (ok) { pass++; } else { fail++; console.log('FAIL ' + name + (detail ? ' - ' + detail : '')); }
}

const m = src.match(/function etaShown\([\s\S]*?\r?\n  \}\r?\n/);
check('track.html defines etaShown()', !!m);
let etaShown = null;
if (m) {
  try { etaShown = new Function(m[0] + '\nreturn etaShown;')(); } catch (e) { check('etaShown() parses', false, e.message); }
}

if (etaShown) {
  const now = Date.UTC(2026, 10, 10, 12, 0, 0);
  const cases = [
    ['fresh figure shows as sent', 12, now, 12],
    ['90 s old drops one minute', 12, now - 90e3, 11],
    ['59 s old drops nothing', 12, now - 59e3, 12],
    ['11.5 min old reaches the floor of 1', 12, now - 11.5 * 60e3, 1],
    ['older than the figure never goes below 1', 12, now - 20 * 60e3, 1],
    ['a zero from the server reads 1, not nothing', 0, now, 1],
    ['fractions round to the nearest minute', 4.6, now, 5],
    ['a missing figure shows nothing', null, now, null],
    ['a non-number shows nothing', 'soon', now, null],
    ['a negative figure shows nothing', -3, now, null],
  ];
  for (const [name, minutes, anchor, want] of cases) {
    const got = etaShown(minutes, anchor, now);
    check(name, got === want, 'etaShown(' + JSON.stringify(minutes) + ') = ' + got + ', want ' + want);
  }
}

check('the anchor reads eta.age_s', /age_s/.test(src));
check('a missing age_s reads 0', /Number\.isFinite\([^)]*age_s[^)]*\)\s*\?/.test(src));
check('the countdown ticks every 30 s', /setInterval\(\s*tickEta\s*,\s*30000\s*\)/.test(src));
check('the tick stops with the poll when the tab is hidden', /function stop\(\)[^\n]*tickTimer/.test(src));
check('no "About N min" built straight from eta.minutes any more', !/'About ' \+ v\.eta\.minutes/.test(src));

const total = pass + fail;
console.log((fail ? 'TRACK ETA: FAIL ' : 'TRACK ETA: PASS ') + pass + '/' + total);
process.exit(fail || total === 0 ? 1 : 0);
