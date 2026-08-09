// HALA MOVE — Routing Middleware: platform-aware store redirects for /drive and /get.
//
// WHY THIS EXISTS: /drive and /get used to be static vercel.json 307 redirects that ALWAYS pointed
// at Google Play, with NO user-agent detection. So an iPhone scanning a /drive QR landed on Google
// Play — not the App Store — even though the HALA Move DRIVER app went LIVE on the iOS App Store on
// 2026-07-23 (apps.apple.com/za/app/id6789447581 -> HTTP 200). Every /drive QR already printed or
// posted was sending iPhone drivers to the wrong store. Middleware runs before routing, reads the
// User-Agent, and sends iOS devices to the App Store and everything else to Google Play — so the
// SAME link already in the wild now routes each phone to its correct store.
//
// The /drive + /get entries were REMOVED from vercel.json on purpose: vercel.json `redirects` are
// evaluated BEFORE middleware, so leaving them there would preempt this file and the fix would
// silently do nothing. This middleware is now the single source of truth for those two paths.
//
// ?s= source code is preserved: as Google Play install `referrer` UTMs (utm_campaign/utm_content,
// same shape the old redirects produced) and as an Apple `ct` campaign token on iOS.
//
// 2026-07-31 — CUSTOMER iOS IS NOW LIVE, and this file was the last thing that did not know it.
// [SRC 2026-07-31] apps.apple.com/za/app/id6789445062 -> HTTP 200, og:title "HALA Move App";
// itunes lookup: bundleId com.hala.customer, version 1.0, releaseDate 2026-07-24T07:00:00Z. Control:
// a nonsense App Store id returns 404, which is what proves the 200 is real and not a catch-all.
//
// SO FOR SEVEN DAYS THIS REDIRECT LIED. APP_STORE['/get'] was null, so every iPhone that scanned a
// /get QR or tapped a /get link between 2026-07-24 and 2026-07-31 was sent to /download — a page
// whose own copy said the customer app was "coming soon to iPhone" — while it sat live in the App
// Store. The listing was reachable; nothing routed to it. A live listing that no link points at is
// functionally not live, and NOTHING in the system noticed: the fix below was written as a comment
// ("when the customer app ships, set this"), and a comment is a note, not a control. The durable
// lesson is the one the ten-day dead driver id already taught, one level out — there it was a doc
// carrying an id that 404s, here it is a redirect carrying an absence that had ended. Both were
// discovered by PROBING the live store, never by reading our own files.
//
// Verify each listing id against the app's own app.json + a live 200 (with a 404 control), never a
// doc — the driver package was renamed once and a dead id rode a doc for 10 days.

// 2026-08-09 — THE MATCHER WIDENED, AND WHY.
// It was ['/drive','/get']. It now matches everything, because this file has TAKEN OVER the
// apex -> www redirect that used to be a VERCEL DOMAIN-LEVEL setting.
//
// WHY THE MOVE: a domain-level redirect has no path exceptions, and it fires BEFORE routing, so
// middleware could never see an apex request at all ([SRC] halamove.co.za/get 307'd to www before
// this file ran). That was fine for pages and fatal for ONE path: Google's Digital Asset Links
// verifier DOES NOT FOLLOW REDIRECTS, so /.well-known/assetlinks.json on the apex answered 307 and
// Android App Link verification could never succeed there.
// [SRC 2026-08-09] statements:list?source.web.site=https://halamove.co.za -> ERROR_CODE_REDIRECT,
// 0 statements; the same query on www -> 4 statements, no errors.
//
// APPLE IS THE OPPOSITE, and we measured rather than assumed: Apple's CDN DOES follow the redirect
// ([SRC] app-site-association.cdn-apple.com/a/v1/halamove.co.za -> 200 with our file). So iOS was
// never broken by this; only Android was. Two vendors, same redirect, different behaviour — which
// is exactly why the rule is "probe the CDN, don't reason about it".
//
// WHAT IS PRESERVED: the apex still 307s to www for every page, so the canonical host is unchanged
// and there is no SEO change. 307 (not 308) is deliberate — it is what the domain-level redirect
// already returned, and this change is meant to alter exactly ONE thing.
// WHAT IS NEW: /.well-known/* is served DIRECTLY on both hosts, never redirected.
export const config = { matcher: ['/((?!_next/|_vercel/).*)'] };

