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
//   4. Text sizes under 20px sit on the scale 12 / 13 / 14 / 15 / 17 / 19 px, nothing under 12px, and a form field
//      never under 16px (iOS zooms the page into a smaller field). Sizes of 20px and up sit on the display scale
//      20 / 24 / 28 / 32 / 40 / 48 / 64 / 80 px. Read from every rule, every inline style, and BOTH ends of a
//      clamp() (2026-11-23: inline styles and clamp() were skipped, and rules in the heading face were exempt, so
//      the home page rendered 19 sizes at 1440 px, 10.9, 15.2, 16, 17.6, 17.9, 18.4, 38.4, 52, 60.8 and 76 among
//      them, with this check green). Left out: the wordmark, a decorative ::before/::after glyph, a relative size
//      (em, %) that follows its parent, and a rule whose classes appear nowhere on the page.
//   5. Headings are never letter-spaced out; mixed-case text is never letter-spaced out (capitals labels may be).
//   6. The wordmark keeps its two words apart (word-spacing on every wordmark rule): Outfit 900's space is 0.18em.
//   7. Every .brand wordmark reads HALA in brand green (#5CB558) and MOVE in white (#FFFFFF), as the brand sets it.
//      Found in Chrome at 390 px: download, creator, invite and driver-invite had the colours reversed (HALA white,
//      MOVE green), and refund, track and reset-password set both words in green.
//   8. A page with its own Content-Security-Policy lets this site's stylesheet and fonts load ('self' in style-src
//      and font-src). reset-password's policy blocked both, so it rendered in Arial while every source check passed.
//   9. The reading measure (2026-11-23): 45 to 75 characters a line (Bringhurst). Measured in Chrome at 1440 px, each
//      paragraph graded by its fullest line: the article, service and legal pages ran 98 to 118 characters, every
//      paragraph over 75; the home page's closing line 93 and its business cards 88; the delete-account cards 101.
//      Barlow sets about 2.5 characters to the em, so a measure in em holds the count at any text size, and a measure
//      in px or rem gives a different count at every size. So: type.css holds .prose p and .prose li to a measure in
//      em; any max-width on running text (p, li, dd, a lede or sub line, inline or in a rule) is in em and at most
//      30em; the named reading blocks below carry one. After: 0 paragraphs over 75 on the pages above.

const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const SCALE = [12, 13, 14, 15, 17, 19];
const DISPLAY = [20, 24, 28, 32, 40, 48, 64, 80];
const FACES = [['Outfit', '600', 'outfit-600.woff2'], ['Outfit', '900', 'outfit-900.woff2'],
  ['Barlow', '400', 'barlow-400.woff2'], ['Barlow', '600', 'barlow-600.woff2']];
const ALLOWED_FAMILY = /^(var\(--(disp|display|body)\)|var\(--disp,inherit\)|inherit|'(Outfit|Barlow)','\2 Fallback',system-ui,sans-serif)$/;
const WORDMARK_SEL = /^(\.wordmark|\.brand|\.wm|\.nav-brand|\.logo)$/;
const MEASURE_EM = [22, 30];
// running text: the last compound of a selector is a paragraph-like element or a lede/sub line
const TEXT_SEL = /(^|[\s>+~])(p|li|dd|blockquote)$|\.(hero-sub|app-cta-sub|sub|lede|lead|intro)$/;
// reading blocks that must carry a measure: [page, selector, unit, at most]
const MEASURED = [['index.html', '.hero-sub', 'em', 30], ['index.html', '.sub', 'em', 30], ['index.html', '.app-cta-sub', 'em', 30],
  ['index.html', '.biz-feat p', 'em', 30], ['delete-account.html', '.wrap', 'rem', 33]];

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

