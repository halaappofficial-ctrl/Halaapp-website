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

export const config = { matcher: ['/drive', '/get'] };

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
  // Defensive: the matcher already scopes this to /drive + /get. Anything else passes straight through.
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
  const referrer = new URLSearchParams({ utm_source: 'halamove', utm_medium: 'qr' });
  if (src) { referrer.set('utm_campaign', src); referrer.set('utm_content', src); }
  const play = `https://play.google.com/store/apps/details?id=${PLAY[path]}&referrer=${encodeURIComponent(referrer.toString())}`;
  return redirect(play);
}
