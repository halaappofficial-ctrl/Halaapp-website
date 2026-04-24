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
