#!/usr/bin/env node
'use strict';

// -- verify-guides ---------------------------------------------------------------------------------------------------
//
//   node verify-guides.cjs           # exit 0 = the guides page is whole: every guide listed, every step in order,
//                                    #          every screen on disk at the size it claims
//   node verify-guides.cjs --prove   # also breaks each rule in memory and requires the check to go red
//
// THE PAGE (2026-11-24): the four-station figure left the home page; the how-to belongs "under a section of
// button of guides which describes how and steps of using our platforms", on the real screens, "without using generic
// emoji and poor icons on our materials". guides.html shows real HALA MOVE pages with example details.
//
// THE RULES
//   1. The page is in the sitemap.
//   2. The list at the top and the guides on the page match: every listed guide has its section, every section is
//      listed, in the same order.
//   3. Each guide has at least three steps, numbered 1, 2, 3 ... in order with no gap.
//   4. Every picture is a file under /images/guides that exists, in a 300 px and a 600 px width that really are those
//      widths, with alt text, a width and height (no layout shift), and lazy loading. No file in images/guides is
//      left unused.
//   5. The page says the details on the screens are examples (the screens carry sample names, addresses and amounts).
//   6. No emoji and no drawn icons in the guides: the pictures are the screens.
//   7. Goods move, people do not: no "your move", "moving" or "removal" in what the page says (HALA MOVE is
//      infrastructure for goods; the brand name itself is fine).
//   8. The side gutter holds on every block (2026-11-24, found on the phone render: the opening ran to the screen's
//      edge). .wrap gives each block its left and right padding; a class sharing an element with .wrap that sets the
//      padding shorthand (padding: 72px 0 8px) zeroes that gutter on a phone. Those classes set padding-top and
//      padding-bottom only.

const fs = require('fs');
const path = require('path');
const ROOT = __dirname;
const DIR = path.join(ROOT, 'images', 'guides');

function webpWidth(buf) {
  if (buf.toString('ascii', 0, 4) !== 'RIFF' || buf.toString('ascii', 8, 12) !== 'WEBP') return null;
  const kind = buf.toString('ascii', 12, 16);
  if (kind === 'VP8 ') return buf.readUInt16LE(26) & 0x3fff;
  if (kind === 'VP8L') return 1 + (((buf[22] & 0x3f) << 8) | buf[21]);
  if (kind === 'VP8X') return 1 + buf.readUIntLE(24, 3);
  return null;
}

