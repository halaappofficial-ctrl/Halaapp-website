#!/usr/bin/env node
'use strict';

// -- verify-hero-rail -----------------------------------------------------------------------------
//
//   node verify-hero-rail.cjs           # exit 0 = the home page hero says who we are in a glance and every door works
//   node verify-hero-rail.cjs --prove   # also breaks each rule in memory and requires the check to go red
//
// THE RULE (2026-11-15): the hero is three words, one line and the vehicles. "Once someone's eyes land on any of our
// material they get to know who we are and what problems we are here to solve" - so the reading is capped, and the
// picture (the five vehicle sizes) carries the rest, each leading to the customer app or the driver app.
//
// AMENDED 2026-11-24 (design review item 9, executed on Eric's instruction to carry out every recommendation): the
// brightest thing at first glance was a white card with a bakkie photo (57% of a 1440x900 first screen, 44% of
// 390x844), which reads as bakkie hire. HALA MOVE is the rail goods move on, so the hero now opens on the connection:
// the three words and the line, two doors (Book a move, I'm a driver), then one drawn figure of four stations on a
// line - the store, a checked driver, the doorstep, the record - and the vehicles one step in. The doors keep booking
// on the first screen once the vehicles move down. The record station's figure comes only from the live record
// (recordView() in index.html, driven by verify-record.cjs); the page carries no figure of its own.
//   9. Order: heading, doors, connection, vehicles. Four stations, in order, each an HTML label beside a hidden icon,
//      no link or button inside (a figure, not four tiles), no digit in the markup, at most 30 words.
//  10. The doors: Book goes to the web booking (never rewritten for computers), the driver door to /drive and, on a
//      computer, /download. A motion key used twice leaves the second element hidden, so each key is used once.
//
// What breaks it silently, and is therefore checked here:
//   1. A rail element tagged data-motion-hero-el. assets/motion.js pre-hides every tagged hero element and animates
//      only five named keys, so a tagged rail would sit at opacity 0 for every visitor with JavaScript on.
//   2. A store link without its web- code, or with a code middleware.js would reject (it allows [A-Za-z0-9_-]{1,32})
//      or file as a printed board (any code not starting with a known prefix reads as 'qr').
//   3. A picture that is not on disk, or a size that is not the app's (the five lines are the app's size picker,
//      mirrored in assets/lead-form.js; this compares the two so they cannot drift apart).
//   4. The words creeping back: the hero text (eyebrow, heading, line) stays within 25 words.
//   5. Book going anywhere but the web booking. It answers in production since 2026-11-16 (book.halamove.co.za,
//      200 with a valid certificate), so "Book a move" goes there and is never rewritten for computers (it works in
//      a browser); "or get the app" goes to /get, and computers to /download.
//   6. Movement nobody can stop (rebuilt 2026-11-15 as a studio stage that advances by itself): the frames need a
//      pause button (WCAG 2.2.2), must not move for a visitor who asks for reduced motion, and must hold while the
//      stage is off screen.
//   7. Frames hidden for good: the CSS fades the frames that are not in view only once the script has marked the
//      current one (.rail.is-live), so a page whose script fails still shows every vehicle in full.
//   8. The vehicle as drivers have it (2026-11-17). [ERIC] "drivers such as shaughn love to see there vehicles as they
//      have them either covered or with back cabin trailers", and the website shows what the apps and the booking page
//      show. Each size lists how it comes (open first, then covered and with a trailer): the backend's
//      CATEGORY_VARIANTS (src/constants/vehicleImages.js), mirrored in `vars` below. A size with one way to come has
//      no strip. Each picture is on disk as webp and jpg and carries a description.
//      Every picture's backdrop is pure white (255): the card blends pictures with multiply, so a backdrop of 253 (the
//      backend set's) shows as a faint box around the vehicle. Lift the white point when making a site copy.
//      This gate cannot decode a JPEG to check it; look at the render.

const fs = require('fs');
const path = require('path');
const ROOT = __dirname;
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');

