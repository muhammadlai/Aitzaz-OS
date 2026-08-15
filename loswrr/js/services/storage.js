/* ==========================================================================
   LOSWRR Storage — IndexedDB + LocalStorage hybrid
   Foundation: Aitzaz AI Pro's persistent memory architecture
   ========================================================================== */
(function (global) {
  'use strict';

  const LS_KEY = 'loswrr.v1';
  const memory = {
    _ls: {},
    init() {
      try {
        const raw = localStorage.getItem(LS_KEY);
        if (raw) this._ls = JSON.parse(raw) || {};
      } catch (e) { this._ls = {}; }
    },
    get(key, fallback) {
      return key in this._ls ? this._ls[key] : fallback;
    },
    set(key, val) {
      this._ls[key] = val;
      this._flush();
    },
    update(key, patch) {
      const cur = this._ls[key] || {};
      this._ls[key] = Object.assign({}, cur, patch);
      this._flush();
    },
    push(key, item) {
      const arr = this._ls[key] || [];
      arr.unshift(item);
      this._ls[key] = arr;
      this._flush();
    },
    remove(key, predicate) {
      const arr = this._ls[key] || [];
      const next = arr.filter(x => !predicate(x));
      this._ls[key] = next;
      this._flush();
      return arr.length - next.length;
    },
    all(key) { return this._ls[key] || []; },
    _flush() {
      try { localStorage.setItem(LS_KEY, JSON.stringify(this._ls)); } catch (e) { /* quota */ }
    },
    clear() { this._ls = {}; try { localStorage.removeItem(LS_KEY); } catch (e) {} },
  };

  /* Vector-ish store for memory embeddings (cosine similarity over JS arrays) */
  const vectorStore = {
    _db: null,
    _mem: null, // fallback in-memory store
    async init() {
      if (this._db || this._mem) return;
      if (!('indexedDB' in global)) {
        this._mem = new Map();
        return;
      }
      try {
        this._db = await new Promise((res, rej) => {
          const req = indexedDB.open('loswrr_vectors', 1);
          req.onupgradeneeded = () => {
            const db = req.result;
            if (!db.objectStoreNames.contains('vectors')) {
              const s = db.createObjectStore('vectors', { keyPath: 'id' });
              s.createIndex('category', 'category', { unique: false });
              s.createIndex('created', 'created', { unique: false });
            }
          };
          req.onsuccess = () => res(req.result);
          req.onerror = () => rej(req.error);
        });
      } catch (e) {
        // IndexedDB unavailable; fall back to memory
        this._mem = new Map();
      }
    },
    async put(item) {
      if (!this._db && !this._mem) await this.init();
      if (this._mem) { this._mem.set(item.id, item); return; }
      return new Promise((res, rej) => {
        const tx = this._db.transaction('vectors', 'readwrite');
        const s = tx.objectStore('vectors');
        s.put(item);
        tx.oncomplete = () => res();
        tx.onerror = () => rej(tx.error);
      });
    },
    async all() {
      if (!this._db && !this._mem) await this.init();
      if (this._mem) return Array.from(this._mem.values());
      return new Promise((res, rej) => {
        const tx = this._db.transaction('vectors', 'readonly');
        const s = tx.objectStore('vectors');
        const req = s.getAll();
        req.onsuccess = () => res(req.result || []);
        req.onerror = () => rej(req.error);
      });
    },
    async byCategory(cat) {
      if (!this._db && !this._mem) await this.init();
      if (this._mem) return Array.from(this._mem.values()).filter(x => x.category === cat);
      return new Promise((res, rej) => {
        const tx = this._db.transaction('vectors', 'readonly');
        const s = tx.objectStore('vectors');
        const idx = s.index('category');
        const req = idx.getAll(IDBKeyRange.only(cat));
        req.onsuccess = () => res(req.result || []);
        req.onerror = () => rej(req.error);
      });
    },
    async delete(id) {
      if (!this._db && !this._mem) await this.init();
      if (this._mem) { this._mem.delete(id); return; }
      return new Promise((res, rej) => {
        const tx = this._db.transaction('vectors', 'readwrite');
        tx.objectStore('vectors').delete(id);
        tx.oncomplete = () => res();
        tx.onerror = () => rej(tx.error);
      });
    },
    async clear() {
      if (!this._db && !this._mem) await this.init();
      if (this._mem) { this._mem.clear(); return; }
      return new Promise((res, rej) => {
        const tx = this._db.transaction('vectors', 'readwrite');
        tx.objectStore('vectors').clear();
        tx.oncomplete = () => res();
        tx.onerror = () => rej(tx.error);
      });
    },
  };

  /* Simple deterministic text -> 64-dim vector embedding (hash bag) */
  function textVector(text, dim = 64) {
    const v = new Array(dim).fill(0);
    const tokens = String(text || '').toLowerCase().split(/[^a-z0-9]+/g).filter(Boolean);
    if (!tokens.length) return v;
    for (const t of tokens) {
      let h = 2166136261;
      for (let i = 0; i < t.length; i++) {
        h ^= t.charCodeAt(i);
        h = (h * 16777619) >>> 0;
      }
      v[h % dim] += 1;
      const bigram = (t[0] || ' ') + (t[1] || ' ');
      let h2 = 2166136261;
      for (let i = 0; i < bigram.length; i++) {
        h2 ^= bigram.charCodeAt(i);
        h2 = (h2 * 16777619) >>> 0;
      }
      v[(h2 + 7) % dim] += 0.5;
    }
    const norm = Math.sqrt(v.reduce((s, x) => s + x * x, 0)) || 1;
    return v.map(x => x / norm);
  }
  function cosine(a, b) {
    if (!a || !b || a.length !== b.length) return 0;
    let s = 0;
    for (let i = 0; i < a.length; i++) s += a[i] * b[i];
    return s;
  }

  global.LStorage = memory;
  global.LVector = vectorStore;
  global.LTextVector = textVector;
  global.LCosine = cosine;
  memory.init();
  vectorStore.init().catch(() => {});
})(window);
