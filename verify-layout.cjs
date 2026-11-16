#!/usr/bin/env node
'use strict';

// -- verify-layout ---------------------------------------------------------------------------------
//
//   node verify-layout.cjs           # exit 0 = the top menu stays on one line, says when it scrolls on a phone, and no table widens a phone page
//   node verify-layout.cjs --prove   # also breaks each rule in memory and requires the check to go red
//
// THE RULES (2026-11-16):
//   1. The top menu reads on one line at every desktop width. Measured in Chrome before the fix: on all 14 pages
//      with the main top bar, four of the five links broke onto two lines at 1200, 1280 and 1440 px (42 of 42
//      frames), because the "Live - Durban" pill took the room. The pill is gone from the bar, every menu link is
//      white-space:nowrap in its base rule, and between 768 and 1199 px the bar's column gap is 16 px (24 px ran
//      the buttons 2 px past the edge at 960).
//   2. No table pushes a page sideways on a phone. Measured before the fix: the business and cookie pages scrolled
//      sideways at 360 and 390 px, because a table wider than the text column dragged the column (a grid item) wider
//      than the screen. Every .data-table now sits in a .table-scroll box that scrolls on its own, the text column
//      may shrink (.prose min-width:0), and long heading words may hyphenate ("Acknowledgment" was 322 px in a
//      273 px column at 320 px). Tables of four or more columns keep a readable 36rem and swipe inside their box.
//   3. Each table box is a region a keyboard can reach (tabindex 0), named by the heading it sits under
//      (aria-labelledby an id that exists once on the page), so the name follows the heading if it is edited.
//   4. On a phone the menu links share one row that scrolls sideways, and the last link sits past the right edge:
//      measured in Chrome at 390 px on 14 of 14 pages ("Download" ends at 446 px, "Videos" on the home page at
//      429 px), with the scrollbar hidden and nothing on screen saying the row goes on. The row fades out over its
//      last 32 px, so a cut-off link reads as "more this way", and its end padding is at least as wide as the fade,
//      so the last link scrolls fully clear of it.
//
// WHAT IT CANNOT DO: it reads source. Whether a line wraps is a measurement; the numbers above came from Chrome
// (frames of 320 to 1920 px across every page with the bar, 0 wrapped links, 0 overflow after the fix).

const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const pages = fs.readdirSync(ROOT).filter((f) => f.endsWith('.html')).sort();

function baseRules(css, selector) {
  // rules for `selector` that sit outside every @media block
  const out = [];
  let depth = 0;
  for (let i = 0; i < css.length; i++) {
    const ch = css[i];
    if (ch === '{') depth++;
    else if (ch === '}') depth--;
    else if (depth === 0 && css.startsWith(selector + '{', i)) {
      const end = css.indexOf('}', i);
      out.push(css.slice(i, end + 1));
    }
  }
  return out;
}