const SIZES = [   // order = the app's TIER_ORDER; image = backend CATEGORY_IMAGE file; vars = backend CATEGORY_VARIANTS
  { code: 'sbak', name: 'Small Bakkie', img: 'half_ton', vars: ['half_ton', 'half_ton_canopy', 'half_ton_trailer'] },
  { code: 'lbak', name: 'Large Bakkie', img: 'one_ton', vars: ['one_ton', 'one_ton_canopy', 'double_cab_trailer'] },
  { code: 'van', name: 'Panel Van', img: 'panel_van', vars: ['panel_van'] },
  { code: '1t', name: '1 Ton Truck', img: 'dropside', vars: ['dropside', 'dropside_box', 'dropside_trailer'] },
  { code: '4t', name: '4 Ton Truck', img: 'box_truck', vars: ['box_truck'] },
];
const MAX_HERO_WORDS = 25;

function strip(html) { return html.replace(/<!--[\s\S]*?-->/g, ''); }

function check(html, leadForm) {
  const fails = [];
  const h = strip(html);
  const a = h.indexOf('<section class="hero"');
  const b = h.indexOf('</section>', a);
  if (a < 0 || b < 0) return ['the hero section is not found'];
  const hero = h.slice(a, b);

  // 1. nothing in the rail is pre-hidden by the motion script
  const r0 = hero.indexOf('<div class="rail-wrap">');
  const r1 = hero.indexOf('<div class="container">', r0);
  if (r0 < 0 || r1 < 0) return ['the vehicle rail is not in the hero'];
  const rail = hero.slice(r0, r1);
  if (/data-motion-hero-el/.test(rail)) fails.push('a rail element carries data-motion-hero-el, so motion.js would keep it hidden');
  const keys = (hero.match(/data-motion-hero-el="([a-z]+)"/g) || []).map((m) => m.split('"')[1]);
  const known = ['eyebrow', 'h1', 'sub', 'cta', 'trust'];
  keys.filter((k) => !known.includes(k)).forEach((k) => fails.push('hero key "' + k + '" is not one motion.js animates, so it stays hidden'));
  keys.filter((k, i) => keys.indexOf(k) !== i).forEach((k) => fails.push('hero key "' + k + '" is used twice; motion.js animates only the first, so the second stays hidden'));

  // 9 + 10. the opening: heading, two doors, the connection, then the vehicles
  const d0 = hero.indexOf('<div class="hero-doors"');
  const c0 = hero.indexOf('<ol class="conn"');
  const c1 = c0 < 0 ? -1 : hero.indexOf('</ol>', c0);
  if (d0 < 0) fails.push('the hero has no doors, so booking leaves the first screen with the vehicles');
  if (c0 < 0 || c1 < 0) fails.push('the hero does not open on the connection');
  if (d0 >= 0 && c0 >= 0 && !(d0 < c0 && c1 < r0)) fails.push('the hero must read heading, doors, connection, then the vehicles');
  if (d0 >= 0) {
    const doors = hero.slice(d0, c0 > d0 ? c0 : r0);
    const links = [...doors.matchAll(/<a ([^>]*)>([^<]+)<\/a>/g)].map((m) => ({ attrs: m[1], label: m[2].trim(), href: (m[1].match(/href="([^"]+)"/) || [])[1] || '' }));
    const want = [['Book a move', 'https://book.halamove.co.za/book/?s=web-hero'], ["I'm a driver", '/drive?s=web-herod']];
    if (links.length !== want.length) fails.push('the hero has ' + links.length + ' doors, expected ' + want.length);
    want.forEach(([label, href], i) => {
      const l = links[i];
      if (!l) return;
      if (l.label !== label) fails.push('door ' + (i + 1) + ' reads "' + l.label + '", expected "' + label + '"');
      if (l.href !== href) fails.push('"' + label + '" goes to ' + (l.href || 'nowhere') + ', expected ' + href);
      const code = l.href.split('?s=')[1] || '';
      if (!/^[A-Za-z0-9_-]{1,32}$/.test(code)) fails.push('"' + label + '": code ' + code + ' would be rejected by middleware.js');
      if (!code.startsWith('web-')) fails.push('"' + label + '": code ' + code + ' would be filed as a printed board');
    });
    if (links[0] && /data-desk/.test(links[0].attrs)) fails.push('the hero Book door would send a computer away from the web booking');
    if (links[1] && !/data-desk="\/download"/.test(links[1].attrs)) fails.push('the hero driver door would not send a computer to /download');
    if (!/querySelectorAll\('[^']*\.hero-doors \[data-desk\][^']*'\)/.test(html)) fails.push('the computer rewrite does not reach the hero doors');
  }
  if (c0 >= 0 && c1 >= 0) {
    const conn = hero.slice(c0, c1);
    const items = conn.split(/<li[ >]/).slice(1);
    const names = items.map((li) => ((li.match(/<b>([^<]+)<\/b>/) || [])[1] || '').trim());
    const STATIONS = ['The store', 'A checked driver', 'The doorstep', 'The record'];
    if (names.join('|') !== STATIONS.join('|')) fails.push('the connection reads ' + (names.join(', ') || 'nothing') + ', expected ' + STATIONS.join(', '));
    items.forEach((li, i) => { if (!/<svg [^>]*aria-hidden="true"/.test(li)) fails.push('station ' + (i + 1) + ' has no hidden icon'); });
    if (/<(a|button)[\s>]/.test(conn)) fails.push('a station is a link or a button; the connection is one figure, not four tiles');
    const text = conn.replace(/<svg[\s\S]*?<\/svg>/g, ' ').replace(/<[^>]+>/g, ' ');
    if (/[0-9]/.test(text)) fails.push('a figure is written into the connection; the record station takes its figure from the live record');
    if (!/<span [^>]*data-conn-rec[^>]*>/.test(items[3] || '')) fails.push('the record station has no place for the live record');
    const cw = text.replace(/&[a-z]+;/g, ' ').split(/\s+/).filter(Boolean).length;
    if (cw > 30) fails.push('the connection reads ' + cw + ' words, the cap is 30');
  }

  // 2 + 3. five cards, in order, each with its picture, its line and both doors
  const cards = rail.split(/<li class="rail-card"[^>]*>/).slice(1);
  if (cards.length !== SIZES.length) fails.push('the rail has ' + cards.length + ' cards, the app has ' + SIZES.length + ' sizes');
  const lines = {};
  // only the size picker's own rows (keyed by the app's tier codes); the file carries other lists of the same shape
  for (const m of leadForm.matchAll(/\['(bakkie_small|bakkie_large|panel_van|truck_1ton|truck_4ton)', '([^']+)', '([^']+)'\]/g)) {
    if (!(m[2] in lines)) lines[m[2]] = m[3];
  }
  SIZES.forEach((sz, i) => {
    const c = cards[i] || '';
    const name = (c.match(/<h3 class="rail-name"><a [^>]*>([^<]+)<\/a>/) || [])[1];
    if (name !== sz.name) { fails.push('card ' + (i + 1) + ' is "' + name + '", expected "' + sz.name + '"'); return; }
    const fits = (c.match(/<p class="rail-fits">([^<]+)<\/p>/) || [])[1] || '';
    const app = (lines[sz.name] || '').replace(/\.$/, '').split('. ')[0];
    if (!app) fails.push(sz.name + ': no line for this size in assets/lead-form.js');
    else if (fits !== app) fails.push(sz.name + ': the line "' + fits + '" is not the app\'s "' + app + '"');
    // A size line describes the load, never a home (Eric 2026-11-17, goods wording: HALA MOVE is the rail goods move on).
    if (/\b(home|homes|household|bedroom|one-bed|studio|house)\b/i.test(fits)) fails.push(sz.name + ': the line "' + fits + '" describes a home, not a load');
    for (const f of [480, 800, 1200, 1640].map((w) => sz.img + '.v1-' + w + '.webp').concat(sz.img + '.v1-1200.jpg')) {
      if (!c.includes('/images/vehicles/' + f)) fails.push(sz.name + ': does not use ' + f);
      else if (!fs.existsSync(path.join(ROOT, 'images', 'vehicles', f))) fails.push(sz.name + ': images/vehicles/' + f + ' is not on disk');
    }
    if (!/alt="[^"]{6,}"/.test(c)) fails.push(sz.name + ': the picture has no description');
    const book = (c.match(/class="rail-book" href="([^"]+)"/) || [])[1] || '';
    const drive = (c.match(/class="rail-drive" href="([^"]+)"/) || [])[1] || '';
    const appLink = (c.match(/class="rail-app" href="([^"]+)"/) || [])[1] || '';
    const want = [['Book a move', book, 'https://book.halamove.co.za/book/?s=web-hero-' + sz.code], ['I drive one', drive, '/drive?s=web-herod-' + sz.code],
      ['or get the app', appLink, '/get?s=web-hero-' + sz.code]];
    for (const [label, got, exp] of want) {
      if (got !== exp) fails.push(sz.name + ': "' + label + '" goes to ' + (got || 'nowhere') + ', expected ' + exp);
      const code = (got.split('?s=')[1] || '');
      if (code && !/^[A-Za-z0-9_-]{1,32}$/.test(code)) fails.push(sz.name + ': code ' + code + ' would be rejected by middleware.js');
      if (code && !code.startsWith('web-')) fails.push(sz.name + ': code ' + code + ' would be filed as a printed board');
    }
    if ((c.match(/data-desk="\/download"/g) || []).length !== 2) fails.push(sz.name + ': a computer would not be sent to /download');
    if (/class="rail-book"[^>]*data-desk/.test(c)) fails.push(sz.name + ': a computer would be sent away from the web booking');
    if (!/class="rail-book"[^>]*>Book a move<\/a>/.test(c)) fails.push(sz.name + ': the green button does not read "Book a move"');
    // 8. how the size comes: exactly its variants, in order, each picture on disk and described
    const strip = (c.match(/<ul class="rail-vars">([\s\S]*?)<\/ul>/) || [])[1];
    const shown = strip ? [...strip.matchAll(/<img src="\/images\/vehicles\/([a-z_]+)\.v1-480\.jpg"/g)].map((m) => m[1]) : [];
    const wantVars = sz.vars.length > 1 ? sz.vars : [];
    if (shown.join(',') !== wantVars.join(',')) fails.push(sz.name + ': shows ' + (shown.join(', ') || 'no variants') + ', the backend lists ' + (wantVars.join(', ') || 'none'));
    if (strip) {
      for (const k of shown) {
        for (const f of [k + '.v1-480.webp', k + '.v1-480.jpg']) {
          if (!strip.includes('/images/vehicles/' + f)) fails.push(sz.name + ': the ' + k + ' picture does not use ' + f);
          else if (!fs.existsSync(path.join(ROOT, 'images', 'vehicles', f))) fails.push(sz.name + ': images/vehicles/' + f + ' is not on disk');
        }
      }
      const alts = (strip.match(/<img [^>]*alt="([^"]{6,})"/g) || []).length;
      if (alts !== shown.length) fails.push(sz.name + ': ' + (shown.length - alts) + ' variant picture(s) without a description');
    }
  });
  if (!/loading="lazy"/.test(cards.slice(1).join('')) || /loading="lazy"/.test(cards[0] || '')) {
    fails.push('the first picture must load at once and the rest lazily');
  }

  // 4. the reading stays short (the heading and its line; the doors and the connection are held above)
  const words = hero.slice(0, d0 >= 0 ? d0 : r0).replace(/<[^>]+>/g, ' ').replace(/&[a-z]+;|·/g, ' ').split(/\s+/).filter(Boolean);
  if (words.length > MAX_HERO_WORDS) fails.push('the hero reads ' + words.length + ' words, the cap is ' + MAX_HERO_WORDS);

  // 5. booking without the app is live: every Book goes there (checked per frame above), and no other booking door
  if (/href="[^"]*(\/order|\/post-a-job)[^"]*"/i.test(hero)) fails.push('a booking door other than book.halamove.co.za is in the hero');

  // 6. movement a visitor can stop, that respects reduced motion and holds off screen
  const js0 = html.indexOf('// HERO STAGE');
  const js = js0 < 0 ? '' : html.slice(js0, html.indexOf('}());', js0));
  if (!/<button class="rail-play" id="rail-play"[^>]*aria-label="[^"]+"/.test(rail)) fails.push('the frames move by themselves and there is no pause button');
  if (!js) fails.push('the stage script is missing');
  else {
    if (!/prefers-reduced-motion: reduce/.test(js) || !/setPlay\(!reduce\)/.test(js)) fails.push('the frames would move for a visitor who asked for reduced motion');
    if (!/holds\.away = !en\[0\]\.isIntersecting/.test(js)) fails.push('the frames would keep moving off screen');
    if (!/visibilityState/.test(js)) fails.push('the frames would keep moving in a hidden tab');
  }
  // 7. nothing is hidden unless the script has marked the current frame
  const css = h.slice(0, h.indexOf('</style>'));
  for (const m of css.matchAll(/([^{}]*\.rail-card:not\(\.is-active\)[^{}]*)\{/g)) {
    m[1].split(',').filter((sel) => sel.includes(':not(.is-active)') && !sel.includes('.rail.is-live'))
      .forEach((sel) => fails.push('"' + sel.trim() + '" hides a frame even when the script never ran'));
  }
  if (!/rail\.classList\.add\('is-live'\)/.test(js)) fails.push('the script never marks the stage live');

  // the script that drives the dots exists, and the page still names the brand in full
  if (!/document\.getElementById\('hero-rail'\)/.test(js)) fails.push('the rail script is missing');
  if (!/id="hero-rail"/.test(rail)) fails.push('the rail has lost its id, so the dots would not follow it');
  return fails;
}

const html = read('index.html');
const leadForm = read('assets/lead-form.js');
const fails = check(html, leadForm);

let proveFails = [];
if (process.argv.includes('--prove')) {
  const breaks = [
    ['tag the rail for the motion script', (s) => s.replace('<div class="rail-wrap">', '<div class="rail-wrap" data-motion-hero-el="rail">')],
    ['the connection removed', (s) => s.replace(/<ol class="conn"[\s\S]*?<\/ol>/, '')],
    ['two stations swapped', (s) => s.replace('<b>The store</b>', '<b>THE_SWAP</b>').replace('<b>The doorstep</b>', '<b>The store</b>').replace('<b>THE_SWAP</b>', '<b>The doorstep</b>')],
    ['the vehicles before the connection', (s) => { const m = s.match(/ *<ol class="conn"[\s\S]*?<\/ol>\r?\n/); return m ? s.replace(m[0], '').replace(' <div class="container">\n    <!-- GOOGLE PLAY', m[0] + ' <div class="container">\n    <!-- GOOGLE PLAY') : s; }],
    ['a figure written into the record station', (s) => s.replace(/(<span [^>]*data-conn-rec[^>]*>)[^<]*/, '$121 deliveries, 0 disputes')],
    ['a station made a link', (s) => s.replace('<b>A checked driver</b>', '<a href="#drivers"><b>A checked driver</b></a>')],
    ['a motion key used twice', (s) => s.replace('<div class="store-row">', '<div class="store-row" data-motion-hero-el="cta">')],
    ['the doors removed', (s) => s.replace(/ *<div class="hero-doors"[\s\S]*?<\/div>\r?\n/, '')],
    ['the hero Book door rewritten for computers', (s) => s.replace('href="https://book.halamove.co.za/book/?s=web-hero" ', 'href="https://book.halamove.co.za/book/?s=web-hero" data-desk="/download" ')],
    ['the hero Book door sent to the stores', (s) => s.replace('href="https://book.halamove.co.za/book/?s=web-hero"', 'href="/get?s=web-hero"')],
    ['the driver door kept from computers', (s) => s.replace(/(href="\/drive\?s=web-herod") data-desk="\/download"/, '$1')],
    ['the computer rewrite misses the doors', (s) => s.replace(", .hero-doors [data-desk]'", "'")],
    ['the connection grows', (s) => s.replace('<b>The record</b>', '<b>The record</b> kept for every single delivery that has ever been booked through any of the doors we run')],
    ['drop a web- code', (s) => s.replace('/get?s=web-hero-van', '/get?s=hero-van')],
    ['a code middleware rejects', (s) => s.replace('/drive?s=web-herod-4t', '/drive?s=web-herod-4t!')],
    ['a missing picture', (s) => s.split('box_truck.v1-1640.webp').join('box_truck.v9-1640.webp')],
    ['a line that is not the app\'s', (s) => s.replace('Enclosed and dry, for stock and appliances', 'Enclosed, for anything')],
    ['a card removed', (s) => s.replace(/   <li class="rail-card"[^>]*>[\s\S]*?<\/li>\r?\n/, '')],
    ['the words creep back', (s) => s.replace('Your money is held until it arrives.', 'Your money is held until it arrives. Eventually somebody sends you a number and you text a stranger.')],
    ['Book sent back to the stores', (s) => s.replace('href="https://book.halamove.co.za/book/?s=web-hero-sbak"', 'href="/get?s=web-hero-sbak"')],
    ['Book rewritten for computers', (s) => s.replace('href="https://book.halamove.co.za/book/?s=web-hero-van"', 'href="https://book.halamove.co.za/book/?s=web-hero-van" data-desk="/download"')],
    ['the app link lost', (s) => s.replace('<a class="rail-app" href="/get?s=web-hero-1t"', '<a class="rail-app" href="/"')],
    ['Book relabelled', (s) => s.replace('no app needed">Book a move</a>', 'no app needed">Book</a>')],
    ['every picture loads at once', (s) => s.split('loading="lazy" decoding="async"').join('decoding="async"')],
    ['no pause button', (s) => s.replace('<button class="rail-play" id="rail-play"', '<span class="rail-play"')],
    ['autoplay ignores reduced motion', (s) => s.replace('setPlay(!reduce);', 'setPlay(true);')],
    ['autoplay runs off screen', (s) => s.replace('holds.away = !en[0].isIntersecting;', 'holds.away = false;')],
    ['frames hidden without the script', (s) => s.replace('.rail.is-live .rail-card:not(.is-active) .rail-pic img{', '.rail-card:not(.is-active) .rail-pic img{')],
    ['the script never marks the stage live', (s) => s.replace("rail.classList.add('is-live');", '')],
    ['a covered picture dropped', (s) => s.replace(/<li><picture><source type="image\/webp" srcset="\/images\/vehicles\/one_ton_canopy[\s\S]*?<\/li>\r?\n/, '')],
    ['the trailer picture missing from disk', (s) => s.split('half_ton_trailer.v1-480.jpg').join('half_ton_trailer.v9-480.jpg')],
    ['a variant without a description', (s) => s.replace('alt="A white one-ton truck with a box body"', 'alt=""')],
    ['a strip on a size with one way to come', (s) => s.replace('alt="A white panel van" loading="lazy" decoding="async">\n    </picture>', 'alt="A white panel van" loading="lazy" decoding="async">\n    </picture>\n    <ul class="rail-vars"><li><picture><img src="/images/vehicles/panel_van.v1-480.jpg" alt="A white panel van"></picture></li></ul>')],
  ];
  for (const [label, mutate] of breaks) {
    const m = mutate(html);
    if (m === html) { proveFails.push('PROVE: "' + label + '" did not change the page (the break is stale)'); continue; }
    if (check(m, leadForm).length === 0) proveFails.push('PROVE: "' + label + '" stayed green');
  }
  console.log('  PROVE: ' + (breaks.length - proveFails.length) + '/' + breaks.length + ' breaks turn the check red');
}

fails.concat(proveFails).forEach((f) => console.log('  FAIL ' + f));
const total = SIZES.length;
console.log(fails.length || proveFails.length ? '  HERO RAIL: FAIL' : '  HERO RAIL: ' + total + '/' + total + ' sizes, every door and picture in place');
process.exit(fails.length || proveFails.length ? 1 : 0);
