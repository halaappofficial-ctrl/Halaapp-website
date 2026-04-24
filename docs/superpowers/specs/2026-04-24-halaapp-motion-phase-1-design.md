# HALA MOVE website — Motion & Visuals, Phase 1

**Date:** 2026-04-24
**Scope:** `index.html` + 6 Durban landing pages (`bakkie-hire-durban.html`, `student-moving-durban.html`, `business-transport-durban.html`, `furniture-removal-durban.html`, `panel-van-hire-durban.html`, `truck-hire-durban.html`, `same-day-delivery-durban.html`)
**Status:** Approved — ready for implementation-plan stage
**Repo:** github.com/halaappofficial-ctrl/Halaapp-website, `main` branch
**Authoring tools:** Motion One v11.15.0 (installed site-wide) · 21st.dev magic MCP · frontend-design skill

---

## 1. Context

Halaapp-website is a static HTML marketing site for HALA MOVE (on-demand logistics, Durban/KZN, launching 2026). The site is hand-written HTML+CSS with no build step, 14 pages, 22 media-query breakpoints, SEO-optimised landing pages per service. Motion One was installed site-wide on 2026-04-24 as a CDN `<script defer>` tag before any animations existed.

The team wants to improve motion and visuals, combining Motion One, 21st.dev's magic MCP (UI component generator), and the frontend-design skill. Mobile compatibility is non-negotiable — the KZN audience is heavily mobile-first on cost-constrained Android devices.

## 2. Goal & bottleneck framing

Four gates sit between traffic and conversion: SEO/CWV → first-impression → product comprehension → conversion action. You can only pull the next gate once the previous one is passing.

Pre-launch with no conversion analytics yet, Phase 1 focuses on the two gates with the strongest compounding return:

- **First-impression** (premium feel — Gate 2)
- **Product comprehension** (storytelling through motion — Gate 3)

Conversion micro-tuning (Gate 4) is explicitly deferred to Phase 2 post-launch, when we have analytics to optimise against. Core Web Vitals (Gate 1) is not a phase — it's an always-on guardrail that governs every phase.

## 3. Goals

- Deliver "premium feel" to the hero: the first-impression gate must hold for users arriving from Google.
- Deliver "storytelling through motion" to the 4-step how-it-works section: teach the product flow visually, not just textually.
- Ship on the 7 in-scope pages without regressing LCP, CLS, INP, or JS bundle size.
- Establish a motion vocabulary that future iterations can reuse without redesigning from scratch.
- Respect `prefers-reduced-motion`, keyboard navigation, and screen-reader behaviour.
- Degrade gracefully if Motion One fails to load.

## 4. Non-goals

- No visual overhaul of legal pages (`privacy.html`, `terms.html`, `cookie-policy.html`, `driver-agreement.html`), `about.html`, or `faq.html`.
- No nav shrink-on-scroll (INP cost > benefit).
- No parallax (mobile perf + tone-A restraint).
- No autoplay carousels or looping animations.
- No page-transition animations (would require SPA-ification; wrong tool for static HTML).
- No React runtime, no Tailwind, no build step. 21st.dev output is never deployed directly — it is a prototyping tool whose patterns are ported to vanilla HTML.
- No conversion-specific CTA micro-animations. Deferred to Phase 2 (post-launch, analytics-driven).

## 5. Constraints

- **Tone:** Uber/Bolt restraint. No springs, no overshoots, no bounces. Motion that you don't notice until you turn it off.
- **Mobile:** Must pass on a Moto G Power / equivalent mid-range Android with 4G throttling.
- **Static HTML:** No framework introduction. No build step. One new JS file allowed.
- **CDN dependency:** Motion One served from jsdelivr. Site must remain functional if that CDN fails.
- **SEO:** Zero tolerance for LCP or CLS regression. The site already ranks for Durban service keywords; we protect that first.

## 6. Section inventory

Three sections get direct work; everything else on the 7 pages inherits the shared reveal grammar only.

