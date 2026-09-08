#!/usr/bin/env node
'use strict';

// ── verify-vercel-config ─────────────────────────────────────────────────────────────────────
//
//   node verify-vercel-config.cjs      # exit 0 = valid, exit 1 = Vercel will reject the deploy
//
// WHY THIS EXISTS. On 2026-09-08 a redirect was added to vercel.json with a "_comment" key
// explaining why it was there. The file was checked with JSON.parse, which passed - it WAS valid
// JSON. It was not a valid Vercel config: redirect objects are `additionalProperties: false`, so
// the production deploy failed with "Vercel couldn't load a valid project configuration" and the
// website did not ship. The check passed for the wrong reason, which is the worst kind of green.
//
// vercel.json IS STRICT JSON AND CANNOT CARRY COMMENTS. That is the trap: the natural instinct is
// to explain a rule next to the rule, and here there is nowhere legal to do it. Prose about
// vercel.json belongs in this file or in README, never inside it.
//
// WHAT IT CHECKS. Every object in redirects / rewrites / headers is validated against the key set
// Vercel publishes at openapi.vercel.sh/vercel.json. The schema is fetched live so it cannot rot,
// and falls back to a PINNED key set when offline - with a loud note, because a check that
// silently degrades to nothing is the defect this file was born from.
//
// WHAT IT DOES NOT CHECK: that a redirect points somewhere useful. `/c/DANIEL -> /c/THECHITOMBIS`
// is schema-valid whether or not either code exists. Only a probe against the live site can tell
// you that, and only the backend's /api/creators/lookup/:code can say whether the destination is
// a real creator.
//
// ── WHY /c/DANIEL REDIRECTS (the note vercel.json cannot hold) ────────────────────────────────
// The creator code DANIEL was renamed to THECHITOMBIS on 2026-09-08, hours after it was created,
// at the creator's request ("he prefers his link to be The Chitombis"). It had 6 real browser
// opens by then, so the old URL went somewhere. Without the redirect that URL still RENDERS -
// /c/:code is a generic page that reads the code out of the path - while the API lookup 404s, so
// the badge goes unnamed and anyone signing up with DANIEL is attributed to NOBODY and the
// creator is paid nothing. A page that looks fine and pays nobody is a silent failure.
// The redirect is safe to delete once nothing points at /c/DANIEL any more; harmless to leave.

const fs = require('fs');
const path = require('path');

const CONFIG = path.join(__dirname, 'vercel.json');
const SCHEMA_URL = 'https://openapi.vercel.sh/vercel.json';

// Pinned fallback, read from the live schema on 2026-09-08. Used ONLY when the fetch fails, and
// the run says so rather than quietly reporting a pass it did not earn.
const PINNED = {
  redirects: ['source', 'destination', 'permanent', 'statusCode', 'has', 'missing', 'env'],
  rewrites:  ['source', 'destination', 'has', 'missing', 'statusCode'],
  headers:   ['source', 'headers', 'has', 'missing'],
};

function itemKeys(schema, section) {
  const node = schema && schema.properties && schema.properties[section];
  if (!node) return null;
  const item = node.items || (node.anyOf && node.anyOf[0] && node.anyOf[0].items);
  return item && item.properties ? Object.keys(item.properties) : null;
}

async function loadAllowed() {
  try {
    const res = await fetch(SCHEMA_URL);
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const schema = await res.json();
    const out = {};
    for (const s of Object.keys(PINNED)) out[s] = itemKeys(schema, s) || PINNED[s];
    return { allowed: out, source: 'live schema (' + SCHEMA_URL + ')' };
  } catch (e) {
    return { allowed: PINNED, source: 'PINNED FALLBACK - could not fetch the live schema (' + e.message + '). Keys may be out of date.' };
  }
}

(async () => {
  if (!fs.existsSync(CONFIG)) {
    console.error('FAIL: vercel.json not found at ' + CONFIG);
    process.exit(1);
  }

  let cfg;
  try {
    cfg = JSON.parse(fs.readFileSync(CONFIG, 'utf8'));
  } catch (e) {
    console.error('FAIL: vercel.json is not valid JSON - ' + e.message);
    process.exit(1);
  }

  const { allowed, source } = await loadAllowed();
  console.log('key set from: ' + source + '\n');

  let bad = 0;
  let checked = 0;
  for (const section of Object.keys(PINNED)) {
    const entries = cfg[section];
    if (!Array.isArray(entries)) continue;
    const ok = new Set(allowed[section]);
    entries.forEach((entry, i) => {
      checked += 1;
      const extra = Object.keys(entry).filter((k) => !ok.has(k));
      const label = '  ' + section + '[' + i + '] ' + (entry.source || '(no source)');
      if (extra.length) {
        bad += 1;
        console.log(label + '\n      ILLEGAL KEY(S): ' + extra.join(', ')
          + '\n      allowed here: ' + allowed[section].join(', '));
      } else {
        console.log(label + '  ok');
      }
    });
  }

  // total > 0 guard: "nothing to check" must never read as "all pass".
  if (checked === 0) {
    console.error('\nFAIL: found no redirects/rewrites/headers to check - the extractor is broken, not the config clean.');
    process.exit(1);
  }

  console.log('\n' + (bad === 0
    ? 'PASS: ' + checked + '/' + checked + ' entries valid - Vercel will accept this config.'
    : 'FAIL: ' + bad + ' of ' + checked + ' entries carry keys Vercel rejects. The deploy WILL fail with '
      + '"Vercel couldn\'t load a valid project configuration".'));
  process.exit(bad === 0 ? 0 : 1);
})();
