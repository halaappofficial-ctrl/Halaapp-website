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
//   4. The download page and the code pages load the bar from assets/nav.css, carry the site's five menu links, and
//      no install buttons in the bar (the page itself is the install). The download page marks its own link as
//      the current page.

const fs = require('fs');
const path = require('path');
const ROOT = __dirname;

const TASK_PAGES = ['delete-account.html', 'paid.html', 'payment-cancelled.html', 'quote.html', 'refund.html', 'reset-password.html', 'track.html'];
const SHARED_BAR = ['creator.html', 'download.html', 'driver-invite.html', 'invite.html'];
const MENU = [['/#customers', 'For Customers'], ['/#drivers', 'For Drivers'], ['/#business', 'For Business'], ['/quote', 'Get a Quote'], ['/download', 'Download']];

function tokensOf(html) {
  const css = (html.match(/<style[^>]*>[\s\S]*?<\/style>/g) || []).join('');
  const out = {};
  for (const m of css.matchAll(/:root\s*\{([^}]*)\}/g)) for (const d of m[1].matchAll(/(--[\w-]+)\s*:\s*([^;]+);?/g)) out[d[1]] = d[2].trim().replace(/\s+/g, ' ');
  return out;
}

function check(pages) {
  const fails = [];
  const inSystem = pages.filter(([, h]) => /<nav id="main-nav"/.test(h));
  for (const [f, h] of pages) {
    const inBar = /<nav id="main-nav"/.test(h);
    if (!inBar && !TASK_PAGES.includes(f)) fails.push(f + ': carries neither the site bar nor a place on the task-page list');
    if (inBar && TASK_PAGES.includes(f)) fails.push(f + ': is listed as a task page but carries the site bar (take it off the list)');
    if (/#4A9DE8|74,\s*157,\s*232/i.test(h)) fails.push(f + ': paints the old customer blue (#4A9DE8)');
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
    if (JSON.stringify(links) !== JSON.stringify(MENU)) fails.push(f + ': the menu is not the site\'s five links (' + links.map((l) => l[1]).join(', ') + ')');
    if (/nav-btns/.test(nav)) fails.push(f + ': the bar offers install buttons on a page whose own job is the install');
    if (!/class="nav-logo"[\s\S]*?<svg/.test(nav)) fails.push(f + ': the bar has lost the logo');
    const current = (nav.match(/aria-current="page"/g) || []).length;
    if (f === 'download.html' && !/<a href="\/download" aria-current="page">Download<\/a>/.test(nav)) fails.push(f + ': the Download link does not mark itself as the current page');
    if (f !== 'download.html' && current) fails.push(f + ': marks a menu link as the current page, and none of them is this page');
  }
  const css = fs.existsSync(path.join(ROOT, 'assets/nav.css')) ? fs.readFileSync(path.join(ROOT, 'assets/nav.css'), 'utf8') : '';
  if (!/#main-nav\{position:sticky/.test(css)) fails.push('assets/nav.css: the bar\'s rules are missing');
  if (/(^|[\s,}])nav\{/.test(css)) fails.push('assets/nav.css: a rule for every <nav> on the page, not only the site bar (#main-nav)');
  return { fails, system: inSystem.length };
}

const pages = fs.readdirSync(ROOT).filter((f) => f.endsWith('.html')).sort().map((f) => [f, fs.readFileSync(path.join(ROOT, f), 'utf8')]);
const res = check(pages);
if (!pages.length) res.fails.push('no page found (the reader is broken)');

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
    ['a menu link dropped', swap('download.html', (h) => h.replace('<li><a href="/quote">Get a Quote</a></li>', ''))],
  ];
  for (const [label, mutated] of breaks) {
    if (mutated.length === pages.length && mutated.every(([f, h], i) => h === pages[i][1])) { proveFails.push('PROVE: "' + label + '" did not change any page (the break is stale)'); continue; }
    if (check(mutated).fails.length === 0) proveFails.push('PROVE: "' + label + '" stayed green');
  }
  console.log('  PROVE: ' + (breaks.length - proveFails.length) + '/' + breaks.length + ' breaks turn the check red');
}

res.fails.concat(proveFails).forEach((f) => console.log('  FAIL ' + f));
if (res.fails.length || proveFails.length) { console.log('  SITE SYSTEM: FAIL'); process.exit(1); }
console.log('  SITE SYSTEM: ' + res.system + ' pages in the system with one set of colours, ' + TASK_PAGES.length + ' task pages, ' + SHARED_BAR.length + ' on the shared bar');