| # | Section | Location | Work type | Why |
|---|---|---|---|---|
| 1 | Hero (`.hero`) | `index.html:1254` | Wire reveal-on-load stagger on text column | First-impression gate. Phone mockup already has rich motion (bid arrivals, pulse-dot, city-canvas) that is kept as-is; see §7.5 "scoped exceptions." Only the text column (eyebrow → h1 → sub → CTA → trust) needs the shared §7 grammar added on page load. **Scope revised 2026-04-24** after discovering existing hero animations contradicted the original "static hero" assumption — see §14. |
| 2 | How it works (`.how`) | `index.html:1404` | Wire existing markup | Storytelling gate. Markup already has `.reveal.visible.d1-d4` + `.steps-line-fill`. Zero layout change; pure wire-up. |
| 3 | Stats bar (`.stats-bar`) | `index.html:1380` | Wire existing markup | Trust gate. Markup already has `data-count` / `data-suffix` attributes waiting for counter animation. Zero layout change. |

The 6 landing pages share the same structural DNA (`.page-hero` + `.page-body`). Only the shared grammar applies — no per-page bespoke work.

## 7. Motion vocabulary (the grammar)

One shared language, applied everywhere. Consistency is the premium feel.

### 7.1 Core principles

1. **One motion pattern site-wide.** Every reveal = opacity 0→1 paired with a small translate-up. Never just one property.
2. **Short durations.** 240ms baseline, 320ms max. Two exceptions documented explicitly (progress line, counter).
3. **Linear-out easing only.** `cubic-bezier(0.22, 0.61, 0.36, 1)`. No springs. No overshoots. No bounces.
4. **Fire once.** Elements animate the first time they enter the viewport. Scrolling back does not retrigger.
5. **Transform + opacity only.** Never `height`, `width`, `top`, `left`, `margin` — those force layout and tank INP.

### 7.2 Concrete numbers

| Property | Desktop | Mobile (<768px) | Reason |
|---|---|---|---|
| Translate distance | 16px | 10px | Smaller screens, same perceptual weight |
| Duration (default) | 240ms | 200ms | Phone scroll is faster |
| Stagger between siblings | 60ms | 40ms | Rhythm, not parade |
| IntersectionObserver threshold | 0.2 | 0.15 | Mobile fires earlier |
| Max staggered children | 6 | 4 | Beyond this violates restraint |

### 7.3 Documented exceptions

- **Progress line (`.steps-line-fill`):** 1400ms ease-out — a progress line under 400ms doesn't *feel* like progress.
- **Stats counters (`[data-count]`):** 900ms ease-out — counters need time to read and settle.
- **Hero phone micro-interaction:** up to 500ms total duration, fires once on page load, then holds. Exception to the 320ms max because it resolves a visual narrative (e.g., a bid card entering), not a static element reveal.

### 7.4 Button hover (desktop only)

- `transform: translateY(-1px)`, 150ms, linear-out.
- Disabled on `(hover: none)` devices.

### 7.5 Hard-blocked behaviours (with scoped exceptions)

The Uber-restraint tone applies to **scroll/viewport reveal animations** — the shared grammar that fires across the site. It does NOT apply universally; specific product UX patterns are allowed spring/loop motion under tight gating:

**Universally blocked** (for all reveal animations):
- Autoplay carousels
- Animations >500ms (outside the documented exceptions)
- Any animation on `prefers-reduced-motion: reduce` (fall back to instant opacity change, show final state)
- Movement >24px mobile / >32px desktop

**Blocked for reveals; allowed for specific product contexts:**

| Pattern | Blocked for | Allowed for | Reason |
|---|---|---|---|
| Springs / overshoots | Scroll reveals, page-load stagger | Discrete product events (e.g., `.bid-card.arriveN` in the hero phone mockup) that fire once | A spring on a bid-card landing reads as "a bid just arrived" — it punctuates a product moment, not a UI reveal. Uber restraint here would feel dead. Scope: `.bid-card.arrive*` at `index.html:550-552` is grandfathered. |
| Infinite looping animations | Everything that isn't a live-status indicator | Elements conveying platform liveness (`.pulse-dot`), low-motion ambient backgrounds (`#city-canvas`) | Pulse-dot IS the feature — it communicates "platform is live" which the spec §2 identifies as Gate 2. Permitted with: (a) cycle ≥1.2s, (b) `aria-label` indicates live status, (c) CSS `prefers-reduced-motion` stops the loop. |

