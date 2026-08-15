/* ==========================================================================
   LOSWRR File Service
   In-browser file handling: PDF, DOCX, TXT, CSV, JSON, Images
   With Desktop Bridge: real local filesystem access (approved folders only)
   ========================================================================== */
(function (global) {
  'use strict';

  async function readAsText(file) {
    return new Promise((res, rej) => {
      const r = new FileReader();
      r.onload = () => res(r.result);
      r.onerror = () => rej(r.error);
      r.readAsText(file);
    });
  }
  async function readAsDataURL(file) {
    return new Promise((res, rej) => {
      const r = new FileReader();
      r.onload = () => res(r.result);
      r.onerror = () => rej(r.error);
      r.readAsDataURL(file);
    });
  }
  async function readAsArrayBuffer(file) {
    return new Promise((res, rej) => {
      const r = new FileReader();
      r.onload = () => res(r.result);
      r.onerror = () => rej(r.error);
      r.readAsArrayBuffer(file);
    });
  }

  function detectKind(file) {
    const n = (file.name || '').toLowerCase();
    if (n.endsWith('.pdf')) return 'pdf';
    if (n.endsWith('.docx')) return 'docx';
    if (n.endsWith('.txt') || n.endsWith('.md')) return 'text';
    if (n.endsWith('.csv')) return 'csv';
    if (n.endsWith('.json')) return 'json';
    if (/\.(png|jpe?g|webp|gif|bmp|svg)$/.test(n)) return 'image';
    return 'binary';
  }

  async function parse(file) {
    const kind = detectKind(file);
    if (kind === 'text' || kind === 'csv' || kind === 'json') {
      return { kind, text: await readAsText(file) };
    }
    if (kind === 'image') {
      return { kind, dataUrl: await readAsDataURL(file), size: file.size };
    }
    if (kind === 'pdf') {
      // Without a PDF parser lib loaded at runtime we still expose the data URL
      // so the UI can show the file card and prompt the user to install a
      // parser extension. The actual content remains accessible.
      return { kind, dataUrl: await readAsDataURL(file), size: file.size };
    }
    if (kind === 'docx') {
      // DOCX is a zip of XML — extract raw text if we have JSZip, else surface file card only.
      return { kind, dataUrl: await readAsDataURL(file), size: file.size };
    }
    return { kind, dataUrl: await readAsDataURL(file), size: file.size };
  }

  /* Simple CSV parser */
  function parseCSV(text) {
    const lines = text.split(/\r?\n/).filter(Boolean);
    if (!lines.length) return { headers: [], rows: [] };
    const headers = splitCSVLine(lines[0]);
    const rows = lines.slice(1).map(l => {
      const cells = splitCSVLine(l);
      const obj = {};
      headers.forEach((h, i) => { obj[h] = cells[i] || ''; });
      return obj;
    });
    return { headers, rows };
  }
  function splitCSVLine(line) {
    const out = []; let cur = ''; let inQ = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (c === '"' && line[i + 1] === '"') { cur += '"'; i++; continue; }
      if (c === '"') { inQ = !inQ; continue; }
      if (c === ',' && !inQ) { out.push(cur); cur = ''; continue; }
      cur += c;
    }
    out.push(cur);
    return out;
  }

  function list() { return LStorage.get('files', []); }
  function add(meta) {
    const arr = list();
    const f = Object.assign({ id: 'f_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6), uploaded: Date.now() }, meta);
    arr.unshift(f);
    LStorage.set('files', arr);
    return f;
  }
  function remove(id) {
    const arr = list();
    LStorage.set('files', arr.filter(x => x.id !== id));
  }

  async function summarize(parsed) {
    if (!parsed) return '';
    if (parsed.kind === 'text' || parsed.kind === 'csv' || parsed.kind === 'json') {
      const sample = (parsed.text || '').slice(0, 6000);
      try {
        const r = await LProviders.respond([
          { role: 'system', content: 'You are LOSWRR File Agent. Summarize the content in 3-6 bullet points, capture key facts, and note anything actionable.' },
          { role: 'user', content: sample },
        ], { temperature: 0.3, max_tokens: 400 });
        return r.text;
      } catch (e) { return 'Summary unavailable.'; }
    }
    return 'File of type ' + parsed.kind + ' (binary). Configure a parser to extract content.';
  }

  global.LFiles = { parse, parseCSV, list, add, remove, summarize, readAsText, readAsDataURL, detectKind };
})(window);
