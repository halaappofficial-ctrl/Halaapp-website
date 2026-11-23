#!/usr/bin/env node
'use strict';

// -- verify-button-labels ------------------------------------------------------------------------------------------
//
//   node verify-button-labels.cjs           # exit 0 = every button label can be read
//   node verify-button-labels.cjs --prove   # also breaks each rule in memory and requires the check to go red
//
// THE DEFECT (found 2026-11-23 in Chrome at 390 and 1440 px): eight live pages showed their main green button as a
// blank green block. ".prose a{color:var(--g)}" (specificity 0,1,1) beat ".btn-green{color:#0A0A0A}" (0,1,0), so the
// label was painted in the button's own green: "Download the app" on bakkie, truck, panel van, furniture, same-day
// and student pages, "Download HALA MOVE" on About, "Email Us" on the FAQ. Every other gate passed, because each one
// reads the page's words and none of them reads the colour a word is painted in.
//
// RULE 1: a descendant link rule that sets a colour (".X a{...color...}", hover and focus included) must not reach a
// button (an <a> whose class carries btn) placed inside an element with class X, unless the rule excludes buttons
// with :not(.btn). Ancestry is read with a small tag stack over each page; the pages are hand-written, well-formed
// static HTML.
//
// RULE 2 (same day): a rule that sets a text colour on its own solid background in one block must reach 4.5:1 (WCAG
// AA for text under 24 px; every such rule on the site paints a button or a pill label well under that size). The
// WhatsApp button painted white on #25D366, 1.98:1, on 14 pages.

const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const VOID = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'source', 'track', 'wbr']);

const styles = (html) => '\n' + [...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)].map((s) => s[1]).join('\n').replace(/\/\*[\s\S]*?\*\//g, '');

// ".X a{...}" / ".X a:hover{...}" rules that set color, and do not exclude buttons
function colourRules(html) {
  const css = styles(html);
  const out = [];
  const re = /(^|[}\s,])\.([A-Za-z0-9_-]+)\s+a((?::[a-z-]+(?:\([^)]*\))?)*)\s*\{([^}]*)\}/g;
  let m;
  while ((m = re.exec(css))) {
    const pseudo = m[3] || '';
    if (!/(^|;|\s)color\s*:/.test(m[4])) continue;
    if (/:not\(\.btn\)/.test(pseudo)) continue;
    out.push({ container: m[2], rule: `.${m[2]} a${pseudo}{${m[4].trim().slice(0, 60)}}` });
  }
  return out;
}

// every <a> whose class carries btn, with the classes of all its ancestors and its text
function buttons(html) {
  const body = html.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '').replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '').replace(/<!--[\s\S]*?-->/g, '');
  const stack = [];
  const found = [];
  const re = /<\/?([A-Za-z][A-Za-z0-9-]*)([^>]*)>/g;
  let m;
  while ((m = re.exec(body))) {
    const tag = m[1].toLowerCase();
    if (m[0][1] === '/') {
      const i = stack.map((s) => s.tag).lastIndexOf(tag);
      if (i >= 0) stack.length = i;
      continue;
    }
    const cls = ((m[2].match(/\sclass\s*=\s*"([^"]*)"/) || [])[1] || '').split(/\s+/).filter(Boolean);
    if (tag === 'a' && cls.includes('btn')) {
      const end = body.indexOf('</a>', re.lastIndex);
      const text = body.slice(re.lastIndex, end < 0 ? re.lastIndex : end).replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
      found.push({ text, ancestors: new Set(stack.flatMap((s) => s.cls)) });
    }
    if (!VOID.has(tag) && !/\/\s*$/.test(m[2])) stack.push({ tag, cls });
  }
  return found;
}

const hex = (h) => { h = h.replace('#', ''); if (h.length === 3) h = h.split('').map((c) => c + c).join(''); return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)); };
const lum = (rgb) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; const [r, g, b] = rgb.map(f); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
const ratio = (a, b) => { const x = lum(hex(a)), y = lum(hex(b)); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };

