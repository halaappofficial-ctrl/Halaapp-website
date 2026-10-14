// verify-videos.cjs - guards the homepage #videos section (added 2026-10-14).
//
//   node verify-videos.cjs          # offline: markup, covers on disk, JSON-LD, labels, placement
//   node verify-videos.cjs --live   # also asks YouTube's oEmbed whether each video is public and
//                                   # embeddable, and that its title is the one the JSON-LD names
//
// Why each check exists:
// - Frame labels come from one approved set: TESTIMONIAL for a real customer, HOW IT WORKS or GUIDE
//   for a video that explains the app (the one made with AYANDA). Words outside that set must not
//   appear anywhere on the homepage, comments included; the list lives in the backend messaging
//   source and cover guard G12 (scripts/marketing/build_video_covers.py). It is kept encoded here
//   so this public file never prints the words it forbids.
// - A frame whose id, cover file or JSON-LD entry disagree renders fine and plays the wrong video,
//   so every id is cross-checked against the link, the player id, the cover and the JSON-LD.
// - oEmbed answers 401/403/404 for a video that is private, scheduled, deleted or not embeddable;
//   a frame pointing at one would open a dead player on tap.
// The count is the verdict: N/N with N > 0, never a judgment.
'use strict';
const fs = require('fs');
const path = require('path');
const https = require('https');

const ROOT = __dirname;
const LIVE = process.argv.includes('--live');
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const results = [];
const check = (name, ok, detail) => results.push({ name, ok: !!ok, detail: ok ? '' : (detail || '') });

const TYPES = ['TESTIMONIAL', 'HOW IT WORKS'];
const STAGED = new RegExp('\\b(' + Buffer.from('c2tpdHxza2V0Y2h8Y29tZWR5fGNvbWVkaWN8cGFyb2R5fHByYW5rfGFjdGVk', 'base64').toString() + ')\\b', 'i');
const ID = /^[A-Za-z0-9_-]{11}$/;

// 1. The section, and where it sits: after How it works (#customers), before #drivers
const secStart = html.indexOf('<section class="vids" id="videos"');
const secEnd = secStart >= 0 ? html.indexOf('</section>', secStart) : -1;
check('section #videos exists', secStart >= 0 && secEnd > secStart, 'no <section class="vids" id="videos">');
const sec = secStart >= 0 ? html.slice(secStart, secEnd) : '';
const iCustomers = html.indexOf('id="customers"');
const iDrivers = html.indexOf('id="drivers"');
check('placed after How it works and before For Drivers', iCustomers >= 0 && iCustomers < secStart && secStart < iDrivers,
  `customers@${iCustomers} videos@${secStart} drivers@${iDrivers}`);
check('heading "In their own words."', sec.includes('>In their own words.</h2>'), 'heading text changed - update MESSAGING_SOURCE first');
check('a player that cannot load puts the cover back with a way to YouTube', /yt-failed/.test(html) && /Tap to watch on YouTube/.test(html) && /setTimeout\(function\(\)\{ fail\(f\); \},15000\)/.test(html),
  'the facade lost its can-not-play fallback - a flagged network would see a grey box');
check('nav links to #videos', /<ul class="nav-links"[\s\S]*?<a href="#videos">Videos<\/a>[\s\S]*?<\/ul>/.test(html), 'no Videos link in the main nav');

// 2. Frames
const frameRe = /<li class="vid" data-type="([^"]+)">\s*<a class="vid-frame" href="([^"]+)" data-yt="([^"]+)"[^>]*aria-label="([^"]+)"[^>]*>\s*<img src="([^"]+)" width="(\d+)" height="(\d+)"[^>]*>/g;
const frames = [...sec.matchAll(frameRe)].map((m) => ({ type: m[1], href: m[2], id: m[3], label: m[4], img: m[5], w: +m[6], h: +m[7] }));
check('exactly 3 frames', frames.length === 3, `found ${frames.length}`);
check('frame order TESTIMONIAL, TESTIMONIAL, HOW IT WORKS', frames.map((f) => f.type).join('|') === 'TESTIMONIAL|TESTIMONIAL|HOW IT WORKS',
  frames.map((f) => f.type).join('|'));
