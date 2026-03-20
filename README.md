# HALA — Website Repository

**halaapp.co.za** · South Africa's verified logistics platform · Built in Durban

---

## Repository Structure

```
hala-website/
├── index.html                 ← Main website — complete, production-ready
├── about.html                 ← About Us (pending — generate with Copywriting Prompt v2.0)
├── faq.html                   ← FAQs (pending — generate with Copywriting Prompt v2.0)
├── privacy.html               ← Privacy Policy (pending — generate with Copywriting Prompt v2.0)
├── terms.html                 ← Terms of Service (pending — generate with Copywriting Prompt v2.0)
├── driver-agreement.html      ← Driver Agreement (pending — generate with Copywriting Prompt v2.0)
├── cookie-policy.html         ← Cookie Policy (pending — generate with Copywriting Prompt v2.0)
└── README.md                  ← This file
```

**No build step. No framework. No dependencies to install.**
Every page is a standalone `.html` file. Push to GitHub, Vercel deploys automatically.

---

## Deploying to Vercel

Vercel reads from this GitHub repository. Every push to `main` triggers a new deployment automatically.

**First-time setup:**
1. Push this repo to GitHub
2. Go to [vercel.com](https://vercel.com) → New Project → Import from GitHub → select this repo
3. Framework Preset: **Other**
4. Build Command: leave empty
5. Output Directory: leave empty (Vercel serves from root)
6. Click **Deploy**

**Domain setup (halaapp.co.za):**
1. Vercel project → Settings → Domains
2. Add `halaapp.co.za` and `www.halaapp.co.za`
3. Copy the DNS records Vercel provides
4. Add those records at your domain registrar (Afrihost or domains.co.za)
5. HTTPS provisions automatically — no configuration needed

---

## What index.html Contains

`index.html` is a single self-contained file. **115KB.** 1,804 lines. No external JS dependencies beyond Google Fonts.

### Sections (in order)

| # | Section | Description |
|---|---------|-------------|
| 1 | Announcement bar | Scrolling ticker — key platform messages, contact email |
| 2 | Navigation | Sticky nav with HALA logo (base64 embedded), Live·Durban badge, mobile hamburger |
| 3 | Hero | H1 headline, hero sub, CTAs, app store badges, phone mockup with live bid animation, animated city grid canvas |
| 4 | Stats bar | 3 factual platform stats — 80% driver share, same-day payout, R0 monthly fee, 24hr verification |
| 5 | How It Works | 4-step customer flow with animated connecting line on desktop |
| 6 | Features | 6 feature cards — verification, AI Smart Quote, photo protocol, PayFast escrow, live GPS, carbon tracking |
| 7 | For Drivers | Earnings formula box, 4 barrier-removal perks, interactive earnings calculator with illustrative disclaimer |
| 8 | For Business | 3 B2B features, 6 industry cards, SLA table, contact CTA |
| 9 | Testimonials | 3 representative experience cards with role badges |
| 10 | Download CTA | App store download section with green radial glow |
| 11 | Footer | 4-column footer, legal disclaimer, HALA (Pty) Ltd copyright |
| 12 | Floating elements | Scroll-to-top button, WhatsApp chat float |

### Embedded Assets

| Asset | Method | Notes |
|-------|--------|-------|
| HALA logo | Base64 PNG in HTML | Transparent background. Used in nav and footer. No external file needed. |
| All icons | Inline SVG | 22 custom stroke-based SVGs. 24×24 viewBox. 1.75px stroke weight. No icon library dependency. |
| City grid animation | HTML5 Canvas + vanilla JS | Animated nodes and routes. Represents live driver network. Renders on all modern browsers. |

### External Dependencies (fonts only)

```
https://fonts.googleapis.com/css2?family=Syne:wght@700;800
                                       &family=Plus+Jakarta+Sans:ital,wght@0,300;0,400;0,500;0,600;0,700;1,400
```

No CDN scripts. No jQuery. No React. No build tools. The file opens in a browser and works.

---

## JavaScript Features

All JavaScript is vanilla. No libraries. Written inline at the bottom of `index.html`.

| Feature | How it works |
|---------|-------------|
| Scroll reveal | `IntersectionObserver` with `threshold: 0` and `rootMargin: 0px 0px -40px 0px` |
| Reveal failsafe | 1.5s timeout inside observer + `window.addEventListener('load')` at 300ms. Three independent mechanisms ensure no section stays invisible. |
| Animated counters | `requestAnimationFrame` with cubic ease-out, triggered by `IntersectionObserver` |
| Earnings calculator | Three range sliders update monthly figure in real time. Formula: Jobs × Bid price × 80%. Includes illustrative disclaimer. |
| City grid canvas | Custom Canvas 2D rendering. Randomised node grid, dashed routes, animated driver dots with radial glow and pulse-on-arrival. Resizes on window resize. |
| Phone mockup timer | Countdown timer (14:22 → 0) showing live bidding window. Runs in 1-second intervals. |
| Magnetic buttons | `mousemove` translate effect on `.btn-green` elements. Resets on `mouseleave`. |
| Hamburger menu | Full-screen slide-in on mobile. Closes on any link tap. Disables body scroll when open. |
| Nav scroll state | Background opacity increases after 60px scroll. Scroll-to-top button appears after 500px. |

---

## Brand Specifications

| Token | Value |
|-------|-------|
| Primary green | `#5CB558` |
| Background | `#0A0A0A` |
| Surface | `#1A1A1A` |
| Border | `#2A2A2A` |
| Text primary | `#FFFFFF` |
| Text secondary | `#AAAAAA` |
| Display font | Syne 700/800 |
| Body font | Plus Jakarta Sans 300–700 |
| Border radius (cards) | 14px |
| Border radius (buttons) | 8px |

**Colors never to use:** `#FF6B00`, `#1DB954`, `#22C55E`, any purple gradient, white as a page background.

**Logo rules:**
- `HALA_transparentlogo.png` (base64 embedded) → nav bar and footer only
- `HALA_coloredlogo.png` → app icon only, never used as an in-page element

---

## Icon System

All 22 icons in `index.html` are custom inline SVGs. No icon library is used.

**Specification:**
- ViewBox: `0 0 24 24`
- Fill: `none`
- Stroke: `#5CB558`
- Stroke-width: `1.75`
- Stroke-linecap: `round`
- Stroke-linejoin: `round`

**Never replace an SVG icon with an emoji.** If a new icon is needed, draw it as an inline SVG using the specification above. Emoji render inconsistently across operating systems and do not meet the visual standard of the site.

| Location | Icon | SVG identifier |
|----------|------|----------------|
| Step 1 | Location pin | `M12 2C8.13 2 5 5.13...` |
| Step 2 | Lightning bolt | `M13 2 4.5 13.5h7...` |
| Step 3 | Circle check | `circle cx="12" cy="12" r="9"` |
| Step 4 | Navigation arrow | `M3 11l19-9-9 19...` |
| Feature 1 | Shield with check | `M12 2.5L4 6v6c0 4.97...` |
| Feature 2 | CPU chip | `rect x="7" y="7" width="10"` |
| Feature 3 | Camera | `M23 19a2 2 0 0 1-2 2H3...` |
| Feature 4 | Credit card | `rect x="1" y="5" width="22"` |
| Feature 5 | GPS crosshair | `circle cx="12" cy="12" r="3"` |
| Feature 6 | Leaf | `M17 8C8 10 5.9 16.17...` |
| Industry 1 | Hard hat | `M5 13v-2.2C5 8.14...` |
| Industry 2 | Medical cross | `rect x="2" y="2" width="20"` |
| Industry 3 | Shopping bag | `M6 2L3 6v14...` |
| Industry 4 | Factory | `M2 20V9l6 4V9l6 4...` |
| Industry 5 | Package box | `M21 16V8a2 2 0 0 0-1...` |
| Industry 6 | Government columns | `M3 22h18` + `M12 2L3 11h18` |
| B2B 1 | Bar chart | `rect x="2" y="14" width="4"` |
| B2B 2 | Clipboard check | `M9 5H7a2 2 0 0 0-2 2v12...` |
| B2B 3 | ESG leaf | `M2 22c2.67-3.33...` |
| Store | Play button | `M4.5 3.5l13 7-13 7V3.5z` |
| Store | Apple icon | `M16.5 7.5c-1-1-2.5...` |
| Float | Chat bubble | `M17.5 10c0 4.14...` |

---

## Legal Compliance

The following rules are embedded throughout `index.html` and must be maintained in all future edits.

**Earnings language.** The driver section uses the formula model, not specific rand figures:
> `Jobs completed × Your bid price × 80%`

All illustrative figures carry the disclaimer:
> *"Illustrative only. Actual earnings vary based on individual availability, vehicle type, job volume, location, and market conditions. HALA does not guarantee any level of income."*

**Platform status.** The footer disclaimer states:
> *"HALA is a technology platform — drivers are independent service providers, not employees of HALA."*

This must not be contradicted anywhere on the site.

**Legal entity.** Copyright reads `© 2026 HALA (Pty) Ltd`. All contact links use `contact@halaapp.co.za`.

**Insurance.** Not mentioned on the main site. Requires underwriter agreement before public offer.

**SLA percentages.** Not published. B2B SLA is described as "Agreed per contract."

---

## Pending Pages

Six pages are linked in the footer and must be built before launch. Each is a standalone `.html` file using the same dark theme as `index.html`.

**To generate each page:**
1. Open a new Claude conversation
2. Paste the full `HALA_Master_Copywriting_Prompt_v2.md` as your first message
3. Request the page: *"Write the Privacy Policy page — privacy.html"*
4. Confirm voice and tone before continuing
5. Save each file to this repository

**Priority order for build:**

| Priority | File | Why |
|----------|------|-----|
| 1 | `privacy.html` | **Apple App Store hard requirement.** Must be live at a public URL before iOS submission. |
| 2 | `about.html` | Builds brand trust. Referenced from footer immediately. |
| 3 | `driver-agreement.html` | Required before driver onboarding opens at scale. |
| 4 | `terms.html` | Required before first paying job. |
| 5 | `faq.html` | Reduces support load at launch. |
| 6 | `cookie-policy.html` | Required for POPIA compliance. |

---

## Known Cloudflare Behaviour

If this repository is served through Cloudflare, Cloudflare automatically obfuscates email addresses by replacing them with encoded `span` elements and injecting a decode script. This is Cloudflare's Email Address Obfuscation feature.

**To disable it:** Cloudflare dashboard → your domain → Scrape Shield → Email Address Obfuscation → **turn OFF**.

All email links in `index.html` use plain `mailto:contact@halaapp.co.za`. Never commit a file containing `cdn-cgi/l/email-protection` links — those are Cloudflare injections.

---

## WhatsApp Float Button

Currently links to `https://wa.me/27000000000` — placeholder number.

**To activate:** Replace `27000000000` with the HALA WhatsApp Business number once the Meta API application is approved and the dedicated SIM is registered.

Find and update this line in `index.html`:
```html
<a href="https://wa.me/27XXXXXXXXXX" class="wa-float" ...>
```

Update the footer social link at the same time.

---

## File Maintenance Rules

When editing `index.html`, follow these rules without exception:

1. **No hardcoded hex colours.** All colours use CSS variables from `:root {}`. Never write `color: #5CB558` in an inline style or new rule — write `color: var(--g)`.

2. **No emoji icons.** All 22 icons are stroke SVGs. Add new icons as SVGs using the spec above.

3. **Test reveal animations after every structural change.** Open locally, scroll every section, confirm nothing stays invisible.

4. **Check for truncation after every save.** The final two lines of the file must be `</body>` and `</html>`. If missing, the file was truncated. Append the missing closing tags immediately.

5. **Never add a Cloudflare email decode script.** If `cfasync` or `cdn-cgi/l/email-protection` appears in the file, the email obfuscation feature is active and must be disabled at the Cloudflare level.

6. **Keep the earnings disclaimer on the calculator.** The illustrative disclaimer below the calculator must remain every time the calculator section is edited.

---

## Contact

| Role | Person | Responsibility |
|------|--------|----------------|
| Co-Founder & CTO | Mbabazi Eric | Codebase, infrastructure, all technical decisions, app store submissions |
| Co-Founder & CEO | Uchenna Ngubane | B2B contracts, driver recruitment, brand, marketing, investor relations |
| General enquiries | — | contact@halaapp.co.za |

---

*HALA (Pty) Ltd · Durban, KwaZulu-Natal · South Africa · halaapp.co.za · March 2026*
