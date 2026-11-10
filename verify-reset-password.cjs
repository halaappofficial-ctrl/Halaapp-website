#!/usr/bin/env node
'use strict';

// -- verify-reset-password ------------------------------------------------------------------------------------------
//
//   node verify-reset-password.cjs           # exit 0 = every case holds
//   node verify-reset-password.cjs --prove   # also breaks each rule in memory and requires the check to go red
//
// THE PAGE: halamove.co.za/reset-password?t=<token>, linked from the "Forgot password" email (backend
// src/services/passwordReset.js). For 60 minutes the token can set the password on someone's account, so:
//
// WHAT IT HOLDS:
//   1. Nothing on the page can carry the token anywhere: no script source of any kind (so no analytics), a
//      Content-Security-Policy that allows no script source and no connection except the backend, no Referer
//      (meta, the fetch itself and the vercel.json header), noindex in the page and in the header, no-store, no
//      HTML injected from a reply, and the page is not in the sitemap.
//   2. The page DOES what the backend expects. Its own script runs here against a stand-in document and a
//      stand-in fetch, through every answer the backend gives: 200 / 404 / 410 / 503 on the check, 200 / 400 /
//      404 / 410 / 503 on the save, and a dropped connection on each. The server's sentence is shown as it is.
//   3. The password boxes refuse what the server would refuse (under 8 characters) and two boxes that differ,
//      before anything is sent, and carry no name, so a form sent without the script would send nothing.
//
// WHAT IT CANNOT DO: it reads source and runs the script in Node. Whether the page looks right on a phone, and
// whether the live backend answers as described, are checked by loading the real page.

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = __dirname;
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');
const API = 'https://hala-backend-production.up.railway.app/api/auth/password-reset';
const TOKEN = 'u.1b2c3d4e-0000-4000-8000-000000000001.1793000000.ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopq';

