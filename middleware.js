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

  // (medium classification lives in mediumFor(), below the handler — see the table there.)

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
  const medium = mediumFor(src);
  // utm_source stays 'halamove' deliberately: changing it would split every campaign's Play Console
  // history, and the specific origin is already recoverable from utm_campaign (the ?s= code itself,
  // e.g. `ig-d7` names Instagram). Medium is the field that describes the CHANNEL, and it is the one
  // that was wrong.
  const referrer = new URLSearchParams({ utm_source: 'halamove', utm_medium: medium });
  if (src) { referrer.set('utm_campaign', src); referrer.set('utm_content', src); }
  const play = `https://play.google.com/store/apps/details?id=${PLAY[path]}&referrer=${encodeURIComponent(referrer.toString())}`;
  return redirect(play);
}

// ── utm_medium: WHICH DOOR DID THIS INSTALL COME THROUGH? ──────────────────────────────────────
//
// HISTORY. utm_medium was hardcoded 'qr'. That was true when every ?s= code came off a printed
// board, and stopped being true the day paid ads used the same door — an install from a Meta ad tap
// landed in Play Console labelled medium=qr, so the one column whose whole job is to separate paid
// acquisition from a scanned flyer said they were the same thing. Commit 5493b29 fixed that with
// `src.startsWith('ad-') ? 'paid_social' : 'qr'`.
//
// THAT FIX WAS RIGHT AND INCOMPLETE, and the shape of the incompleteness is worth naming: it treated
// a MISSING DIMENSION as a single exception. Every code that was not `ad-` still fell to 'qr', so the
// moment a third door existed it was mislabelled again — and two already did:
//   [SRC] codes present in the asset pipeline, 2026-08-10:
//     ig-14d-02, ig-14d-04, ig-cep-couch-a, ig-d7 …  Instagram   -> reported as QR SCANS
//     tt-d9w1                                        TikTok      -> reported as a QR SCAN
// So organic social has been landing in the same bucket as printed flyers this whole time. A fourth
// door then arrived (check-in SMS, `ci-*`), which is what prompted looking.
//
// Hence a TABLE rather than another ternary. Adding a channel is now one line, and the default is
// stated once instead of being whatever the last `else` happened to be.
//
// PRINT CODES KEEP 'qr' ON PURPOSE (ios-c, ios-d, kasi-umlazi, umlazi-d2 …). Those really are
// scanned boards, and re-labelling them now would split their Play Console history across two
// mediums for no gain.
//
// NO CODE AT ALL -> 'direct', which is a CHANGE. A bare /drive — typed, or shared in a WhatsApp
// message — is not a scan, and calling it one inflated the QR column with traffic that never met a
// QR code. Nothing is split by this: when there is no ?s= there is no utm_campaign either, so those
// installs carry no campaign history to fragment.
//
// SAFE TO CHANGE AT ALL: a counted sweep of backend/src and both mobile src trees found NOTHING that
// reads these UTMs back (no Install Referrer API use anywhere). Play Console is the only consumer, so
// this changes a report, never behaviour. Apple's side needs nothing — `ct` is the only token it
// takes and there is no medium concept.
//
// ⚠️ NOT GUARDED BY A LOOP. The backend invariant suite cannot reach this repo (separate repo, machine
// -specific path), so this mapping is protected by its commit and by probing the live redirect —
// `curl -A '<android UA>' 'https://www.halamove.co.za/drive?s=ci-dos'` and read utm_medium back.
const MEDIUM_BY_PREFIX = [
  ['ad-', 'paid_social'], // paid Meta/social buys — AD_VARIATION_MATRIX convention; these boards carry NO QR
  ['ig-', 'social'],      // Instagram organic posts
  ['tt-', 'social'],      // TikTok organic posts
  ['ci-', 'sms'],         // check-in messages, SMS channel (backend checkinCampaigns.js, one code per campaign)
  // ['cp-', 'push'] ships WITH the backend change that emits these codes (2026-08-11). The store
  // link went into check-in PUSH bodies too, because push is the channel most recipients actually
  // resolve to. It needs its own prefix rather than reusing 'ci-': MEDIUM_CODED_DEFAULT below is
  // 'qr', so an unrecognised code does not read as unknown — it reads as a PRINTED BOARD, which is
  // the exact wrong answer and the same shape as the hardcoded-'qr' bug this table was built to end.
  // The campaign half of the code mirrors the SMS one (ci-dos / cp-dos), so utm_campaign joins the
  // two channels of one campaign instead of splitting it into two unrelated-looking campaigns.
  ['cp-', 'push'],        // check-in messages, push channel
];
const MEDIUM_CODED_DEFAULT = 'qr';   // an unrecognised code is a printed board until proven otherwise
const MEDIUM_NO_CODE = 'direct';     // no ?s= at all: typed, bookmarked, or shared as a bare link

function mediumFor(src) {
  if (!src) return MEDIUM_NO_CODE;
  for (const [prefix, medium] of MEDIUM_BY_PREFIX) {
    if (src.startsWith(prefix)) return medium;
  }
  return MEDIUM_CODED_DEFAULT;
}