function check(files) {
  const fails = [];
  let bars = 0, tables = 0, phoneRows = 0;
  for (const [name, src] of Object.entries(files)) {
    const css = src.slice(0, src.indexOf('</style>'));
    if (src.includes('class="nav-inner"')) {
      bars++;
      if (/class="nav-live"/.test(src) || /\.nav-live\{/.test(css)) fails.push(name + ': the Live pill is back in the top bar');
      if (!baseRules(css, '.nav-links a').some((r) => r.includes('white-space:nowrap'))) fails.push(name + ': menu links may break inside their words at desktop widths');
      if (!/@media\(min-width:768px\) and \(max-width:1199px\)\{[^}]*\}[^@]*\.nav-inner\{column-gap:16px\}/.test(css)) fails.push(name + ': the 768-1199 px bar gap is not 16 px, the buttons run past the edge at 960');
      for (const m of css.matchAll(/\.nav-links\s*\{([^}]*overflow-x:auto[^}]*)\}/g)) {
        phoneRows++;
        const body = m[1].replace(/\s+/g, '');
        const fade = /(?:^|;)mask-image:linear-gradient\(90deg,#000calc\(100%-(\d+)px\),transparent\)/.exec(body);
        const webkit = /-webkit-mask-image:linear-gradient\(90deg,#000calc\(100%-\d+px\),transparent\)/.test(body);
        const pad = /padding:\d+px(\d+)px\d+px\d+px/.exec(body);
        if (!fade || !webkit) fails.push(name + ': the phone menu row scrolls with no sign that it does (no right-edge fade)');
        else if (!pad || +pad[1] < +fade[1]) fails.push(name + ': the phone menu row ends inside its own fade, the last link can never be read in full');
      }
    }
    const tbl = src.match(/<table class="data-table"/g) || [];
    tables += tbl.length;
    if (tbl.length) {
      const wrapped = src.match(/<div class="table-scroll" role="region" tabindex="0" aria-labelledby="[^"]+"[^>]*><table class="data-table"/g) || [];
      if (wrapped.length !== tbl.length) fails.push(name + ': ' + (tbl.length - wrapped.length) + ' table(s) not in a keyboard-reachable .table-scroll box');
      for (const m of src.matchAll(/class="table-scroll"[^>]*aria-labelledby="([^"]+)"/g)) {
        const n = (src.match(new RegExp('id="' + m[1] + '"', 'g')) || []).length;
        if (n !== 1) fails.push(name + ': a table box is named by #' + m[1] + ', which appears ' + n + ' times');
      }
      if (!/\.table-scroll\{overflow-x:auto/.test(css)) fails.push(name + ': .table-scroll does not scroll');
      if (!/\.prose\{min-width:0\}/.test(css)) fails.push(name + ': the text column cannot shrink below its widest table');
      if (!/\.prose h2,\.prose h3\{overflow-wrap:break-word;hyphens:auto/.test(css)) fails.push(name + ': a long heading word can widen the page');
    }
  }
  if (bars === 0) fails.push('no page with the main top bar found');
  if (tables === 0) fails.push('no table found');
  if (phoneRows === 0) fails.push('no phone menu row found');
  return { fails, bars, tables, phoneRows };
}

const files = Object.fromEntries(pages.map((p) => [p, fs.readFileSync(path.join(ROOT, p), 'utf8')]));
const res = check(files);

if (process.argv.includes('--prove')) {
  const one = (name, fn) => {
    const copy = Object.assign({}, files);
    copy[name] = fn(copy[name]);
    return check(copy).fails.length > 0;
  };
  const breaks = [
    ['the pill put back', 'about.html', (s) => s.replace('<ul class="nav-links"', '<div class="nav-live" aria-label="Platform is live"><div class="nav-live-dot"></div>Live</div>\n  <ul class="nav-links"')],
    ['nowrap dropped from the home menu', 'index.html', (s) => s.replace('.nav-links a{white-space:nowrap;', '.nav-links a{')],
    ['nowrap dropped from a page menu', 'faq.html', (s) => s.replace('.nav-links a{white-space:nowrap}\n', '')],
    ['the 960 px gap put back', 'terms.html', (s) => s.replace('.nav-inner{column-gap:16px}', '')],
    ['a table left unwrapped', 'cookie-policy.html', (s) => s.replace(/<div class="table-scroll"[^>]*>(<table class="data-table")/, '$1')],
    ['a table box with no keyboard focus', 'privacy.html', (s) => s.replace('role="region" tabindex="0"', 'role="region"')],
    ['a table box named by a missing heading', 'truck-hire-durban.html', (s) => s.replace('aria-labelledby="pricing"', 'aria-labelledby="pricing-gone"')],
    ['the text column held at its widest table', 'business-transport-durban.html', (s) => s.replace('.prose{min-width:0}', '')],
    ['long heading words unbroken', 'driver-agreement.html', (s) => s.replace('.prose h2,.prose h3{overflow-wrap:break-word;hyphens:auto', '.prose h2,.prose h3{')],
    ['the phone menu fade dropped', 'faq.html', (s) => s.replace(/-webkit-mask-image:[^;]+;mask-image:[^;]+;/, '')],
    ['the phone menu fade dropped on the home page', 'index.html', (s) => s.replace(/-webkit-mask-image:[^;]+;mask-image:[^;]+;/, '')],
    ['the last link left under the fade', 'terms.html', (s) => s.replace('padding:4px 32px 6px 2px', 'padding:4px 2px 6px 2px')],
  ];
  let red = 0;
  for (const [label, name, fn] of breaks) {
    if (one(name, fn)) red++;
    else console.log('  PROVE FAILED: "' + label + '" stayed green');
  }
  console.log('  PROVE: ' + red + '/' + breaks.length + ' breaks turn the check red');
  if (red !== breaks.length) process.exit(1);
}

if (res.fails.length) {
  res.fails.forEach((f) => console.log('  FAIL ' + f));
  console.log('  LAYOUT: ' + res.fails.length + ' problem(s)');
  process.exit(1);
}
console.log('  LAYOUT: ' + res.bars + ' top bars on one line, ' + res.phoneRows + ' phone menu rows marked as scrolling, ' + res.tables + ' tables boxed, 0 problems');
