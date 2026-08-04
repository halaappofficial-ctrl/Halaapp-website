// Behavioural test for middleware.js — the /get and /drive store doors.
//
//     node middleware.test.mjs          # exit 0 = green, 1 = red
//
// Zero dependencies and NO package.json on purpose: this repo is a static site plus one
// middleware, and adding a package.json would change how Vercel decides to build it. This runs
// on plain Node (18+) because Request/Response/URL are globals there.
//
// WHY THIS FILE EXISTS. middleware.js is the single most decay-prone file in the repo: it is
// LIVE, PUBLIC, and it encodes STATE (which stores are live, which package ids, what a campaign
// code means). It has already carried stale state twice — APP_STORE['/get'] sat null for seven
// days after the customer app shipped, and utm_medium said 'qr' for every paid ad click. Both
// were invisible because the thing kept WORKING: a redirect that goes somewhere plausible does
// not look broken. Assertions are the only thing that reads intent.
//
// These cases pin BEHAVIOUR, not implementation — platform branching, campaign-code passthrough,
// the input allow-list, and the paid-vs-scanned medium split.

import mw from './middleware.js';

const IOS = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Safari/604.1';
const AND = 'Mozilla/5.0 (Linux; Android 13; Pixel 7) Chrome/120 Mobile Safari/537.36';

const hit = (path, ua) => {
  const res = mw(new Request('https://www.halamove.co.za' + path, { headers: { 'user-agent': ua } }));
  return res ? res.headers.get('Location') : '(passthrough)';
};
const medium = (loc) => (decodeURIComponent(loc).match(/utm_medium=([a-z_]+)/) || [, '(none)'])[1];

const CASES = [
  // Paid ads (`ad-` prefix, AD_VARIATION_MATRIX convention) must NOT be labelled as scans.
  ['paid customer -> play, paid_social', '/get?s=ad-c9-a', AND,
    l => l.includes('id=com.hala.customer') && medium(l) === 'paid_social' && l.includes('utm_campaign%3Dad-c9-a')],
  ['paid driver   -> play, paid_social', '/drive?s=ad-d10-a', AND,
    l => l.includes('id=com.hala.driverapp') && medium(l) === 'paid_social'],

  // Printed boards keep 'qr'. Re-labelling them would split their Play Console history.
  ['static QR     -> play, qr',          '/get?s=st-c',    AND, l => medium(l) === 'qr' && l.includes('utm_campaign%3Dst-c')],
  ['app-board QR  -> play, qr',          '/drive?s=app-d', AND, l => medium(l) === 'qr'],
  ['no code       -> play, qr, no campaign', '/get',       AND, l => medium(l) === 'qr' && !l.includes('utm_campaign')],

  // The ?s= allow-list is an input boundary on a public URL: anything outside [A-Za-z0-9_-]{1,32}
  // is DROPPED, never echoed into the outbound link.
  ['hostile code  -> dropped',           '/get?s=../evil!', AND, l => medium(l) === 'qr' && !l.includes('evil')],

  // iOS: App Store by id, campaign code as Apple's `ct`. No medium concept exists on this side.
  ['ios customer  -> app store + ct',    '/get?s=ad-c9-a',    IOS, l => l === 'https://apps.apple.com/za/app/id6789445062?ct=ad-c9-a'],
  ['ios driver    -> app store + ct',    '/drive?s=ad-d10-a', IOS, l => l === 'https://apps.apple.com/za/app/id6789447581?ct=ad-d10-a'],

  // The driver package was renamed once (com.hala.driver -> com.hala.driverapp) and the dead id
  // rode a doc for ten days. Pin the live one; the old one 404s.
  ['driver package is driverapp',        '/drive',         AND, l => l.includes('id=com.hala.driverapp') && !l.includes('id=com.hala.driver&')],

  // Anything outside the matcher passes straight through untouched.
  ['unmatched path passes through',      '/about',         AND, l => l === '(passthrough)'],
];

let ok = 0;
for (const [name, path, ua, assert] of CASES) {
  let pass = false, loc = '';
  try { loc = hit(path, ua); pass = assert(loc); } catch (e) { loc = 'THREW ' + e.message; }
  if (pass) ok++;
  console.log(`  ${pass ? 'ok  ' : 'FAIL'} ${name.padEnd(38)} ${loc.length > 84 ? loc.slice(0, 81) + '...' : loc}`);
}

// Counting done-rule with a total>0 guard: "nothing to check" must never read as "all pass".
if (CASES.length === 0) { console.log('\n  MIDDLEWARE: no cases — refusing to report a pass on an empty set.'); process.exit(1); }
console.log(`\n  MIDDLEWARE: ${ok}/${CASES.length}`);
process.exit(ok === CASES.length ? 0 : 1);
