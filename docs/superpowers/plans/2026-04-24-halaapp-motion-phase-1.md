# HALA MOVE Website — Motion & Visuals Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship restrained, Uber/Bolt-tone motion across `index.html` + 6 Durban landing pages by wiring up existing markup for the how-it-works + stats sections and redesigning the hero via the Motion One + 21st.dev + frontend-design three-tool loop — without regressing Core Web Vitals on mid-range Android.

**Architecture:** One new vanilla JS file (`assets/motion.js`) loaded after the existing Motion One CDN script. The file queries known selectors on `DOMContentLoaded`, early-exits on `prefers-reduced-motion`, and uses IntersectionObserver + Motion One's `animate()` API to drive three behaviors: stats counter (0→N), how-it-works progress line + step reveals, and hero stagger sequence. Degrades gracefully when Motion One CDN fails. No build step, no framework.

**Tech Stack:** Motion One v11.15.0 (installed, CDN) · vanilla ES2020 JS · IntersectionObserver · `matchMedia('(prefers-reduced-motion: reduce)')`. Design exploration only: 21st.dev magic MCP (React/Tailwind prototypes, never shipped) · frontend-design skill.

**Reference spec:** [docs/superpowers/specs/2026-04-24-halaapp-motion-phase-1-design.md](../specs/2026-04-24-halaapp-motion-phase-1-design.md)

---

## File Structure

**New files (1):**
- `assets/motion.js` — single motion module. Sections: top-level config, utility fns (`prefersReducedMotion`, `onViewOnce`, `applyInitialState`), three section initializers (`initStats`, `initSteps`, `initHero`), `setupMotion()` entry point called on `DOMContentLoaded`.

**Modified files (7):**
- `index.html` — add `<script defer src="assets/motion.js">` after Motion One tag (line ~1182); add `data-motion-hero-el` attributes to hero children during Task 11.
- `bakkie-hire-durban.html`, `student-moving-durban.html`, `business-transport-durban.html`, `furniture-removal-durban.html`, `panel-van-hire-durban.html`, `truck-hire-durban.html`, `same-day-delivery-durban.html` — add `<script defer src="assets/motion.js">` after Motion One tag. These pages use the shared reveal grammar only (no hero/stats/steps wiring).

**Supporting (1):**
- `install-motion-js.cjs` — idempotent installer script mirroring `install-motion-one.cjs`. Inserts the motion.js `<script>` tag into the 7 in-scope pages. Pattern reused from existing installer.

**Not modified in this plan:** `about.html`, `faq.html`, `privacy.html`, `terms.html`, `cookie-policy.html`, `driver-agreement.html` (out of scope per spec §6).

**Function signatures (to keep consistent across tasks):**
```js
// assets/motion.js
const MOTION_VOCAB = { /* durations, distances, stagger, easing */ };
function prefersReducedMotion() : boolean;
function isMobile() : boolean;
function onViewOnce(el, threshold, callback) : void;
function applyInitialState(el, opacityZero = true, translateY = 16) : void;
function initStats() : void;
function initSteps() : void;
function initHero() : void;   // no-op until Task 12
function setupMotion() : void; // entry point
```

---

## Testing & verification strategy

This is a static HTML marketing site with no test framework. The "tests" for motion work are:
1. **Lighthouse CI runs** — baseline captured in Task 1, compared after each major task group.
2. **Manual DevTools verification** — `prefers-reduced-motion` toggle, offline-mode fallback test, keyboard tab-through.
3. **Node-scripted idempotency check** on the installer.
4. **grep verification** that script tags propagated to all 7 pages.

Each task ends with explicit verification steps — if a verification fails, that's a ship blocker, not a future-fix.

---

## Task 1: Capture pre-change Lighthouse baseline

**Purpose:** We commit in spec §9.1 to zero CWV regression. Without a baseline we can't prove that. This must run BEFORE any files change.

**Files:**
- Create: `docs/superpowers/plans/baselines/2026-04-24-lighthouse-before.md`

- [ ] **Step 1: Confirm Chrome is installed for Lighthouse**

```bash
cd "C:/Users/USER/Documents/Halaapp-website"
npx lighthouse --version
```
Expected: a version number like `12.x.x`. If not installed, `npx` auto-installs on first use.

- [ ] **Step 2: Start a local HTTP server to serve the site**

Motion One loads from CDN but Lighthouse still needs to fetch pages over HTTP (not `file://`). Use Node's built-in static server:

```bash
cd "C:/Users/USER/Documents/Halaapp-website"
npx http-server . -p 8080 --silent &
```
Verify: `curl -s http://localhost:8080/index.html | head -1` returns the doctype line.

- [ ] **Step 3: Run Lighthouse on index.html (mobile, Moto G Power throttling)**

```bash
cd "C:/Users/USER/Documents/Halaapp-website"
npx lighthouse http://localhost:8080/index.html \
  --preset=mobile \
  --throttling.cpuSlowdownMultiplier=4 \
  --throttling.rttMs=150 \
  --throttling.throughputKbps=1638.4 \
  --output=json --output-path=./baselines/index-before.json \
  --chrome-flags="--headless" \
  --quiet
```
Expected: creates `baselines/index-before.json`.

- [ ] **Step 4: Run Lighthouse on 2 representative landing pages**

```bash
cd "C:/Users/USER/Documents/Halaapp-website"
npx lighthouse http://localhost:8080/bakkie-hire-durban.html --preset=mobile --output=json --output-path=./baselines/bakkie-before.json --chrome-flags="--headless" --quiet
npx lighthouse http://localhost:8080/student-moving-durban.html --preset=mobile --output=json --output-path=./baselines/student-before.json --chrome-flags="--headless" --quiet
```

- [ ] **Step 5: Extract key metrics into a markdown baseline file**

```bash
cd "C:/Users/USER/Documents/Halaapp-website"
mkdir -p docs/superpowers/plans/baselines
node -e "
const fs = require('fs');
const pages = ['index', 'bakkie', 'student'];
let md = '# Lighthouse baseline — pre-motion, 2026-04-24\n\n| Page | LCP | CLS | TBT | Performance |\n|---|---|---|---|---|\n';
for (const p of pages) {
  const j = JSON.parse(fs.readFileSync('./baselines/' + p + '-before.json', 'utf8'));
  const a = j.audits;
  md += '| ' + p + ' | ' + a['largest-contentful-paint'].displayValue + ' | ' + a['cumulative-layout-shift'].displayValue + ' | ' + a['total-blocking-time'].displayValue + ' | ' + Math.round(j.categories.performance.score * 100) + ' |\n';
}
fs.writeFileSync('./docs/superpowers/plans/baselines/2026-04-24-lighthouse-before.md', md);
console.log(md);
"
```
Expected: prints a 4-column table with numeric values for all 3 pages.

