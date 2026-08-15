/* ==========================================================================
   LOSWRR Security Service
   Authentication, session, PIN, audit log, permissions
   ========================================================================== */
(function (global) {
  'use strict';

  const state = {
    authenticated: false,
    sessionStarted: null,
    pinHash: null,
    pinSalt: null,
  };

  async function ensurePin() {
    let p = LStorage.get('pin', null);
    if (!p || !p.hash) {
      const initial = '0000';
      const h = await LCrypto.hashPin(initial);
      p = h;
      LStorage.set('pin', p);
      LStorage.set('pin-default', true);
    }
    state.pinHash = p.hash;
    state.pinSalt = p.salt;
    return p;
  }

  async function verify(input) {
    await ensurePin();
    const stored = { hash: state.pinHash, salt: state.pinSalt };
    const ok = await LCrypto.verifyPin(input, stored);
    if (ok) {
      state.authenticated = true;
      state.sessionStarted = Date.now();
      // Create a session passphrase for encrypting API keys at rest
      const passphrase = 'loswrr-' + Math.random().toString(36).slice(2) + '-' + Date.now();
      LStorage.set('pin-passphrase', passphrase);
      audit('login', 'OK');
      return true;
    }
    audit('login', 'FAIL');
    return false;
  }

  async function changePin(oldPin, newPin) {
    const ok = await verify(oldPin);
    if (!ok) return false;
    const h = await LCrypto.hashPin(newPin);
    LStorage.set('pin', h);
    state.pinHash = h.hash;
    state.pinSalt = h.salt;
    audit('pin-changed', 'OK');
    return true;
  }

  function logout() {
    state.authenticated = false;
    state.sessionStarted = null;
    LStorage.set('pin-passphrase', '');
    audit('logout', 'OK');
  }

  function audit(action, result) {
    const log = LStorage.get('audit', []);
    log.unshift({ ts: Date.now(), action, result, ua: navigator.userAgent.slice(0, 80) });
    LStorage.set('audit', log.slice(0, 500));
  }

  function auditLog() { return LStorage.get('audit', []); }

  function isDefaultPin() { return !!LStorage.get('pin-default', false); }

  global.LSecurity = { verify, changePin, logout, ensurePin, audit, auditLog, state, isDefaultPin };
})(window);