function check({ html, sitemap, files, widthOf }) {
  const fails = [];
  if (!html) return { fails: ['guides.html: missing'], guides: 0, steps: 0, pictures: 0 };
  if (!/<loc>https:\/\/www\.halamove\.co\.za\/guides<\/loc>/.test(sitemap)) fails.push('sitemap.xml: the guides page is not listed');

  const main = (html.match(/<main>[\s\S]*<\/main>/) || [''])[0];
  if (!main) fails.push('guides.html: no <main> (the reader is broken)');
  const index = [...((main.match(/<ul class="index"[\s\S]*?<\/ul>/) || [''])[0]).matchAll(/<a href="#([\w-]+)"/g)].map((m) => m[1]);
  const sections = [...main.matchAll(/<section class="guide wrap" id="([\w-]+)"/g)].map((m) => m[1]);
  if (!sections.length) fails.push('guides.html: no guide found (the reader is broken)');
  if (JSON.stringify(index) !== JSON.stringify(sections)) fails.push('guides.html: the list at the top (' + index.join(', ') + ') does not match the guides on the page (' + sections.join(', ') + ')');

  let steps = 0;
  for (const id of sections) {
    const body = (main.match(new RegExp('<section class="guide wrap" id="' + id + '"[\\s\\S]*?</section>')) || [''])[0];
    const nums = [...body.matchAll(/<span class="n" aria-hidden="true">(\d+)<\/span>/g)].map((m) => Number(m[1]));
    const items = (body.match(/<li class="step">/g) || []).length;
    steps += items;
    if (items < 3) fails.push('#' + id + ': ' + items + ' steps, a guide needs at least 3');
    if (nums.length !== items) fails.push('#' + id + ': ' + items + ' steps but ' + nums.length + ' step numbers');
    nums.forEach((n, i) => { if (n !== i + 1) fails.push('#' + id + ': step ' + (i + 1) + ' is numbered ' + n); });
  }

  const used = new Set();
  const imgs = [...main.matchAll(/<img\b[^>]*>/g)].map((m) => m[0]);
  for (const tag of imgs) {
    const attr = (k) => { const m = tag.match(new RegExp('\\s' + k + '="([^"]*)"')); return m ? m[1] : null; };
    const src = attr('src') || '';
    const name = src.replace(/^\/images\/guides\//, '');
    if (!src.startsWith('/images/guides/')) { fails.push(src + ': a picture from outside /images/guides'); continue; }
    if (!(attr('alt') || '').trim()) fails.push(src + ': no alt text');
    if (!attr('width') || !attr('height')) fails.push(src + ': no width and height, so the page jumps as it loads');
    if (attr('loading') !== 'lazy') fails.push(src + ': not lazy-loaded');
    const set = [...(attr('srcset') || '').matchAll(/\/images\/guides\/([^\s,]+)\s+(\d+)w/g)].map((m) => [m[1], Number(m[2])]);
    if (set.length !== 2 || set[0][1] !== 300 || set[1][1] !== 600) fails.push(src + ': needs a 300w and a 600w file in srcset');
    for (const [f, w] of [[name, 300], ...set]) {
      used.add(f);
      if (!files.includes(f)) { fails.push(f + ': not on disk'); continue; }
      const real = widthOf(f);
      if (real !== w) fails.push(f + ': claims ' + w + ' px wide, is ' + real);
    }
  }
  for (const f of files) if (!used.has(f)) fails.push('images/guides/' + f + ': on disk but on no step');

  if (!/are examples\./.test(main)) fails.push('guides.html: the line saying the screens carry example details is gone');
  const text = main.replace(/<[^>]+>/g, ' ');
  const emoji = [...text].filter((c) => /\p{Extended_Pictographic}/u.test(c));
  if (emoji.length) fails.push('guides.html: emoji in the guides (' + [...new Set(emoji)].map((c) => 'U+' + c.codePointAt(0).toString(16).toUpperCase()).join(' ') + ')');
  if (/<svg\b|<i class=|class="[^"]*\b(icon|fa-|material-icons)/.test(main)) fails.push('guides.html: a drawn icon in the guides, where the pictures should be the screens');
  const moving = text.replace(/HALA MOVE/g, '').match(/\b(your move|my move|moves?|moving|removals?)\b/gi);
  if (moving) fails.push('guides.html: says "' + moving[0] + '"; goods are delivered, the guides never call a job a move');
  const css = (html.match(/<style>[\s\S]*?<\/style>/g) || []).join('\n');
  const partners = new Set([...html.matchAll(/class="([^"]*)"/g)].map((m) => m[1].split(/\s+/)).filter((c) => c.includes('wrap')).flat().filter((c) => c !== 'wrap'));
  if (!partners.size) fails.push('guides.html: no block carries .wrap (the reader is broken)');
  for (const c of partners) {
    const re = new RegExp('\\.' + c + '\\s*\\{[^}]*\\bpadding\\s*:');
    if (re.test(css)) fails.push('guides.html: .' + c + ' sets the padding shorthand, which wipes the .wrap side gutter on a phone (use padding-top and padding-bottom)');
  }
  return { fails, guides: sections.length, steps, pictures: imgs.length };
}

const read = (f) => (fs.existsSync(f) ? fs.readFileSync(f, 'utf8') : '');
const real = {
  html: read(path.join(ROOT, 'guides.html')),
  sitemap: read(path.join(ROOT, 'sitemap.xml')),
  files: fs.existsSync(DIR) ? fs.readdirSync(DIR).filter((f) => !f.startsWith('.')).sort() : [],
  widthOf: (f) => webpWidth(fs.readFileSync(path.join(DIR, f))),
};
const res = check(real);
if (res.guides && !res.pictures) res.fails.push('guides.html: no picture found (the reader is broken)');

const proveFails = [];
if (process.argv.includes('--prove')) {
  const w = (o) => Object.assign({}, real, o);
  const h = (fn) => w({ html: fn(real.html) });
  const breaks = [
    ['the page off the sitemap', w({ sitemap: real.sitemap.replace('<loc>https://www.halamove.co.za/guides</loc>', '') })],
    ['a listed guide with no section', h((s) => s.replace('<li><a href="#fleet">', '<li><a href="#fleet">x</a></li><li><a href="#driver">'))],
    ['a guide left off the list', h((s) => s.replace(/<li><a href="#fleet">[\s\S]*?<\/li>/, ''))],
    ['a step number skipped', h((s) => s.replace('<span class="n" aria-hidden="true">3</span>', '<span class="n" aria-hidden="true">4</span>'))],
    ['a picture with no alt text', h((s) => s.replace(/alt="The Book a delivery page[^"]*"/, 'alt=""'))],
    ['a picture not lazy', h((s) => s.replace('loading="lazy"', 'loading="eager"'))],
    ['a picture that is not on disk', h((s) => s.replace('/images/guides/web-1.v1-300.webp"', '/images/guides/web-0.v1-300.webp"'))],
    ['a file claiming the wrong width', w({ widthOf: (f) => (f === 'web-1.v1-600.webp' ? 780 : real.widthOf(f)) })],
    ['an unused file in the folder', w({ files: real.files.concat(['old-step.v1-300.webp']) })],
    ['the examples line dropped', h((s) => s.replace('are examples.', 'are real.'))],
    ['an emoji in a step', h((s) => s.replace('Choose the offer you want', 'Choose the offer you want \u{1F69A}'))],
    ['a drawn icon in a guide', h((s) => s.replace('<h2 id="web-h">', '<h2 id="web-h"><svg width="16" height="16"></svg>'))],
    ['a job called a move', h((s) => s.replace('Follow each delivery under Your deliveries.', 'Follow your move under Your deliveries.'))],
    ['a block that wipes the side gutter', h((s) => s.replace('.guide { padding-top: 96px;', '.guide { padding: 96px 0 0;'))],
  ];
  for (const [label, mutated] of breaks) {
    const same = mutated.html === real.html && mutated.sitemap === real.sitemap && mutated.files === real.files && mutated.widthOf === real.widthOf;
    if (same) { proveFails.push('PROVE: "' + label + '" changed nothing (the break is stale)'); continue; }
    if (check(mutated).fails.length === 0) proveFails.push('PROVE: "' + label + '" stayed green');
  }
  console.log('  PROVE: ' + (breaks.length - proveFails.length) + '/' + breaks.length + ' breaks turn the check red');
}

res.fails.concat(proveFails).forEach((f) => console.log('  FAIL ' + f));
if (res.fails.length || proveFails.length) { console.log('  GUIDES: FAIL'); process.exit(1); }
console.log('  GUIDES: ' + res.guides + ' guides, ' + res.steps + ' steps in order, ' + res.pictures + ' screens on disk at their sizes');
