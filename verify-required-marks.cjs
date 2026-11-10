#!/usr/bin/env node
'use strict';

// -- verify-required-marks ------------------------------------------------------------------------
//
//   node verify-required-marks.cjs           # exit 0 = every field a visitor fills says whether it must be filled
//   node verify-required-marks.cjs --prove   # also breaks each rule in memory and requires the check to go red
//
// THE RULE (2026-11-10): "Mandatory fields should have an asterisk in red or any visible color that aligns with
// our premium design." A field that must be filled carries a red asterisk after its label (#FF4444, the apps'
// error red, the same mark as mobile components/RequiredMark.js); a field that may be skipped says "(optional)".
// A person should never be stopped by an error they could not see coming.
//
// WHAT IT HOLDS:
//   1. assets/lead-form.js (/quote and /business-transport-durban): every question is EITHER optional OR carries
//      a `req` message, never both and never neither, so the star never promises a check that is not made; the
//      label renderer gives the star to every non-optional question and "(optional)" to the rest; the consent box
//      carries the star; the stylesheet colours it #FF4444.
//   2. refund.html: every label in the bank-details form carries the star (all four fields are required).
//   3. index.html early access: email OR phone, so the pair is one question with the star, and the script still
//      refuses a send with both boxes empty (that refusal is what makes the star true).
//   4. No OTHER page has a field a visitor fills in. A new form fails here until it is covered above.
//
// WHAT IT CANNOT DO: it reads source. Whether the star reads well beside each label is an on-screen check.

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = __dirname;
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
const COVERED = { 'index.html': 1, 'refund.html': 1 };

function between(src, a, b) {
  const i = src.indexOf(a);
  if (i < 0) return '';
  const j = src.indexOf(b, i + a.length);
  return j < 0 ? '' : src.slice(i, j + b.length);
}

// ---- 1. the shared lead form -----------------------------------------------------------------------
function checkLeadForm(js, css) {
  const fails = [];
  const start = js.indexOf("'use strict';");
  const stop = js.indexOf('var COPY = {');
  if (start < 0 || stop < 0) return ['lead-form.js: question set not found'];
  let qs;
  try {
    const ctx = { root: {} };
    vm.runInNewContext(js.slice(start, stop) + '\n;this.__Q = { DEMAND: DEMAND, FLEET: FLEET };', ctx);
    qs = ctx.__Q;
  } catch (e) {
    return ['lead-form.js: question set does not evaluate: ' + e.message];
  }
  let n = 0;
  for (const flow of ['DEMAND', 'FLEET']) {
    for (const step of qs[flow] || []) {
      for (const q of step.qs || []) {
        n++;
        const id = flow + '.' + q.key;
        if (q.type === 'consent') { if (!q.req) fails.push(id + ': the consent box has no req message'); continue; }
        if (!!q.optional === !!q.req) {
          fails.push(id + (q.optional ? ': optional AND has a req message' : ': neither optional nor checked (no req message)'));
        }
      }
    }
  }
  if (n === 0) fails.push('lead-form.js: zero questions read');

  const reqLine = (js.match(/^\s*var REQ = .*;$/m) || [''])[0];
  const labelLine = (js.match(/^\s*function label\(qd\) \{.*\}$/m) || [''])[0];
  const escFn = between(js, 'function esc(', '\n  }');
  if (!reqLine || !labelLine || !escFn) {
    fails.push('lead-form.js: REQ, label() or esc() not found');
  } else {
    try {
      const ctx = {};
      vm.runInNewContext(escFn + '\n' + reqLine + '\n' + labelLine + '\n;this.label = label;', ctx);
      const must = ctx.label({ label: 'Business name' });
      const may = ctx.label({ label: 'Your role', optional: true });
      if (!/class="lf-req"[^>]*>\s*\*<\/span>/.test(must)) fails.push('label(): a required question renders no red star');
      if (!/\(required\)/.test(must)) fails.push('label(): a required question gives screen readers no "(required)"');
      if (!/\(optional\)/.test(may) || /lf-req/.test(may)) fails.push('label(): an optional question is not marked "(optional)" alone');
    } catch (e) {
      fails.push('label() does not evaluate: ' + e.message);
    }
  }
  if (!/sentence \+ REQ/.test(js)) fails.push('lead-form.js: the consent box lost its star');
  if (!/--lf-req:#FF4444/i.test(css) || !/\.lf \.lf-req\{color:var\(--lf-req\)/.test(css)) {
    fails.push('lead-form.css: the star is not coloured #FF4444');
  }
  return fails;
}

