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
// What breaks it silently, and is therefore checked here:
//   1. A rail element tagged data-motion-hero-el. assets/motion.js pre-hides every tagged hero element and animates
//      only five named keys, so a tagged rail would sit at opacity 0 for every visitor with JavaScript on.
//   2. A store link without its web- code, or with a code middleware.js would reject (it allows [A-Za-z0-9_-]{1,32})
//      or file as a printed board (any code not starting with a known prefix reads as 'qr').
//   3. A picture that is not on disk, or a size that is not the app's (the five lines are the app's size picker,
//      mirrored in assets/lead-form.js; this compares the two so they cannot drift apart).
//   4. The words creeping back: the hero text (eyebrow, heading, line) stays within 25 words.
//   5. A booking-without-the-app link before that page answers in production.
//   6. Movement nobody can stop (rebuilt 2026-11-15 as a studio stage that advances by itself): the frames need a
//      pause button (WCAG 2.2.2), must not move for a visitor who asks for reduced motion, and must hold while the
//      stage is off screen.
//   7. Frames hidden for good: the CSS fades the frames that are not in view only once the script has marked the
//      current one (.rail.is-live), so a page whose script fails still shows every vehicle in full.

const fs = require('fs');
const path = require('path');
const ROOT = __dirname;
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');

const SIZES = [   // order = the app's TIER_ORDER; image = backend CATEGORY_IMAGE file
  { code: 'sbak', name: 'Small Bakkie', img: 'half_ton' },
  { code: 'lbak', name: 'Large Bakkie', img: 'one_ton' },
  { code: 'van', name: 'Panel Van', img: 'panel_van' },
  { code: '1t', name: '1 Ton Truck', img: 'dropside' },
  { code: '4t', name: '4 Ton Truck', img: 'box_truck' },
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
    for (const f of [480, 800, 1200, 1640].map((w) => sz.img + '.v1-' + w + '.webp').concat(sz.img + '.v1-1200.jpg')) {
      if (!c.includes('/images/vehicles/' + f)) fails.push(sz.name + ': does not use ' + f);
      else if (!fs.existsSync(path.join(ROOT, 'images', 'vehicles', f))) fails.push(sz.name + ': images/vehicles/' + f + ' is not on disk');
    }
    if (!/alt="[^"]{6,}"/.test(c)) fails.push(sz.name + ': the picture has no description');
    const book = (c.match(/class="rail-book" href="([^"]+)"/) || [])[1] || '';
    const drive = (c.match(/class="rail-drive" href="([^"]+)"/) || [])[1] || '';
    const want = [['Book', book, '/get?s=web-hero-' + sz.code], ['I drive one', drive, '/drive?s=web-herod-' + sz.code]];
    for (const [label, got, exp] of want) {
      if (got !== exp) fails.push(sz.name + ': "' + label + '" goes to ' + (got || 'nowhere') + ', expected ' + exp);
      const code = (got.split('?s=')[1] || '');
      if (code && !/^[A-Za-z0-9_-]{1,32}$/.test(code)) fails.push(sz.name + ': code ' + code + ' would be rejected by middleware.js');
      if (code && !code.startsWith('web-')) fails.push(sz.name + ': code ' + code + ' would be filed as a printed board');
    }
    if ((c.match(/data-desk="\/download"/g) || []).length !== 2) fails.push(sz.name + ': a computer would not be sent to /download');
  });
  if (!/loading="lazy"/.test(cards.slice(1).join('')) || /loading="lazy"/.test(cards[0] || '')) {
    fails.push('the first picture must load at once and the rest lazily');
  }

  // 4. the reading stays short
  const words = hero.slice(0, r0).replace(/<[^>]+>/g, ' ').replace(/&[a-z]+;|·/g, ' ').split(/\s+/).filter(Boolean);
  if (words.length > MAX_HERO_WORDS) fails.push('the hero reads ' + words.length + ' words, the cap is ' + MAX_HERO_WORDS);

  // 5. no booking without the app until it answers in production
  if (/href="[^"]*(\/book|\/order|\/post-a-job)[^"]*"/i.test(hero)) fails.push('a booking-without-the-app link is in the hero before that page is live');

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
    ['drop a web- code', (s) => s.replace('/get?s=web-hero-van', '/get?s=hero-van')],
    ['a code middleware rejects', (s) => s.replace('/drive?s=web-herod-4t', '/drive?s=web-herod-4t!')],
    ['a missing picture', (s) => s.split('box_truck.v1-1640.webp').join('box_truck.v9-1640.webp')],
    ['a line that is not the app\'s', (s) => s.replace('Enclosed and dry, for stock and appliances', 'Enclosed, for anything')],
    ['a card removed', (s) => s.replace(/   <li class="rail-card"[^>]*>[\s\S]*?<\/li>\n/, '')],
    ['the words creep back', (s) => s.replace('Your money is held until it arrives.', 'Your money is held until it arrives. Eventually somebody sends you a number and you text a stranger.')],
    ['a booking link before it is live', (s) => s.replace('href="/get?s=web-hero-sbak"', 'href="/book?s=web-hero-sbak"')],
    ['every picture loads at once', (s) => s.split('loading="lazy" decoding="async"').join('decoding="async"')],
    ['no pause button', (s) => s.replace('<button class="rail-play" id="rail-play"', '<span class="rail-play"')],
    ['autoplay ignores reduced motion', (s) => s.replace('setPlay(!reduce);', 'setPlay(true);')],
    ['autoplay runs off screen', (s) => s.replace('holds.away = !en[0].isIntersecting;', 'holds.away = false;')],
    ['frames hidden without the script', (s) => s.replace('.rail.is-live .rail-card:not(.is-active) .rail-pic img{', '.rail-card:not(.is-active) .rail-pic img{')],
    ['the script never marks the stage live', (s) => s.replace("rail.classList.add('is-live');", '')],
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