const ids = new Set();
for (const f of frames) {
  const tag = `frame ${f.id}`;
  check(`${tag}: type is one of ${TYPES.join(' / ')}`, TYPES.includes(f.type), f.type);
  check(`${tag}: a real 11-character video id`, ID.test(f.id), f.id);
  check(`${tag}: link opens the same Short`, f.href === `https://www.youtube.com/shorts/${f.id}`, f.href);
  check(`${tag}: id used once`, !ids.has(f.id), 'duplicate id'); ids.add(f.id);
  const file = path.join(ROOT, f.img.replace(/^\//, ''));
  const size = fs.existsSync(file) ? fs.statSync(file).size : 0;
  check(`${tag}: cover file exists (${f.img})`, size > 10000 && size < 200000, `size ${size}`);
  check(`${tag}: cover is 9:16 at 540x960`, f.w === 540 && f.h === 960, `${f.w}x${f.h}`);
  check(`${tag}: the HOW IT WORKS frame is the AYANDA cover`, f.type !== 'HOW IT WORKS' || /how-it-works/.test(f.img), f.img);
  check(`${tag}: a TESTIMONIAL frame never uses the AYANDA cover`, f.type !== 'TESTIMONIAL' || !/ayanda|how-it-works/i.test(f.img), f.img);
}

// 3. Words outside the label set: nowhere on the whole homepage (comments and JSON-LD included -
//    a code comment is served to every visitor), and not in a cover file name
const ldBlocks = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) => m[1]);
check('no unapproved label word anywhere in index.html', !STAGED.test(html), 'found: ' + (html.match(STAGED) || [])[0]);
check('no unapproved label word in a cover file name', !frames.some((f) => STAGED.test(f.img)), 'cover file name');

// 4. VideoObject JSON-LD, one per frame, consistent with the frame
let videos = [];
let parsed = 0;
for (const b of ldBlocks) {
  try {
    const j = JSON.parse(b); parsed++;
    const nodes = Array.isArray(j['@graph']) ? j['@graph'] : [j];
    videos = videos.concat(nodes.filter((n) => n['@type'] === 'VideoObject'));
  } catch (e) { check('JSON-LD parses', false, e.message); }
}
check('all JSON-LD blocks parse', parsed === ldBlocks.length && parsed > 0, `${parsed}/${ldBlocks.length}`);
check('3 VideoObjects', videos.length === 3, `found ${videos.length}`);
for (const f of frames) {
  const v = videos.find((x) => x.embedUrl === `https://www.youtube-nocookie.com/embed/${f.id}`);
  const tag = `VideoObject ${f.id}`;
  check(`${tag}: present, embedUrl is youtube-nocookie`, !!v, 'no VideoObject with this embedUrl');
  if (!v) continue;
  check(`${tag}: contentUrl is the Short`, v.contentUrl === `https://www.youtube.com/shorts/${f.id}`, v.contentUrl);
  check(`${tag}: name and description set`, typeof v.name === 'string' && v.name.length > 5 && typeof v.description === 'string' && v.description.length > 20);
  check(`${tag}: uploadDate is an ISO time with a zone`, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}([+-]\d{2}:\d{2}|Z)$/.test(v.uploadDate || ''), v.uploadDate);
  check(`${tag}: duration is ISO 8601`, /^PT(\d+M)?(\d+S)?$/.test(v.duration || '') && v.duration !== 'PT', v.duration);
  const thumbs = [].concat(v.thumbnailUrl || []);
  check(`${tag}: thumbnail is the frame's own cover`, thumbs.includes('https://www.halamove.co.za' + f.img), thumbs.join(' '));
}

function oembed(id) {
  const url = `https://www.youtube.com/oembed?url=${encodeURIComponent('https://www.youtube.com/shorts/' + id)}&format=json`;
  return new Promise((resolve) => {
    https.get(url, { timeout: 15000 }, (res) => {
      let body = ''; res.on('data', (c) => { body += c; });
      res.on('end', () => { let j = null; try { j = JSON.parse(body); } catch (e) { /* not JSON */ } resolve({ status: res.statusCode, json: j }); });
    }).on('error', (e) => resolve({ status: 0, error: e.message })).on('timeout', function () { this.destroy(new Error('timeout')); });
  });
}

(async () => {
  if (LIVE) {
    for (const f of frames) {
      const r = await oembed(f.id);
      const v = videos.find((x) => x.embedUrl === `https://www.youtube-nocookie.com/embed/${f.id}`) || {};
      check(`live ${f.id}: public and embeddable (oEmbed 200)`, r.status === 200, `HTTP ${r.status}${r.error ? ' ' + r.error : ''}`);
      const title = r.json && r.json.title;
      check(`live ${f.id}: YouTube title starts with the JSON-LD name`, !!title && (title === v.name || title.startsWith(v.name.replace(/ \| HALA MOVE$/, ''))),
        `YouTube "${title}" vs JSON-LD "${v.name}"`);
      check(`live ${f.id}: on the HALA MOVE channel`, !!(r.json && /halamove/i.test(r.json.author_url || '')), r.json && r.json.author_url);
    }
  }
  const failed = results.filter((r) => !r.ok);
  for (const r of results) console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.name}${r.ok ? '' : '  -> ' + r.detail}`);
  const total = results.length;
  console.log(`\nverify-videos: ${total - failed.length}/${total} checks pass${LIVE ? ' (live)' : ' (offline; --live asks YouTube)'}`);
  process.exit(total > 0 && failed.length === 0 ? 0 : 1);
})();