- [ ] **Step 6: Stop the http-server**

```bash
# Find the http-server process and kill it (Windows Git Bash)
taskkill //F //IM node.exe 2>/dev/null || true
```
Alternative on Unix: `kill %1` in the same shell session.

- [ ] **Step 7: Commit baseline**

```bash
cd "C:/Users/USER/Documents/Halaapp-website"
git add docs/superpowers/plans/baselines/2026-04-24-lighthouse-before.md
git commit -m "docs: capture Lighthouse baseline before Phase 1 motion"
```
Note: the raw `.json` files stay untracked (add to .gitignore in Task 14). Only the markdown summary is committed.

---

## Task 2: Create assets/motion.js skeleton

**Purpose:** Scaffold the single motion module with vocabulary constants, a11y guard, fallback detection, and the empty initializer functions. No animations yet — just the structure that Tasks 3-4 + 12 will fill in.

**Files:**
- Create: `assets/motion.js`

- [ ] **Step 1: Create the assets directory**

```bash
cd "C:/Users/USER/Documents/Halaapp-website"
mkdir -p assets
ls assets
```
Expected: directory exists, empty.

- [ ] **Step 2: Write the skeleton file**

Create `assets/motion.js` with the following content:

```js
/**
 * HALA MOVE — motion.js
 * Restrained (Uber/Bolt tone) motion for the 3 anchored sections:
 * hero, how-it-works, stats. Other sections inherit shared reveal grammar only.
 *
 * Spec: docs/superpowers/specs/2026-04-24-halaapp-motion-phase-1-design.md
 * Requires: Motion One v11.x loaded before this script (global `Motion`).
 */
(function () {
  'use strict';

  // --------------------------------------------------------------
  // Vocabulary (per spec §7 — do not change without updating spec)
  // --------------------------------------------------------------
  const MOTION_VOCAB = {
    translateDesktopPx: 16,
    translateMobilePx: 10,
    durationDesktopMs: 240,
    durationMobileMs: 200,
    staggerDesktopMs: 60,
    staggerMobileMs: 40,
    thresholdDesktop: 0.2,
    thresholdMobile: 0.15,
    easing: 'cubic-bezier(0.22, 0.61, 0.36, 1)',
    counterDurationMs: 900,
    progressLineDurationMs: 1400,
    heroMaxDurationMs: 500,
    mobileBreakpointPx: 768,
  };

  // --------------------------------------------------------------
  // Utility fns
  // --------------------------------------------------------------
  function prefersReducedMotion() {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  function isMobile() {
    return window.innerWidth < MOTION_VOCAB.mobileBreakpointPx;
  }

  function motionOneAvailable() {
    return typeof window.Motion !== 'undefined' && typeof window.Motion.animate === 'function';
  }

  // Run `callback(el)` exactly once, when `el` is `threshold` fraction in view.
  function onViewOnce(el, threshold, callback) {
    if (!('IntersectionObserver' in window)) {
      callback(el);
      return;
    }
    const io = new IntersectionObserver(function (entries, observer) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          callback(entry.target);
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: threshold });
    io.observe(el);
  }

  // --------------------------------------------------------------
  // One-time CSS injection — button hover (§7.4) + motion-failed /
  // motion-reduced safety overrides (§9.3). Kept inside motion.js so
  // the spec's "one new file" commitment holds.
  // --------------------------------------------------------------
  function injectCss() {
    const css = [
      '/* §7.4 button hover lift — desktop only, 150ms linear-out */',
      '@media (hover: hover) {',
      '  .btn { transition: transform 150ms cubic-bezier(0.22, 0.61, 0.36, 1); }',
      '  .btn:hover { transform: translateY(-1px); }',
      '}',
      '/* §9.3 safety: if motion.js fails or reduced-motion is set, never hide anything */',
      'html.motion-failed [data-motion-hero-el],',
      'html.motion-reduced [data-motion-hero-el] { opacity: 1 !important; transform: none !important; }',
      'html.motion-failed .step, html.motion-reduced .step { opacity: 1 !important; transform: none !important; }',
      'html.motion-failed .stat-item, html.motion-reduced .stat-item { opacity: 1 !important; transform: none !important; }',
      'html.motion-failed .reveal, html.motion-reduced .reveal { opacity: 1 !important; transform: none !important; }',
    ].join('\n');
    const style = document.createElement('style');
    style.setAttribute('data-source', 'motion.js');
    style.textContent = css;
    document.head.appendChild(style);
  }

  // --------------------------------------------------------------
  // Section initializers (filled in by later tasks)
  // --------------------------------------------------------------
  function initStats()    { /* Task 3 */ }
  function initSteps()    { /* Task 4 */ }
  function initReveals()  { /* Task 4.5 — generic .reveal handler (§8.4) */ }
  function initHero()     { /* Task 12 */ }

  // --------------------------------------------------------------
  // Entry point
  // --------------------------------------------------------------
  function setupMotion() {
    // Tag <html> so CSS / future code can key off readiness
    document.documentElement.classList.add('js-ready');
    injectCss();

    if (!motionOneAvailable()) {
      // Motion One failed to load — add fallback class and bail.
      // CSS defaults keep elements visible; wire-ups are no-ops.
      document.documentElement.classList.add('motion-failed');
      return;
    }

    if (prefersReducedMotion()) {
      // Respect the user's OS-level preference. Elements are visible by default
      // (opacity: 1 in CSS). Counters show their final value because we never
      // modified the DOM text. Nothing more to do.
      document.documentElement.classList.add('motion-reduced');
      return;
    }

    initStats();
    initSteps();
    initReveals();
    initHero();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupMotion);
  } else {
    setupMotion();
  }

  // Expose for debugging (not part of the API contract)
  window.__halaMotion = { MOTION_VOCAB, setupMotion };
})();
```

- [ ] **Step 3: Syntax-check the file with Node**

```bash
cd "C:/Users/USER/Documents/Halaapp-website"
node --check assets/motion.js
echo "Exit: $?"
```
Expected: no output, exit 0. Any SyntaxError blocks progress.

- [ ] **Step 4: Commit skeleton**

```bash
cd "C:/Users/USER/Documents/Halaapp-website"
git add assets/motion.js
git commit -m "feat(motion): add motion.js skeleton with vocabulary + a11y guards"
```

---

## Task 3: Wire up stats counter (spec §8.3)

**Purpose:** Implement `initStats()`. Elements with `data-count` count from 0 to the target value over 900ms; text-only tiles get the shared reveal grammar. Fires once when the stats bar is ≥20% in view (≥15% mobile).

