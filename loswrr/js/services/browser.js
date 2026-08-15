/* ==========================================================================
   LOSWRR Browser Agent Service
   - In-app browser: open URLs in an iframe (sandboxed) for read-only viewing
   - With Desktop Bridge: real browser automation (subject to permissions)
   - Never bypasses CAPTCHA / auth / site ToS
   - Sensitive actions require approval
   ========================================================================== */
(function (global) {
  'use strict';

  function canEmbed(url) {
    try {
      const u = new URL(url);
      // Most production sites block iframe embedding. We try anyway; if it
      // fails the Browser Agent reports a graceful fallback.
      return u.protocol === 'https:' || u.protocol === 'http:';
    } catch (e) { return false; }
  }

  /* Extract title from a URL via fetch (CORS-permitting) */
  async function fetchMeta(url, signal) {
    try {
      const resp = await fetch(url, { signal });
      if (!resp.ok) return null;
      const text = await resp.text();
      const titleMatch = text.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
      const title = titleMatch ? titleMatch[1].trim().slice(0, 200) : url;
      const descMatch = text.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i);
      const desc = descMatch ? descMatch[1].slice(0, 300) : '';
      return { title, desc, fetched: Date.now() };
    } catch (e) {
      return null;
    }
  }

  /* Compose a Google search URL */
  function searchUrl(query) {
    return 'https://www.google.com/search?q=' + encodeURIComponent(query);
  }

  /* Open a URL — real action when bridge is connected, otherwise the in-app
     browser iframe will display it (subject to site X-Frame-Options). */
  async function open(url, opts) {
    opts = opts || {};
    if (global.LBridge && LBridge.state.connected) {
      const r = await LBridge.call('browser_open', { url, confirmed: opts.approved });
      if (r.requiresApproval) return r;
      if (r.ok) return r;
    }
    return { ok: true, mode: 'in-app', url };
  }

  async function search(query, opts) {
    return open(searchUrl(query), opts);
  }

  global.LBrowser = { open, search, fetchMeta, searchUrl, canEmbed };
})(window);
