#!/usr/bin/env node
'use strict';

// -- verify-float -----------------------------------------------------------------------------------------------------
//
//   node verify-float.cjs           # exit 0 = on a phone the floating WhatsApp button stays off the first screen and
//                                   #          out of the text's way, and it stops bouncing
//   node verify-float.cjs --prove   # also breaks each rule in memory and requires the check to go red
//
// THE RULES (2026-11-23, design review: "The WhatsApp button sits over the text at first glance"):
//   Measured in Chrome before the fix, on the 14 pages that carry the button, at 390x844, 390x750, 390x664 and
//   360x740: at first glance the 134 px "Chat with us" pill overlapped text or a control on 32 of 56 page-sizes (on
//   the home page at 390x750 it sat on the "I drive one" button), at the end of 13 pages it covered the copyright line,
//   and it bounced forever. After: 0 of 56 at first glance, 0 of 14 at the end, scroll steps over a control 50 -> 17,
//   never over the download bar or scroll-to-top; desktop keeps the same pill.
//   1. assets/float.css carries the phone rules: a 48 px round button in the corner with its words kept for screen
//      readers, hidden under .wa-later, scroll-to-top beside it (not stacked above it), room at the end of the footer,
//      and the lift above the download bar on a page that has one. Outside the phone block it only limits the bounce
//      to two runs (WCAG 2.2.2: movement that starts by itself may not run past five seconds).
//   2. Every page with the button links /assets/float.css once, inside <head>, after the <style> that defines the
//      page's own .wa-float (so the shared rules win), and carries the inline script that puts .wa-later on <html>
//      while scrollY is 400 or less, once. With no script the class never arrives and the button shows.
//   3. No page bounces the button forever, and no page pins it back to the old stacked seat with !important.
//   4. The gate is wired into .githooks/pre-push, in GATES and in PROVE.
//
// WHAT IT CANNOT DO: it reads source. Whether the button covers a word is a measurement; the numbers above came from
// Chrome (E:/hala_tmp/w7/wa_sweep.js, a scratch harness, every page at four phone sizes and every 120 px of scroll).

const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const HOOK = path.join(ROOT, '.githooks', 'pre-push');
const CSS = 'assets/float.css';
const SCRIPT = "(function(r){function c(){r.classList.toggle('wa-later',(window.scrollY||0)<=400)}c();" +
  "window.addEventListener('scroll',c,{passive:true})}(document.documentElement));";

function load() {
  const files = new Map();
  for (const f of fs.readdirSync(ROOT).filter((x) => x.endsWith('.html')).sort()) files.set(f, fs.readFileSync(path.join(ROOT, f), 'utf8'));
  const css = fs.existsSync(path.join(ROOT, CSS)) ? fs.readFileSync(path.join(ROOT, CSS), 'utf8') : '';
  const hook = fs.existsSync(HOOK) ? fs.readFileSync(HOOK, 'utf8') : '';
  return { files, css, hook };
}

