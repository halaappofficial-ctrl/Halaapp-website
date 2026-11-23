#!/usr/bin/env node
'use strict';

// -- verify-button-labels ------------------------------------------------------------------------------------------
//
//   node verify-button-labels.cjs           # exit 0 = no container link rule can recolour a button inside it
//   node verify-button-labels.cjs --prove   # also breaks the rule in memory and requires the check to go red
//
// THE DEFECT (found 2026-11-23 in Chrome at 390 and 1440 px): eight live pages showed their main green button as a
// blank green block. ".prose a{color:var(--g)}" (specificity 0,1,1) beat ".btn-green{color:#0A0A0A}" (0,1,0), so the
// label was painted in the button's own green: "Download the app" on bakkie, truck, panel van, furniture, same-day
// and student pages, "Download HALA MOVE" on About, "Email Us" on the FAQ. Every other gate passed, because each one
// reads the page's words and none of them reads the colour a word is painted in.
//
// THE RULE: a descendant link rule that sets a colour (".X a{...color...}", hover and focus included) must not reach
// a button (an <a> whose class carries btn) placed inside an element with class X, unless the rule excludes buttons
// with :not(.btn). Ancestry is read with a small tag stack over each page; the pages are hand-written, well-formed
// static HTML.

const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const VOID = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'source', 'track', 'wbr']);

// ".X a{...}" / ".X a:hover{...}" rules that set color, and do not exclude buttons
function colourRules(html) {
  const css = '\n' + [...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)].map((s) => s[1]).join('\n');
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

function check(pages) {
  const fails = [];
  let buttonsSeen = 0;
  for (const [name, html] of Object.entries(pages)) {
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
  ];
  const holds = [
    ['the same rule written :not(.btn)', { 'x.html': '<style>.prose a:not(.btn){color:#5CB558}</style><div class="prose"><a class="btn btn-green" href="/">Go</a></div>' }],
    ['a button outside the container', { 'x.html': '<style>.prose a{color:#5CB558}</style><div class="prose"><a href="/">x</a></div><a class="btn" href="/">Go</a>' }],
    ['a rule that sets no colour', { 'x.html': '<style>.prose a{text-decoration:underline}</style><div class="prose"><a class="btn" href="/">Go</a></div>' }],
  ];
  for (const [label, p] of breaks) if (check(p).fails.length === 0) proveFails.push(`PROVE: "${label}" stayed green`);
  for (const [label, p] of holds) if (check(p).fails.length !== 0) proveFails.push(`PROVE: "${label}" went red`);
  const total = breaks.length + holds.length;
  console.log(`  PROVE: ${total - proveFails.length}/${total} cases give the right verdict`);
}

fails.concat(proveFails).forEach((f) => console.log('  FAIL ' + f));
console.log(fails.length || proveFails.length ? '  BUTTON LABELS: FAIL'
  : `  BUTTON LABELS: ok (${Object.keys(pages).length} pages, ${real.buttonsSeen} buttons, no link rule recolours one)`);
process.exit(fails.length || proveFails.length ? 1 : 0);