const APEX = 'halamove.co.za';
const WWW  = 'www.halamove.co.za';

// Google Play package id per path.
const PLAY = {
  '/drive': 'com.hala.driverapp',
  '/get': 'com.hala.customer',
};

// iOS App Store destination per path. null = no live App Store listing yet -> IOS_FALLBACK.
const APP_STORE = {
  '/drive': 'https://apps.apple.com/za/app/id6789447581', // HALA Move Driver — LIVE 2026-07-23
  '/get': 'https://apps.apple.com/za/app/id6789445062',   // HALA Move (customer) — LIVE 2026-07-24
};
// Kept deliberately: it is the correct behaviour for any FUTURE app whose listing is not live yet.
// Both current entries are non-null, so nothing reaches it today.
const IOS_FALLBACK = 'https://halamove.co.za/download';

function redirect(location) {
  return new Response(null, { status: 307, headers: { Location: location, 'Cache-Control': 'no-store' } });
}

export default function middleware(request) {
  const url = new URL(request.url);
  const path = url.pathname;

  // ── 1. /.well-known/* IS NEVER REDIRECTED, ON EITHER HOST ────────────────────────────────────
  // This is the whole reason the matcher widened. Belt AND braces: the matcher could be edited
  // later by someone who does not know why it is shaped that way, so the guard lives in code too.
  // Deep-link association files must answer 200 at the ORIGIN Google/Apple ask for.
  if (path.startsWith('/.well-known/')) return;

  // ── 2. apex -> www, for everything else ──────────────────────────────────────────────────────
  // Replaces the Vercel domain-level redirect. Same 307, same destination, path + query preserved.
  const host = (request.headers.get('host') || '').toLowerCase().split(':')[0];
  if (host === APEX) {
    const dest = new URL(request.url);
    dest.hostname = WWW;
    return redirect(dest.toString());
  }

  // ── 3. platform-aware store routing (unchanged) ──────────────────────────────────────────────
  if (path !== '/drive' && path !== '/get') return;

  const ua = request.headers.get('user-agent') || '';
  const isIOS = /iPhone|iPad|iPod/i.test(ua);

  // ?s= source code — same allow-list the old vercel.json used ([A-Za-z0-9_-]{1,32}); reject anything else.
  const raw = url.searchParams.get('s');
  const src = raw && /^[A-Za-z0-9_-]{1,32}$/.test(raw) ? raw : null;

  if (isIOS) {
    const appStore = APP_STORE[path];
    if (appStore) {
      const dest = new URL(appStore);
      if (src) dest.searchParams.set('ct', src); // Apple App Analytics campaign token (harmless if unused)
      return redirect(dest.toString());
    }
    return redirect(IOS_FALLBACK); // no live App Store listing for this app yet (customer)
  }

  // Android / desktop / everything else -> Google Play, preserving the install-referrer UTMs.
  // utm_medium WAS HARDCODED 'qr'. That was true when every ?s= code came off a printed board,
  // and it quietly stopped being true the day paid ads started using the same door: an install
  // from a Meta ad tap landed in Play Console labelled medium=qr, so the one column whose whole
  // job is to separate paid acquisition from a scanned flyer said they were the same thing.
  // WHY IT SURVIVED: utm_campaign still carried the distinct code, so the split was always
  // RECOVERABLE — the wrongness cost nothing until someone read the medium column and believed
  // it. A field that is merely misleading outlives a field that is broken.
  // Paid codes are `ad-<concept>-<asset>` (AD_VARIATION_MATRIX convention) and the paid boards
  // deliberately carry NO QR, so the prefix is a safe discriminator: nothing with an `ad-` code
  // is ever scanned. Everything else KEEPS 'qr' on purpose — those codes really are printed
  // boards, and re-labelling them now would split their Play Console history across two mediums
  // for no gain. Apple's side needs nothing: `ct` is the only token, there is no medium concept.
  const medium = src && src.startsWith('ad-') ? 'paid_social' : 'qr';
  const referrer = new URLSearchParams({ utm_source: 'halamove', utm_medium: medium });
  if (src) { referrer.set('utm_campaign', src); referrer.set('utm_content', src); }
  const play = `https://play.google.com/store/apps/details?id=${PLAY[path]}&referrer=${encodeURIComponent(referrer.toString())}`;
  return redirect(play);
}