**Files:**
- Modify: `assets/motion.js` (fill in `initStats` function + add helper `animateCounter`)

- [ ] **Step 1: Inspect the current stats-bar markup to confirm selectors**

```bash
cd "C:/Users/USER/Documents/Halaapp-website"
grep -n "stats-bar\|data-count\|data-suffix\|stat-num" index.html | head -20
```
Expected: confirms `.stats-bar` at line ~1380, `.stat-item` children, `.stat-num` elements, one `data-count="80"` + `data-suffix="%"`.

- [ ] **Step 2: Implement `animateCounter` + update `initStats`**

In `assets/motion.js`, replace the stub `function initStats() { /* Task 3 */ }` with:

```js
  // --------------------------------------------------------------
  // §8.3 — Stats counter
  // --------------------------------------------------------------
  function animateCounter(el) {
    const target = parseFloat(el.getAttribute('data-count'));
    if (!isFinite(target)) return;

    const prefix = el.getAttribute('data-prefix') || '';
    const suffix = el.getAttribute('data-suffix') || '';
    const duration = MOTION_VOCAB.counterDurationMs;
    const start = performance.now();

    function frame(now) {
      const t = Math.min(1, (now - start) / duration);
      // Ease-out cubic
      const eased = 1 - Math.pow(1 - t, 3);
      const value = Math.round(target * eased);
      el.textContent = prefix + value + suffix;
      if (t < 1) {
        requestAnimationFrame(frame);
      } else {
        el.textContent = prefix + target + suffix;
      }
    }
    requestAnimationFrame(frame);
  }

  function initStats() {
    const bar = document.querySelector('.stats-bar');
    if (!bar) return;

    const counterEls = bar.querySelectorAll('[data-count]');
    const tiles = bar.querySelectorAll('.stat-item');
    const threshold = isMobile() ? MOTION_VOCAB.thresholdMobile : MOTION_VOCAB.thresholdDesktop;
    const stagger = isMobile() ? MOTION_VOCAB.staggerMobileMs : MOTION_VOCAB.staggerDesktopMs;
    const dist = isMobile() ? MOTION_VOCAB.translateMobilePx : MOTION_VOCAB.translateDesktopPx;
    const dur = isMobile() ? MOTION_VOCAB.durationMobileMs : MOTION_VOCAB.durationDesktopMs;

    // NOTE: CSS pre-staging handled in the HTML head inline <style> (installed
    // via install-motion-prestage.cjs). Do NOT also pre-stage in JS — redundant.
    // Every animate() must use `fill: 'forwards'` so the final keyframe value
    // sticks after the animation ends. Without it, the CSS pre-stage rule
    // re-matches and elements snap back to opacity: 0.

    onViewOnce(bar, threshold, function () {
      counterEls.forEach(animateCounter);
      tiles.forEach(function (tile, i) {
        window.Motion.animate(
          tile,
          { opacity: [0, 1], transform: ['translateY(' + dist + 'px)', 'translateY(0)'] },
          { duration: dur / 1000, delay: (i * stagger) / 1000, easing: MOTION_VOCAB.easing, fill: 'forwards' }
        );
      });
    });
  }
```

- [ ] **Step 3: Syntax-check again**

```bash
cd "C:/Users/USER/Documents/Halaapp-website"
node --check assets/motion.js
```
Expected: exit 0.

- [ ] **Step 4: Decision point — tile 3 "R150+" counter?**

Per spec §13 open question. **Default decision: leave as text-only reveal.** Rationale: `R150+` with `+` suffix communicates "starting at" more clearly than a counter arriving at `R150+`. If user wants it counted, add these attributes to `index.html:1392` during this step:
- `data-count="150"` `data-prefix="R"` `data-suffix="+"`

Skip this step unless explicitly overridden. Leaving as-is is the YAGNI default.

- [ ] **Step 5: Commit counter wiring**

```bash
cd "C:/Users/USER/Documents/Halaapp-website"
git add assets/motion.js
git commit -m "feat(motion): wire stats counter + tile reveals (spec §8.3)"
```

---

## Task 4: Wire up how-it-works reveal + progress line (spec §8.2)

**Purpose:** Implement `initSteps()`. The `.steps-line-fill` grows 0→100% over 1400ms. Each `.step` fades up timed to the line reaching its column.

**Files:**
- Modify: `assets/motion.js` (fill in `initSteps`)

- [ ] **Step 1: Inspect `.how` section markup**

```bash
cd "C:/Users/USER/Documents/Halaapp-website"
grep -n 'class="how"\|steps-line\|"step reveal' index.html | head -10
```
Expected: confirms `.how` section at line ~1404, `.steps-line-fill`, 4 `.step.reveal.visible.d1-d4` children.

- [ ] **Step 2: Check current CSS for `.steps-line-fill` width behavior**

```bash
cd "C:/Users/USER/Documents/Halaapp-website"
grep -nE "\.steps-line-fill|\.steps-line\b" index.html | head -10
```
Expected: find the CSS rules. If `.steps-line-fill` has a default `width: 100%` (visible by default), our fallback works. If it has `width: 0`, we need to confirm it still behaves gracefully when motion.js doesn't run.

- [ ] **Step 3: Replace the stub `initSteps`**

In `assets/motion.js`, replace `function initSteps() { /* Task 4 */ }` with:

```js
  // --------------------------------------------------------------
  // §8.2 — How it works: progress line + step reveals
  // --------------------------------------------------------------
  function initSteps() {
    const section = document.querySelector('.how');
    if (!section) return;
    const line = section.querySelector('.steps-line-fill');
    const steps = section.querySelectorAll('.step');
    if (!line || steps.length === 0) return;

    // Set initial state only when js-ready so fallback = visible
    line.style.width = '0';
    line.style.transformOrigin = 'left center';

    const threshold = isMobile() ? MOTION_VOCAB.thresholdMobile : MOTION_VOCAB.thresholdDesktop;
    const dist = isMobile() ? MOTION_VOCAB.translateMobilePx : MOTION_VOCAB.translateDesktopPx;
    const dur = isMobile() ? MOTION_VOCAB.durationMobileMs : MOTION_VOCAB.durationDesktopMs;

    // Pre-staging handled by CSS in HTML head (install-motion-prestage.cjs).
    // All animate() calls below use fill: 'forwards' so values stick after completion.

    onViewOnce(section, threshold, function () {
      const lineDur = MOTION_VOCAB.progressLineDurationMs / 1000;

      // Animate the progress line.
      // The `width` transition is intentional here (not in the shared vocab) because
      // this is the one dedicated progress-line element that uses width per spec §7.3.
      window.Motion.animate(
        line,
        { width: ['0%', '100%'] },
        { duration: lineDur, easing: MOTION_VOCAB.easing, fill: 'forwards' }
      );

      // Schedule each step at its proportional point along the line
      const fractions = [0, 0.33, 0.66, 1.0];
      steps.forEach(function (step, i) {
        const delay = (fractions[i] || (i / Math.max(1, steps.length - 1))) * MOTION_VOCAB.progressLineDurationMs;
        window.Motion.animate(
          step,
          { opacity: [0, 1], transform: ['translateY(' + dist + 'px)', 'translateY(0)'] },
          { duration: dur / 1000, delay: delay / 1000, easing: MOTION_VOCAB.easing, fill: 'forwards' }
        );
      });
    });
  }
```