function phoneBlock(css) {
  const at = css.search(/@media \(max-width: 768px\) \{/);
  if (at < 0) return '';
  let depth = 0;
  for (let i = css.indexOf('{', at); i < css.length; i++) {
    if (css[i] === '{') depth++;
    else if (css[i] === '}' && --depth === 0) return css.slice(at, i + 1);
  }
  return '';
}

function check({ files, css, hook }) {
  const fails = [];
  const bare = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const phone = phoneBlock(bare);
  const outside = bare.replace(phone, '');
  if (!bare) fails.push(CSS + ' is missing');
  if (!/\.wa-float \{ animation-iteration-count: 2; \}/.test(outside)) fails.push(CSS + ': the bounce is not limited to two runs outside the phone block');
  if (!phone) fails.push(CSS + ': no @media (max-width: 768px) block');
  const rule = (sel) => { const m = new RegExp('(?:^|\\n)\\s*' + sel.replace(/[.()[\]:]/g, '\\$&') + ' \\{([^}]*)\\}').exec(phone); return m ? m[1] : null; };
  const wa = rule('.wa-float') || '';
  for (const d of ['width: 48px', 'height: 48px', 'right: 16px', 'padding: 0']) if (!wa.includes(d)) fails.push(CSS + ': the phone .wa-float lacks "' + d + '"');
  if (!/bottom: calc\(16px \+ env\(safe-area-inset-bottom, 0px\)\)/.test(wa)) fails.push(CSS + ': the phone .wa-float is not seated in the corner');
  const later = rule('.wa-later .wa-float') || '';
  for (const d of ['visibility: hidden', 'pointer-events: none', 'opacity: 0']) if (!later.includes(d)) fails.push(CSS + ': .wa-later .wa-float lacks "' + d + '"');
  if (!/clip-path: inset\(50%\)/.test(rule('.wa-float span') || '')) fails.push(CSS + ': the button\'s words are not kept for screen readers');
  if (!/right: 72px/.test(rule('.scroll-top') || '')) fails.push(CSS + ': scroll-to-top does not sit beside the button');
  const room = /height: (\d+)px/.exec(rule('footer::after') || '');
  if (!room || +room[1] < 64) fails.push(CSS + ': the footer ends without room for the button');
  if (!/bottom: calc\(84px/.test(rule('body:has(.sticky-download) .wa-float') || '')) fails.push(CSS + ': the button is not lifted above the download bar');

  const pages = [...files].filter(([, s]) => /<a [^>]*class="wa-float"/.test(s));
  if (pages.length === 0) fails.push('found no page with the floating button, so nothing was checked');
  for (const [name, s] of pages) {
    const links = s.split('href="/assets/float.css"').length - 1;
    if (links !== 1) { fails.push(name + ' links ' + CSS + ' ' + links + ' times; expected 1'); continue; }
    const at = s.indexOf('href="/assets/float.css"');
    const head = s.indexOf('</head>');
    const base = s.indexOf('.wa-float{');
    const baseEnd = base < 0 ? -1 : s.indexOf('</style>', base);
    if (head < 0 || at > head) fails.push(name + ': ' + CSS + ' is not linked inside <head>');
    if (base < 0 || at < baseEnd) fails.push(name + ': ' + CSS + ' is linked before the page\'s own .wa-float rules, so they win');
    if (s.split(SCRIPT).length - 1 !== 1) fails.push(name + ': the inline .wa-later script is not there exactly once');
    if (/waBounce[^;}]*infinite/.test(s)) fails.push(name + ': the button bounces forever');
    if (/\.wa-float\{[^}]*bottom:[^};]*!important/.test(s) || /\.scroll-top\{[^}]*bottom:[^};]*!important/.test(s)) fails.push(name + ': the button is pinned to the old stacked seat with !important');
  }
  if (!/GATES="[^"]*\bverify-float\.cjs\b/.test(hook)) fails.push('verify-float.cjs is not in GATES in .githooks/pre-push');
  if (!/PROVE="[^"]*\bverify-float\.cjs\b/.test(hook)) fails.push('verify-float.cjs is not in PROVE in .githooks/pre-push');
  return { fails, pages: pages.length };
}

function prove(state) {
  const page = (name, fn) => { const files = new Map(state.files); files.set(name, fn(files.get(name))); return { ...state, files }; };
  const css = (fn) => ({ ...state, css: fn(state.css) });
  const cases = [
    ['the shared rules dropped from the FAQ', page('faq.html', (s) => s.replace('<link rel="stylesheet" href="/assets/float.css">', ''))],
    ['the shared rules linked before the page\'s own', page('about.html', (s) => s.replace('<link rel="stylesheet" href="/assets/float.css">', '').replace('<head>', '<head><link rel="stylesheet" href="/assets/float.css">'))],
    ['the inline script taken off the terms page', page('terms.html', (s) => s.replace(SCRIPT, ''))],
    ['the home page bouncing forever again', page('index.html', (s) => s.replace('waBounce 2s ease-in-out 3s 2', 'waBounce 2s ease-in-out 3s infinite'))],
    ['the old stacked seat put back on the home page', page('index.html', (s) => s.replace('@media(max-width:768px){', '@media(max-width:768px){.wa-float{bottom:128px!important;right:16px}'))],
    ['the button no longer hidden on the first screen', css((s) => s.replace('.wa-later .wa-float { opacity: 0; visibility: hidden; pointer-events: none;', '.wa-later .wa-float {'))],
    ['the pill back on a phone', css((s) => s.replace('width: 48px;', ''))],
    ['no room at the end of the footer', css((s) => s.replace("footer::after { content: ''; display: block; height: 72px; }", ''))],
    ['scroll-to-top stacked above the button again', css((s) => s.replace('.scroll-top { right: 72px;', '.scroll-top { right: 16px;'))],
    ['the bounce limit removed', css((s) => s.replace('.wa-float { animation-iteration-count: 2; }', ''))],
    ['the gate taken out of the push hook', { ...state, hook: state.hook.replace(/verify-float\.cjs/g, '') }],
  ];
  let ok = true;
  for (const [label, s] of cases) {
    const red = check(s).fails.length > 0;
    console.log((red ? '  red   ' : '  GREEN ') + label);
    if (!red) ok = false;
  }
  return ok;
}

const state = load();
const res = check(state);
for (const f of res.fails) console.log('FAIL ' + f);
let ok = res.fails.length === 0;
if (process.argv.includes('--prove')) {
  console.log('prove: each break must turn the check red');
  if (!prove(state)) { console.log('prove: a break stayed green, so the check is not reading what it should'); ok = false; }
}
console.log('\n  FLOAT: ' + (ok ? 'ok' : 'FAIL') + ' (' + res.pages + ' pages with the button, ' + res.fails.length + ' problems)');
process.exit(ok ? 0 : 1);