// a rule that sets a hex text colour and a hex background in the same block
function pairRules(html) {
  const out = [];
  for (const m of styles(html).matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const fg = /(?:^|;)\s*color\s*:\s*(#[0-9a-fA-F]{6}|#[0-9a-fA-F]{3})(?![0-9a-fA-F])/.exec(m[2]);
    const bg = /(?:^|;)\s*background(?:-color)?\s*:\s*(#[0-9a-fA-F]{6}|#[0-9a-fA-F]{3})\s*(?:;|$|!)/.exec(m[2]);
    if (!fg || !bg) continue;
    const r = ratio(fg[1], bg[1]);
    if (r < 4.5) out.push(`${m[1].trim().slice(-40)} paints ${fg[1]} on ${bg[1]} at ${r.toFixed(2)}:1, under 4.5:1`);
  }
  return out;
}

// RULE 3 (same day): a text colour token (--t2, --t3, --text-*) must reach 4.5:1 on the page background (#0A0A0A).
// download.html set --text-faint to #707070, 4.0:1 on the page and 3.5:1 on its cards; the site's own --t3 is #999.
function tokenRules(html) {
  const out = [];
  for (const m of styles(html).matchAll(/(--(?:t\d|text(?:-[a-z]+)?))\s*:\s*(#[0-9a-fA-F]{6}|#[0-9a-fA-F]{3})(?![0-9a-fA-F])/g)) {
    const r = ratio(m[2], '#0A0A0A');
    if (r < 4.5) out.push(`the text token ${m[1]} is ${m[2]}, ${r.toFixed(2)}:1 on #0A0A0A, under 4.5:1`);
  }
  return out;
}

function check(pages) {
  const fails = [];
  let buttonsSeen = 0;
  for (const [name, html] of Object.entries(pages)) {
    for (const f of pairRules(html)) fails.push(`${name}: ${f}`);
    for (const f of tokenRules(html)) fails.push(`${name}: ${f}`);
    const rules = colourRules(html);
    const btns = buttons(html);
    buttonsSeen += btns.length;
    for (const b of btns) {
      for (const r of rules) {
        if (b.ancestors.has(r.container)) fails.push(`${name}: the button "${b.text}" sits inside .${r.container}, and ${r.rule} paints its label (write .${r.container} a:not(.btn))`);
      }
    }
  }
  return { fails, buttonsSeen };
}

const pages = {};
for (const f of fs.readdirSync(ROOT).filter((f) => f.endsWith('.html')).sort()) pages[f] = fs.readFileSync(path.join(ROOT, f), 'utf8');
const real = check(pages);
const fails = [...real.fails];
if (Object.keys(pages).length === 0 || real.buttonsSeen === 0) fails.push(`read ${Object.keys(pages).length} pages and ${real.buttonsSeen} buttons: nothing was checked`);

const proveFails = [];
if (process.argv.includes('--prove')) {
  const breaks = [
    ['a prose link rule that reaches a button', { 'x.html': '<style>.prose a{color:#5CB558}</style><div class="prose"><p><a class="btn btn-green" href="/">Go</a></p></div>' }],
    ['a hover colour that reaches a button', { 'x.html': '<style>.cta a:hover{color:#5CB558}</style><section class="cta"><a href="/" class="btn">Go</a></section>' }],
    ['a nested container two levels up', { 'x.html': '<style>.prose a{color:red}</style><div class="prose"><div><span><a class="btn" href="/">Go</a></span></div></div>' }],
    ['white on WhatsApp green in one rule', { 'x.html': '<style>.wa-float{position:fixed;background:#25D366;color:#fff}</style><a class="btn" href="/">Go</a>' }],
    ['a faint text token at 4.0:1', { 'x.html': '<style>:root{--text-faint: #707070;}</style><a class="btn" href="/">Go</a>' }],
  ];
  const holds = [
    ['the same rule written :not(.btn)', { 'x.html': '<style>.prose a:not(.btn){color:#5CB558}</style><div class="prose"><a class="btn btn-green" href="/">Go</a></div>' }],
    ['a button outside the container', { 'x.html': '<style>.prose a{color:#5CB558}</style><div class="prose"><a href="/">x</a></div><a class="btn" href="/">Go</a>' }],
    ['a rule that sets no colour', { 'x.html': '<style>.prose a{text-decoration:underline}</style><div class="prose"><a class="btn" href="/">Go</a></div>' }],
    ['dark text on brand green in one rule', { 'x.html': '<style>.btn-green{background:#5CB558;color:#0A0A0A}</style><a class="btn btn-green" href="/">Go</a>' }],
    ['the site third-level text token', { 'x.html': '<style>:root{--t3:#999}</style><a class="btn" href="/">Go</a>' }],
  ];
  for (const [label, p] of breaks) if (check(p).fails.length === 0) proveFails.push(`PROVE: "${label}" stayed green`);
  for (const [label, p] of holds) if (check(p).fails.length !== 0) proveFails.push(`PROVE: "${label}" went red`);
  const total = breaks.length + holds.length;
  console.log(`  PROVE: ${total - proveFails.length}/${total} cases give the right verdict`);
}

fails.concat(proveFails).forEach((f) => console.log('  FAIL ' + f));
console.log(fails.length || proveFails.length ? '  BUTTON LABELS: FAIL'
  : `  BUTTON LABELS: ok (${Object.keys(pages).length} pages, ${real.buttonsSeen} buttons, every label readable)`);
process.exit(fails.length || proveFails.length ? 1 : 0);