- [ ] **Step 4: Syntax-check**

```bash
cd "C:/Users/USER/Documents/Halaapp-website"
node --check assets/motion.js
```
Expected: exit 0.

- [ ] **Step 5: Commit**

```bash
cd "C:/Users/USER/Documents/Halaapp-website"
git add assets/motion.js
git commit -m "feat(motion): wire how-it-works progress line + step reveals (spec §8.2)"
```

---

## Task 4.5: Generic `.reveal` handler for shared grammar (spec §8.4)

**Purpose:** Spec §8.4 commits to shared reveal grammar across all 7 pages for sections not otherwise handled by `initStats`, `initSteps`, or `initHero`. The existing markup already uses `class="reveal"` in multiple places (e.g., `index.html:1442`, various landing-page sections). This task implements a generic handler that fades those up with the §7 vocabulary.

**Exclusions:** elements matched by `initSteps` (`.step.reveal` inside `.how`) must be skipped here to avoid double-animating them.

**Files:**
- Modify: `assets/motion.js` (replace the `initReveals` stub added in Task 2)

- [ ] **Step 1: Survey existing `.reveal` usage across in-scope pages**

```bash
cd "C:/Users/USER/Documents/Halaapp-website"
grep -c 'class="[^"]*reveal' index.html bakkie-hire-durban.html student-moving-durban.html business-transport-durban.html furniture-removal-durban.html panel-van-hire-durban.html truck-hire-durban.html same-day-delivery-durban.html
```
Expected: non-zero counts on multiple pages, confirming the class is used.

- [ ] **Step 2: Replace the `initReveals` stub**

In `assets/motion.js`, replace `function initReveals()  { /* Task 4.5 — generic .reveal handler (§8.4) */ }` with:

```js
  // --------------------------------------------------------------
  // §8.4 — Shared grammar: generic .reveal handler
  // Applies to any element with class="reveal" that isn't already
  // handled by initStats / initSteps / initHero.
  // --------------------------------------------------------------
  function initReveals() {
    const all = document.querySelectorAll('.reveal');
    if (all.length === 0) return;

    const threshold = isMobile() ? MOTION_VOCAB.thresholdMobile : MOTION_VOCAB.thresholdDesktop;
    const dist = isMobile() ? MOTION_VOCAB.translateMobilePx : MOTION_VOCAB.translateDesktopPx;
    const dur = isMobile() ? MOTION_VOCAB.durationMobileMs : MOTION_VOCAB.durationDesktopMs;

    all.forEach(function (el) {
      // Skip elements handled by dedicated initializers
      if (el.closest('.how') && el.classList.contains('step')) return; // handled by initSteps
      if (el.closest('.hero') && el.hasAttribute('data-motion-hero-el')) return; // handled by initHero

      // Pre-staging handled by CSS (install-motion-prestage.cjs).
      onViewOnce(el, threshold, function (target) {
        window.Motion.animate(
          target,
          { opacity: [0, 1], transform: ['translateY(' + dist + 'px)', 'translateY(0)'] },
          { duration: dur / 1000, easing: MOTION_VOCAB.easing, fill: 'forwards' }
        );
      });
    });
  }
```

- [ ] **Step 3: Syntax-check**

```bash
cd "C:/Users/USER/Documents/Halaapp-website"
node --check assets/motion.js
```
Expected: exit 0.

- [ ] **Step 4: Commit**

```bash
cd "C:/Users/USER/Documents/Halaapp-website"
git add assets/motion.js
git commit -m "feat(motion): generic .reveal handler for shared grammar (spec §8.4)"
```

---

## Task 5: Load motion.js on index.html + first in-browser verification

**Purpose:** Add the `<script defer>` tag for `assets/motion.js` immediately after the existing Motion One CDN tag on `index.html`. Then open the page and verify the wire-ups render correctly before propagating to the 6 landing pages.

**Files:**
- Modify: `index.html` (insert script tag near line 1182)

- [ ] **Step 1: Confirm Motion One tag location**

```bash
cd "C:/Users/USER/Documents/Halaapp-website"
grep -n "motion@11" index.html
```
Expected: 1 match at line ~1182 with the jsdelivr URL.

- [ ] **Step 2: Insert our script tag immediately after**

Use the Edit tool on `index.html`:

Old string (unique — exact match including CRLF handling):
```
<!-- Motion One (animation library) - pinned -->
<script defer src="https://cdn.jsdelivr.net/npm/motion@11.15.0/dist/motion.min.js"></script>
</head>
```

New string:
```
<!-- Motion One (animation library) - pinned -->
<script defer src="https://cdn.jsdelivr.net/npm/motion@11.15.0/dist/motion.min.js"></script>
<!-- HALA motion wiring -->
<script defer src="assets/motion.js"></script>
</head>
```

- [ ] **Step 3: Start the local server**

```bash
cd "C:/Users/USER/Documents/Halaapp-website"
npx http-server . -p 8080 --silent &
sleep 1
curl -s http://localhost:8080/assets/motion.js | head -3
```
Expected: returns the first 3 lines of motion.js (`/**`, `* HALA MOVE...`).

- [ ] **Step 4: Open in browser and verify wire-ups render**

Open `http://localhost:8080/index.html` in a browser.

