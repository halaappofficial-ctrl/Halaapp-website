#!/usr/bin/env node
'use strict';

// -- verify-copy ----------------------------------------------------------------------------------------------------
//
//   node verify-copy.cjs           # exit 0 = no page carries the green dash, a dash in its words, or negation used
//                                  #          as emphasis
//   node verify-copy.cjs --prove   # also runs the golden pairs: every bad line must go red, every good line green
//
// THE STANDARD (2026-11-17): "one more thing that screams AI on our website in the em dash green which is there and
// you always writing content starting sentences with words such as 'NOT' anytime you are trying to reinforce or
// assert a point ... we have to be natural", then: "the Not openers exist but not only those, also other siblings of
// the same kind". Natural writing states what is true. It does not assert by denying a straw man ("Not a pilot, but
// a launch"), stack fragments for drama ("No calls. No cash. No waiting."), or hang a point off a dash.
//
// What this reads, on every page: the visible text, the title, every meta description and title, image alt text,
// aria-label, placeholder and title attributes, the structured data Google reads (ld+json names, descriptions and
// FAQ answers), and text a script writes onto the page (textContent, innerHTML, innerText, showToast).
// HTML comments, CSS and script logic are not read: nobody sees them.
//
// What fails:
//   green-dash   a short decorative green rule drawn by a ::before / ::after with empty content (the "eyebrow" dash)
//   dash         an em dash or en dash in the words, as a character or an entity (&mdash; &ndash; &#8212; &#8211;)
//   opener       a sentence that opens with Not / No / Never / Nothing / Nobody / None / Zero / Without / Neither /
//                Nor / Forget / Stop to make its point
//   tail         "X, not Y" contrast tails
//   notjust      not just / not only / more than just
//   reframe      "isn't X, it's Y" and its siblings
//   nomore       "No more X" and a tacked-on ", no X." fragment
//   insteadof    "instead of" / "rather than" foils
//   notbut       "not by X, but by Y" anywhere in a sentence
//   label        a middot-joined label that opens with a negative ("20% commission, middot, no monthly fee")
//   staccato     three fragments in a row of five words or fewer, or two short sentences opening on the same word
//
// A line that must stay as written (a founders' decision still open, contract wording) goes in ALLOW with its
// reason. An ALLOW entry that no longer matches anything fails too, so the list cannot rot.

const fs = require('fs');
const path = require('path');
const ROOT = __dirname;

