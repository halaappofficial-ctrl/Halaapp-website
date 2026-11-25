#!/usr/bin/env node
'use strict';

// -- verify-site-system ----------------------------------------------------------------------------------------------
//
//   node verify-site-system.cjs           # exit 0 = every page is either in the site's system or a listed task page
//   node verify-site-system.cjs --prove   # also breaks each rule in memory and requires the check to go red
//
// THE DEFECT (design review 2026-11-23, item 10): the download page and the three code pages (invite, driver invite,
// creator) ran a second template: their own logo strip instead of the site's bar, their own colour names and values,
// and a customer blue (#4A9DE8) that is in neither app nor the brand rules. White on that blue read at 2.88:1 on the
// invite button. These are the pages a flyer scan, an invite link and every "Download App" button land on.
//
// THE RULES
//   1. Every page is in the site's system (it carries the site's bar, <nav id="main-nav">) or is one of the task pages
//      below, which keep a person on one job (pay, refund, track, reset a password, get a quote, delete an account)
//      and carry no menu by design. A new page has to choose.
//   2. Every page in the system defines the same colour tokens with the same values, and no others.
//   3. No page paints the old customer blue.
//   4. The download page, the guides page and the code pages load the bar from assets/nav.css, carry the site's six
//      menu links, and no install buttons in the bar (the download page itself is the install). The download and
//      guides pages mark their own link as the current page; no other page marks one.
//   5. A code page reads its code from the last part of the address, so opened at its own bare address (/invite,
//      /driver-invite, /creator) it would read its own name as the code. Each one treats its own name as "no code"
//      and shows its empty state. (Found 2026-11-24: /creator showed "creator" in the code box and sent it to the
//      stores as the source.)
//   6. Every page in the system links the guides from its bar (2026-11-24: the how-to belongs "under a section
//      of button of guides"), placed before Get a Quote so a phone's bar shows it before the row scrolls.
//   7. No page paints a green glow: no radial gradient carrying the brand green, written out (#5CB558, 92,181,88) or
//      as a colour token (var(--g), var(--glow), var(--gl)). (2026-11-25: "The green reflection in the
//      background towards the top of screens ... has to be removed across all materials, that extra green color".)
//      Green marks a state (a badge, a step number, a button); it is never a light behind the page. The dashed rule
//      and the download headline's green text are linear fills of a line and of letters, and stay.
//   8. No text file carries a word from the private list. The list is held as SHA-256 hashes. Every word of every
//      text file (html, txt, md, json, js, cjs, css, xml; not node_modules, .git, baselines or .bak) is hashed and
//      compared.

const fs = require('fs');
const path = require('path');
const ROOT = __dirname;

const TASK_PAGES = ['delete-account.html', 'paid.html', 'payment-cancelled.html', 'pool.html', 'quote.html', 'refund.html', 'reset-password.html', 'track.html'];
const SHARED_BAR = ['creator.html', 'download.html', 'driver-invite.html', 'guides.html', 'invite.html'];
const OWN_LINK = { 'download.html': ['/download', 'Download'], 'guides.html': ['/guides', 'Guides'] };
const CODE_PAGES = { 'invite.html': 'INVITE', 'driver-invite.html': 'DRIVER-INVITE', 'creator.html': 'CREATOR' };
const GREEN_GLOW = /radial-gradient\([^;{}]*(#5cb558|92\s*,\s*181\s*,\s*88|var\(--g[a-z0-9-]*\))[^;{}]*/gi;
const PRIVATE_WORDS = new Set([
  '6f9edcd3408cbda14a837e6a44fc5b7f64ccc9a2477c1498fcb13c777ffb9605',
  'c79cf8128f0c9fb0c6ef53690274390abfbbdc386c31dcf6be302608f37a6e45',
  '3daca1f7ee70d17abcfd46030f170d26a5ba8dd791cd95ec0e94c598f4b56c31',
]);
const TEXT_FILE = /\.(html|txt|md|json|js|cjs|css|xml)$/i;
const SKIP_DIR = new Set(['node_modules', '.git', 'baselines', '.vercel']);
const MENU = [['/#customers', 'For Customers'], ['/#drivers', 'For Drivers'], ['/#business', 'For Business'], ['/guides', 'Guides'], ['/quote', 'Get a Quote'], ['/download', 'Download']];

function tokensOf(html) {
  const css = (html.match(/<style[^>]*>[\s\S]*?<\/style>/g) || []).join('');
  const out = {};
  for (const m of css.matchAll(/:root\s*\{([^}]*)\}/g)) for (const d of m[1].matchAll(/(--[\w-]+)\s*:\s*([^;]+);?/g)) out[d[1]] = d[2].trim().replace(/\s+/g, ' ');
  return out;
}

function textFiles(dir, rel) {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const r = rel ? rel + '/' + e.name : e.name;
    if (e.isDirectory()) { if (!SKIP_DIR.has(e.name)) out.push(...textFiles(path.join(dir, e.name), r)); continue; }
    if (TEXT_FILE.test(e.name) && !/\.bak$/i.test(e.name)) out.push([r, fs.readFileSync(path.join(dir, e.name), 'utf8')]);
  }
  return out;
}

