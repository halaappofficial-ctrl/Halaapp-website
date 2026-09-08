#!/usr/bin/env node
'use strict';

// ── verify-contact-routes ────────────────────────────────────────────────────────────────────
//
//   node verify-contact-routes.cjs      # exit 0 = every enquiry route is a declared one
//
// WHY THIS EXISTS. On 2026-09-08 the business landing page routed enquiries to
// business@halamove.co.za in three places - a visible mailto and BOTH failure messages, the copy
// that fires at the exact moment a lead has failed to save. That address is not in
// brand-manifest.json, which declares exactly one: contact@halamove.co.za. Whether business@ is a
// real mailbox is not knowable from this repo, and the asymmetry is what decides it: if it exists,
// routing to contact@ costs an inbox hop; if it does not, a five-figure enquiry is simply gone,
// silently, with the sender believing they have reached us.
//
// A third address, hello@halamove.co.za, was found only in baselines/*.json - Kapture QA snapshots
// that Vercel does not serve and that are dated records, so they are excluded rather than edited.
//
// THE RULE: an address a customer can reach us on is a PROMISE that someone is reading it. The
// manifest is where this project declares its promises, so the manifest is the allowlist.
//
// WHAT IT CANNOT DO, stated plainly: it proves the site only advertises DECLARED addresses. It
// cannot prove the mailbox behind a declared address is monitored, or that it exists at all - the
// MX for halamove.co.za is GoDaddy (secureserver.net) and nothing here can enumerate mailboxes.
// That last mile is a human check, and it is worth doing.

const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const MANIFEST = path.join(ROOT, 'brand-manifest.json');
const DOMAIN_RE = /[a-zA-Z0-9._%+-]+@halamove\.co\.za/g;

// Not served by Vercel, and dated records besides: a baseline is true at its epoch and must not be
// rewritten to today's truth.
const SKIP_DIRS = new Set(['node_modules', '.git', 'baselines', 'docs', 'images', 'assets']);
const SKIP_FILE = (n) => n.endsWith('.bak') || n.endsWith('.png') || n.endsWith('.jpg');

function walk(dir, out = []) {
  for (const name of fs.readdirSync(dir)) {
    if (SKIP_DIRS.has(name) || SKIP_FILE(name)) continue;
    const fp = path.join(dir, name);
    const st = fs.statSync(fp);
    if (st.isDirectory()) walk(fp, out);
    // CUSTOMER-FACING SURFACES ONLY, and the exclusion of .cjs/.js is the subject, not a dodge.
    // The first version scanned build and verify scripts too, and flagged verify-landing-pages.cjs
    // - where the address appears only inside the guard FORBIDDING it. Naming an address to
    // prohibit it is not advertising it ([[L-71]]), and a build script is not a route a customer
    // can reach us on. The question this file asks is "can a customer send mail to somewhere
    // nobody reads?", so it looks at what a customer can actually see.
    else if (/\.(html|txt|json|xml|svg)$/.test(name)) out.push(fp);
  }
  return out;
}

const manifestSrc = fs.readFileSync(MANIFEST, 'utf8');
const declared = new Set(manifestSrc.match(DOMAIN_RE) || []);

if (declared.size === 0) {
  // total > 0 guard: an empty allowlist would make every address "undeclared" and the run
  // meaningless in the loud direction, or - worse, if inverted one day - silently permissive.
  console.error('FAIL: brand-manifest.json declares NO halamove.co.za address. The allowlist is empty, so this check cannot mean anything.');
  process.exit(1);
}

console.log('declared in brand-manifest.json: ' + [...declared].join(', ') + '\n');

const offenders = [];
let scanned = 0;
for (const fp of walk(ROOT)) {
  const rel = path.relative(ROOT, fp);
  // This file NAMES the offending address in order to forbid it, exactly like the guards in
  // verify-landing-pages.cjs. A prohibition is not a promise ([[L-71]]).
  if (rel === 'verify-contact-routes.cjs') continue;
  const src = fs.readFileSync(fp, 'utf8');
  const found = src.match(DOMAIN_RE);
  if (!found) continue;
  scanned += 1;
  for (const addr of new Set(found)) {
    if (!declared.has(addr)) offenders.push({ rel, addr });
  }
}

if (scanned === 0) {
  console.error('FAIL: no file on the site mentions a halamove.co.za address at all - the scanner is broken, not the site clean.');
  process.exit(1);
}

if (offenders.length === 0) {
  console.log('PASS: all addresses across ' + scanned + ' served file(s) are declared in the manifest.');
  process.exit(0);
}

console.log('FAIL: ' + offenders.length + ' undeclared address(es) reachable by a customer:');
for (const o of offenders) console.log('  ' + o.rel + '  ->  ' + o.addr);
console.log('\nEither add the address to brand-manifest.json (which asserts somebody reads it),');
console.log('or route it to a declared one. An address nobody monitors loses the enquiry silently.');
process.exit(1);
