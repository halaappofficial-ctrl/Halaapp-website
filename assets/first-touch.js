/*
 * HALA MOVE - first-touch attribution for the business and fleet enquiry forms.
 *
 * Spec: hala-backend docs/research/2026-11-02-lead-form-questions.md, section D.
 *
 * WHAT IT DOES. Remembers, for this browser tab only, where the FIRST tagged or externally referred
 * page view came from: the ?s= code, the utm_* values, and the referring host. A visitor who lands on
 * the homepage from an Instagram link and taps "Get a Business Quote" two clicks later still arrives
 * at the form tagged; without this the tag is lost on the first click and the referrer becomes our
 * own domain.
 *
 * WHAT IT DOES NOT DO. No cookie, no third-party script, no request of its own. The record lives in
 * sessionStorage (the browser deletes it when the tab closes) and leaves the device only inside an
 * enquiry the visitor chooses to send. The referring HOST is kept, never the path or query: a full
 * referring address can carry someone else's search terms or tokens.
 *
 * SHAPE. The keys are exactly the ones the backend sanitizer keeps (src/utils/leadAnswers.js,
 * sanitizeAttribution): page, s, utm_source, utm_medium, utm_campaign, utm_content, referrer_host.
 * Any other key would be dropped there silently, so none is produced here.
 *
 * ES5 on purpose, like every script on this site that has to run on an old phone.
 */
(function (root) {
  'use strict';

  var KEY = 'hm_ft';
  var UTM = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content'];
  var OWN_HOST = /(^|\.)halamove\.co\.za$/;

  function query(search) {
    var out = {};
    var s = String(search || '').replace(/^\?/, '');
    if (!s) return out;
    var parts = s.split('&');
    for (var i = 0; i < parts.length; i++) {
      if (!parts[i]) continue;
      var eq = parts[i].indexOf('=');
      var k = eq < 0 ? parts[i] : parts[i].slice(0, eq);
      var v = eq < 0 ? '' : parts[i].slice(eq + 1);
      try { k = decodeURIComponent(k.replace(/\+/g, ' ')); v = decodeURIComponent(v.replace(/\+/g, ' ')); } catch (e) { continue; }
      if (!(k in out)) out[k] = v;   // first value wins, like URLSearchParams.get
    }
    return out;
  }

  // The same allow-list middleware.js uses for ?s= codes.
  function cleanS(v) { return String(v || '').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 32); }
  // The characters the backend sanitizer keeps in a utm value.
  function cleanUtm(v) { return String(v || '').replace(/[^A-Za-z0-9:_.-]/g, '').slice(0, 60); }

  function hostOf(referrer) {
    var m = /^[a-z][a-z0-9+.-]*:\/\/([^\/?#:@]+)/i.exec(String(referrer || ''));
    if (!m) return '';
    var h = m[1].toLowerCase();
    if (OWN_HOST.test(h)) return '';
    return /^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(h) && h.length <= 100 ? h : '';
  }

  function touch(search, referrer) {
    var q = query(search);
    var t = {};
    var s = cleanS(q.s);
    if (s) t.s = s;
    for (var i = 0; i < UTM.length; i++) {
      var u = cleanUtm(q[UTM[i]]);
      if (u) t[UTM[i]] = u;
    }
    var h = hostOf(referrer);
    if (h) t.referrer_host = h;
    return t;
  }

  function tagged(t) {
    return !!(t && (t.s || t.utm_source || t.utm_medium || t.utm_campaign || t.utm_content));
  }

  function read() {
    try {
      var raw = root.sessionStorage ? root.sessionStorage.getItem(KEY) : null;
      var o = raw ? JSON.parse(raw) : null;
      return o && typeof o === 'object' ? o : null;
    } catch (e) { return null; }
  }

  // The FIRST tagged or externally referred view in the tab is kept; later views never overwrite it.
  function remember(t) {
    if (!t || (!tagged(t) && !t.referrer_host)) return;
    if (read()) return;
    try { root.sessionStorage.setItem(KEY, JSON.stringify(t)); } catch (e) { /* storage off: nothing kept */ }
  }

  // "/quote", "/business-transport-durban": a path only, the way the admin names the form.
  function page(pathname) {
    var p = String(pathname || '/').split(/[?#]/)[0].replace(/\.html$/, '');
    if (p.length > 1) p = p.replace(/\/+$/, '');
    if (p === '/index' || p === '') p = '/';
    return p.charAt(0) === '/' ? p : '/' + p;
  }

  // At submit: the current address's tags win; otherwise the stored first touch; the referring host
  // comes from whichever record supplied the tags, else from the other one.
  function attribution(loc, referrer) {
    loc = loc || {};
    var cur = touch(loc.search, referrer);
    var ft = read();
    var base = tagged(cur) ? cur : (ft || cur);
    var out = { page: page(loc.pathname) };
    if (base.s) out.s = base.s;
    for (var i = 0; i < UTM.length; i++) if (base[UTM[i]]) out[UTM[i]] = base[UTM[i]];
    var host = base.referrer_host || cur.referrer_host || (ft && ft.referrer_host) || '';
    if (host) out.referrer_host = host;
    return out;
  }

  root.HMAttribution = { touch: touch, tagged: tagged, read: read, attribution: attribution, page: page };

  try { remember(touch(root.location && root.location.search, root.document && root.document.referrer)); } catch (e) { /* never break a page */ }
})(typeof window !== 'undefined' ? window : this);