const RULES = [
  { id: 'opener', re: /(?:^|[.!?|:]\s+|["(]\s*)((?:Not|No|Never|Nothing|Nobody|None|Zero|Without|Neither|Nor|Forget|Stop)\b[^.!?|]{0,400}[.!?])/g },
  { id: 'tail', re: /([^.!?|]{0,80}[,;]\s+not\s+(?!only\b|just\b)[^.!?|]{1,80}[.!?])/gi },
  { id: 'notjust', re: /([^.!?|]{0,60}\b(?:not just|not only|more than just|isn't just|aren't just|is not just|are not just)\b[^.!?|]{0,80})/gi },
  { id: 'reframe', re: /([^.!?|]{0,60}\b(?:isn't|is not|aren't|are not|wasn't|it's not|we're not|we are not|this is not|that's not|doesn't|does not|don't|do not|won't|will not)\b[^.!?|]{0,60}[.;,:]\s*(?:it's|it is|we're|we are|they're|they are|it|this|that|instead|but|rather)\b[^.!?|]{0,80}[.!?])/gi },
  { id: 'nomore', re: /(\bno more\b[^.!?|]{0,80}|[^.!?|]{0,60},\s+no\s+[a-z]+(?:\s[a-z]+)?[.!?])/gi },
  { id: 'insteadof', re: /([^.!?|]{0,60}\b(?:instead of|rather than)\b[^.!?|]{0,80})/gi },
  { id: 'notbut', re: /([^.!?|]{0,60}\bnot (?:by|as|because|for|in|to|a|an|the|about|from|with|that|this|your|our)\b[^.!?|]{0,160}\bbut\b[^.!?|]{0,80})/gi },
  { id: 'label', re: /(?:\u00b7|&middot;|\s\/\s)\s*((?:no|not|never|zero|without|nothing)\b[^\u00b7|.!?]{0,60})/gi },
  { id: 'dash', re: /([^|]{0,50}[\u2014\u2013][^|]{0,50})/g },
];

// Wrong facts that once shipped. Each names the source that makes it wrong.
const FACTS = [
  { re: /platform base( price)?\b/i, id: 'fact',
    why: 'R150 is the lowest offer a driver can send (backend src/routes/bids.js, min 150), not a base price; the price formula starts at R200 plus R10 a km (src/services/aiPricingService.js). Say "Loads from R150".' },
];

// Lines kept as written, each with the reason. Every entry must still match a line on the site.
// Empty since 2026-11-17, when the founders reworded the two lines it held (the vision, and one Driver Agreement
// sentence). Add an entry only with the founders' decision, and say whose and when.
const ALLOW = [];

function staccato(text) {
  const sents = text.split(/(?<=[.!?])\s+|\s*\|\s*/).map((s) => s.trim()).filter(Boolean);
  const hits = [];
  const words = (s) => s.split(/\s+/).length;
  for (let i = 0; i + 2 < sents.length; i++) {
    if ([0, 1, 2].every((k) => words(sents[i + k]) <= 5 && /[.!]$/.test(sents[i + k]))) hits.push(sents.slice(i, i + 3).join(' '));
  }
  for (let i = 0; i + 1 < sents.length; i++) {
    const a = sents[i].split(/\s+/), b = sents[i + 1].split(/\s+/);
    if (a.length <= 8 && b.length <= 8 && a[0] === b[0] && /^[A-Z]/.test(a[0]) && !/^(The|A|An|HALA)$/.test(a[0])
      && /[.!]$/.test(sents[i])) hits.push(sents[i] + ' ' + sents[i + 1]);
  }
  return [...new Set(hits)];
}

function scan(text) {
  const out = [];
  for (const r of RULES) for (const m of text.matchAll(r.re)) out.push({ rule: r.id, text: (m[1] || m[0]).trim() });
  for (const s of staccato(text)) out.push({ rule: 'staccato', text: s });
  return out;
}

const decode = (s) => s
  .replace(/&mdash;|&#8212;|&#x2014;/gi, '\u2014').replace(/&ndash;|&#8211;|&#x2013;/gi, '\u2013')
  .replace(/&rsquo;|&lsquo;|&#8217;|&#8216;|&#39;|&apos;/g, "'").replace(/&ldquo;|&rdquo;|&#8220;|&#8221;|&quot;/g, '"')
  .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&[a-z]+;|&#\d+;/gi, ' ');

const BLOCK = /<(br|\/?p|\/?h[1-6]|\/?li|\/?ul|\/?ol|\/?div|\/?section|\/?header|\/?footer|\/?nav|\/?main|\/?article|\/?aside|\/?table|\/?tr|\/td|\/th|\/a|\/button|\/figcaption|\/label|\/summary|\/details|\/dt|\/dd|\/blockquote)\b[^>]*>/gi;

// Every piece of text a reader or a search engine sees, each with where it came from.
function extract(html) {
  const parts = [];
  const add = (where, s) => { const t = decode(s).replace(/\s+/g, ' ').trim(); if (t) parts.push({ where, text: t }); };
  const noComments = html.replace(/<!--[\s\S]*?-->/g, ' ');
  // structured data
  for (const m of noComments.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    let data;
    try { data = JSON.parse(m[1]); } catch (e) { parts.push({ where: 'ld+json', text: '', invalid: e.message }); continue; }
    (function walk(v, key) {
      if (typeof v === 'string') { if (/^(name|description|text|headline|caption|slogan|alternateName|disambiguatingDescription)$/.test(key)) add('ld+json ' + key, v); return; }
      if (Array.isArray(v)) { v.forEach((x) => walk(x, key)); return; }
      if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) walk(x, k);
    })(data, '');
  }
  // text a script puts on the page
  for (const m of noComments.matchAll(/<script\b(?![^>]*ld\+json)[^>]*>([\s\S]*?)<\/script>/gi)) {
    for (const s of m[1].matchAll(/(?:textContent|innerHTML|innerText)\s*=\s*(['"`])((?:\\.|(?!\1).)*)\1|showToast\(\s*(['"`])((?:\\.|(?!\3).)*)\3/g)) {
      const raw = (s[2] !== undefined ? s[2] : s[4]).replace(/\\(['"`])/g, '$1');
      add('script text', raw.replace(/<[^>]+>/g, ' '));
    }
  }
  const body = noComments.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ');
  for (const m of body.matchAll(/<title>([\s\S]*?)<\/title>/gi)) add('title', m[1]);
  for (const m of body.matchAll(/<meta\b[^>]*>/gi)) {
    const tag = m[0];
    const name = (tag.match(/\b(?:name|property)=["']([^"']+)["']/i) || [])[1] || '';
    const content = (tag.match(/\bcontent=(["'])([\s\S]*?)\1/i) || [])[2];
    if (content !== undefined && /^(description|og:title|og:description|og:image:alt|twitter:title|twitter:description|twitter:image:alt)$/i.test(name)) add('meta ' + name, content);
  }
  for (const m of body.matchAll(/\s(alt|aria-label|placeholder|title)=(["'])([^"']*)\2/gi)) add(m[1], m[3]);
  add('page', body.replace(/<title>[\s\S]*?<\/title>/gi, ' ').replace(BLOCK, ' | ').replace(/<[^>]+>/g, ' '));
  return parts;
}

// The decorative green rule: an empty ::before/::after, a short width, a hairline height, a green fill.
function greenDashes(html) {
  const css = [...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)].map((m) => m[1]).join('\n');
  const out = [];
  for (const m of css.matchAll(/([^{}]*::?(?:before|after)[^{}]*)\{([^}]*)\}/gi)) {
    const d = m[2].replace(/\s+/g, '');
    const h = d.match(/(?:^|;)height:([\d.]+)px/); const w = d.match(/(?:^|;)width:([\d.]+)px/);
    if (/content:(''|"")/.test(d) && h && +h[1] <= 3 && w && +w[1] >= 8 && +w[1] <= 64
      && /background(?:-color)?:(var\(--(g|green|accent|primary)\)|#5cb558|#4caf50)/i.test(d)) out.push(m[1].trim() + '{' + m[2].trim() + '}');
  }
  return out;
}

const fails0 = [];
function check(pages) {
  const fails = [];
  const used = new Set();
  for (const [file, html] of Object.entries(pages)) {
    for (const g of greenDashes(html)) fails.push(`${file}: green-dash  ${g.slice(0, 140)}`);
    for (const p of extract(html)) {
      if (p.invalid) { fails.push(`${file}: ld+json does not parse (${p.invalid})`); continue; }
      for (const f of FACTS) { const m = p.text.match(f.re); if (m) fails.push(`${file}: fact      [${p.where}] "${m[0]}" - ${f.why}`); }
      for (const h of scan(p.text)) {
        const a = ALLOW.find((x) => h.text.includes(x.text) || x.text.includes(h.text));
        if (a) { used.add(a.text); continue; }
        fails.push(`${file}: ${h.rule.padEnd(9)} [${p.where}] ${h.text.slice(0, 170)}`);
      }
    }
  }
  return { fails, used };
}

// Two plain files people and machines also read: llms.txt (what AI assistants are told about HALA MOVE) and the
// image titles in sitemap.xml (what image search shows). Each is turned into paragraphs and read like a page.
function asPage(file, raw) {
  const esc = (s) => s.replace(/&(?![a-z]+;|#\d+;)/gi, '&amp;').replace(/</g, '&lt;');
  if (file === 'llms.txt') {
    return raw.split(/\r?\n/).map((l) => l.replace(/\[([^\]]*)\]\([^)]*\)/g, '$1').replace(/^\s*(#+|>|[-*])\s*/, '').replace(/\*\*/g, ''))
      .filter((l) => l.trim()).map((l) => `<p>${esc(l)}</p>`).join('\n');
  }
  return [...raw.matchAll(/<image:(?:title|caption)>([\s\S]*?)<\/image:(?:title|caption)>/g)].map((m) => `<p>${m[1]}</p>`).join('\n');
}

const files = fs.readdirSync(ROOT).filter((f) => f.endsWith('.html'));
const pages = Object.fromEntries(files.map((f) => [f, fs.readFileSync(path.join(ROOT, f), 'utf8')]));
for (const f of ['llms.txt', 'sitemap.xml']) {
  if (fs.existsSync(path.join(ROOT, f))) pages[f] = asPage(f, fs.readFileSync(path.join(ROOT, f), 'utf8'));
  else fails0.push(`${f} is missing`);
}
const real = check(pages);
const fails = [...fails0, ...real.fails];
for (const a of ALLOW) if (!real.used.has(a.text)) fails.push(`ALLOW entry matches nothing any more, remove it: "${a.text}"`);
if (files.length === 0) fails.push('no pages found to read');

const proveFails = [];
if (process.argv.includes('--prove')) {
  const wrap = (s) => `<html><head><title>T | HALA MOVE</title></head><body><p>${s}</p></body></html>`;
  const BAD = [
    ['dash (character)', wrap('Post your load \u2014 drivers send offers.')],
    ['dash (entity)', wrap('Post your load &mdash; drivers send offers.')],
    ['dash (number range)', wrap('<table><tr><td>R150 &ndash; R250</td></tr></table>')],
    ['opener Not', wrap('HALA MOVE launched in Durban. Not as a pilot, but as a launch.')],
    ['opener No', wrap('Everything runs in one app. No calls.')],
    ['opener Nobody', wrap('Your cut is fixed. Nobody can lower it without telling you.')],
    ['opener Stop', wrap('<h1>Stop asking around.</h1>')],
    ['tail', wrap('Your verified status is real, not a self-declared checkbox.')],
    ['notjust', wrap('It is not just a dashboard for your fleet.')],
    ['reframe', wrap('Getting paid quickly is not a feature. It is the foundation.')],
    ['nomore', wrap('You see the driver live. No more guessing the ETA.')],
    ['insteadof', wrap('Instead of phoning five companies, you post once.')],
    ['notbut', wrap('HALA MOVE gives drivers a system, not by replacing them but by backing them.')],
    ['staccato', wrap('Verified drivers. Live GPS tracking. PayFast escrow.')],
    ['staccato (same opener)', wrap('Your Vehicle. Your Schedule.')],
    ['meta description', '<html><head><meta name="description" content="Book a bakkie \u2014 fast."></head><body></body></html>'],
    ['image alt', '<html><body><img src="a.png" alt="HALA MOVE \u2014 Post. Choose. Move."></body></html>'],
    ['ld+json FAQ answer', '<html><head><script type="application/ld+json">{"@type":"FAQPage","mainEntity":[{"@type":"Question","name":"Q","acceptedAnswer":{"@type":"Answer","text":"No. It does not change."}}]}</script></head><body></body></html>'],
    ['script text', '<html><body><script>el.textContent = \'Copied \u2014 paste it at signup.\';</script></body></html>'],
    ['green dash', '<html><head><style>.eyebrow::after{content:\'\';width:24px;height:1.5px;background:var(--g)}</style></head><body></body></html>'],
    ['broken ld+json', '<html><head><script type="application/ld+json">{"name": "x",}</script></head><body></body></html>'],
    ['label with a negative', wrap('Drivers: 20% commission per job \u00b7 no monthly fee')],
    ['wrong fact: base price', wrap('Loads start at a R150 platform base price.')],
    ['llms.txt line', asPage('llms.txt', '# HALA MOVE \u2014 AI Guidelines\n- **Where**: Durban. Not currently operating elsewhere.')],
    ['sitemap image title', asPage('sitemap.xml', '<image:title>HALA MOVE \u2014 Bakkie Hire Durban</image:title>')],
  ];
  const GOOD = [
    ['plain claim', wrap('Post your load and drivers near you send offers. Your money is held until it arrives.')],
    ['legal negative mid-sentence', wrap('We do not use advertising cookies, track you across other websites, or share your browsing behaviour.')],
    ['range in words', wrap('<table><tr><td>R150 to R250</td></tr></table>')],
    ['hyphenated word', wrap('Same-day delivery with a proof-of-delivery photo.')],
    ['comment and css ignored', '<html><head><style>a::before{content:"\u2014"}</style></head><body><!-- old \u2014 note --><p>Built in Durban.</p></body></html>'],
    ['nav arrow pseudo (not a rule)', '<html><head><style>.x::after{content:\'\';width:24px;height:24px;background:var(--g)}</style></head><body></body></html>'],
    ['question', wrap('Unsure which size you need? Post a photo and drivers will advise.')],
    ['llms.txt link line', asPage('llms.txt', '- [Bakkie hire in Durban](https://www.halamove.co.za/bakkie-hire-durban)')],
  ];
  for (const [label, html] of BAD) if (check({ [label]: html }).fails.length === 0) proveFails.push(`PROVE: bad line "${label}" stayed green`);
  for (const [label, html] of GOOD) { const r = check({ [label]: html }).fails; if (r.length) proveFails.push(`PROVE: good line "${label}" went red: ${r[0]}`); }
  console.log(`  PROVE: ${BAD.length + GOOD.length - proveFails.length}/${BAD.length + GOOD.length} golden lines judged right (${BAD.length} bad, ${GOOD.length} good)`);
}

fails.concat(proveFails).forEach((f) => console.log('  FAIL ' + f));
console.log(fails.length || proveFails.length ? `  COPY: FAIL (${fails.length + proveFails.length})`
  : `  COPY: PASS - ${files.length} pages, no green dash, no dash in the words, no negation used as emphasis${ALLOW.length ? ` (${ALLOW.length} lines held for the founders)` : ""}`);
process.exit(fails.length || proveFails.length ? 1 : 0);