Scope additions require spec update. This is not a blanket permission.

## 8. Per-section specs

### 8.1 Hero (wire text-column reveal-on-load) — `index.html:1254`

**Revised 2026-04-24** — see §14. Original scope assumed the hero was static; code inspection during implementation revealed substantial existing motion (bid-card spring arrivals, infinite `pulse-dot`, `city-canvas` background animation, countdown timer). User confirmed the existing motion is the right feel for the product and the tone constraint was relaxed via §7.5 scoped exceptions. Scope narrows to adding reveal-on-load stagger for the text column only.

**In scope (Phase 1):**

- Text column reveals on page load as a 5-element stagger: eyebrow → h1 → sub → CTA → trust.
- Uses the shared §7 grammar (linear-out, fire-once, transform + opacity only).
- Fires on page load (not scroll), inside the first 400ms after first paint, so hero reveal does not delay LCP.
- Stagger **start times** (measured from sequence origin):
  - eyebrow at 0ms
  - h1 at 60ms
  - sub at 120ms
  - CTA at 180ms
  - trust at 240ms

**Out of scope (Phase 1):**

- Phone mockup (`.hero-phone-wrap`). Its existing motion — `.bid-card.arriveN` spring arrivals at `index.html:550-552`, `.pulse-dot` liveness indicator, `#city-canvas` ambient background — is preserved intact under §7.5 scoped exceptions. No port, no redesign, no 21st.dev exploration.

**Tool usage:** Motion One only. 21st.dev magic and frontend-design skill are NOT used in Phase 1 (their planned roles were to explore a phone-mockup "alive state" that no longer needs exploration).

### 8.2 How it works (wire existing markup) — `index.html:1404`

**No layout change.** The markup already has `.reveal.visible.d1/d2/d3/d4` on each of 4 `.step` elements and a `.steps-line-fill` progress line.

**Wiring spec:**

- `.steps-line-fill` starts at `width: 0`, animates to `width: 100%` over 1400ms ease-out as the section enters viewport (threshold 0.2 desktop / 0.15 mobile).
- Each `.step` fades-up on a 60ms stagger, timed to the progress line's arrival at each step's column:
  - `d1` at 0% fill
  - `d2` at 33% fill
  - `d3` at 66% fill
  - `d4` at 100% fill
- Mobile: line is vertical per existing CSS; same timings, rotated axis. Validate during implementation that existing CSS already handles this — if so, zero extra work; if not, add a mobile-vertical variant.
- Existing `.visible` class is a static fallback — steps are visible by CSS default.

**Tool usage:** Motion One only.

### 8.3 Stats counter (wire existing markup) — `index.html:1380`

**Current markup inventory** (4 stat tiles at `index.html:1383-1398`):

- Tile 1: `80%` — has `data-count="80"` and `data-suffix="%"`. **Animates as counter.**
- Tile 2: `Same Day` — text, no `data-count`. **Reveal only.**
- Tile 3: `R150+` — text, no `data-count`. **Reveal only** (unless we choose to add `data-count="150"` + `data-prefix="R"` + `data-suffix="+"` during implementation — see open question §13).
- Tile 4: `24 hrs` — text, no `data-count`. **Reveal only.**

**Wiring spec:**

- Elements with `[data-count]` animate 0 → value over 900ms ease-out, firing once on viewport entry.
- Elements without `[data-count]` receive only the shared reveal grammar from §7.
- Counter format preserved via optional `data-prefix` and `data-suffix` attributes: e.g., `data-count="80"` + `data-suffix="%"` → counts 0→80 with `%` fixed; `data-count="150"` + `data-prefix="R"` + `data-suffix="+"` → counts R0+ → R150+.
- Per-frame rounding via `Math.round()`. No decimals mid-animation.

