# App-association files for HALA MOVE deep links

These two files make `https://halamove.co.za/invite/CODE` and `/driver-invite/CODE`
open the app SEAMLESSLY (Android App Links / iOS Universal Links) instead of the browser.
They ship with placeholders — the links still work via the landing pages + custom scheme
without them; these only add the chooser-free "open in app" behaviour.

## assetlinks.json (Android) — fill the two SHA-256 fingerprints
1. Run `eas credentials` in `mobile/customer-app` (and `mobile/driver-app`) → Android →
   Keystore → copy the **SHA-256 Fingerprint**. If Google Play App Signing is enabled,
   also add the Play "App signing key" SHA-256 (Play Console → App integrity → App signing).
2. Replace `REPLACE_WITH_CUSTOMER_APP_SHA256_FROM_eas_credentials` (com.hala.customer) and
   `REPLACE_WITH_DRIVER_APP_SHA256_FROM_eas_credentials` (com.hala.driver) with the colon-
   separated hex fingerprint(s), e.g. `"AB:CD:...:12"`. Each app may list multiple.
3. Both apps must be **rebuilt via EAS** (the `app.json` intentFilters + `autoVerify` are
   baked at build time) and reinstalled; then Android auto-verifies against this file.

## apple-app-site-association (iOS) — GATED on Apple enrollment
- Replace `REPLACE_WITH_APPLE_TEAM_ID` with the 10-character Apple **Team ID** (available
  only after Apple Developer enrollment completes — GO-LIVE blocker #2). Member ID
  5S2CQN8NFY is the enrollment reference, NOT necessarily the Team ID — confirm in the
  Apple Developer portal (Membership → Team ID).
- Served WITHOUT a file extension; `vercel.json` forces `Content-Type: application/json`
  for it (the classic Universal Links gotcha — iOS silently rejects any other type).
- Needs `ios.associatedDomains` in both `app.json` (already added) + an EAS rebuild + Apple
  enrollment.

Until filled, deep links fall back gracefully to the `/invite/CODE` landing pages, which
already show + copy the code for manual paste at signup — the referral works end-to-end today.