const privateWordMemo = new Map();
function isPrivateWord(w) {
  if (!privateWordMemo.has(w)) privateWordMemo.set(w, PRIVATE_WORDS.has(require('crypto').createHash('sha256').update(w).digest('hex')));
  return privateWordMemo.get(w);
}

function namesPrivate(files) {
  const fails = [];
  for (const [f, t] of files) {
    const hit = new Set();
    for (const w of new Set(t.toLowerCase().match(/[a-z]+/g) || [])) if (isPrivateWord(w)) hit.add(w);
    if (hit.size) fails.push(f + ': carries ' + hit.size + ' word(s) from the private list');
  }
  return fails;
}

function check(pages) {
  const fails = [];
  const inSystem = pages.filter(([, h]) => /<nav id="main-nav"/.test(h));
  for (const [f, h] of pages) {
    const inBar = /<nav id="main-nav"/.test(h);
    if (!inBar && !TASK_PAGES.includes(f)) fails.push(f + ': carries neither the site bar nor a place on the task-page list');
    if (inBar && TASK_PAGES.includes(f)) fails.push(f + ': is listed as a task page but carries the site bar (take it off the list)');
    if (/#4A9DE8|74,\s*157,\s*232/i.test(h)) fails.push(f + ': paints the old customer blue (#4A9DE8)');
    for (const g of h.match(GREEN_GLOW) || []) fails.push(f + ': paints a green glow (' + g.slice(0, 60) + ')');
    if (inBar) {
      const bar = h.match(/<nav id="main-nav"[\s\S]*?<\/nav>/)[0];
      const g = bar.search(/<a href="\/guides"[^>]*>Guides<\/a>/);
      const q = bar.search(/<a href="\/quote"[^>]*>Get a Quote<\/a>/);
      if (g < 0) fails.push(f + ': the bar does not link the guides');
      else if (q >= 0 && g > q) fails.push(f + ': Guides sits after Get a Quote, past what a phone bar shows first');
    }
  }
  const ref = inSystem.find(([f]) => f === 'index.html') || inSystem[0];
  if (ref) {
    const want = tokensOf(ref[1]);
    if (!Object.keys(want).length) fails.push(ref[0] + ': no colour tokens found (the reader is broken)');
    for (const [f, h] of inSystem) {
      const got = tokensOf(h);
      for (const k of Object.keys(want)) if (got[k] !== want[k]) fails.push(f + ': ' + k + ' is ' + (got[k] || 'missing') + ', the site has ' + want[k]);
      for (const k of Object.keys(got)) if (!(k in want)) fails.push(f + ': defines its own colour token ' + k);
    }
  }
  for (const f of SHARED_BAR) {
    const p = pages.find(([n]) => n === f);
    if (!p) { fails.push(f + ': missing'); continue; }
    const h = p[1];
    if (!/<nav id="main-nav"/.test(h)) continue;   // rule 1 has already said so
    if (!h.includes('<link rel="stylesheet" href="/assets/nav.css">')) fails.push(f + ': does not load the bar from assets/nav.css');
    if (/class="topbar"/.test(h)) fails.push(f + ': still carries its own logo strip');
    const nav = h.match(/<nav id="main-nav"[\s\S]*?<\/nav>/)[0];
    const links = [...nav.matchAll(/<li><a href="([^"]+)"([^>]*)>([^<]+)<\/a><\/li>/g)].map((m) => [m[1], m[3]]);
    if (JSON.stringify(links) !== JSON.stringify(MENU)) fails.push(f + ': the menu is not the site\'s six links (' + links.map((l) => l[1]).join(', ') + ')');
    if (/nav-btns/.test(nav)) fails.push(f + ': the bar offers install buttons on a page whose own job is the install');
    if (!/class="nav-logo"[\s\S]*?<svg/.test(nav)) fails.push(f + ': the bar has lost the logo');
    const current = (nav.match(/aria-current="page"/g) || []).length;
    const own = OWN_LINK[f];
    if (own && !nav.includes('<a href="' + own[0] + '" aria-current="page">' + own[1] + '</a>')) fails.push(f + ': the ' + own[1] + ' link does not mark itself as the current page');
    if (own && current !== 1) fails.push(f + ': marks ' + current + ' menu links as the current page, not just its own');
    if (!own && current) fails.push(f + ': marks a menu link as the current page, and none of them is this page');
  }
  for (const [f, own] of Object.entries(CODE_PAGES)) {
    const p = pages.find(([n]) => n === f);
    if (!p) continue;
    const script = (p[1].match(/<script>[\s\S]*?<\/script>/g) || []).find((s) => /location\.pathname\.split\('\/'\)/.test(s));
    if (!script) { fails.push(f + ': no script reads the code from the address (the reader is broken)'); continue; }
    if (!new RegExp("raw === '" + own + "'").test(script)) fails.push(f + ': opened at its own address it shows "' + own.toLowerCase() + '" as the code');
  }
  const css = fs.existsSync(path.join(ROOT, 'assets/nav.css')) ? fs.readFileSync(path.join(ROOT, 'assets/nav.css'), 'utf8') : '';
  if (!/#main-nav\{position:sticky/.test(css)) fails.push('assets/nav.css: the bar\'s rules are missing');
  if (/(^|[\s,}])nav\{/.test(css)) fails.push('assets/nav.css: a rule for every <nav> on the page, not only the site bar (#main-nav)');
  return { fails, system: inSystem.length };
}

const pages = fs.readdirSync(ROOT).filter((f) => f.endsWith('.html')).sort().map((f) => [f, fs.readFileSync(path.join(ROOT, f), 'utf8')]);
const files = textFiles(ROOT, '');
const res = check(pages);
res.fails.push(...namesPrivate(files));
if (!pages.length) res.fails.push('no page found (the reader is broken)');
if (!files.some(([f]) => f === 'verify-site-system.cjs')) res.fails.push('the text-file reader did not find this gate (the reader is broken)');

const proveFails = [];
if (process.argv.includes('--prove')) {
  const swap = (file, fn) => pages.map(([f, h]) => [f, f === file ? fn(h) : h]);
  const breaks = [
    ['a code page back on its own logo strip', swap('invite.html', (h) => h.replace(/<nav id="main-nav"[\s\S]*?<\/nav>/, '<header class="topbar"><a href="/" class="brand">HALA MOVE</a></header>'))],
    ['the customer blue back on the download page', swap('download.html', (h) => h.replace('</style>', '.card-customer .card-icon{background:#4A9DE8}</style>'))],
    ['the shared bar stylesheet dropped', swap('creator.html', (h) => h.replace('<link rel="stylesheet" href="/assets/nav.css">', ''))],
    ['a colour token drifting on one page', swap('driver-invite.html', (h) => h.replace(/--t2:\s*#AAAAAA;/, '--t2: #A0A0A0;'))],
    ['a page of its own colour names', swap('creator.html', (h) => h.replace(/:root\{\n --g:/, ':root{\n --accent: #5CB558;\n --g:'))],
    ['install buttons in the bar of a code page', swap('invite.html', (h) => h.replace('</ul>\n', '</ul>\n  <div class="nav-btns"><a href="/download" class="btn btn-green btn-sm">Get Started</a></div>\n'))],
    ['a new page that chose neither', pages.concat([['offer.html', '<!DOCTYPE html><html><body><p>x</p></body></html>']])],
    ['the creator page reading its own name as a code', swap('creator.html', (h) => h.replace(" || raw === 'CREATOR'", ''))],
    ['the invite page reading its own name as a code', swap('invite.html', (h) => h.replace(" || raw === 'INVITE'", ''))],
    ['a menu link dropped', swap('download.html', (h) => h.replace('<li><a href="/quote">Get a Quote</a></li>', ''))],
    ['Guides dropped from a page with its own bar', swap('faq.html', (h) => h.replace(/\n[ \t]*<li><a href="\/guides">Guides<\/a><\/li>/, ''))],
    ['Guides moved after Get a Quote on the home page', swap('index.html', (h) => h.replace(/(\n[ \t]*)<li><a href="\/guides">Guides<\/a><\/li>(\n[ \t]*<li><a href="\/quote">Get a Quote<\/a><\/li>)/, '$2$1<li><a href="/guides">Guides</a></li>'))],
    ['the guides page not marking its own link', swap('guides.html', (h) => h.replace('<a href="/guides" aria-current="page">', '<a href="/guides">'))],
    ['a green glow back behind the invite page', swap('invite.html', (h) => h.replace('</style>', 'main::before { content: ""; background: radial-gradient(circle, var(--glow) 0%, transparent 60%); }</style>'))],
    ['a green glow written out on the home page', swap('index.html', (h) => h.replace('</style>', '.hero::before{background:radial-gradient(60% 50% at 12% 0%,rgba(92,181,88,.22),transparent 70%)}</style>'))],
    ['the guides page marking Download as current', swap('guides.html', (h) => h.replace('<a href="/download">Download</a>', '<a href="/download" aria-current="page">Download</a>'))],
  ];
  for (const [label, mutated] of breaks) {
    if (mutated.length === pages.length && mutated.every(([f, h], i) => h === pages[i][1])) { proveFails.push('PROVE: "' + label + '" did not change any page (the break is stale)'); continue; }
    if (check(mutated).fails.length === 0) proveFails.push('PROVE: "' + label + '" stayed green');
  }
  // The private-word rule reads files, not pages: plant a word whose hash is on the list (built from char codes so
  // this file still carries none of the words) into a comment of a page and of a gate.
  const planted = String.fromCharCode(101, 114, 105, 99);
  for (const [label, file] of [['a private word in a page comment', 'guides.html'], ['a private word in a gate', 'verify-links.cjs']]) {
    const mutatedFiles = files.map(([f, t]) => [f, f === file ? t + '\n<!-- ' + planted.toUpperCase() + ' said so -->' : t]);
    if (!files.some(([f]) => f === file)) { proveFails.push('PROVE: "' + label + '": ' + file + ' not found (the break is stale)'); continue; }
    if (namesPrivate(mutatedFiles.filter(([f]) => f === file)).length === 0) proveFails.push('PROVE: "' + label + '" stayed green');
    breaks.push([label]);
  }
  console.log('  PROVE: ' + (breaks.length - proveFails.length) + '/' + breaks.length + ' breaks turn the check red');
}

res.fails.concat(proveFails).forEach((f) => console.log('  FAIL ' + f));
if (res.fails.length || proveFails.length) { console.log('  SITE SYSTEM: FAIL'); process.exit(1); }
console.log('  SITE SYSTEM: ' + res.system + ' pages in the system with one set of colours, ' + TASK_PAGES.length + ' task pages, ' + SHARED_BAR.length + ' on the shared bar, ' + files.length + ' text files free of private words');
