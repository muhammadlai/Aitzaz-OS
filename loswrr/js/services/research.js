/* ==========================================================================
   LOSWRR Research Service
   SEARCH → OPEN SOURCES → EXTRACT → VERIFY → COMPARE → SUMMARIZE → SAVE
   ========================================================================== */
(function (global) {
  'use strict';

  async function research(query, opts) {
    opts = opts || {};
    const log = (verb, target) => global.LApp && LApp.emit('activity', { actor: 'Research', verb, target });
    log('searching', query);
    const r = await LSearch.search(query, { timeout: 10000 });
    const results = r.results.slice(0, opts.limit || 6);
    log('opening sources', results.length + ' sources');
    const extracted = results.map(x => ({ title: x.title, url: x.url, snippet: x.snippet, source: x.source }));
    log('comparing sources', 'extracted ' + extracted.length);
    const summary = await summarize(query, extracted);
    log('saving research', query);
    const id = 'res_' + Date.now();
    LStorage.set('research:' + id, {
      id, query, results: extracted, summary, mode: r.mode, source: r.source, created: Date.now(),
    });
    return { id, query, results: extracted, summary, mode: r.mode };
  }

  async function summarize(query, items) {
    const sysPrompt = 'You are LOSWRR Research, a precise summarizer. Produce a concise, factual summary with key findings and direct quotes (if available). Include source URLs as a references list. Use bullet points. Keep it under 300 words.';
    const userContent = 'Question: ' + query + '\n\nSources:\n' +
      items.map((x, i) => (i + 1) + '. [' + x.title + '] ' + x.url + '\n' + x.snippet).join('\n\n');
    try {
      const r = await LProviders.respond([
        { role: 'system', content: sysPrompt },
        { role: 'user', content: userContent },
      ], { temperature: 0.3, max_tokens: 600 });
      return r.text;
    } catch (e) {
      return 'Summary unavailable in demo mode.';
    }
  }

  function list() {
    const out = [];
    for (const k of Object.keys(localStorage)) {
      if (k.startsWith('loswrr.v1')) {
        try {
          const all = JSON.parse(localStorage.getItem(k));
          for (const kk of Object.keys(all || {})) {
            if (kk.startsWith('research:')) out.push(all[kk]);
          }
        } catch (e) {}
      }
    }
    return out.sort((a, b) => b.created - a.created);
  }
  function get(id) { return LStorage.get('research:' + id, null); }
  function remove(id) {
    const all = LStorage.get('research', null);
    if (all) { delete all[id]; LStorage.set('research', all); }
    // Fallback — direct
    try {
      const raw = localStorage.getItem('loswrr.v1');
      const obj = raw ? JSON.parse(raw) : {};
      if (obj['research:' + id]) { delete obj['research:' + id]; localStorage.setItem('loswrr.v1', JSON.stringify(obj)); }
    } catch (e) {}
  }

  global.LResearch = { research, list, get, remove };
})(window);
