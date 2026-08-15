/* ==========================================================================
   LOSWRR Router (hash-based)
   ========================================================================== */
(function (global) {
  'use strict';
  const Router = {
    current: 'command',
    listeners: [],
    go(view, opts) {
      opts = opts || {};
      if (opts.silent !== true) location.hash = '#' + view;
      this.current = view;
      this.listeners.forEach(fn => fn(view));
    },
    on(fn) { this.listeners.push(fn); },
  };
  global.LRouter = Router;
  window.addEventListener('hashchange', () => {
    const v = location.hash.replace(/^#/, '') || 'command';
    Router.current = v;
    Router.listeners.forEach(fn => fn(v));
  });
})(window);
