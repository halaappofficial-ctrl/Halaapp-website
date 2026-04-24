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
  // Stats counter helper (used by initStats — §8.3)
  // Animates an element's text content from 0 to data-count over 900ms
  // with ease-out cubic. Preserves data-prefix and data-suffix.
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
      const eased = 1 - Math.pow(1 - t, 3); // ease-out cubic
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

  // --------------------------------------------------------------
  // One-time CSS injection — button hover (§7.4) + motion-failed /
  // motion-reduced safety overrides (§9.3). Kept inside motion.js so
  // the spec's "one new file" commitment holds.
  // --------------------------------------------------------------
  function injectCss() {
    // Idempotency guard — setupMotion() may be re-invoked via window.__halaMotion
    // from DevTools. Without this, each call appends another <style> element.
    if (document.querySelector('style[data-source="motion.js"]')) return;
    const css = [
      '/* §7.4 button hover lift — desktop only, 150ms linear-out */',
      '@media (hover: hover) {',
      '  .btn { transition: transform 150ms cubic-bezier(0.22, 0.61, 0.36, 1); }',
      '  .btn:hover { transform: translateY(-1px); }',
      '}',
      '/* §9.3 safety: if motion.js fails or reduced-motion is set, never hide anything. */',
      '/* These !important rules also override the inline pre-stage CSS injected in the HTML head. */',
      'html.motion-failed .stats-bar .stat-item, html.motion-reduced .stats-bar .stat-item,',
      'html.motion-failed .how .step, html.motion-reduced .how .step,',
      'html.motion-failed .reveal, html.motion-reduced .reveal,',
      'html.motion-failed .hero [data-motion-hero-el], html.motion-reduced .hero [data-motion-hero-el]',
      '{ opacity: 1 !important; transform: none !important; }',
    ].join('\n');
    const style = document.createElement('style');
    style.setAttribute('data-source', 'motion.js');
    style.textContent = css;
    document.head.appendChild(style);
  }

  // --------------------------------------------------------------
  // §8.3 — Stats counter
  // --------------------------------------------------------------
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
    // Every animate() uses `fill: 'forwards'` so the final keyframe value
    // sticks after the animation ends.

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
  // --------------------------------------------------------------
  // §8.2 — How it works: progress line + step reveals
  // --------------------------------------------------------------
  function initSteps() {
    const section = document.querySelector('.how');
    if (!section) return;
    const line = section.querySelector('.steps-line-fill');
    const steps = section.querySelectorAll('.step');
    if (!line || steps.length === 0) return;

    const threshold = isMobile() ? MOTION_VOCAB.thresholdMobile : MOTION_VOCAB.thresholdDesktop;
    const dist = isMobile() ? MOTION_VOCAB.translateMobilePx : MOTION_VOCAB.translateDesktopPx;
    const dur = isMobile() ? MOTION_VOCAB.durationMobileMs : MOTION_VOCAB.durationDesktopMs;

    // Pre-staging for .step elements handled by CSS in HTML head.
    // All animate() calls below use fill: 'forwards'.

    onViewOnce(section, threshold, function () {
      // Line needs width:0 start — not covered by CSS pre-stage (which targets
      // only opacity/transform). Set synchronously at animation start so a debug
      // re-invoke doesn't re-zero an already-animated line on every setupMotion call.
      line.style.width = '0';
      line.style.transformOrigin = 'left center';

      const lineDur = MOTION_VOCAB.progressLineDurationMs / 1000;

      // Animate the progress line (width is an intentional exception per spec §7.3).
      window.Motion.animate(
        line,
        { width: ['0%', '100%'] },
        { duration: lineDur, easing: MOTION_VOCAB.easing, fill: 'forwards' }
      );

      // Schedule each step at its proportional point along the line.
      // Explicit lookup-with-fallback to avoid the `0 || fallback` anti-pattern
      // that masks i=0 through a coincidence of both values being 0.
      const fractions = [0, 0.33, 0.66, 1.0];
      steps.forEach(function (step, i) {
        const frac = (i < fractions.length) ? fractions[i] : (i / Math.max(1, steps.length - 1));
        const delay = frac * MOTION_VOCAB.progressLineDurationMs;
        window.Motion.animate(
          step,
          { opacity: [0, 1], transform: ['translateY(' + dist + 'px)', 'translateY(0)'] },
          { duration: dur / 1000, delay: delay / 1000, easing: MOTION_VOCAB.easing, fill: 'forwards' }
        );
      });
    });
  }
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
      // Skip elements handled by dedicated initializers. These skip-rules
      // must stay in sync with the selectors each dedicated initializer claims.
      if (el.closest('.how') && el.classList.contains('step')) return; // handled by initSteps
      if (el.closest('.hero') && el.hasAttribute('data-motion-hero-el')) return; // handled by initHero
      if (el.closest('.stats-bar') && el.classList.contains('stat-item')) return; // handled by initStats (defensive — markup-drift safe)

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
  // --------------------------------------------------------------
  // §8.1 (revised) — Hero text-column reveal-on-load stagger.
  // Phone mockup is NOT animated here — it has its own motion (bid
  // arrivals, pulse-dot, city-canvas) preserved under §7.5 exceptions.
  // --------------------------------------------------------------
  function initHero() {
    const hero = document.querySelector('.hero');
    if (!hero) return;

    const order = ['eyebrow', 'h1', 'sub', 'cta', 'trust'];
    const staggerStartMs = [0, 60, 120, 180, 240];
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
        window.Motion.animate(
          el,
          { opacity: [0, 1], transform: ['translateY(' + dist + 'px)', 'translateY(0)'] },
          { duration: dur / 1000, delay: delay / 1000, easing: MOTION_VOCAB.easing, fill: 'forwards' }
        );
      });
    });
  }

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
