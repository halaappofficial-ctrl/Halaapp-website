#!/usr/bin/env node
'use strict';

// -- verify-type ----------------------------------------------------------------------------------------------------
//
//   node verify-type.cjs           # exit 0 = every page is set in the one HALA MOVE type system
//   node verify-type.cjs --prove   # also breaks each rule in memory and requires the check to go red
//
// THE STANDARD (2026-11-16): "our letter fonts dont reflect those companies, we are still looking like an AI designed
// website". Measured on apple.com, tesla.com and spacex.com: one display face and one text face, two or three
// weights, a short size scale, large headings tracked tighter as they grow, nothing on a third party's server.
// The site had Syne 700/800 and Plus Jakarta Sans 300-800 from Google's CDN, 29 text sizes on the home page, large
// headings spaced out, and the HALA MOVE wordmark in Syne although the brand sets it in Outfit Black 900.
//
// The system, and what this checks:
//   1. Faces: Outfit (headings, the wordmark) and Barlow (text), self-hosted in /fonts, declared once in
//      assets/type.css with font-display swap, each file a real woff2 on disk. No page loads Google Fonts, Syne or
//      Plus Jakarta Sans, and the cookie policy no longer lists Google Fonts as a service the site calls.
//   2. Every page (and the /card page middleware.js builds) links /assets/type.css; every font-family is one of the
//      two tokens, inherit, or the code face on the tracking page.
//   3. Weights 400, 600 and 900, and 900 only on the wordmark (HALA MOVE spans, .wordmark, .brand, .wm).
//   4. Text sizes (rules under 20px that are not headings) sit on the scale 12 / 13 / 14 / 15 / 17 / 19 px, nothing
//      under 12px, and a form field never under 16px (iOS zooms the page into a smaller field).
//   5. Headings are never letter-spaced out; mixed-case text is never letter-spaced out (capitals labels may be).
//   6. The wordmark keeps its two words apart (word-spacing on every wordmark rule): Outfit 900's space is 0.18em.

const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const SCALE = [12, 13, 14, 15, 17, 19];
const FACES = [['Outfit', '600', 'outfit-600.woff2'], ['Outfit', '900', 'outfit-900.woff2'],
  ['Barlow', '400', 'barlow-400.woff2'], ['Barlow', '600', 'barlow-600.woff2']];
const ALLOWED_FAMILY = /^(var\(--(disp|display|body)\)|var\(--disp,inherit\)|inherit|'(Outfit|Barlow)','\2 Fallback',system-ui,sans-serif)$/;
const WORDMARK_SEL = /^(\.wordmark|\.brand|\.wm|\.nav-brand|\.logo)$/;

function load() {
  const pages = {};
  for (const f of fs.readdirSync(ROOT).filter((f) => f.endsWith('.html')).sort()) pages[f] = fs.readFileSync(path.join(ROOT, f), 'utf8');
  return {
    pages,
    typeCss: fs.readFileSync(path.join(ROOT, 'assets', 'type.css'), 'utf8'),
    formCss: fs.readFileSync(path.join(ROOT, 'assets', 'lead-form.css'), 'utf8'),
    middleware: fs.readFileSync(path.join(ROOT, 'middleware.js'), 'utf8'),
    fontBytes: Object.fromEntries(FACES.map(([, , file]) => {
      const p = path.join(ROOT, 'fonts', file);
      return [file, fs.existsSync(p) ? fs.readFileSync(p) : null];
    })),
  };
}

const decls = (body) => {
  const d = {};
  for (const m of body.matchAll(/([a-zA-Z-]+)\s*:\s*([^;]+)/g)) d[m[1].trim().toLowerCase()] = m[2].trim();
  return d;
};
const px = (v) => {
  const m = /^(\d*\.?\d+)(rem|px)$/.exec(v || '');
  return m ? parseFloat(m[1]) * (m[2] === 'rem' ? 16 : 1) : null;
};
const live = (s) => s.replace(/^\s*\/\/.*$/gm, '').replace(/<!--[\s\S]*?-->/g, '');

// every CSS rule on a page: inside <style> blocks, plus inline style="" attributes (selector '[inline]')
function rulesOf(html) {
  const out = [];
  for (const block of html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)) {
    const css = block[1].replace(/\/\*[\s\S]*?\*\//g, '');
    for (const m of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) out.push({ sel: m[1].trim(), d: decls(m[2]) });
  }
  for (const m of html.matchAll(/style="([^"]*)"(\s*>\s*<span[^>]*>HALA<\/span>)?/g)) out.push({ sel: m[2] ? '[wordmark]' : '[inline]', d: decls(m[1]) });
  return out;
}

