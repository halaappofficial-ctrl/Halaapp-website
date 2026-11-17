#!/usr/bin/env node
'use strict';

// -- verify-self-serve ----------------------------------------------------------------------------
//
//   node verify-self-serve.cjs           # exit 0 = no page sends a visitor to WhatsApp for something they can do
//   node verify-self-serve.cjs --prove   # also breaks the rule in memory and requires the check to go red
//
// THE RULE (2026-11-10, permanent): "stop directing every communication and actions which can be done by the
// users themselves to whatsapping us all the time, the system has to be self serving and self sustaining".
// Anything a visitor can finish on their own (a quote or fleet enquiry, refund details, sign-up, the apps,
// tracking, answers in the FAQ) points at that path. Our WhatsApp number appears only where a person is
// genuinely needed, and each such place says why.
//
// THE SUPPORT CONTACT (2026-11-17, the founders' decision): "ACTIVATE AGAIN THE OLD WHATSAPP SUPPORT CONTACT ON THE
// SITE AS BEFORE BECAUSE ITS REQUIRED AND WORKS MORE THAN THE EMAILS IN OUR ENVIRONMENT, KEEP THE CONTACT US METHODS
// STILL AVAILABLE". The floating "Chat with us" button and the footer WhatsApp icon are back on the 14 pages that had
// them, beside email and the forms, never in place of a form. Each carries the reason `support`.
//
// WHAT IT HOLDS:
//   1. Every line of a served page or script that links to our WhatsApp, shows the number, or says
//      "WhatsApp us" / "Chat with us" carries a `last-resort` mark (a data-last-resort attribute or a
//      `last-resort:` comment, on the line or the one above) naming one reason:
//        dispute             - a disagreement only a person can settle
//        safety              - something going wrong on a live delivery
//        outage              - our own system failed and the visitor's work would otherwise be lost
//        no-self-serve-path  - the product has no self-serve way yet (each one is a gap to close)
//        support             - the standing support contact: the floating button, the footer icon, and the
//                              "or WhatsApp us" lines beside email (2026-11-17)
//   2. The floating "Chat with us" button is on every one of SUPPORT_PAGES, once, linked to the current number.
//   3. The number retired on 2026-08-05 appears nowhere.
//   4. total > 0: the scan read pages, and found the marked places, so "nothing to check" cannot pass.
//
// OUT OF SCOPE, deliberately: a share sheet (wa.me/?text=..., e.g. "Send my drivers the app link") sends a
// visitor's message to people THEY choose, not to us; the policy pages describe how WhatsApp messages are
// delivered without asking anyone to use it; middleware.js serves a founder's own business card.

const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const REASONS = new Set(['dispute', 'safety', 'outage', 'no-self-serve-path', 'support']);
const CURRENT = 'https://wa.me/27760525398';
const SUPPORT_PAGES = ['about.html', 'bakkie-hire-durban.html', 'business-transport-durban.html', 'cookie-policy.html',
  'driver-agreement.html', 'faq.html', 'furniture-removal-durban.html', 'index.html', 'panel-van-hire-durban.html',
  'privacy.html', 'same-day-delivery-durban.html', 'student-moving-durban.html', 'terms.html', 'truck-hire-durban.html'];
