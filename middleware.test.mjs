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

// Card contacts are TEST data. The real ones live only in the Vercel variable CARD_CONTACTS -
// this repo is public, so no founder's number may ever appear in it.
const CARDS = {
  alpha: { name: 'Test Alpha', given: 'Test', family: 'Alpha', greet: 'Test', title: 'Co-founder and CEO', phone: '+27000000001', email: 'alpha@example.com' },
  bravo: { name: 'Test Bravo', given: 'Test', family: 'Bravo', greet: 'Bravo', title: 'Co-founder and COO', phone: '+27000000002', email: 'bravo@example.com' },
  broken: { name: 'Test Broken', given: 'Test', family: 'Broken', greet: 'Test', title: 'X', phone: '0820000000', email: 'x@example.com' },
};
process.env.CARD_CONTACTS = JSON.stringify(CARDS);

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
  // A bare link was typed or shared, not scanned: 'direct' since 43a356f (2026-08-10). These two
  // cases still expected 'qr' and had been red from that day until 2026-10-05 - nothing runs this
  // file unless a person does.
  ['no code       -> play, direct, no campaign', '/get',   AND, l => medium(l) === 'direct' && !l.includes('utm_campaign')],

  // A link inside one of our own apps (2026-10-05): the customer app's driver-app line. Not 'qr',
  // which is what an unrecognised code would have been filed as.
  ['in-app link   -> driver play, in_app', '/drive?s=inapp-login', AND,
    l => l.includes('id=com.hala.driverapp') && medium(l) === 'in_app' && l.includes('utm_campaign%3Dinapp-login')],

  // The ?s= allow-list is an input boundary on a public URL: anything outside [A-Za-z0-9_-]{1,32}
  // is DROPPED, never echoed into the outbound link - so a hostile code reads as no code at all.
  ['hostile code  -> dropped',           '/get?s=../evil!', AND, l => medium(l) === 'direct' && !l.includes('evil')],

  // iOS: App Store by id, campaign code as Apple's `ct`. No medium concept exists on this side.
  ['ios customer  -> app store + ct',    '/get?s=ad-c9-a',    IOS, l => l === 'https://apps.apple.com/za/app/id6789445062?ct=ad-c9-a'],
  ['ios driver    -> app store + ct',    '/drive?s=ad-d10-a', IOS, l => l === 'https://apps.apple.com/za/app/id6789447581?ct=ad-d10-a'],

  // The driver package was renamed once (com.hala.driver -> com.hala.driverapp) and the dead id
  // rode a doc for ten days. Pin the live one; the old one 404s.
  ['driver package is driverapp',        '/drive',         AND, l => l.includes('id=com.hala.driverapp') && !l.includes('id=com.hala.driver&')],

  // Anything outside the matcher passes straight through untouched.
  ['unmatched path passes through',      '/about',         AND, l => l === '(passthrough)'],
];

// /card/<name>: one founder's scan-to-save page (2026-10-13). Each case reads status, type,
// body and headers, because a page that answers 200 with the wrong person's number is worse
// than a 404.
const get = async (path, host = 'www.halamove.co.za') => {
  const res = mw(new Request('https://' + host + path, { headers: { host, 'user-agent': AND } }));
  if (!res) return { status: 'passthrough', body: '', type: '', robots: '', location: '' };
  return { status: res.status, body: await res.text(), type: res.headers.get('content-type') || '',
           robots: res.headers.get('x-robots-tag') || '', location: res.headers.get('location') || '' };
};
const withEnv = async (value, fn) => {
  const saved = process.env.CARD_CONTACTS;
  if (value === undefined) delete process.env.CARD_CONTACTS; else process.env.CARD_CONTACTS = value;
  try { return await fn(); } finally { process.env.CARD_CONTACTS = saved; }
};
const notOthers = (body, self) => Object.entries(CARDS).filter(([s]) => s !== self)
  .every(([, c]) => !body.includes(c.name) && !body.includes(c.phone) && !body.includes(c.phone.slice(1)) && !body.includes(c.email));