function checkRules(where, rules, fails, counts) {
  const display = new Set(rules.filter((r) => /var\(--(disp|display)/.test(r.d['font-family'] || '')).map((r) => r.sel));
  for (const { sel, d } of rules) {
    const wordmark = sel === '[wordmark]' || WORDMARK_SEL.test(sel);
    if (d['font-family']) {
      counts.families++;
      if (!ALLOWED_FAMILY.test(d['font-family'].replace(/\s+/g, '').replace(/"/g, "'")) && !/monospace/.test(d['font-family']))
        fails.push(`${where} ${sel}: font-family ${d['font-family']} is not one of the two type tokens`);
    }
    if (d.font && !/var\(--body\)|monospace/.test(d.font)) fails.push(`${where} ${sel}: font shorthand ${d.font} skips the type tokens`);
    const w = d['font-weight'];
    if (w) {
      counts.weights++;
      if (!['400', '600', '900'].includes(w)) fails.push(`${where} ${sel}: weight ${w} (the system has 400, 600 and 900)`);
      else if (w === '900' && !wordmark) fails.push(`${where} ${sel}: weight 900 is the wordmark's only`);
    }
    if (wordmark && w === '900') {
      counts.wordmarks++;
      if (!/^\.\d+em$|^0?\.\d+em$/.test(d['word-spacing'] || '')) fails.push(`${where} ${sel}: wordmark without word-spacing, HALA and MOVE run together`);
      if (!/var\(--disp/.test(d['font-family'] || '') && !/Outfit/.test(d['font-family'] || '')) fails.push(`${where} ${sel}: wordmark not in Outfit`);
    }
    const ls = d['letter-spacing'];
    const isDisp = display.has(sel);
    const caps = (d['text-transform'] || '').toLowerCase() === 'uppercase';
    if (ls && /^\d*\.?\d+em$/.test(ls) && parseFloat(ls) > 0 && !caps && !wordmark)
      fails.push(`${where} ${sel}: ${isDisp ? 'heading' : 'mixed-case text'} letter-spaced out (${ls})`);
    const size = px(d['font-size']);
    if (size !== null && size < 20 && !isDisp && !wordmark && sel !== '[inline]' && !/^(html|body)$/.test(sel)) {
      counts.sizes++;
      if (!SCALE.includes(Math.round(size * 100) / 100)) fails.push(`${where} ${sel}: text size ${size}px is off the scale ${SCALE.join('/')}`);
      if (/(input|select|textarea)(?![\w-])/.test(sel) && size < 16) fails.push(`${where} ${sel}: form field at ${size}px (iOS zooms into it)`);
    }
  }
}

function check(x) {
  const fails = [];
  const counts = { pages: 0, families: 0, weights: 0, wordmarks: 0, sizes: 0, faces: 0 };
  // 1. faces
  for (const [fam, w, file] of FACES) {
    const rx = new RegExp(`@font-face\\{font-family:'${fam}';font-style:normal;font-weight:${w};font-display:swap;src:url\\(/fonts/${file.replace('.', '\\.')}\\) format\\('woff2'\\)\\}`);
    if (!rx.test(x.typeCss)) fails.push(`type.css: no ${fam} ${w} face from /fonts/${file} with font-display swap`);
    const b = x.fontBytes[file];
    if (!b) fails.push(`fonts/${file} is missing`);
    else if (b.slice(0, 4).toString('latin1') !== 'wOF2') fails.push(`fonts/${file} is not a woff2 file`);
    else if (b.length > 40000) fails.push(`fonts/${file} is ${b.length} bytes (a latin subset is under 40 KB)`);
    else counts.faces++;
  }
  const declared = [...x.typeCss.matchAll(/@font-face\{font-family:'(Outfit|Barlow)';/g)].length;
  if (declared !== FACES.length) fails.push(`type.css declares ${declared} brand faces, the system has ${FACES.length}`);
  // 2 to 6, per page
  for (const [f, html] of Object.entries(x.pages)) {
    counts.pages++;
    const l = live(html);
    if (!/<link rel="stylesheet" href="\/assets\/type\.css">/.test(html)) fails.push(`${f}: does not link /assets/type.css`);
    for (const bad of ['fonts.googleapis.com', 'fonts.gstatic.com', 'Syne', 'Plus Jakarta'])
      if (l.includes(bad)) fails.push(`${f}: still names ${bad}`);
    if (/font-style:\s*italic/.test(l)) fails.push(`${f}: italic text, and no italic face is loaded (the browser fakes the slant)`);
    checkRules(f, rulesOf(html), fails, counts);
  }
  const formRules = [...x.formCss.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((m) => ({ sel: m[1].trim(), d: decls(m[2]) }));
  checkRules('lead-form.css', formRules, fails, counts);
  if (/Google Fonts/.test(x.pages['cookie-policy.html'] || '')) fails.push('cookie-policy.html: still lists Google Fonts, which the site no longer calls');
  const card = x.middleware.slice(x.middleware.indexOf('function cardPage'), x.middleware.indexOf('function cardPage') + 4000);
  if (!card.includes('<link rel="stylesheet" href="/assets/type.css">')) fails.push('middleware.js /card page does not link /assets/type.css');
  if (/fonts\.googleapis|fonts\.gstatic/.test(card)) fails.push('middleware.js /card page still loads Google Fonts');
  if (counts.pages === 0 || counts.sizes === 0 || counts.wordmarks === 0) fails.push('nothing was checked (an empty read is not a pass)');
  return { fails, counts };
}

const real = load();
const { fails, counts } = check(real);

const proveFails = [];
if (process.argv.includes('--prove')) {
  const page = (f, from, to) => (x) => ({ ...x, pages: { ...x.pages, [f]: x.pages[f].replace(from, to) } });
  const breaks = [
    ['Google Fonts link back on the home page', page('index.html', '<link rel="stylesheet" href="/assets/type.css">', '<link href="https://fonts.googleapis.com/css2?family=Syne:wght@800" rel="stylesheet">')],
    ['Syne set as the heading token', page('about.html', "--disp:'Outfit','Outfit Fallback',system-ui,sans-serif", "--disp:'Syne',sans-serif")],
    ['a 700 weight on a home page rule', page('index.html', /(\.step-title\{[^}]*?)font-weight:600/, '$1font-weight:700')],
    ['a 900 weight on a heading', page('refund.html', /(\.amount\{[^}]*?)font-weight:600/, '$1font-weight:900')],
    ['an 11px caption', page('index.html', /(\.store-note\{[^}]*?)font-size:[^;]+/, '$1font-size:.6875rem')],
    ['a size off the scale', page('faq.html', /(\.nav-links a\{[^}]*?)font-size:[^;]+/, '$1font-size:.85rem')],
    ['a heading spaced out', page('index.html', /(\.h2\{[^}]*?)letter-spacing:[^;]+/, '$1letter-spacing:.01em')],
    ['mixed-case text spaced out', page('index.html', /(\.stat-label\{[^}]*?)letter-spacing:[^;]+/, '$1letter-spacing:.04em')],
    ['the wordmark loses its word space', page('paid.html', /(\.wordmark\{[^}]*?);word-spacing:\.12em/, '$1')],
    ['italic text with no italic face', page('about.html', /(\.testi-quote\{[^}]*?)flex:1/, '$1font-style:italic;flex:1')],
    ['a page without the type stylesheet', page('terms.html', '<link rel="stylesheet" href="/assets/type.css">', '')],
    ['the cookie policy lists Google Fonts again', page('cookie-policy.html', '<td>PayFast</td>', '<td>Google Fonts</td>')],
    ['a form field under 16px', (x) => ({ ...x, formCss: x.formCss.replace(/(\.lf textarea\{[^}]*?)font-size:17px/, '$1font-size:15px') })],
    ['a face file missing', (x) => ({ ...x, fontBytes: { ...x.fontBytes, 'barlow-600.woff2': null } })],
    ['a face loaded without font-display swap', (x) => ({ ...x, typeCss: x.typeCss.replace("font-weight:900;font-display:swap", 'font-weight:900;font-display:block') })],
    ['the /card page back on Google Fonts', (x) => ({ ...x, middleware: x.middleware.replace('<link rel="stylesheet" href="/assets/type.css">', '<link href="https://fonts.googleapis.com/css2?family=Outfit" rel="stylesheet">') })],
  ];
  for (const [label, brk] of breaks) {
    const m = brk(real);
    if (JSON.stringify(m.pages) === JSON.stringify(real.pages) && m.formCss === real.formCss && m.typeCss === real.typeCss
      && m.middleware === real.middleware && m.fontBytes === real.fontBytes) { proveFails.push(`PROVE: "${label}" did not change anything (the break is stale)`); continue; }
    if (check(m).fails.length === 0) proveFails.push(`PROVE: "${label}" stayed green`);
  }
  console.log('  PROVE: ' + (breaks.length - proveFails.length) + '/' + breaks.length + ' breaks turn the check red');
}

fails.concat(proveFails).forEach((f) => console.log('  FAIL ' + f));
console.log(fails.length || proveFails.length ? '  TYPE: FAIL' :
  `  TYPE: ${counts.pages}/${counts.pages} pages, ${counts.faces}/${FACES.length} faces, ${counts.families} families, ${counts.weights} weights, ${counts.sizes} text sizes on the scale, ${counts.wordmarks} wordmarks`);
process.exit(fails.length || proveFails.length ? 1 : 0);