**Tool usage:** Motion One only.

### 8.4 Shared grammar (all 7 pages, all remaining sections)

- Sections fade-up per §7 defaults as they enter viewport.
- Buttons get the §7.4 hover lift.
- No section-specific bespoke work.

## 9. Guardrails

### 9.1 Core Web Vitals budget

| Metric | Target | Motion budget |
|---|---|---|
| LCP | ≤ 2.5s on Moto G Power 4G | Hero reveal fires *after* LCP element paints. No motion work on the LCP element's layout. |
| CLS | ≤ 0.05 | Zero tolerance. Transform + opacity only. Content reserves space. |
| INP | ≤ 200ms | Passive IntersectionObservers. No scroll listeners. No synchronous work inside `animate()` callbacks. |
| JS transfer | +8 KB max | Motion One gzipped. No additional libraries. |

**Enforcement:** Pre-change Lighthouse baseline captured before any file is modified. Post-implementation Lighthouse run on `index.html` + 3 landing pages. Budget breach = ship blocker, not deferred item.

### 9.2 Accessibility

- **`prefers-reduced-motion: reduce`** — branch explicitly. Skip transforms, skip counter animation, show final state via instant opacity change.
- **Keyboard focus** — elements are interactable from `opacity ≥ 0.01`, not after animation completes. Never trap focus inside a mid-animation element.
- **Screen readers** — counters use `aria-live="off"`; DOM text content is final value. Assistive tech reads `80%`, not "0" during animation.

### 9.3 Fallback (Motion One CDN failure)

Progressive enhancement, not dependency.

- Hero elements: `opacity: 1` in CSS by default. Runtime script applies `opacity: 0` only after Motion One confirms loaded (via a `js-ready` class on `<html>`).
- How-it-works steps: already have `.visible` class in CSS — visible by default. CDN failure = steps stay visible.
- Stats counters: DOM text content is already final value. CDN failure = user sees the final number, no counter effect.
- `<script>` tag gets an `onerror` handler adding a `motion-failed` class to `<html>` so CSS can force final states as a safety net.

### 9.4 Verification checklist

Each item must pass before work is claimed complete:

1. Lighthouse (mobile, Moto G Power throttling) on `index.html` + 2 landing pages, before and after. Report both numbers.
2. DevTools → Rendering → `prefers-reduced-motion: reduce` — verify zero motion, final state visible, counters show final values.
3. DevTools → Network → Block `cdn.jsdelivr.net/npm/motion@*` — verify fallback works, page remains usable.
4. Mid-range Android smoke (real device or emulator) — verify no stutter.
5. Keyboard tab-through on `index.html` — verify no focus traps in animating elements.

## 10. Tool workflow (revised 2026-04-24 — see §14)

### 10.1 Which tools per section

| Section | Motion One | 21st.dev magic | frontend-design |
|---|---|---|---|
| Hero (wire text-column stagger) | ✅ runtime | ❌ (scope dropped) | ❌ (scope dropped) |
| How it works (wire-up) | ✅ runtime | ❌ | ❌ |
| Stats counter (wire-up) | ✅ runtime | ❌ | ❌ |
| Shared grammar | ✅ runtime | ❌ | ⚠️ spot-check only |

**Original spec committed to a 6-step hero redesign loop using all three tools. That loop was dropped** after code inspection revealed the hero phone mockup already has rich, product-appropriate motion that does not benefit from re-exploration (see §14). 21st.dev magic and frontend-design skill remain available for future phases (e.g., Phase 2 post-launch CTA optimization) but are not used in Phase 1.

### 10.2 Hero wire-up (now a simple wire-up, not a 6-step loop)

