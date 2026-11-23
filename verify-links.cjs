#!/usr/bin/env node
'use strict';

// -- verify-links ----------------------------------------------------------------------------------------------------
//
//   node verify-links.cjs           # exit 0 = every link on every page goes somewhere
//   node verify-links.cjs --prove   # also breaks each rule in memory and requires the check to go red
//
// THE DEFECT (found 2026-11-24 while bringing the download and invite pages into the site's system): the footer of 12
// pages offered "Privacy" and "Terms" as <a href="#">, so a visitor looking for the privacy policy or the terms from
// the bottom of the about page, the FAQ or any service page was sent to the top of the same page. Every gate read the
// words of the link; none read where it went.
//
// THE RULES, for every <a href> on every page:
//   1. "#" alone goes nowhere.
//   2. "#name" names an element on the same page (id or name).
//   3. A path on this site ("/faq", "/#drivers", "/assets/x.png") is a file here, a clean URL of one, a rewrite or a
//      redirect in vercel.json, or a path middleware.js answers; "/page#name" also names an element on that page.
// Links to other hosts, mailto:, tel: and sms: are not followed (a request from a gate is not a visitor).

const fs = require('fs');
const path = require('path');
const ROOT = __dirname;

function routesFrom(vercel, middleware) {
  const pats = [];
  for (const r of [].concat(vercel.rewrites || [], vercel.redirects || [])) {
    const src = String(r.source || '');
    pats.push(new RegExp('^' + src.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\/:[\w]+\*/g, '(?:/.*)?').replace(/:[\w]+/g, '[^/]+') + '/?$'));
  }
  // middleware.js answers the store doors (the keys of its PLAY table, /drive and /get) and the /card pages itself.
  const play = middleware.match(/const PLAY = \{([\s\S]*?)\}/);
  if (play) for (const k of play[1].matchAll(/'(\/[\w-]+)'\s*:/g)) pats.push(new RegExp('^' + k[1] + '/?$'));
  if (/startsWith\('\/card\/'\)/.test(middleware)) pats.push(/^\/card\/[^/]+$/i);
  return pats;
}

function idsOf(html) {
  return new Set([...html.matchAll(/\s(?:id|name)="([^"]+)"/g)].map((m) => m[1]));
}

function check(pages, files, routes) {
  const fails = [];
  let links = 0;
  const byName = new Map(pages);
  const fileFor = (p) => {
    const clean = p.replace(/\/+$/, '') || '/index';
    const rel = clean.replace(/^\//, '');
    if (files.has(rel)) return rel;
    if (files.has(rel + '.html')) return rel + '.html';
    if (files.has(rel + '/index.html')) return rel + '/index.html';
    return null;
  };
  for (const [file, html] of pages) {
    const markup = html.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<!--[\s\S]*?-->/g, '');
    const ids = idsOf(markup);
    for (const m of markup.matchAll(/<a\b[^>]*\shref="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi)) {
      const href = m[1].replace(/&amp;/g, '&');
      const text = m[2].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 40) || '(no text)';
      links++;
      if (href === '#' || href === '') { fails.push(file + ': "' + text + '" goes nowhere (href="' + href + '")'); continue; }
      if (href.startsWith('#')) {
        if (!ids.has(decodeURIComponent(href.slice(1)))) fails.push(file + ': "' + text + '" points at ' + href + ', which is not on the page');
        continue;
      }
      if (!href.startsWith('/') || href.startsWith('//')) continue;
      const [pathPart, hash] = href.split('#');
      const p = pathPart.split('?')[0];
      const target = fileFor(p);
      if (!target && !routes.some((re) => re.test(p))) { fails.push(file + ': "' + text + '" goes to ' + p + ', which this site does not serve'); continue; }
      if (hash && target && byName.has(target) && !idsOf(byName.get(target).replace(/<script[\s\S]*?<\/script>/gi, '')).has(hash)) {
        fails.push(file + ': "' + text + '" points at ' + href + ', and ' + target + ' has no #' + hash);
      }
    }
  }
  return { fails, links };
}

function listFiles(dir, base = '') {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name.startsWith('.') || e.name === 'node_modules') continue;
    const rel = base ? base + '/' + e.name : e.name;
    if (e.isDirectory()) out.push(...listFiles(path.join(dir, e.name), rel)); else out.push(rel);
  }
  return out;
}

const files = new Set(listFiles(ROOT));
const pages = [...files].filter((f) => /^[^/]+\.html$/.test(f)).sort().map((f) => [f, fs.readFileSync(path.join(ROOT, f), 'utf8')]);
const vercel = JSON.parse(fs.readFileSync(path.join(ROOT, 'vercel.json'), 'utf8'));
const middleware = fs.existsSync(path.join(ROOT, 'middleware.js')) ? fs.readFileSync(path.join(ROOT, 'middleware.js'), 'utf8') : '';
const routes = routesFrom(vercel, middleware);
const res = check(pages, files, routes);
if (!pages.length || !res.links) res.fails.push('no link was found to check (the reader is broken)');

const proveFails = [];
if (process.argv.includes('--prove')) {
  const swap = (file, fn) => pages.map(([f, h]) => [f, f === file ? fn(h) : h]);
  const breaks = [
    ['a footer link to "#"', swap('faq.html', (h) => h.replace('</footer>', '<a href="#">Privacy</a></footer>'))],
    ['an anchor to a section the page does not have', swap('terms.html', (h) => h.replace('</footer>', '<a href="#no-such-section">Jump</a></footer>'))],
    ['a page path that is not served', swap('about.html', (h) => h.replace('</footer>', '<a href="/privacy-policy">Privacy</a></footer>'))],
    ['a cross-page anchor to a missing section', swap('about.html', (h) => h.replace('</footer>', '<a href="/#no-such-section">Home</a></footer>'))],
  ];
  for (const [label, mutated] of breaks) {
    if (mutated.every(([f, h], i) => h === pages[i][1])) { proveFails.push('PROVE: "' + label + '" did not change any page (the break is stale)'); continue; }
    if (check(mutated, files, routes).fails.length <= res.fails.length) proveFails.push('PROVE: "' + label + '" stayed green');
  }
  console.log('  PROVE: ' + (breaks.length - proveFails.length) + '/' + breaks.length + ' breaks turn the check red');
}

res.fails.concat(proveFails).forEach((f) => console.log('  FAIL ' + f));
if (res.fails.length || proveFails.length) { console.log('  LINKS: FAIL (' + res.fails.length + ' of ' + res.links + ' links)'); process.exit(1); }
console.log('  LINKS: ' + res.links + ' links on ' + pages.length + ' pages, every one goes somewhere');
