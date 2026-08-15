/* ==========================================================================
   LOSWRR Web Search
   Multiple fallbacks: DuckDuckGo HTML, Wikipedia, Searx instances.
   Clearly returns DEMO results if all fail.
   ========================================================================== */
(function (global) {
  'use strict';

  const CORS_PROXIES = [
    (u) => 'https://api.allorigins.win/raw?url=' + encodeURIComponent(u),
    (u) => 'https://corsproxy.io/?' + encodeURIComponent(u),
    (u) => 'https://r.jina.ai/' + u.replace(/^https?:\/\//, ''),
  ];

  async function searchDuckDuckGo(query, signal) {
    const url = 'https://html.duckduckgo.com/html/?q=' + encodeURIComponent(query);
    let html = '';
    for (const proxy of CORS_PROXIES) {
      try {
        const resp = await fetch(proxy(url), { signal });
        if (resp.ok) {
          html = await resp.text();
          if (html && html.length > 100) break;
        }
      } catch (e) { /* try next */ }
    }
    if (!html) throw new Error('All proxies failed');
    return parseDuckDuckGo(html);
  }

  function parseDuckDuckGo(html) {
    const out = [];
    const re = /<a[^>]+class="result__a"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?<a[^>]+class="result__snippet"[^>]*>([\s\S]*?)<\/a>/g;
    let m;
    while ((m = re.exec(html)) && out.length < 10) {
      const href = decodeHtml(m[1]);
      const title = stripTags(decodeHtml(m[2])).trim();
      const snippet = stripTags(decodeHtml(m[3])).trim();
      if (title) out.push({ title, snippet, url: href, source: domainOf(href) });
    }
    return out;
  }

  function stripTags(s) { return String(s || '').replace(/<[^>]+>/g, ''); }
  function decodeHtml(s) { return String(s || '')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, ' '); }
  function domainOf(url) { try { return new URL(url).hostname.replace(/^www\./, ''); } catch (e) { return url; } }

  /* Wikipedia search */
  async function searchWikipedia(query, signal) {
    const url = 'https://en.wikipedia.org/w/api.php?action=opensearch&format=json&origin=*&search=' + encodeURIComponent(query);
    const resp = await fetch(url, { signal });
    if (!resp.ok) throw new Error('Wikipedia failed');
    const data = await resp.json();
    const titles = data[1] || [];
    const descs = data[2] || [];
    const links = data[3] || [];
    return titles.map((t, i) => ({ title: t, snippet: descs[i] || '', url: links[i] || '', source: 'wikipedia.org' }));
  }

  async function search(query, opts) {
    opts = opts || {};
    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), opts.timeout || 8000);
    const errors = [];
    try {
      try {
        const r = await searchWikipedia(query, ac.signal);
        if (r && r.length) return { results: r, mode: 'live', source: 'wikipedia' };
      } catch (e) { errors.push('wiki: ' + (e.message || e)); }
      try {
        const r = await searchDuckDuckGo(query, ac.signal);
        if (r && r.length) return { results: r, mode: 'live', source: 'duckduckgo' };
      } catch (e) { errors.push('ddg: ' + (e.message || e)); }
    } finally { clearTimeout(t); }
    return { results: demoSearch(query), mode: 'demo', source: 'demo', errors };
  }

  function demoSearch(query) {
    return [
      { title: 'Result for "' + query + '" (demo)', snippet: 'Demo search result. Connect a provider with web-search capability in Settings to see live data.', url: 'https://example.com', source: 'demo' },
      { title: 'LOSWRR Research Note', snippet: 'In demo mode, search results are simulated. Real queries need a working network and provider.', url: 'https://example.com', source: 'demo' },
    ];
  }

  global.LSearch = { search };
})(window);