Checks (do manually, note results in commit msg if anything's off):
- Stats bar counter (`80%`) counts 0 → 80 when scrolled into view
- How-it-works progress line grows left-to-right as steps fade up
- No console errors
- No visible jank or layout shift

If any check fails, debug before moving to Step 5. Common issues:
- Console "Motion is not defined" → the Motion One CDN tag is missing or blocked
- Counters don't animate → IntersectionObserver threshold too high, try scrolling further
- Steps all appear at once → check `fractions` array in `initSteps`

- [ ] **Step 5: Verify fallback — block Motion One CDN**

In browser DevTools → Network → right-click `motion.min.js` → Block request URL → reload.

Expected behavior:
- `<html>` has class `motion-failed`
- Stats counter shows `80%` (final value, no animation)
- How-it-works steps all visible
- No console errors; page is fully usable

- [ ] **Step 6: Verify reduced-motion branch**

DevTools → rendering panel (Cmd/Ctrl+Shift+P → "Show rendering") → "Emulate CSS media feature prefers-reduced-motion" → "reduce" → reload.

Expected:
- `<html>` has class `motion-reduced`
- No counter animation, no step reveal — final states shown immediately

- [ ] **Step 7: Stop server + commit**

```bash
cd "C:/Users/USER/Documents/Halaapp-website"
taskkill //F //IM node.exe 2>/dev/null || true
git add index.html
git commit -m "feat(motion): load motion.js on index.html"
```

---

## Task 6: Propagate motion.js to 6 landing pages via installer script

**Purpose:** Mirror the Motion One installer pattern. One idempotent script that inserts our tag on all 7 in-scope pages (it's also a no-op re-run on index.html).

**Files:**
- Create: `install-motion-js.cjs`
- Modify: 6 landing page HTML files (via the script)

- [ ] **Step 1: Write the installer script**

Create `install-motion-js.cjs`:

```js
// Inserts the assets/motion.js script tag on the 7 in-scope pages.
// Idempotent — re-runs are safe. Mirror of install-motion-one.cjs.

const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const IN_SCOPE = [
  'index.html',
  'bakkie-hire-durban.html',
  'student-moving-durban.html',
  'business-transport-durban.html',
  'furniture-removal-durban.html',
  'panel-van-hire-durban.html',
  'truck-hire-durban.html',
  'same-day-delivery-durban.html',
];

const TAG = '<!-- HALA motion wiring -->\r\n<script defer src="assets/motion.js"></script>\r\n';
const MARKER = 'assets/motion.js';
// Insert immediately after the Motion One tag so load order is correct.
const ANCHOR = /(<script defer src="https:\/\/cdn\.jsdelivr\.net\/npm\/motion@[^"]+"><\/script>)(\r?\n)/;

const results = [];
for (const name of IN_SCOPE) {
  const file = path.join(ROOT, name);
  if (!fs.existsSync(file)) {
    results.push({ name, status: 'MISS (file not found)' });
    continue;
  }
  const src = fs.readFileSync(file, 'utf8');
  if (src.includes(MARKER)) {
    results.push({ name, status: 'SKIP (already installed)' });
    continue;
  }
  const m = src.match(ANCHOR);
  if (!m) {
    results.push({ name, status: 'MISS (no Motion One tag to anchor to)' });
    continue;
  }
  const out = src.replace(ANCHOR, m[1] + m[2] + TAG);
  if (!fs.existsSync(file + '.bak')) {
    fs.writeFileSync(file + '.bak', src, 'utf8');
  }
  fs.writeFileSync(file, out, 'utf8');
  results.push({ name, status: 'OK (installed)' });
}

console.log('motion.js install:');
for (const r of results) {
  console.log('  ' + r.status.padEnd(32) + ' ' + r.name);
}
```

- [ ] **Step 2: Run the installer**

```bash
cd "C:/Users/USER/Documents/Halaapp-website"
node install-motion-js.cjs
```
Expected output:
```
motion.js install:
  SKIP (already installed)         index.html
  OK (installed)                   bakkie-hire-durban.html
  OK (installed)                   student-moving-durban.html
  ...
```
`SKIP` on index.html is correct — we added that tag manually in Task 5. `OK` on the other 6.

- [ ] **Step 3: Verify idempotency by re-running**

```bash
cd "C:/Users/USER/Documents/Halaapp-website"
node install-motion-js.cjs
```
Expected: all 7 now show `SKIP (already installed)`.

- [ ] **Step 4: grep-verify the tag is on all 7 pages**

```bash
cd "C:/Users/USER/Documents/Halaapp-website"
grep -l "assets/motion.js" *.html
```
Expected: prints exactly these 7 filenames:
```
bakkie-hire-durban.html
business-transport-durban.html
furniture-removal-durban.html
index.html
panel-van-hire-durban.html
same-day-delivery-durban.html
student-moving-durban.html
truck-hire-durban.html
```
Pages NOT in scope (`about.html`, `faq.html`, `privacy.html`, `terms.html`, `cookie-policy.html`, `driver-agreement.html`) must NOT appear.

- [ ] **Step 5: Spot-check one landing page in the browser**

```bash
cd "C:/Users/USER/Documents/Halaapp-website"
npx http-server . -p 8080 --silent &
sleep 1
```

Open `http://localhost:8080/bakkie-hire-durban.html`. These pages don't have `.stats-bar` / `.how` / `.hero` (they have `.page-hero` / `.page-body`), so `initStats/Steps/Hero` are no-ops. Expected:
- Page loads normally
- Console: no errors
- `<html>` has class `js-ready`

Stop server: `taskkill //F //IM node.exe 2>/dev/null || true`

- [ ] **Step 6: Commit installer + propagated pages**

```bash
cd "C:/Users/USER/Documents/Halaapp-website"
git add install-motion-js.cjs bakkie-hire-durban.html business-transport-durban.html furniture-removal-durban.html panel-van-hire-durban.html same-day-delivery-durban.html student-moving-durban.html truck-hire-durban.html
git commit -m "feat(motion): propagate motion.js to 6 Durban landing pages"
```

Note: `.bak` files are untracked — they'll be gitignored in Task 14.

---

## Task 7: Interim Lighthouse check after wire-ups

**Purpose:** Enforce spec §9.1 budget before touching the hero. If the wire-ups alone regress CWV, fix before adding more work.

**Files:**
- Create: `docs/superpowers/plans/baselines/2026-04-24-lighthouse-after-wireups.md`

- [ ] **Step 1: Start server, run Lighthouse against same 3 pages**

```bash
cd "C:/Users/USER/Documents/Halaapp-website"
npx http-server . -p 8080 --silent &
sleep 1
npx lighthouse http://localhost:8080/index.html --preset=mobile --output=json --output-path=./baselines/index-after-wireups.json --chrome-flags="--headless" --quiet
npx lighthouse http://localhost:8080/bakkie-hire-durban.html --preset=mobile --output=json --output-path=./baselines/bakkie-after-wireups.json --chrome-flags="--headless" --quiet
npx lighthouse http://localhost:8080/student-moving-durban.html --preset=mobile --output=json --output-path=./baselines/student-after-wireups.json --chrome-flags="--headless" --quiet
taskkill //F //IM node.exe 2>/dev/null || true
```

- [ ] **Step 2: Compare against baseline**

```bash
cd "C:/Users/USER/Documents/Halaapp-website"
node -e "
const fs = require('fs');
const pages = ['index', 'bakkie', 'student'];
let md = '# Lighthouse after wire-ups — 2026-04-24\n\n| Page | Metric | Before | After | Delta |\n|---|---|---|---|---|\n';
const metrics = [['LCP','largest-contentful-paint'],['CLS','cumulative-layout-shift'],['TBT','total-blocking-time']];
for (const p of pages) {
  const before = JSON.parse(fs.readFileSync('./baselines/' + p + '-before.json', 'utf8')).audits;
  const after  = JSON.parse(fs.readFileSync('./baselines/' + p + '-after-wireups.json', 'utf8')).audits;
  for (const [label, key] of metrics) {
    const b = before[key].numericValue;
    const a = after[key].numericValue;
    const delta = a - b;
    const sign = delta >= 0 ? '+' : '';
    md += '| ' + p + ' | ' + label + ' | ' + before[key].displayValue + ' | ' + after[key].displayValue + ' | ' + sign + delta.toFixed(0) + ' |\n';
  }
}
fs.writeFileSync('./docs/superpowers/plans/baselines/2026-04-24-lighthouse-after-wireups.md', md);
console.log(md);
"
```

- [ ] **Step 3: Gate check against spec §9.1 budget**

Read the delta column. **Ship blockers:**
- LCP delta > +100ms on any page → investigate
- CLS delta > +0.01 on any page → investigate
- Performance score drop > 3 points → investigate

If all within budget: proceed. If not: STOP. Debug before continuing. Common causes of regression here:
- motion.js not actually deferred (missing `defer` attribute)
- Initial state styles (`opacity: 0`, `width: 0`) applied before page is paintable
- IntersectionObserver firing before viewport settles

- [ ] **Step 4: Commit the comparison**

```bash
cd "C:/Users/USER/Documents/Halaapp-website"
git add docs/superpowers/plans/baselines/2026-04-24-lighthouse-after-wireups.md
git commit -m "docs: Lighthouse comparison after wire-ups (Tasks 3-6)"
```

**Checkpoint:** At this point, the wire-up half of Phase 1 is complete and shippable. If you want to ship now and defer the hero redesign, stop here, push, and deploy. Tasks 8-12 are additive.

---

## Task 8: Hero redesign — write brief via frontend-design skill

**Purpose:** Establish the visual direction for the hero redesign (spec §10.2 step 1). This is human-in-the-loop — the frontend-design skill writes a one-page brief; user approves before 21st.dev is invoked.

**Files:**
- Create: `docs/superpowers/plans/hero-brief.md`

- [ ] **Step 1: Capture a screenshot of the current hero**

Start the server, open `http://localhost:8080/index.html`, viewport 1440×900, take a screenshot of the hero section (lines 1238–1380). Save as `docs/superpowers/plans/hero-before.png`.

- [ ] **Step 2: Invoke the frontend-design skill**

In the Claude Code session, run:
```
/frontend-design
```
Provide the skill with:
- Spec §8.1 text
- Spec §7 motion vocabulary
- The `hero-before.png` screenshot
- Prompt: "Write a one-page brief for the HALA MOVE hero phone-mockup 'alive state' micro-interaction. Tone: Uber/Bolt restraint. Constraint: ≤500ms total duration, fires once on page load. Goal: signal the product is live and moving without motion noise. Deliverable: brief including (a) the motif options considered, (b) the recommended motif with rationale, (c) the pre-port adjustments needed, (d) what success looks like visually."

- [ ] **Step 3: Save the brief**

Save the skill's output as `docs/superpowers/plans/hero-brief.md`.

- [ ] **Step 4: User review gate**

Stop. Ask user: "Brief written to `docs/superpowers/plans/hero-brief.md`. Review and approve before I invoke 21st.dev to generate prototypes."

Only proceed to Task 9 after user approves. If they want changes, re-invoke the frontend-design skill with adjustments and iterate.

- [ ] **Step 5: Commit the brief**

```bash
cd "C:/Users/USER/Documents/Halaapp-website"
git add docs/superpowers/plans/hero-brief.md docs/superpowers/plans/hero-before.png
git commit -m "docs: hero redesign brief (spec §10.2.1)"
```

---

## Task 9: Hero redesign — generate 2-3 variants via 21st.dev magic MCP

**Purpose:** Spec §10.2 step 2. Use the magic MCP to generate React/Tailwind prototypes of the phone mockup in its "alive" state. These are visual references only — never deployed.

**Files:**
- Create: `docs/superpowers/plans/hero-variants/variant-1.tsx` (and 2, 3)
- Create: `docs/superpowers/plans/hero-variants/screenshots/` (PNG per variant)

- [ ] **Step 1: Confirm magic MCP server is available**

```bash
claude mcp list
```
Expected: `magic` server listed as connected. If not, see earlier `/doctor` fix (`cmd /c npx ...` wrapper in `~/.claude.json`).

- [ ] **Step 2: Invoke magic MCP with the brief**

Using the magic MCP tools available in this session (namespace `mcp__plugin_21st-dev_magic__*` or equivalent after tool search), generate:

1. Variant 1: the top-recommended motif from the brief
2. Variant 2: the secondary motif
3. Variant 3 (optional): a contrasting motif for comparison

Each variant is a single React component representing the phone mockup interior. Save as `.tsx` files in `docs/superpowers/plans/hero-variants/`.

- [ ] **Step 3: Render each variant to a PNG**

The magic MCP can produce a preview URL. Alternatively, spin up a minimal Vite React sandbox in a temp folder, render each variant, screenshot to `docs/superpowers/plans/hero-variants/screenshots/variant-N.png`.

- [ ] **Step 4: Commit variants**

```bash
cd "C:/Users/USER/Documents/Halaapp-website"
git add docs/superpowers/plans/hero-variants
git commit -m "docs: hero variants generated via 21st.dev magic (spec §10.2.2)"
```

---

## Task 10: Hero redesign — frontend-design arbitrates + user picks

**Purpose:** Spec §10.2 step 3. frontend-design skill ranks the variants against the brief; user confirms or overrides.

**Files:**
- Create: `docs/superpowers/plans/hero-pick.md`

- [ ] **Step 1: Invoke frontend-design for arbitration**

```
/frontend-design
```
Provide: `hero-brief.md` + all variant `.tsx` files + PNG screenshots.
Prompt: "Rank these 2-3 hero variants against the brief. For the recommended pick, list the specific pre-port adjustments needed (spacing, color, hierarchy, motion timing)."

- [ ] **Step 2: Save arbitration output**

Save as `docs/superpowers/plans/hero-pick.md`.

- [ ] **Step 3: User decision gate**

Ask user: "Frontend-design recommends variant N for reasons X, Y, Z. Agree? Or override with a different variant?"

Only proceed to Task 11 after explicit user pick. Record the final decision in `hero-pick.md`.

- [ ] **Step 4: Commit**

```bash
cd "C:/Users/USER/Documents/Halaapp-website"
git add docs/superpowers/plans/hero-pick.md
git commit -m "docs: hero variant selected (spec §10.2.3)"
```

---

## Task 11: Hero redesign — port winner to vanilla HTML/CSS/SVG

**Purpose:** Spec §10.2 step 4. Rewrite the React variant as vanilla HTML + CSS + SVG inside `index.html` at lines 1238–1379. Match visual parity. Add `data-motion-hero-el` attributes to elements the motion system will target.

**Files:**
- Modify: `index.html` lines 1238–1379 (hero section)

- [ ] **Step 1: Read the current hero markup in detail**

```bash
cd "C:/Users/USER/Documents/Halaapp-website"
sed -n '1238,1379p' index.html > /tmp/hero-before.html
wc -l /tmp/hero-before.html
```
Expected: ~142 lines.

- [ ] **Step 2: Port the winning variant's JSX to HTML**

In `index.html:1238-1379`, rewrite the hero section per `hero-pick.md`. Rules for the port:
- Keep the outer `<section class="hero" id="hero" aria-labelledby="hero-heading">` wrapper exactly as-is — SEO and accessibility depend on it.
- Keep the `.hero-grid` layout structure.
- Replace the phone mockup interior (the part `aria-hidden="true"` starts at line 1288) with the ported markup.
- Tailwind classes from the React variant must be converted to existing CSS classes OR new CSS rules added to the inline `<style>` block above line 1180. No Tailwind runtime.
- SVG stays inline; no external SVG files.
- No new JS — all motion is driven by `assets/motion.js`.
- Add `data-motion-hero-el="eyebrow"`, `data-motion-hero-el="h1"`, `data-motion-hero-el="sub"`, `data-motion-hero-el="cta"`, `data-motion-hero-el="trust"`, `data-motion-hero-el="phone"` to the corresponding elements.

- [ ] **Step 3: Visual parity check**

```bash
cd "C:/Users/USER/Documents/Halaapp-website"
npx http-server . -p 8080 --silent &
sleep 1
```
Open `http://localhost:8080/index.html`, screenshot the hero at 1440×900, compare side-by-side to variant PNG. Differences < a few px / trivial color tweaks are acceptable. Major differences = go back and fix.

- [ ] **Step 4: Ensure fallback (no Motion One) still shows the hero**

DevTools → Network → block motion CDN → reload.
Expected: hero is fully visible, phone mockup renders in final state. If anything's hidden, your CSS has `opacity: 0` as a default — it must be `opacity: 1` by default, and the motion system applies 0 at runtime.

- [ ] **Step 5: Stop server + commit**

```bash
cd "C:/Users/USER/Documents/Halaapp-website"
taskkill //F //IM node.exe 2>/dev/null || true
git add index.html
git commit -m "feat(hero): port redesigned hero to vanilla HTML (spec §10.2.4)"
```

---

## Task 12: Hero redesign — wire Motion One animation

**Purpose:** Spec §10.2 step 5. Fill in `initHero()` in `motion.js`. Implement the stagger sequence (eyebrow → h1 → sub → CTA → trust → phone) firing on page load, not scroll.

**Files:**
- Modify: `assets/motion.js` (replace `initHero` stub)

- [ ] **Step 1: Replace the `initHero` stub**

In `assets/motion.js`, replace `function initHero() { /* Task 12 */ }` with:

```js
  // --------------------------------------------------------------
  // §8.1 — Hero stagger + phone micro-interaction
  // --------------------------------------------------------------
  function initHero() {
    const hero = document.querySelector('.hero');
    if (!hero) return;

    const order = ['eyebrow', 'h1', 'sub', 'cta', 'trust', 'phone'];
    const staggerStartMs = [0, 60, 120, 180, 240, 300];
    const dist = isMobile() ? MOTION_VOCAB.translateMobilePx : MOTION_VOCAB.translateDesktopPx;
    const dur = isMobile() ? MOTION_VOCAB.durationMobileMs : MOTION_VOCAB.durationDesktopMs;

    // Pre-staging handled by CSS in HTML head (install-motion-prestage.cjs)
    // via the `html.js-ready .hero [data-motion-hero-el]` selector.

    // Fire the stagger after first paint so LCP isn't blocked
    requestAnimationFrame(function () {
      order.forEach(function (key, i) {
        const el = hero.querySelector('[data-motion-hero-el="' + key + '"]');
        if (!el) return;

        const delay = staggerStartMs[i];
        const thisDur = (key === 'phone')
          ? MOTION_VOCAB.heroMaxDurationMs / 1000
          : dur / 1000;

        window.Motion.animate(
          el,
          { opacity: [0, 1], transform: ['translateY(' + dist + 'px)', 'translateY(0)'] },
          { duration: thisDur, delay: delay / 1000, easing: MOTION_VOCAB.easing, fill: 'forwards' }
        );
      });
    });
  }
```

- [ ] **Step 2: Syntax-check**

```bash
cd "C:/Users/USER/Documents/Halaapp-website"
node --check assets/motion.js
```
Expected: exit 0.

- [ ] **Step 3: Browser verification**

```bash
cd "C:/Users/USER/Documents/Halaapp-website"
npx http-server . -p 8080 --silent &
sleep 1
```
Open `http://localhost:8080/index.html`, hard-reload (Ctrl+Shift+R).

Expected:
- Hero elements stagger in: eyebrow first, h1 shortly after, then sub, CTA, trust, phone
- Total hero reveal time ≤ ~1200ms after first paint
- No visible jank, no overshoot, no bounce
- Console: no errors

- [ ] **Step 4: Verify reduced-motion + fallback branches still work**

Repeat Task 5 Step 5 + Step 6 checks. Expected: both branches keep the hero fully visible with no animation.

- [ ] **Step 5: Stop server + commit**

```bash
cd "C:/Users/USER/Documents/Halaapp-website"
taskkill //F //IM node.exe 2>/dev/null || true
git add assets/motion.js
git commit -m "feat(motion): wire hero stagger + phone micro-interaction (spec §8.1, §10.2.5)"
```

---

## Task 13: Final Lighthouse sweep + full §9.4 verification

**Purpose:** Spec §9.4 full verification checklist. Before claiming Phase 1 done, all 5 items pass with recorded evidence.

**Files:**
- Create: `docs/superpowers/plans/baselines/2026-04-24-lighthouse-final.md`
- Create: `docs/superpowers/plans/verification-2026-04-24.md`

- [ ] **Step 1: Final Lighthouse run**

```bash
cd "C:/Users/USER/Documents/Halaapp-website"
npx http-server . -p 8080 --silent &
sleep 1
npx lighthouse http://localhost:8080/index.html --preset=mobile --output=json --output-path=./baselines/index-final.json --chrome-flags="--headless" --quiet
npx lighthouse http://localhost:8080/bakkie-hire-durban.html --preset=mobile --output=json --output-path=./baselines/bakkie-final.json --chrome-flags="--headless" --quiet
npx lighthouse http://localhost:8080/student-moving-durban.html --preset=mobile --output=json --output-path=./baselines/student-final.json --chrome-flags="--headless" --quiet
```

- [ ] **Step 2: Build final comparison table**

```bash
cd "C:/Users/USER/Documents/Halaapp-website"
node -e "
const fs = require('fs');
const pages = ['index', 'bakkie', 'student'];
let md = '# Lighthouse final — 2026-04-24\n\n| Page | Metric | Baseline | Final | Delta | Budget | Pass? |\n|---|---|---|---|---|---|---|\n';
const metrics = [
  ['LCP', 'largest-contentful-paint', 100],
  ['CLS', 'cumulative-layout-shift', 0.01],
  ['TBT', 'total-blocking-time', 50],
];
for (const p of pages) {
  const before = JSON.parse(fs.readFileSync('./baselines/' + p + '-before.json', 'utf8')).audits;
  const after  = JSON.parse(fs.readFileSync('./baselines/' + p + '-final.json', 'utf8')).audits;
  for (const [label, key, budget] of metrics) {
    const b = before[key].numericValue;
    const a = after[key].numericValue;
    const delta = a - b;
    const pass = delta <= budget ? 'PASS' : 'FAIL';
    md += '| ' + p + ' | ' + label + ' | ' + before[key].displayValue + ' | ' + after[key].displayValue + ' | ' + (delta>=0?'+':'') + delta.toFixed(3) + ' | +' + budget + ' | ' + pass + ' |\n';
  }
}
fs.writeFileSync('./docs/superpowers/plans/baselines/2026-04-24-lighthouse-final.md', md);
console.log(md);
"
```

Any `FAIL` in the last column = ship blocker per spec §9.1.

- [ ] **Step 3: Run the 5-point §9.4 checklist, record each result**

Create `docs/superpowers/plans/verification-2026-04-24.md` with this template, filled in:

```markdown
# Phase 1 Motion — Verification 2026-04-24

## §9.4.1 Lighthouse mobile
See `baselines/2026-04-24-lighthouse-final.md`. Result: PASS / FAIL

## §9.4.2 prefers-reduced-motion
Steps: DevTools → Rendering → prefers-reduced-motion: reduce → reload index.html.
Expected: no motion, final states visible, counters show final values.
Actual: <fill in>
Result: PASS / FAIL

## §9.4.3 Motion One offline fallback
Steps: DevTools → Network → block cdn.jsdelivr.net/npm/motion@*  → reload index.html.
Expected: `<html class="motion-failed">`, all sections visible, page usable.
Actual: <fill in>
Result: PASS / FAIL

## §9.4.4 Mid-range Android smoke
Device: <Moto G Power emulator or real device>
Steps: open index.html, scroll through hero → stats → steps.
Expected: no stutter, animations complete within budget.
Actual: <fill in>
Result: PASS / FAIL

## §9.4.5 Keyboard tab-through
Steps: Tab through index.html from top to app-cta section.
Expected: focus never traps inside a mid-animation element. Tab order logical.
Actual: <fill in>
Result: PASS / FAIL

## Summary
<n>/5 checks pass. Phase 1 shippable: YES / NO.
```

- [ ] **Step 4: Stop server + commit**

```bash
cd "C:/Users/USER/Documents/Halaapp-website"
taskkill //F //IM node.exe 2>/dev/null || true
git add docs/superpowers/plans/baselines/2026-04-24-lighthouse-final.md docs/superpowers/plans/verification-2026-04-24.md
git commit -m "docs: Phase 1 motion final Lighthouse + §9.4 verification"
```

---

## Task 14: Cleanup — gitignore + .bak removal

**Purpose:** The two installers left 14 `.bak` files + untracked `baselines/*.json`. Add to `.gitignore` so they don't pollute git status.

**Files:**
- Modify: `.gitignore`

- [ ] **Step 1: Check current .gitignore**

```bash
cd "C:/Users/USER/Documents/Halaapp-website"
cat .gitignore 2>/dev/null || echo "(no .gitignore yet)"
```

- [ ] **Step 2: Add motion-related ignore rules**

If `.gitignore` exists, append; if not, create.

Append these lines (preserving existing content):
```
# HALA motion Phase 1 — installer artifacts
*.html.bak

# Lighthouse raw outputs (markdown summaries are committed)
docs/superpowers/plans/baselines/*.json
```

- [ ] **Step 3: Verify with git status**

```bash
cd "C:/Users/USER/Documents/Halaapp-website"
git status --short | grep -E "\.bak|\.json" || echo "(all ignored)"
```
Expected: `(all ignored)` — no more `.bak` or `.json` entries in untracked list.

- [ ] **Step 4: Commit**

```bash
cd "C:/Users/USER/Documents/Halaapp-website"
git add .gitignore
git commit -m "chore: gitignore motion installer .bak files + Lighthouse JSON"
```

---

## Completion checklist

- [ ] Task 1 — baseline captured
- [ ] Task 2 — motion.js skeleton committed
- [ ] Task 3 — stats counter wired
- [ ] Task 4 — how-it-works wired
- [ ] Task 4.5 — generic `.reveal` handler for shared grammar
- [ ] Task 5 — motion.js loaded on index.html + browser-verified
- [ ] Task 6 — motion.js propagated to 6 landing pages
- [ ] Task 7 — interim Lighthouse passes budget
- [ ] Task 8 — hero brief approved by user
- [ ] Task 9 — hero variants generated
- [ ] Task 10 — hero variant selected by user
- [ ] Task 11 — winner ported to vanilla HTML
- [ ] Task 12 — hero motion wired
- [ ] Task 13 — final Lighthouse + §9.4 verification all pass
- [ ] Task 14 — gitignore cleanup

After Task 14: `git log --oneline` shows a clean series of feat/docs/chore commits. Ready to push.

---

## Rollback

If any ship-blocker surfaces late, rollback is fast because changes are scoped:

- **Motion regresses CWV:** `git revert <sha>` on the motion commits, then re-run Task 7 Lighthouse. Installer `.bak` files provide a per-page escape hatch.
- **Specific page broken:** `cp <page>.html.bak <page>.html` then `git add` + commit.
- **Need to disable motion globally without reverting:** delete the `<script defer src="assets/motion.js">` tag on all 7 pages (or add `<html class="motion-failed">` via an inline script before motion.js loads).