1. Read existing markup at `index.html:1254`.
2. Add `data-motion-hero-el` attributes to the 5 text-column elements (eyebrow, h1, sub, cta, trust).
3. Update `initHero()` in `assets/motion.js` to fire the page-load stagger per §8.1.
4. Verify against §9.4.

### 10.3 Wire-up loop (how-it-works + stats)

1. Read existing markup.
2. Write Motion One wiring in `assets/motion.js`.
3. Verify against §9.4.

## 11. Code location

One new file: `assets/motion.js` — approximately 120 lines. Handles all three sections.

- Exports `setup()` that queries known selectors: `.hero [data-motion-hero-el]` (this attribute does not exist today — added to specific hero elements during the port step §10.2.4), `.stats-bar [data-count]`, `.step.reveal`, `.steps-line-fill`.
- Runs on `DOMContentLoaded`.
- Early-exits on `prefers-reduced-motion: reduce` (after applying final states).
- Loaded by a second `<script defer>` tag added immediately after the Motion One tag in all 7 in-scope pages.

One file rationale: easier to audit, one Lighthouse diff to read, same file ports unchanged to all 7 pages.

## 12. Ship order (revised)

1. Wire-ups (§8.2 + §8.3 + §8.4): stats counter, how-it-works, generic `.reveal`. ✅ **Shipped** as of 2026-04-24 commit cef92f5.
2. Hero text-column stagger (§8.1 revised). Wire-up, not redesign.
3. Final §9.4 verification and any cleanup.

## 13. Open questions (deferred / resolved)

- ✅ **Resolved:** tile 3 ("R150+") stays as text-only reveal, not a counter. YAGNI default held.
- ✅ **Resolved:** existing mobile CSS for `.steps-line` already handled orientation — no extra work needed (confirmed during Task 5 browser verification).
- ✅ **Dropped:** phone-mockup "alive state" motif. The phone mockup already has rich, product-appropriate motion (bid arrivals, pulse-dot, city-canvas) that is preserved under §7.5 scoped exceptions.
- Gitignore of `*.html.bak` installer artifacts — handled in plan Task 14.

## 14. Scope revision log

### 2026-04-24 — Hero redesign scope dropped

**What changed:** §6 (hero row), §7.5 (scoped exceptions added), §8.1 (rewritten as wire-up), §10 (6-step loop replaced with 4-step wire-up), §12 (ship order simplified).

**Why:** Before dispatching the hero brief (plan Task 8), code inspection of `index.html` at lines 340, 370, 410, 550-552, 1255, 1320, 2078, 2188 revealed the hero already contains:

- `bidArrive` keyframe animation with spring easing `cubic-bezier(.34,1.56,.64,1)` on `.bid-card.arriveN` (violates original tone A "no springs")
- `pulse-dot` infinite loop on `.phone-header-badge` (violates original §7.5 "no looping animations")
- `#city-canvas` JS-driven ambient background animation (low-motion but continuous)
- `phone-timer` countdown driven by JS

The original design assumption — "hero is static; needs motion added via 21st.dev + frontend-design exploration" — was wrong. The hero is already animated, and the existing motion is product-appropriate (bid landing = spring punctuation; pulse-dot = liveness signal; both tie to Gate 2 "first impression + platform liveness" in §2).

**Decision (confirmed by user 2026-04-24):** relax the universal tone constraint via §7.5 scoped exceptions, preserve existing hero motion intact, narrow Phase 1 hero work to adding the reveal-on-load stagger on the text column to match the shared §7 grammar. 21st.dev magic MCP and frontend-design skill are not used in Phase 1.

**Implication for downstream phases:** if Phase 2 introduces new animation (e.g., on CTAs or conversion micro-interactions), the §7.5 exception list is the governing reference — not the original tone A blanket rule.

## 14. Explicit non-decisions

- Which React variant wins the hero — decided at §10.2 step 3, not now.
- Colour, typography, spacing changes — out of scope. This spec is about motion, not visual redesign. The one exception (hero phone mockup) is bounded to that mockup area only.
- Any Phase 2 work — explicitly deferred until post-launch with analytics.