// ---- 1. nothing carries the token ----------------------------------------------------------------------------------
function checkSealed(html, vercel, sitemap) {
  const fails = [];
  const head = (html.match(/<head>[\s\S]*?<\/head>/) || [''])[0];
  if (/<script\b[^>]*\bsrc=/i.test(html)) fails.push('a <script src> is on the page');
  if (/_vercel\/insights|_vercel\/speed-insights|\bva\(|window\.va\b/.test(html)) fails.push('analytics is on the page');
  const csp = (head.match(/<meta http-equiv="Content-Security-Policy" content="([^"]+)"/) || [])[1];
  if (!csp) fails.push('no Content-Security-Policy meta');
  else {
    const dir = {};
    csp.split(';').map((d) => d.trim()).filter(Boolean).forEach((d) => { const [k, ...v] = d.split(/\s+/); dir[k] = v; });
    if ((dir['default-src'] || []).join(' ') !== "'none'") fails.push("CSP default-src is not 'none'");
    if ((dir['script-src'] || []).join(' ') !== "'unsafe-inline'") fails.push('CSP script-src allows a script source: ' + (dir['script-src'] || []).join(' '));
    if ((dir['connect-src'] || []).join(' ') !== 'https://hala-backend-production.up.railway.app') fails.push('CSP connect-src is not the backend alone');
    if ((dir['form-action'] || []).join(' ') !== "'none'") fails.push("CSP form-action is not 'none'");
    const firstScript = html.search(/<script\b/i);
    if (firstScript !== -1 && html.indexOf('Content-Security-Policy') > firstScript) fails.push('the CSP meta comes after a script');
  }
  if (!/<meta name="robots" content="noindex, nofollow">/.test(head)) fails.push('no robots noindex meta');
  if (!/<meta name="referrer" content="no-referrer">/.test(head)) fails.push('the referrer meta is not no-referrer');
  if (!/referrerPolicy: 'no-referrer'/.test(html)) fails.push('the fetch does not say no-referrer');
  if (/innerHTML|outerHTML|insertAdjacentHTML|document\.write/.test(html)) fails.push('HTML is written into the page');
  if (/wa\.me\//.test(html)) fails.push('a WhatsApp link: the way forward is Forgot password in the app');
  if (!/new URLSearchParams\(window\.location\.search/.test(html)) fails.push('the token is not read with URLSearchParams');
  const inputs = html.match(/<input\b[^>]*>/gi) || [];
  if (inputs.length !== 2) fails.push('expected 2 inputs, found ' + inputs.length);
  for (const t of inputs) {
    if (!/type="password"/.test(t)) fails.push('an input is not type=password: ' + t);
    if (!/autocomplete="new-password"/.test(t)) fails.push('an input is not autocomplete=new-password');
    if (!/minlength="8"/.test(t) || !/maxlength="128"/.test(t)) fails.push('an input does not carry 8 to 128');
    if (/\bname=/.test(t)) fails.push('an input has a name, so a form sent without the script would send it');
  }

  let rules = [];
  try { rules = JSON.parse(vercel).headers || []; } catch (e) { fails.push('vercel.json does not parse: ' + e.message); }
  const rule = rules.find((r) => r.source === '/reset-password(.*)');
  if (!rule) fails.push('vercel.json has no header rule for /reset-password');
  else {
    const h = {}; (rule.headers || []).forEach((x) => { h[x.key] = x.value; });
    if (h['X-Robots-Tag'] !== 'noindex, nofollow') fails.push('vercel.json: X-Robots-Tag is not noindex, nofollow');
    if (h['Referrer-Policy'] !== 'no-referrer') fails.push('vercel.json: Referrer-Policy is not no-referrer');
    if (h['Cache-Control'] !== 'no-store') fails.push('vercel.json: Cache-Control is not no-store');
  }
  if (/reset-password/.test(sitemap)) fails.push('the page is in sitemap.xml');
  return fails;
}

// ---- 2 and 3. the page's own script, driven ------------------------------------------------------------------------
function makeDoc(html) {
  const els = {};
  const re = /<([a-z0-9]+)\b([^>]*)\bid="([^"]+)"([^>]*)>/gi;
  let m;
  while ((m = re.exec(html))) {
    const attrs = m[2] + m[4];
    const classes = new Set(((attrs.match(/class="([^"]*)"/) || [])[1] || '').split(/\s+/).filter(Boolean));
    const type = (attrs.match(/type="([^"]*)"/) || [])[1] || '';
    const aria = (attrs.match(/aria-pressed="([^"]*)"/) || [])[1];
    const el = {
      id: m[3], textContent: '', value: '', type, disabled: false, listeners: {}, attrs: { 'aria-pressed': aria },
      classList: {
        toggle(c, on) { if (on === undefined) on = !classes.has(c); if (on) classes.add(c); else classes.delete(c); },
        add(c) { classes.add(c); }, remove(c) { classes.delete(c); }, contains(c) { return classes.has(c); },
      },
      getAttribute(k) { return this.attrs[k] === undefined ? null : this.attrs[k]; },
      setAttribute(k, v) { this.attrs[k] = String(v); },
      addEventListener(ev, fn) { (this.listeners[ev] = this.listeners[ev] || []).push(fn); },
      focus() { doc.focused = this.id; },
      fire(ev) { (this.listeners[ev] || []).forEach((fn) => fn({ preventDefault() {} })); },
    };
    els[m[3]] = el;
  }
  const doc = { focused: null, els, getElementById: (id) => els[id] || null };
  return doc;
}

function scriptOf(html) {
  const all = html.match(/<script>([\s\S]*?)<\/script>/g) || [];
  return all.length ? all[all.length - 1].replace(/^<script>|<\/script>$/g, '') : '';
}

const flush = () => new Promise((r) => setImmediate(r));
async function settle() { for (let i = 0; i < 6; i++) await flush(); }

// One run of the page: `search` is the address query, `replies` answers each fetch in turn.
async function run(html, search, replies) {
  const doc = makeDoc(html);
  const calls = [];
  const queue = replies.slice();
  const fetch = (url, opts) => {
    calls.push({ url, opts });
    const r = queue.shift();
    if (!r || r === 'drop') return Promise.reject(new TypeError('Failed to fetch'));
    return Promise.resolve({ status: r[0], json: () => (r[1] === 'not-json' ? Promise.reject(new SyntaxError('x')) : Promise.resolve(r[1])) });
  };
  const ctx = { document: doc, window: { location: { search } }, URLSearchParams, fetch, JSON, encodeURIComponent, Promise };
  vm.runInNewContext(scriptOf(html), ctx, { timeout: 2000 });
  await settle();
  const visible = () => ['main', 'done', 'ended', 'invalid', 'down', 'loading'].filter((k) => doc.els[k] && !doc.els[k].classList.contains('hidden'));
  return { doc, calls, queue, visible, el: (id) => doc.els[id] };
}

async function submit(p, pw, pw2) {
  p.el('pw').value = pw; p.el('pw2').value = pw2 === undefined ? pw : pw2;
  p.el('form').fire('submit');
  await settle();
}

const M404 = 'This link is not valid. Open the whole link from the email, or ask for a new one in the app: tap Forgot password on the sign-in screen.';
const M410 = 'This link has expired or has already been used. Ask for a new one in the app: tap Forgot password on the sign-in screen.';
const M503 = 'Something went wrong on our side and your password was not changed. Please try again in a minute.';
const MOK = 'Your password is changed. Open the HALA MOVE Driver app and sign in with your email and your new password.';
const VALID = [200, { valid: true, app: 'customer', first_name: 'Thandi' }];

async function checkBehaviour(html) {
  const fails = [];
  const ok = (name, cond, detail) => { if (!cond) fails.push(name + (detail ? ' - ' + detail : '')); };
  const q = '?t=' + encodeURIComponent(TOKEN);
  let p;

  p = await run(html, '', []);
  ok('no token: says the link is not valid, asks nothing', p.visible().join() === 'invalid' && p.calls.length === 0, p.visible().join());
  ok('no token: the fallback sentence matches the server', p.el('invalid-text').textContent === M404);

  p = await run(html, q, [VALID]);
  ok('check 200: the form shows', p.visible().join() === 'main', p.visible().join());
  ok('check 200: greets by first name', p.el('hello').textContent === 'Hi Thandi,', p.el('hello').textContent);
  ok('check 200: names the customer app', p.el('lead').textContent === 'For your HALA MOVE account.', p.el('lead').textContent);
  ok('check 200: the cursor is in the first box', p.doc.focused === 'pw');
  const c0 = p.calls[0] || { opts: {} };
  ok('check: GET to the API with the token encoded', c0.url === API + '?t=' + encodeURIComponent(TOKEN) && !c0.opts.method, c0.url);
  ok('check: no-store, no cookies, no Referer', c0.opts.cache === 'no-store' && c0.opts.credentials === 'omit' && c0.opts.referrerPolicy === 'no-referrer');

  p = await run(html, '?t=' + encodeURIComponent('u.a+b/c=&d'), [VALID]);
  ok('check: a token with + / = & arrives intact', (p.calls[0] || {}).url === API + '?t=' + encodeURIComponent('u.a+b/c=&d'), (p.calls[0] || {}).url);

  p = await run(html, q, [[200, { valid: true, app: 'driver', first_name: '' }]]);
  ok('check 200 driver: names the driver app', p.el('lead').textContent === 'For your HALA MOVE Driver account.', p.el('lead').textContent);
  ok('check 200 no name: no empty greeting', p.el('hello').textContent === '', p.el('hello').textContent);

  for (const [code, view, msg] of [[404, 'invalid', M404], [410, 'ended', M410], [503, 'down', M503]]) {
    p = await run(html, q, [[code, { error: 'X', message: msg + ' (server)' }]]);
    ok('check ' + code + ': shows ' + view, p.visible().join() === view, p.visible().join());
    ok('check ' + code + ': shows the server sentence as it is', p.el(view + '-text').textContent === msg + ' (server)', p.el(view + '-text').textContent);
    p = await run(html, q, [[code, 'not-json']]);
    ok('check ' + code + ' with no sentence: says the same thing itself', p.visible().join() === view && p.el(view + '-text').textContent === msg, p.el(view + '-text').textContent);
  }
  p = await run(html, q, [[200, {}]]);
  ok('check 200 without valid:true: does not show the form', p.visible().join() === 'down', p.visible().join());
  p = await run(html, q, ['drop', VALID]);
  ok('check dropped: says try again', p.visible().join() === 'down' && p.el('down-text').textContent === M503, p.visible().join());
  p.el('retry').fire('click'); await settle();
  ok('check dropped, then Try again: the form shows', p.visible().join() === 'main' && p.calls.length === 2, p.visible().join());

  // Saving
  p = await run(html, q, [VALID]);
  await submit(p, 'short');
  ok('save: under 8 characters is refused before sending', p.el('error').textContent === 'Use at least 8 characters.' && p.calls.length === 1, p.el('error').textContent);
  ok('save: the error is visible', !p.el('error').classList.contains('hidden'));
  await submit(p, 'longenough1', 'longenough2');
  ok('save: two different boxes are refused before sending', /not the same/.test(p.el('error').textContent) && p.calls.length === 1, p.el('error').textContent);
  await submit(p, '  spaced pass  ');
  ok('save: nothing is trimmed (8+ with spaces is sent as typed)', p.calls.length === 2 && JSON.parse(p.calls[1].opts.body).password === '  spaced pass  ');

  p = await run(html, q, [VALID, [200, { reset: true, app: 'driver', message: MOK }]]);
  await submit(p, 'correct horse');
  const c1 = p.calls[1] || { opts: {} };
  ok('save: POST to the API', c1.url === API && c1.opts.method === 'POST' && (c1.opts.headers || {})['Content-Type'] === 'application/json', c1.url);
  let body = {}; try { body = JSON.parse(c1.opts.body); } catch (e) { /* stays {} */ }
  ok('save: sends the token and the password, nothing else', body.token === TOKEN && body.password === 'correct horse' && Object.keys(body).length === 2, JSON.stringify(Object.keys(body)));
  ok('save: no-store, no cookies, no Referer', c1.opts.cache === 'no-store' && c1.opts.credentials === 'omit' && c1.opts.referrerPolicy === 'no-referrer');
  ok('save 200: says done, in the server sentence', p.visible().join() === 'done' && p.el('done-text').textContent === MOK, p.el('done-text').textContent);
  ok('save 200: the boxes are emptied', p.el('pw').value === '' && p.el('pw2').value === '');

  p = await run(html, q, [VALID, [400, { error: 'WEAK_PASSWORD', message: 'Use at least 8 characters. (server)' }]]);
  await submit(p, 'correct horse');
  ok('save 400: the server sentence under the form, the form stays', p.visible().join() === 'main' && p.el('error').textContent === 'Use at least 8 characters. (server)', p.el('error').textContent);
  for (const [code, view, msg] of [[404, 'invalid', M404], [410, 'ended', M410]]) {
    p = await run(html, q, [VALID, [code, { message: msg + ' (server)' }]]);
    await submit(p, 'correct horse');
    ok('save ' + code + ': shows ' + view + ' with the server sentence', p.visible().join() === view && p.el(view + '-text').textContent === msg + ' (server)', p.visible().join());
  }
  p = await run(html, q, [VALID, [503, { message: M503 + ' (server)' }]]);
  await submit(p, 'correct horse');
  ok('save 503: the server sentence under the form, the button works again', p.visible().join() === 'main' && p.el('error').textContent === M503 + ' (server)' && !p.el('submit').disabled, p.el('error').textContent);
  p = await run(html, q, [VALID, 'drop']);
  await submit(p, 'correct horse');
  ok('save dropped: says it is not changed yet, the button works again', /not changed yet/.test(p.el('error').textContent) && !p.el('submit').disabled && p.el('submit').textContent === 'Save my new password', p.el('error').textContent);

  p = await run(html, q, [VALID]);
  p.el('show').fire('click');
  ok('show password: both boxes readable, pressed, says Hide', p.el('pw').type === 'text' && p.el('pw2').type === 'text' && p.el('show').getAttribute('aria-pressed') === 'true' && p.el('show').textContent === 'Hide password');
  p.el('show').fire('click');
  ok('hide password: both boxes masked again', p.el('pw').type === 'password' && p.el('pw2').type === 'password' && p.el('show').getAttribute('aria-pressed') === 'false');
  return fails;
}

async function runAll(src) {
  return [
    ['nothing carries the token', checkSealed(src.html, src.vercel, src.sitemap)],
    ['the page does what the backend expects', await checkBehaviour(src.html)],
  ];
}

(async () => {
  const SRC = { html: read('reset-password.html'), vercel: read('vercel.json'), sitemap: read('sitemap.xml') };
  let total = 0, bad = 0;
  for (const [name, fails] of await runAll(SRC)) {
    total++;
    if (fails.length) { bad++; console.log('  FAIL ' + name); for (const f of fails) console.log('       ' + f); } else console.log('  ok   ' + name);
  }

  if (process.argv.includes('--prove')) {
    const swap = (s, a, b) => { if (!s.includes(a)) throw new Error('mutation anchor gone: ' + a.slice(0, 50)); return s.replace(a, b); };
    const M = [
      ['analytics added', { html: (s) => swap(s, '</head>', '<script defer src="/_vercel/insights/script.js"></script>\n</head>') }],
      ['the CSP allows scripts from this site', { html: (s) => swap(s, "script-src 'unsafe-inline'", "script-src 'self' 'unsafe-inline'") }],
      ['the Referer let through', { html: (s) => swap(s, '<meta name="referrer" content="no-referrer">', '<meta name="referrer" content="strict-origin-when-cross-origin">') }],
      ['noindex removed', { html: (s) => swap(s, '<meta name="robots" content="noindex, nofollow">', '') }],
      ['the header rule removed', { vercel: (s) => swap(s, '"source": "/reset-password(.*)"', '"source": "/reset-passwrd(.*)"') }],
      ['the page put in the sitemap', { sitemap: (s) => s + '<url><loc>https://www.halamove.co.za/reset-password</loc></url>' }],
      ['a reply written as HTML', { html: (s) => swap(s, "$(view + '-text').textContent = message || fallback;", "$(view + '-text').innerHTML = message || fallback;") }],
      ['the server sentence ignored', { html: (s) => swap(s, "$(view + '-text').textContent = message || fallback;", "$(view + '-text').textContent = fallback;") }],
      ['an ended link read as an outage', { html: (s) => swap(s, "if (r.status === 410) return say('ended', r.body.message, SAID.ended);\n      say('down'", "say('down'") }],
      ['the two boxes not compared', { html: (s) => swap(s, 'if (pw !== pw2)', 'if (false)') }],
      ['the length not checked', { html: (s) => swap(s, 'if (pw.length < MIN || pw.length > MAX)', 'if (false)') }],
      ['the password trimmed', { html: (s) => swap(s, "var pw = $('pw').value,", "var pw = $('pw').value.trim(),") }],
      ['the button left disabled after a failure', { html: (s) => swap(s, "    }).catch(function () {\n      btn.disabled = false;", "    }).catch(function () {\n      btn.disabled = true;") }],
      ['the token sent unencoded', { html: (s) => swap(s, "'?t=' + encodeURIComponent(token)", "'?t=' + token") }],
      ['a name on a password box', { html: (s) => swap(s, '<input type="password" id="pw"', '<input type="password" name="password" id="pw"') }],
    ];
    let caught = 0;
    for (const [label, edits] of M) {
      const s = Object.assign({}, SRC);
      for (const k of Object.keys(edits)) s[k] = edits[k](s[k].replace(/\r\n/g, '\n'));
      const red = (await runAll(s)).some(([, f]) => f.length);
      console.log('  ' + (red ? 'red  ' : 'MISS ') + 'mutation: ' + label);
      if (red) caught++;
    }
    console.log('\n  MUTATIONS: ' + caught + '/' + M.length + ' caught');
    if (caught !== M.length) bad++;
  }

  console.log('\n  RESET PASSWORD: ' + (total - Math.min(bad, total)) + '/' + total + (bad ? ' (FAIL)' : ''));
  process.exit(bad || total === 0 ? 1 : 0);
})().catch((e) => { console.error('  CHECK FAILED TO RUN: ' + e.message); process.exit(1); });