// ---- 2. refund details -------------------------------------------------------------------------------
function checkRefund(html) {
  const fails = [];
  const form = between(html, '<form class="card hidden" id="form"', '</form>');
  if (!form) return ['refund.html: the bank-details form not found'];
  const labels = form.match(/<label\b[^>]*>[\s\S]*?<\/label>/g) || [];
  if (labels.length !== 4) fails.push('refund.html: expected 4 field labels, found ' + labels.length);
  for (const l of labels) {
    if (!/class="req"[^>]*>\s*\*<\/span>/.test(l) && !/\(optional\)/.test(l)) {
      fails.push('refund.html: "' + l.replace(/<[^>]+>/g, '').trim() + '" carries neither the star nor "(optional)"');
    }
  }
  if (!/\.req\{\s*color:#FF4444/i.test(html)) fails.push('refund.html: the star is not coloured #FF4444');
  return fails;
}

// ---- 3. early access -----------------------------------------------------------------------------------
function checkEarlyAccess(html) {
  const fails = [];
  const form = between(html, '<form id="eaForm"', '</form>');
  if (!form) return ['index.html: the early-access form not found'];
  if (!/id="eaAsk"[^>]*>[^<]*<span class="ea-req"[^>]*>\s*\*<\/span>/.test(form)) {
    fails.push('index.html: the email-or-phone question carries no red star');
  }
  if (!/aria-labelledby="eaAsk"/.test(form)) fails.push('index.html: the two boxes are not grouped under the question');
  for (const id of ['eaEmail', 'eaPhone']) {
    if (!new RegExp('<label[^>]*for="' + id + '"').test(form)) fails.push('index.html: #' + id + ' has no label');
  }
  if (!/if\(!email && !phone\)/.test(html)) fails.push('index.html: a send with both boxes empty is no longer refused, so the star lies');
  if (!/\.ea-req\{color:var\(--err\)/.test(html) || !/--err:#FF4444/i.test(html)) {
    fails.push('index.html: the star is not coloured #FF4444');
  }
  return fails;
}

// ---- 4. no uncovered form ------------------------------------------------------------------------------
function uncoveredForms(files) {
  const fails = [];
  for (const [name, html] of files) {
    if (COVERED[name]) continue;
    const fields = (html.match(/<(input|select|textarea)\b[^>]*>/gi) || [])
      .filter((t) => !/type="(hidden|range)"/i.test(t) && !/aria-hidden="true"/i.test(t));
    if (fields.length) fails.push(name + ': ' + fields.length + ' field(s) a visitor fills, not covered by this check');
  }
  return fails;
}

function runAll(src) {
  return [
    ['lead form', checkLeadForm(src.js, src.css)],
    ['refund details', checkRefund(src.refund)],
    ['early access', checkEarlyAccess(src.index)],
    ['other pages', uncoveredForms(src.pages)],
  ];
}

const pages = fs.readdirSync(ROOT).filter((f) => f.endsWith('.html')).map((f) => [f, read(f)]);
const SRC = {
  js: read('assets/lead-form.js'),
  css: read('assets/lead-form.css'),
  refund: read('refund.html'),
  index: read('index.html'),
  pages,
};

let total = 0;
let bad = 0;
for (const [name, fails] of runAll(SRC)) {
  total++;
  if (fails.length) { bad++; console.log('  FAIL ' + name); for (const f of fails) console.log('       ' + f); }
  else console.log('  ok   ' + name);
}

if (process.argv.includes('--prove')) {
  // Each mutation breaks one rule in memory; the check must go red on it, or the check is not a check.
  const swap = (s, a, b) => { if (!s.includes(a)) throw new Error('mutation anchor gone: ' + a.slice(0, 50)); return s.replace(a, b); };
  const M = [
    ['the star taken off required questions', { js: (s) => swap(s, ": REQ); }", ": ''); }") }],
    ['a required question loses its check', { js: (s) => swap(s, "req: 'Choose how many deliveries you send in a normal week.' ", '') }],
    ['an optional question also checked', { js: (s) => swap(s, "{ key: 'role', type: 'chips', optional: true,", "{ key: 'role', type: 'chips', optional: true, req: 'x',") }],
    ['the consent star removed', { js: (s) => swap(s, 'sentence + REQ', 'sentence') }],
    ['the star recoloured', { css: (s) => swap(s, '--lf-req:#FF4444', '--lf-req:#A3A3A3') }],
    ['a refund label without the star', { refund: (s) => swap(s, 'Account number<span class="req" aria-hidden="true"> *</span>', 'Account number') }],
    ['early access star removed', { index: (s) => swap(s, '<span class="ea-req" aria-hidden="true"> *</span>', '') }],
    ['early access empty send allowed', { index: (s) => swap(s, 'if(!email && !phone)', 'if(false)') }],
    ['a new page with a form', { pages: (p) => p.concat([['new.html', '<form><input type="text" name="x"></form>']]) }],
  ];
  let caught = 0;
  for (const [label, edits] of M) {
    const s = Object.assign({}, SRC);
    for (const k of Object.keys(edits)) s[k] = edits[k](s[k]);
    const red = runAll(s).some(([, f]) => f.length);
    console.log('  ' + (red ? 'red  ' : 'MISS ') + 'mutation: ' + label);
    if (red) caught++;
  }
  console.log('\n  MUTATIONS: ' + caught + '/' + M.length + ' caught');
  if (caught !== M.length) bad++;
}

console.log('\n  REQUIRED MARKS: ' + (total - Math.min(bad, total)) + '/' + total + (bad ? ' (FAIL)' : ''));
process.exit(bad ? 1 : 0);