function checkRules(where, rules, fails, counts, markup) {
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
    if (wordmark && w && w !== '900') fails.push(`${where} ${sel}: wordmark at weight ${w}, the brand sets it in Outfit Black 900`);
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
    const raw = d['font-size'];
    if (raw && !wordmark && !/^(html|body)$/.test(sel) && !(markup !== undefined && deadRule(sel, markup))) {
      const ends = sizeEnds(raw);
      const decorative = /::?(before|after)\b/.test(sel) && d.content !== undefined;
      for (const size of ends) {
        const s = Math.round(size * 100) / 100;
        const of = ends.length > 1 ? ` (an end of ${raw})` : '';
        if (size < 20) {
          counts.sizes++;
          if (!SCALE.includes(s)) fails.push(`${where} ${sel}: text size ${s}px${of} is off the scale ${SCALE.join('/')}`);
          if (/(input|select|textarea)(?![\w-])/.test(sel) && size < 16) fails.push(`${where} ${sel}: form field at ${s}px (iOS zooms into it)`);
        } else if (!decorative) {
          counts.display++;
          if (!DISPLAY.includes(s)) fails.push(`${where} ${sel}: display size ${s}px${of} is off the display scale ${DISPLAY.join('/')}`);
        }
      }
    }
  }
}

// font-size as px at each end: a plain rem/px value, or both ends of a clamp(); a relative value (em, %, a keyword)
// follows its parent and is not a size of its own
function sizeEnds(v) {
  const t = (v || '').trim().replace(/\s*!important$/, '');
  const c = /^clamp\(([^,]+),([^,]+),([^)]+)\)$/.exec(t);
  if (c) return [px(c[1].trim()), px(c[3].trim())].filter((n) => n !== null);
  const n = px(t);
  return n === null ? [] : [n];
}

// a rule whose class names appear nowhere in the page's markup or scripts styles nothing on that page
function deadRule(sel, markup) {
  const toks = [...sel.matchAll(/\.([a-zA-Z][\w-]*)/g)].map((m) => m[1]);
  if (!toks.length) return false;
  return !toks.some((t) => new RegExp('(^|[^\\w-])' + t + '([^\\w-]|$)').test(markup));
}

