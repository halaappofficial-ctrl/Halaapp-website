#!/usr/bin/env node
// -- verify-dated-notices (2026-11-23) --------------------------------------------------------------------------------
//
//   node verify-dated-notices.cjs                    # exit 0 = no served page announces, as still to come, a change whose
//                                                    #          date has already passed
//   node verify-dated-notices.cjs --prove            # also runs the golden pairs: every bad line red, every good line green
//   node verify-dated-notices.cjs --today=2026-11-13 # judge as of another day (Johannesburg date)
//
// Why it exists: the customer service fee began on 14 November 2026. On 23 November the home page still opened with
// "Notice of a change to our Terms: from 14 November 2026, customer prices include a HALA MOVE service fee", under an
// HTML comment that read "Remove after 14 November 2026"; six landing pages, the Terms and llms.txt still said "from 14
// November 2026" too. The expiry was written down and nothing ever read it. This gate reads it: once the date passes,
// the push is refused until the words say what is true now.
//
// What fails, once its date is on or before today:
//   - an HTML comment saying to remove, change or update something after, on or by a date;
//   - announcement wording tied to a date: "from <date>", "starting <date>", "as of <date>", "with effect from <date>",
//     "effective <date>", and a "Notice of a change" line carrying a date.
// What passes: dates still ahead; "since <date>", "before <date>", "posted <date>", "last updated" and other past-tense
// records. A date with no year is not read.
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const HOOK = path.join(ROOT, '.githooks', 'pre-push');
const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
const MON = '(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|June?|July?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)';
const DATE = '(\\d{1,2})(?:st|nd|rd|th)?\\s+' + MON + ',?\\s+(20\\d\\d)';
const ANNOUNCE = new RegExp('\\b(?:with effect from|from|starting(?: on)?|as of|effective(?: from| on)?)\\s+' + DATE, 'gi');
const COMMENT_EXPIRY = new RegExp('(?:remove|delete|change|update|take (?:it )?down)[^\\n]{0,80}?\\b(?:after|on|by|from)\\s+' + DATE, 'gi');

function dayOf(d, mon, y) {
  const m = MONTHS.findIndex((name) => name.startsWith(mon.toLowerCase().slice(0, 3)));
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(Number(d)).padStart(2, '0')}`;
}

function johannesburgToday() {
  return new Date(Date.now() + 2 * 3600000).toISOString().slice(0, 10);
}

// Every finding in one text: { kind, day, excerpt } for each dated notice whose day is on or before today.
function findings(text, today) {
  const out = [];
  const push = (kind, m, d, mon, y) => {
    const day = dayOf(d, mon, y);
    if (day <= today) out.push({ kind, day, excerpt: m.replace(/\s+/g, ' ').trim().slice(0, 120) });
  };
  for (const c of text.match(/<!--[\s\S]*?-->/g) || []) {
    for (const m of c.matchAll(COMMENT_EXPIRY)) push('expiry comment', m[0], m[1], m[2], m[3]);
  }
  const visible = text.replace(/<!--[\s\S]*?-->/g, ' ');
  for (const m of visible.matchAll(ANNOUNCE)) push('announcement', m[0], m[1], m[2], m[3]);
  // A notice is judged by the LATEST date in it: "posted 15 October 2026: from 1 December 2026 ..." is still ahead of
  // its change on 23 November, and only turns red once 1 December has come.
  for (const n of visible.matchAll(/notice of a change/gi)) {
    const win = visible.slice(n.index, n.index + 300);
    const dates = [...win.matchAll(new RegExp(DATE, 'gi'))];
    if (!dates.length) continue;
    const latest = dates.reduce((a, m) => (dayOf(m[1], m[2], m[3]) > dayOf(a[1], a[2], a[3]) ? m : a));
    push('notice of a change', win.slice(0, latest.index + latest[0].length), latest[1], latest[2], latest[3]);
  }
  return out;
}

// The files Vercel serves that carry words: root .html pages, llms.txt and the manifest. .bak files and baselines are
// not served (about.html.bak -> 404).
function servedFiles() {
  return fs.readdirSync(ROOT)
    .filter((f) => /\.html$/.test(f) || f === 'llms.txt' || f === 'brand-manifest.json')
    .sort();
}

function run(today) {
  const files = servedFiles();
  let hits = 0;
  for (const f of files) {
    for (const h of findings(fs.readFileSync(path.join(ROOT, f), 'utf8'), today)) {
      hits += 1;
      console.log(`DATED ${f} | ${h.kind} dated ${h.day} (today ${today}) | ${h.excerpt}`);
    }
  }
  const hook = fs.existsSync(HOOK) ? fs.readFileSync(HOOK, 'utf8') : '';
  const wired = /GATES="[^"]*\bverify-dated-notices\.cjs\b/.test(hook);
  if (!wired) console.log('verify-dated-notices.cjs is not in GATES in .githooks/pre-push');
  if (files.length === 0) { console.log('no served files found: nothing was checked, which is a failure'); return false; }
  console.log(`${hits === 0 && wired ? 'PASS' : 'FAIL'}: ${hits} dated notice(s) past their date in ${files.length} served file(s), today ${today}`);
  return hits === 0 && wired;
}

function prove() {
  const today = '2026-11-23';
  const bad = [
    '<!-- NOTICE. Remove after 14 November 2026. -->',
    '<strong>Notice of a change to our Terms:</strong> from 14 November 2026, customer prices include a fee.',
    'These are drivers\' prices: from 14 November 2026 every price in the app also includes a fee.',
    'From 14 November 2026, Customers pay a HALA MOVE service fee.',
    'accept and, from 14 Nov 2026, a HALA MOVE service fee on top of it',
    'The new rate applies with effect from 1st October 2026.',
    'Starting 23 November 2026 the app shows the fee.',
    '<!-- take it down on 20 November 2026 -->',
    '<p>Notice of a change (posted 15 October 2026): Customers will pay a service fee on 14 November 2026.</p>',
  ];
  const good = [
    '<strong>Notice of a change to our Terms:</strong> from 1 December 2026, drivers pay a joining fee.',
    'Every price in the app also includes a HALA MOVE service fee, shown before you pay.',
    'Jobs posted before 14 November 2026 carry no service fee.',
    'The service fee has applied since 14 November 2026.',
    'Notice posted 15 October 2026.',
    'These Terms were last updated in November 2026.',
    'Bakkie hire from R150 in Durban.',
    'from 14 November every price includes it',
    '<!-- Remove after 1 January 2027. -->',
    '<strong>Notice of a change (posted 15 October 2026):</strong> from 1 December 2026, drivers pay a joining fee.',
  ];
  let ok = 0;
  const total = bad.length + good.length;
  for (const line of bad) {
    if (findings(line, today).length > 0) ok += 1; else console.log(`PROVE: should be red, was green: ${line}`);
  }
  for (const line of good) {
    if (findings(line, today).length === 0) ok += 1; else console.log(`PROVE: should be green, was red: ${line}`);
  }
  console.log(`prove: ${ok}/${total} golden lines judged right`);
  return total > 0 && ok === total;
}

const arg = process.argv.find((a) => a.startsWith('--today='));
const today = arg ? arg.slice(8) : johannesburgToday();
if (!/^\d{4}-\d{2}-\d{2}$/.test(today)) { console.log(`bad --today: ${today}`); process.exit(2); }
let pass = true;
if (process.argv.includes('--prove')) pass = prove() && pass;
pass = run(today) && pass;
process.exit(pass ? 0 : 1);