const ROUTE = /wa\.me\/(?!\?)|27760525398|0?76[ \u00a0]?052[ \u00a0]?5398|whatsapp us\b|chat with us\b/i;
const RETIRED = /27658915709|0?65(?:&nbsp;|[ \u00a0])?891(?:&nbsp;|[ \u00a0])?5709/;
const MARK = /last-resort(?:="|:\s*)([a-z-]+)/;

function servedFiles() {
  const out = [];
  for (const f of fs.readdirSync(ROOT)) if (f.endsWith('.html')) out.push([f, fs.readFileSync(path.join(ROOT, f), 'utf8')]);
  const assets = path.join(ROOT, 'assets');
  for (const f of fs.readdirSync(assets)) {
    if (f.endsWith('.js')) out.push(['assets/' + f, fs.readFileSync(path.join(assets, f), 'utf8')]);
  }
  return out;
}

function check(files) {
  const fails = [];
  const marked = [];
  for (const [name, src] of files) {
    const lines = src.split(/\r?\n/);
    lines.forEach((line, i) => {
      if (RETIRED.test(line)) fails.push(name + ':' + (i + 1) + ' shows the WhatsApp number retired on 2026-08-05');
      if (/class="wa-float"/.test(line) && !line.includes('href="' + CURRENT + '"')) {
        fails.push(name + ':' + (i + 1) + ' the floating "Chat with us" button does not link to ' + CURRENT);
      }
      if (!ROUTE.test(line)) return;
      const m = MARK.exec(line) || MARK.exec(lines[i - 1] || '');
      if (!m) { fails.push(name + ':' + (i + 1) + ' sends a visitor to WhatsApp with no last-resort reason'); return; }
      if (!REASONS.has(m[1])) { fails.push(name + ':' + (i + 1) + ' last-resort reason "' + m[1] + '" is not one of ' + [...REASONS].join(', ')); return; }
      marked.push([name + ':' + (i + 1), m[1]]);
    });
  }
  const byName = new Map(files);
  for (const page of SUPPORT_PAGES) {
    const n = ((byName.get(page) || '').match(/<a [^>]*class="wa-float"/g) || []).length;
    if (n !== 1) fails.push(page + ' carries ' + n + ' floating "Chat with us" buttons; expected exactly 1');
  }
  if (files.length < 20) fails.push('read only ' + files.length + ' served files; expected the whole site');
  if (marked.length === 0) fails.push('found no marked last-resort place at all, so the scan is not reading what it should');
  return { fails, marked };
}

const FILES = servedFiles();
const res = check(FILES);
console.log('  served files read: ' + FILES.length);
for (const [where, why] of res.marked) console.log('  last resort  ' + why.padEnd(19) + where);
for (const f of res.fails) console.log('  FAIL ' + f);

let bad = res.fails.length ? 1 : 0;

if (process.argv.includes('--prove')) {
  const edit = (name, fn) => FILES.map(([n, s]) => [n, n === name ? fn(s) : s]);
  const M = [
    ['an unmarked WhatsApp link on the home page', edit('index.html', (s) => s.replace('</footer>', '<a href="https://wa.me/27760525398">Ask us</a></footer>'))],
    ['"WhatsApp us" as the help line on the FAQ', edit('faq.html', (s) => s.replace('</footer>', '<p>Still stuck? WhatsApp us.</p></footer>'))],
    ['the floating button taken off the FAQ', edit('faq.html', (s) => s.replace(/<a [^>]*class="wa-float"[\s\S]*?<\/a>/, ''))],
    ['the floating button pointed somewhere else', edit('about.html', (s) => s.replace('href="https://wa.me/27760525398" data-last-resort="support" class="wa-float"', 'href="https://wa.me/27000000000" data-last-resort="support" class="wa-float"'))],
    ['a second floating button on the home page', edit('index.html', (s) => s.replace('</footer>', '</footer><a href="https://wa.me/27760525398" data-last-resort="support" class="wa-float">x</a>'))],
    ['the retired number shown', edit('delete-account.html', (s) => s.replace('</body>', '<p>+27 65 891 5709</p></body>'))],
    ['a reason that is not on the list', edit('track.html', (s) => s.replace('data-last-resort="safety"', 'data-last-resort="convenience"'))],
    ['every mark stripped', FILES.map(([n, s]) => [n, s.replace(/data-last-resort="[^"]*"|last-resort:/g, '')])],
    ['nothing read', []],
  ];
  let caught = 0;
  for (const [label, files] of M) {
    const red = check(files).fails.length > 0;
    console.log('  ' + (red ? 'red  ' : 'MISS ') + 'mutation: ' + label);
    if (red) caught++;
  }
  console.log('\n  MUTATIONS: ' + caught + '/' + M.length + ' caught');
  if (caught !== M.length) bad = 1;
}

console.log('\n  SELF-SERVE: ' + (bad ? 'FAIL' : 'ok') + ' (' + res.marked.length + ' last-resort places, ' + res.fails.length + ' problems)');
process.exit(bad);
