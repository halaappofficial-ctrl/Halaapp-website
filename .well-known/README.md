# App-association files for HALA MOVE deep links

These two files make `https://halamove.co.za/invite/CODE` and `/driver-invite/CODE`
open the app SEAMLESSLY (Android App Links / iOS Universal Links) instead of the browser.

## STATUS: FILLED IN 2026-08-09 — they were placeholders for months

Both files shipped with `REPLACE_WITH_*` placeholders and were never filled, so iOS
Universal Links and Android App Link verification had a **lifetime success count of zero**
([[L-212]] shape: present, deployed, and never once working). A tapped `/invite/CODE` link
opened the website instead of the app. The web funnel always worked — the landing pages show
and copy the code for manual paste — so this was a degraded hand-off, never a dead door,
which is exactly why nothing ever forced the issue.

## apple-app-site-association (iOS) — DONE

- Apple **Team ID `72U65HN6DA`**. [SRC 2026-08-09] read from the Apple Developer portal
  (Certificates, Identifiers & Profiles header: `PROFITSAGE PTY LTD - 72U65HN6DA`) AND
  independently from the EAS GraphQL API, which maps BOTH `com.hala.customer` and
  `com.hala.driverapp` to that same team. Two independent sources, agreeing.
- The old warning here was right and is retained: Member ID `5S2CQN8NFY` is the enrolment
  reference, **NOT** the Team ID. They are different values; do not substitute one.
- ⚠️ The Apple Developer account is now an **ORGANISATION**: `PROFITSAGE PTY LTD`. It was an
  individual account under Zanele Penelope Mhlanga. Per the account owner, only the entity
  NAME changed — the Team ID did not. EAS still caches the old team name
  ("Zanele Penelope Mhlanga (Individual)"); that string is stale, the identifier is not.
- Served WITHOUT a file extension; `vercel.json` forces `Content-Type: application/json`
  for it (the classic Universal Links gotcha — iOS silently rejects any other type).

### The redirect is NOT a problem — measured, not assumed
The apex 307-redirects `/.well-known/apple-app-site-association` to `www` (a Vercel
domain-level redirect, not in `vercel.json`). It is widely repeated that Apple will not
follow a redirect when fetching the AASA. **That is false here, and we checked instead of
believing it:** `https://app-site-association.cdn-apple.com/a/v1/halamove.co.za` returns
HTTP 200 with our file — Apple's CDN fetched it through the 307. The apex works. No Vercel
change is needed. (`www.halamove.co.za` is also declared in both apps' `associatedDomains`
for robustness.)

## assetlinks.json (Android) — DONE

- ⚠️ **Play App Signing is ON, so the fingerprint that matters is GOOGLE'S app signing key,
  NOT the EAS upload key.** They are different values, and using the upload key alone would
  have failed silently on every Play install. The old instruction here led with
  `eas credentials` (the upload key) and mentioned the Play key only as an afterthought —
  that ordering was backwards and is corrected.
- [SRC 2026-08-09] Play Console → app → **Test and release → Setup → App integrity →
  App signing** (direct: `/console/u/0/developers/6488223465219796357/app/<appId>/keymanagement`).
  Customer appId `4973556533649743852`, driver appId `4974277094770588043`.
- Each entry lists TWO fingerprints on purpose: Google's **app signing key** (what Play-installed
  devices present — the one that must be there) and our **upload key** (so internal-app-sharing
  and direct APK installs verify too).
- Corroboration that we read the right rows: the driver **upload** key SHA-1 is
  `22:87:5D:...:6A:C7`, the exact value already on record as the driver's EAS keystore SHA-1
  used for the Google Maps key.
- The package is **`com.hala.driverapp`** — note the `app` suffix; renamed 2026-07-07 and
  `com.hala.driver` 404s.

## Still required for these to take effect

Both apps must be **rebuilt and reinstalled** — `app.json` `intentFilters`/`autoVerify` and
`ios.associatedDomains` are baked at build time. Android re-verifies on install; iOS refetches
the AASA on install and periodically thereafter.

## How to verify (do this, do not assume)

```
curl -sI https://halamove.co.za/.well-known/apple-app-site-association    # 307 -> www, fine
curl -s  https://app-site-association.cdn-apple.com/a/v1/halamove.co.za   # what APPLE actually has
curl -s  "https://digitalassetlinks.googleapis.com/v1/statements:list?source.web.site=https://www.halamove.co.za&relation=delegate_permission/common.handle_all_urls"
```
Then tap a real `/invite/CODE` link on a real phone with the app installed. A file that parses
is not a link that opens.