function check(x) {
  const fails = [];
  const counts = { pages: 0, families: 0, weights: 0, wordmarks: 0, sizes: 0, display: 0, faces: 0, brandMarks: 0, measures: 0 };
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
    const csp = (html.match(/<meta http-equiv="Content-Security-Policy" content="([^"]+)"/) || [])[1];
    if (csp) {
      const dir = {};
      csp.split(';').map((d) => d.trim()).filter(Boolean).forEach((d) => { const [k, ...v] = d.split(/\s+/); dir[k] = v; });
      for (const k of ['style-src', 'font-src'])
        if (!(dir[k] || dir['default-src'] || []).includes("'self'")) fails.push(`${f}: its Content-Security-Policy blocks ${k === 'font-src' ? '/fonts' : '/assets/type.css'}, so the page renders in Arial`);
    }
    checkRules(f, rulesOf(html), fails, counts, live(html).replace(/<style[^>]*>[\s\S]*?<\/style>/g, ''));
  }
  const formRules = [...x.formCss.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((m) => ({ sel: m[1].trim(), d: decls(m[2]) }));
  checkRules('lead-form.css', formRules, fails, counts);
  if (/Google Fonts/.test(x.pages['cookie-policy.html'] || '')) fails.push('cookie-policy.html: still lists Google Fonts, which the site no longer calls');
  // 7. wordmark colours: HALA green, MOVE white
  for (const [f, html] of Object.entries(x.pages)) {
    const marks = html.match(/class="brand"[^>]*>/g) || [];
    if (!marks.length) continue;
    const css = live(html).replace(/\s+/g, '');
    const token = (name) => (new RegExp('--' + name + ':(#[0-9A-Fa-f]{6})').exec(css) || [])[1];
    const colour = (v) => (v && v.startsWith('var(--') ? token(v.slice(6, -1)) : v || '').toUpperCase();
    const rule = (sel) => (new RegExp('(?:^|[}\\s])' + sel.replace(/\./g, '\\.') + '\\{([^}]*)\\}').exec(css) || [])[1];
    const colourOf = (sel) => { const b = rule(sel); const c = b && /(?:^|;)color:([^;}]+)/.exec(b); return c ? c[1] : null; };
    for (const m of html.matchAll(/class="brand"[^>]*>([\s\S]{0,20000}?)<\/(?:a|div)>/g)) {
      counts.brandMarks++;
      const inner = m[1].replace(/<svg[\s\S]*?<\/svg>/g, '').replace(/^\s*<span class="wm">([\s\S]*)<\/span>\s*$/, '$1').trim();
      const tag = /^<(span|b)>HALA<\/\1> MOVE$/.exec(inner);
      if (!tag) { fails.push(`${f}: wordmark markup "${inner.slice(0, 60)}" (HALA in its own green element, MOVE after it)`); continue; }
      const holder = /class="wm"/.test(m[1]) ? '.wm' : '.brand';
      const hala = colourOf(`${holder}${tag[1]}`) || colourOf(`.brand${tag[1]}`);
      const move = colourOf(holder) || colourOf('.brand');
      if (colour(hala) !== '#5CB558') fails.push(`${f}: HALA in the wordmark is ${hala || 'unset'}, the brand sets #5CB558`);
      if (colour(move) !== '#FFFFFF') fails.push(`${f}: MOVE in the wordmark is ${move || 'unset'}, the brand sets #FFFFFF`);
    }
  }
  // 9. the reading measure
  const unitOf = (v, u) => { const m = new RegExp('^(\\d*\\.?\\d+)' + u + '$').exec((v || '').trim()); return m ? parseFloat(m[1]) : null; };
  const typeRules = [...x.typeCss.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((m) => ({ sel: m[1].trim(), d: decls(m[2]) }));
  const measure = typeRules.find((r) => r.sel.split(',').map((s) => s.trim()).includes('.prose p') && r.sel.split(',').map((s) => s.trim()).includes('.prose li'));
  const mEm = measure ? unitOf(measure.d['max-width'], 'em') : null;
  if (mEm === null) fails.push('type.css: .prose p and .prose li carry no reading measure (a max-width in em)');
  else if (mEm < MEASURE_EM[0] || mEm > MEASURE_EM[1]) fails.push(`type.css: the reading measure is ${mEm}em, outside ${MEASURE_EM.join(' to ')}em (45 to 75 characters)`);
  else counts.measures++;
  const textMax = (where, sel, v) => {
    if (!v || /^(none|100%)$/.test(v.trim())) return;
    const n = unitOf(v, 'em');
    if (n === null) fails.push(`${where} ${sel}: running text held to max-width ${v}; set the measure in em, so it holds the same characters at any size`);
    else if (n > MEASURE_EM[1]) fails.push(`${where} ${sel}: running text at max-width ${v}, wider than ${MEASURE_EM[1]}em (over 75 characters a line)`);
    else counts.measures++;
  };
  const allRules = (html) => {
    const out = [];
    for (const block of html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g))
      for (const m of block[1].replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/([^{}]+)\{([^{}]*)\}/g)) out.push({ sel: m[1].trim(), d: decls(m[2]) });
    return out;
  };
  for (const [f, html] of Object.entries(x.pages)) {
    const rules = allRules(live(html));
    for (const r of rules) if (r.d['max-width'] && r.sel.split(',').some((s) => TEXT_SEL.test(s.trim()))) textMax(f, r.sel, r.d['max-width']);
    for (const m of live(html).matchAll(/<p\b[^>]*\sstyle="([^"]*)"/g)) { const d = decls(m[1]); if (d['max-width']) textMax(f, '<p style>', d['max-width']); }
  }
  for (const [f, sel, u, most] of MEASURED) {
    const rules = allRules(live(x.pages[f] || ''));
    const r = rules.filter((q) => q.sel.split(',').map((s) => s.trim()).includes(sel) && q.d['max-width']).pop();
    const n = r ? unitOf(r.d['max-width'], u) : null;
    if (n === null || n > most) fails.push(`${f} ${sel}: no reading measure (max-width in ${u}, at most ${most}${u})`);
  }
  const card = x.middleware.slice(x.middleware.indexOf('function cardPage'), x.middleware.indexOf('function cardPage') + 4000);
  if (!card.includes('<link rel="stylesheet" href="/assets/type.css">')) fails.push('middleware.js /card page does not link /assets/type.css');
  if (/fonts\.googleapis|fonts\.gstatic/.test(card)) fails.push('middleware.js /card page still loads Google Fonts');
  if (counts.pages === 0 || counts.sizes === 0 || counts.wordmarks === 0 || counts.measures === 0) fails.push('nothing was checked (an empty read is not a pass)');
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
    ['the wordmark colours reversed on the invite page', page('invite.html', 'class="brand"><span>HALA</span> MOVE', 'class="brand">HALA <span>MOVE</span>')],
    ['the wordmark all green on the tracking page', page('track.html', 'color:var(--text);font-family:var(--disp);word-spacing:.12em}', 'color:var(--green);font-family:var(--disp);word-spacing:.12em}')],
    ['the reset page blocks its own fonts again', page('reset-password.html', "font-src 'self'; ", '')],
    ['the reset page blocks its own stylesheet again', page('reset-password.html', "style-src 'self' 'unsafe-inline'", "style-src 'unsafe-inline'")],
    ['the quote wordmark dropped to 600', page('quote.html', '.wm{font-family:var(--display);font-weight:900', '.wm{font-family:var(--display);font-weight:600')],
    ['HALA off-green in the quote wordmark', page('quote.html', '.wm b{color:var(--g)}', '.wm b{color:#FFFFFF}')],
    ['MOVE set off-white on the download page', page('download.html', /(\.brand \{[^}]*?)color: #FFFFFF;/, '$1color: var(--text);')],
    ['the reading measure taken out of type.css', (x) => ({ ...x, typeCss: x.typeCss.replace('.prose p,.prose li,.prose dd{max-width:28em}', '') })],
    ['the reading measure widened to 40em', (x) => ({ ...x, typeCss: x.typeCss.replace('.prose p,.prose li,.prose dd{max-width:28em}', '.prose p,.prose li,.prose dd{max-width:40em}') })],
    ['an article lede held in px again', page('terms.html', 'max-width:28em;line-height:1.6"', 'max-width:560px;line-height:1.6"')],
    ['a section sub line at 34em', page('privacy.html', '.sub{font-size:1.0625rem;color:var(--t2);line-height:1.6;max-width:28em}', '.sub{font-size:1.0625rem;color:var(--t2);line-height:1.6;max-width:34em}')],
    ['the home closing line loses its measure', page('index.html', ';max-width:28em;text-wrap:balance}', ';text-wrap:balance}')],
    ['the delete-account column back to 720px', page('delete-account.html', '.wrap{ max-width:33rem;', '.wrap{ max-width:720px;')],
    ['an inline size off the scale (the footer print at 11.5px)', page('terms.html', 'font-size:.75rem;color:var(--t3);line-height:1.6"><p style="max-width:28em">', 'font-size:.72rem;color:var(--t3);line-height:1.6"><p style="max-width:28em">')],
    ['a clamp() end off the scale (the hero line at 15.7 to 17.9px)', page('index.html', '.hero-sub{font-size:clamp(1.0625rem,2vw,1.1875rem)', '.hero-sub{font-size:clamp(.98rem,2vw,1.12rem)')],
    ['a heading-face rule under 20px off the scale', page('index.html', 'font-family:var(--disp);font-size:1.0625rem;font-weight:600;color:var(--g)', 'font-family:var(--disp);font-size:1.1rem;font-weight:600;color:var(--g)')],
    ['the home hero back at 76px', page('index.html', '.hero-h1{font-size:clamp(3rem,10vw,5rem)', '.hero-h1{font-size:clamp(3rem,10vw,4.75rem)')],
    ['a plain display size off the scale', page('delete-account.html', 'h1{ font-size:28px;', 'h1{ font-size:26px;')],
    ['a live page title off the scale (not taken for a dead rule)', page('terms.html', 'font-size:clamp(2.5rem,5vw,4rem)', 'font-size:clamp(2.4rem,5vw,4rem)')],
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
  `  TYPE: ${counts.pages}/${counts.pages} pages, ${counts.faces}/${FACES.length} faces, ${counts.families} families, ${counts.weights} weights, ${counts.sizes} text sizes on the scale, ${counts.display} display sizes on the display scale, ${counts.wordmarks} wordmarks, ${counts.brandMarks} brand marks HALA green and MOVE white, ${counts.measures} reading measures in em`);
process.exit(fails.length || proveFails.length ? 1 : 0);
