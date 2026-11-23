#!/usr/bin/env node
'use strict';

// -- verify-dead-scripts ---------------------------------------------------------------------------------------------
//
//   node verify-dead-scripts.cjs           # exit 0 = every element-guarded script has its element on the page
//   node verify-dead-scripts.cjs --prove   # also breaks each rule in memory and requires the check to go red
//
// THE DEFECT (found 2026-11-24 in Chrome while moving the home page hero): pages copied from one template kept that
// template's scripts. Thirteen service and legal pages each ran a city-grid canvas animation, a phone countdown and an
// earnings calculator for elements none of them carries; each script found nothing and returned. The home page carried
// the opposite half: a <canvas id="city-canvas"> painted by no script. Nothing broke, so nothing noticed.
//
// RULE 1: a script that looks an element up by id and returns when it is missing (const x =
// document.getElementById('id'); ... if(!x) return;) must find that element in the page's markup.
// RULE 2: a <canvas> with an id is drawn by a script on its own page.

const fs = require('fs');
const path = require('path');
const ROOT = __dirname;

function check(pages) {
  const fails = [];
  let guards = 0;
  let canvases = 0;
  for (const [file, html] of pages) {
    const markup = html.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<style[\s\S]*?<\/style>/gi, '').replace(/<!--[\s\S]*?-->/g, '');
    const ids = new Set([...markup.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]));
    const scripts = [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)].map((m) => m[1]).join('\n');
    for (const g of scripts.matchAll(/if\s*\(\s*(!\s*\w+(?:\s*\|\|\s*!\s*\w+)*)\s*\)\s*return\b/g)) {
      const before = scripts.slice(Math.max(0, g.index - 800), g.index);
      const vars = g[1].split('||').map((v) => v.replace(/[!\s]/g, ''));
      for (const v of vars) {
        const b = before.match(new RegExp('(?:const|let|var)\\s+' + v + '\\s*=\\s*document\\.getElementById\\(\'([\\w-]+)\'\\)'));
        if (!b) continue;
        guards++;
        if (!ids.has(b[1])) fails.push(file + ': a script waits for #' + b[1] + ', which the page does not carry, so it never runs');
      }
    }
    for (const c of markup.matchAll(/<canvas\b[^>]*\sid="([^"]+)"/gi)) {
      canvases++;
      if (!new RegExp('getElementById\\(\'' + c[1] + '\'\\)|querySelector(All)?\\(\'#' + c[1] + '\'\\)').test(scripts)) {
        fails.push(file + ': <canvas id="' + c[1] + '"> is drawn by no script on the page');
      }
    }
  }
  return { fails, guards, canvases };
}

const files = fs.readdirSync(ROOT).filter((f) => f.endsWith('.html')).sort();
const pages = files.map((f) => [f, fs.readFileSync(path.join(ROOT, f), 'utf8')]);
const res = check(pages);
if (!pages.length || !res.guards) res.fails.push('no guarded script was found to check (the reader is broken)');

let proveFails = [];
if (process.argv.includes('--prove')) {
  const swap = (file, fn) => pages.map(([f, h]) => [f, f === file ? fn(h) : h]);
  const breaks = [
    ['a template script copied to a page without its element', swap('terms.html', (h) => h.replace('</body>', "<script>(function(){ const el = document.getElementById('phone-timer'); if(!el) return; el.textContent = '1'; }());</script></body>"))],
    ['a script whose element was renamed', swap('index.html', (h) => h.replace('id="jobs-slider"', 'id="jobs-range"'))],
    ['a canvas no script draws', swap('faq.html', (h) => h.replace('</body>', '<canvas id="city-canvas" aria-hidden="true"></canvas></body>'))],
  ];
  for (const [label, mutated] of breaks) {
    if (mutated.every(([f, h], i) => h === pages[i][1])) { proveFails.push('PROVE: "' + label + '" did not change any page (the break is stale)'); continue; }
    if (check(mutated).fails.length === 0) proveFails.push('PROVE: "' + label + '" stayed green');
  }
  console.log('  PROVE: ' + (breaks.length - proveFails.length) + '/' + breaks.length + ' breaks turn the check red');
}

res.fails.concat(proveFails).forEach((f) => console.log('  FAIL ' + f));
if (res.fails.length || proveFails.length) { console.log('  DEAD SCRIPTS: FAIL'); process.exit(1); }
console.log('  DEAD SCRIPTS: ' + pages.length + ' pages, ' + res.guards + ' element-guarded lookups all find their element, ' + res.canvases + ' canvases drawn');