const CARD_CASES = [
  ['card page: own founder, two buttons, noindex', () => get('/card/alpha'), r =>
    r.status === 200 && r.type.startsWith('text/html') && r.robots.includes('noindex') &&
    r.body.includes('Test Alpha') && r.body.includes('href="/card/alpha.vcf"') &&
    r.body.includes('https://wa.me/27000000001?text=Hi%20Test%2C%20we%20met%20and%20you%20gave%20me%20your%20card.') &&
    r.body.includes('/api/cards/seen') && notOthers(r.body, 'alpha')],
  ['card page: the other founder is separate', () => get('/card/bravo'), r =>
    r.status === 200 && r.body.includes('Test Bravo') && notOthers(r.body, 'bravo')],
  ['contact file: vCard for that founder only', () => get('/card/alpha.vcf'), r =>
    r.status === 200 && r.type.startsWith('text/vcard') && r.body.startsWith('BEGIN:VCARD\r\nVERSION:3.0\r\n') &&
    r.body.includes('N:Alpha;Test;;;') && r.body.includes('TEL;TYPE=CELL,VOICE:+27000000001') &&
    r.body.includes('ORG:HALA MOVE') && notOthers(r.body, 'alpha')],
  ['typed in capitals still opens', () => get('/card/ALPHA'), r => r.status === 200 && r.body.includes('Test Alpha')],
  ['trailing slash still opens', () => get('/card/alpha/'), r => r.status === 200 && r.body.includes('Test Alpha')],
  ['no listing page: /card', () => get('/card'), r => r.status === 404 && !r.body.includes('Test')],
  ['no listing page: /card/', () => get('/card/'), r => r.status === 404 && !r.body.includes('Test')],
  ['unknown name -> 404', () => get('/card/zzzz'), r => r.status === 404],
  ['hostile name -> 404, nothing echoed', () => get('/card/alpha%00'), r => r.status === 404 && !r.body.includes('%00')],
  ['over-long name -> 404', () => get('/card/' + 'a'.repeat(40)), r => r.status === 404],
  ['bad phone in data -> 404, never half a contact', () => get('/card/broken'), r => r.status === 404 && !r.body.includes('Test Broken')],
  ['variable unset -> 404, no throw', () => withEnv(undefined, () => get('/card/alpha')), r => r.status === 404],
  ['variable not JSON -> 404, no throw', () => withEnv('{not json', () => get('/card/alpha')), r => r.status === 404],
  ['QR address on the apex -> one 307 to www, path kept', () => get('/card/alpha', 'halamove.co.za'), r =>
    r.status === 307 && r.location === 'https://www.halamove.co.za/card/alpha'],
  ['creator links are untouched', () => get('/c/SOMECODE'), r => r.status === 'passthrough'],
];

let ok = 0;
for (const [name, path, ua, assert] of CASES) {
  let pass = false, loc = '';
  try { loc = hit(path, ua); pass = assert(loc); } catch (e) { loc = 'THREW ' + e.message; }
  if (pass) ok++;
  console.log(`  ${pass ? 'ok  ' : 'FAIL'} ${name.padEnd(38)} ${loc.length > 84 ? loc.slice(0, 81) + '...' : loc}`);
}
for (const [name, run, assert] of CARD_CASES) {
  let pass = false, info = '';
  try { const r = await run(); info = `${r.status} ${r.type}`; pass = assert(r); } catch (e) { info = 'THREW ' + e.message; }
  if (pass) ok++;
  console.log(`  ${pass ? 'ok  ' : 'FAIL'} ${name.padEnd(48)} ${info}`);
}

// Counting done-rule with a total>0 guard: "nothing to check" must never read as "all pass".
const total = CASES.length + CARD_CASES.length;
if (total === 0) { console.log('\n  MIDDLEWARE: no cases - refusing to report a pass on an empty set.'); process.exit(1); }
console.log(`\n  MIDDLEWARE: ${ok}/${total}`);
process.exit(ok === total ? 0 : 1);
