/* ==========================================================================
   LOSWRR Memory Service
   Structured personal memory on top of persistent vector store.
   Foundation: Aitzaz AI Pro's ChromaDB + SQLite semantic memory.
   Categories: PERSONAL, PREFERENCES, GOALS, PROJECTS, BUSINESS,
               PEOPLE, JOBS, LEADS, DECISIONS, TASKS
   ========================================================================== */
(function (global) {
  'use strict';

  const CATEGORIES = ['PERSONAL', 'PREFERENCES', 'GOALS', 'PROJECTS', 'BUSINESS',
                      'PEOPLE', 'JOBS', 'LEADS', 'DECISIONS', 'TASKS'];

  async function add(text, opts) {
    opts = opts || {};
    const cat = (opts.category || 'PERSONAL').toUpperCase();
    const item = {
      id: 'm_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8),
      text: String(text).trim(),
      category: cat,
      tags: opts.tags || [],
      vector: LTextVector(text),
      created: Date.now(),
      source: opts.source || 'user',
    };
    await LVector.put(item);
    return item;
  }

  async function update(id, patch) {
    const all = await LVector.all();
    const found = all.find(x => x.id === id);
    if (!found) return null;
    if (patch.text) {
      found.text = patch.text;
      found.vector = LTextVector(patch.text);
    }
    if (patch.category) found.category = patch.category.toUpperCase();
    if (patch.tags) found.tags = patch.tags;
    found.updated = Date.now();
    await LVector.put(found);
    return found;
  }

  async function remove(id) { await LVector.delete(id); }

  async function search(query, opts) {
    opts = opts || {};
    const v = LTextVector(query);
    const all = await LVector.all();
    const cat = opts.category ? opts.category.toUpperCase() : null;
    const ranked = all
      .filter(x => !cat || x.category === cat)
      .map(x => ({ item: x, score: LCosine(x.vector, v) }))
      .sort((a, b) => b.score - a.score);
    if (opts.limit) return ranked.slice(0, opts.limit).map(r => r.item);
    return ranked.filter(r => r.score > 0.05).map(r => r.item);
  }

  async function list(opts) {
    opts = opts || {};
    const all = await LVector.all();
    const cat = opts.category ? opts.category.toUpperCase() : null;
    return all
      .filter(x => !cat || x.category === cat)
      .sort((a, b) => b.created - a.created);
  }

  async function byCategory() {
    const all = await LVector.all();
    const map = {};
    for (const c of CATEGORIES) map[c] = 0;
    for (const m of all) map[m.category] = (map[m.category] || 0) + 1;
    return map;
  }

  async function exportAll() {
    const all = await LVector.all();
    return {
      version: 1,
      exportedAt: new Date().toISOString(),
      items: all.map(({ vector, ...rest }) => rest),
    };
  }

  /* Intent detection: did the user ask to remember, recall, decide, etc. */
  function classifyIntent(text) {
    const t = (text || '').toLowerCase();
    if (/^remember\b|please remember|don't forget|keep in mind|note that/.test(t)) return 'remember';
    if (/^what('?s| is) my\b|^recall\b|^do you remember\b/.test(t)) return 'recall';
    if (/^forget\b|^delete that memory\b/.test(t)) return 'forget';
    return null;
  }

  /* Extract a clean fact from a sentence like "Remember that my X is Y" */
  function extractFact(text) {
    let t = String(text || '').trim();
    t = t.replace(/^(please\s+)?(remember|note|keep in mind|don't forget) (that\s+)?/i, '');
    t = t.replace(/[.!?]+$/g, '');
    return t.trim();
  }

  function guessCategory(text) {
    const t = text.toLowerCase();
    if (/\b(job|career|remote work|salary|hiring|interview)\b/.test(t)) return 'JOBS';
    if (/\b(lead|prospect|outreach|company|roofing|customer|client)\b/.test(t)) return 'LEADS';
    if (/\b(prefer|like|love|hate|want|need|favorite|always|never)\b/.test(t)) return 'PREFERENCES';
    if (/\b(goal|aim|target|objective|mission)\b/.test(t)) return 'GOALS';
    if (/\b(project|build|launch|ship)\b/.test(t)) return 'PROJECTS';
    if (/\b(decided|decision|chose|will do)\b/.test(t)) return 'DECISIONS';
    if (/\b(task|todo|to-do|remind me|follow[- ]up)\b/.test(t)) return 'TASKS';
    if (/\b(my name|i am|i live|i work|about me|family|wife|son|daughter)\b/.test(t)) return 'PERSONAL';
    if (/\b(business|revenue|pricing|product|customer|mrr|arr)\b/.test(t)) return 'BUSINESS';
    if (/\b(john|sarah|mike|person|contact|met|call with)\b/.test(t)) return 'PEOPLE';
    return 'PERSONAL';
  }

  /* High-level: process a user utterance and update memory if appropriate */
  async function processUtterance(text) {
    const intent = classifyIntent(text);
    if (intent === 'remember') {
      const fact = extractFact(text);
      const cat = guessCategory(fact);
      const item = await add(fact, { category: cat, source: 'user' });
      return { action: 'remembered', item };
    }
    if (intent === 'recall') {
      const q = text.replace(/^(what('?s| is) my|recall|do you remember)\b/i, '').replace(/[?.!]+$/, '').trim();
      const results = await search(q, { limit: 3 });
      return { action: 'recalled', results };
    }
    if (intent === 'forget') {
      const q = text.replace(/^forget\b/i, '').replace(/[?.!]+$/, '').trim();
      const results = await search(q, { limit: 5 });
      for (const r of results) await remove(r.id);
      return { action: 'forgot', removed: results.length, results };
    }
    return { action: 'none' };
  }

  global.LMemory = {
    CATEGORIES,
    add, update, remove, search, list, byCategory, exportAll,
    classifyIntent, extractFact, guessCategory, processUtterance,
  };
})(window);
