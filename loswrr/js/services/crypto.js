/* ==========================================================================
   LOSWRR Crypto — AES-GCM via Web Crypto for secret storage
   ========================================================================== */
(function (global) {
  'use strict';
  const subtle = global.crypto && global.crypto.subtle;

  async function deriveKey(passphrase, salt) {
    const enc = new TextEncoder();
    const baseKey = await subtle.importKey(
      'raw', enc.encode(passphrase),
      { name: 'PBKDF2' }, false, ['deriveKey']
    );
    return subtle.deriveKey(
      { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' },
      baseKey,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );
  }

  function toB64(buf) {
    const bytes = new Uint8Array(buf);
    let s = '';
    for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
    return btoa(s);
  }
  function fromB64(b64) {
    const s = atob(b64);
    const bytes = new Uint8Array(s.length);
    for (let i = 0; i < s.length; i++) bytes[i] = s.charCodeAt(i);
    return bytes.buffer;
  }

  async function encrypt(text, passphrase) {
    if (!subtle) throw new Error('Web Crypto not available');
    const salt = global.crypto.getRandomValues(new Uint8Array(16));
    const iv = global.crypto.getRandomValues(new Uint8Array(12));
    const key = await deriveKey(passphrase, salt);
    const enc = new TextEncoder();
    const ct = await subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(text));
    return JSON.stringify({
      v: 1, s: toB64(salt), i: toB64(iv), c: toB64(ct),
    });
  }
  async function decrypt(payload, passphrase) {
    if (!subtle) throw new Error('Web Crypto not available');
    const obj = JSON.parse(payload);
    const salt = new Uint8Array(fromB64(obj.s));
    const iv = new Uint8Array(fromB64(obj.i));
    const ct = fromB64(obj.c);
    const key = await deriveKey(passphrase, salt);
    const pt = await subtle.decrypt({ name: 'AES-GCM', iv }, key, ct);
    return new TextDecoder().decode(pt);
  }

  /* PIN hashing — fast for PIN, slow for credentials */
  async function hashPin(pin, salt) {
    const enc = new TextEncoder();
    const useSalt = salt || global.crypto.getRandomValues(new Uint8Array(16));
    const baseKey = await subtle.importKey('raw', enc.encode(pin), { name: 'PBKDF2' }, false, ['deriveBits']);
    const bits = await subtle.deriveBits(
      { name: 'PBKDF2', salt: useSalt, iterations: 50000, hash: 'SHA-256' },
      baseKey, 256
    );
    return { hash: toB64(bits), salt: toB64(useSalt) };
  }
  async function verifyPin(pin, stored) {
    if (!stored || !stored.salt) return false;
    const salt = new Uint8Array(fromB64(stored.salt));
    const useSalt = salt;
    const enc = new TextEncoder();
    const baseKey = await subtle.importKey('raw', enc.encode(pin), { name: 'PBKDF2' }, false, ['deriveBits']);
    const bits = await subtle.deriveBits(
      { name: 'PBKDF2', salt: useSalt, iterations: 50000, hash: 'SHA-256' },
      baseKey, 256
    );
    return toB64(bits) === stored.hash;
  }

  global.LCrypto = { encrypt, decrypt, hashPin, verifyPin, toB64, fromB64 };
})(window);
