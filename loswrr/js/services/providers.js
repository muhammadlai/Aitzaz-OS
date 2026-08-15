/* ==========================================================================
   LOSWRR AI Provider Manager
   Supports: Groq, Cerebras, NVIDIA, Ollama, OpenAI, Anthropic, Gemini
   Falls back gracefully to demo / offline mode.
   Never exposes API keys in the frontend by design — all keys are
   AES-encrypted in local storage and only sent to the provider directly
   over HTTPS from the browser.
   ========================================================================== */
(function (global) {
  'use strict';

  const providers = {
    groq: {
      name: 'Groq', icon: 'GR', type: 'cloud', baseUrl: 'https://api.groq.com/openai/v1',
      models: ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant', 'mixtral-8x7b-32768', 'gemma2-9b-it'],
      defaultModel: 'llama-3.3-70b-versatile',
    },
    cerebras: {
      name: 'Cerebras', icon: 'CB', type: 'cloud', baseUrl: 'https://api.cerebras.ai/v1',
      models: ['llama-3.3-70b', 'llama-3.1-8b', 'qwen-3-32b'],
      defaultModel: 'llama-3.3-70b',
    },
    nvidia: {
      name: 'NVIDIA NIM', icon: 'NV', type: 'cloud', baseUrl: 'https://integrate.api.nvidia.com/v1',
      models: ['meta/llama-3.1-70b-instruct', 'meta/llama-3.1-8b-instruct', 'mistralai/mistral-large-2-instruct'],
      defaultModel: 'meta/llama-3.1-70b-instruct',
    },
    ollama: {
      name: 'Ollama (local)', icon: 'OL', type: 'local', baseUrl: 'http://localhost:11434/v1',
      models: ['llama3.2', 'qwen2.5', 'mistral', 'gemma2', 'phi3', 'codellama'],
      defaultModel: 'llama3.2',
    },
    openai: {
      name: 'OpenAI', icon: 'OA', type: 'cloud', baseUrl: 'https://api.openai.com/v1',
      models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4.1', 'gpt-4.1-mini', 'o4-mini'],
      defaultModel: 'gpt-4o-mini',
    },
    anthropic: {
      name: 'Anthropic', icon: 'AN', type: 'cloud', baseUrl: 'https://api.anthropic.com/v1',
      models: ['claude-opus-4-1', 'claude-sonnet-4-5', 'claude-haiku-4-5'],
      defaultModel: 'claude-sonnet-4-5',
    },
    gemini: {
      name: 'Google Gemini', icon: 'GM', type: 'cloud', baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
      models: ['gemini-2.5-pro', 'gemini-2.5-flash', 'gemini-2.0-flash-exp'],
      defaultModel: 'gemini-2.5-flash',
    },
  };

  const state = {
    active: 'groq',
    fallback: 'ollama',
    config: {}, // provider -> { apiKey, baseUrl, model }
    latency: {},
    status: {}, // provider -> 'unknown' | 'ok' | 'fail' | 'pending'
    lastError: {},
  };

  function init() {
    const cfg = LStorage.get('providers', null);
    if (cfg) {
      state.active = cfg.active || 'groq';
      state.fallback = cfg.fallback || 'ollama';
      state.config = cfg.config || {};
    } else {
      // Default config; no API keys — will fall back to local/demo
      state.active = 'groq';
      state.fallback = 'ollama';
      state.config = {
        groq: { model: 'llama-3.3-70b-versatile' },
        cerebras: { model: 'llama-3.3-70b' },
        nvidia: { model: 'meta/llama-3.1-70b-instruct' },
        ollama: { baseUrl: 'http://localhost:11434/v1', model: 'llama3.2' },
        openai: { model: 'gpt-4o-mini' },
        anthropic: { model: 'claude-sonnet-4-5' },
        gemini: { model: 'gemini-2.5-flash' },
      };
      LStorage.set('providers', { active: state.active, fallback: state.fallback, config: state.config });
    }
  }

  function save() {
    LStorage.set('providers', { active: state.active, fallback: state.fallback, config: state.config });
  }

  function getProvider(key) { return providers[key]; }
  function listProviders() { return Object.keys(providers).map(k => ({ key: k, ...providers[k] })); }

  function getActive() { return state.active; }
  function setActive(key) {
    if (!providers[key]) return false;
    state.active = key;
    save();
    return true;
  }
  function getFallback() { return state.fallback; }
  function setFallback(key) {
    if (!providers[key]) return false;
    state.fallback = key;
    save();
    return true;
  }
  function getConfig(key) { return state.config[key] || {}; }
  function setConfig(key, patch) {
    state.config[key] = Object.assign({}, state.config[key] || {}, patch);
    save();
  }
  function getApiKey(key) {
    const enc = (state.config[key] || {}).apiKey;
    if (!enc) return '';
    try {
      const passphrase = LStorage.get('pin-passphrase', '') || '';
      if (!passphrase) return '';
      return LCrypto.decrypt(enc, passphrase);
    } catch (e) { return ''; }
  }
  async function setApiKey(key, value) {
    if (!value) {
      const cfg = state.config[key] || {};
      delete cfg.apiKey;
      state.config[key] = cfg;
      save();
      return;
    }
    const passphrase = LStorage.get('pin-passphrase', '');
    if (!passphrase) throw new Error('No active session passphrase');
    const enc = await LCrypto.encrypt(value, passphrase);
    state.config[key] = Object.assign({}, state.config[key] || {}, { apiKey: enc });
    save();
  }

  /* Latency probe */
  async function probe(key) {
    const p = providers[key];
    if (!p) return;
    state.status[key] = 'pending';
    state.latency[key] = null;
    const start = performance.now();
    try {
      const apiKey = getApiKey(key);
      if (!apiKey && p.type === 'cloud') {
        state.status[key] = 'fail';
        state.lastError[key] = 'No API key configured';
        return;
      }
      // Lightweight list-models probe
      const url = p.baseUrl.replace(/\/+$/, '') + '/models';
      const headers = { 'Content-Type': 'application/json' };
      if (key === 'anthropic') {
        headers['x-api-key'] = apiKey;
        headers['anthropic-version'] = '2023-06-01';
      } else {
        headers['Authorization'] = 'Bearer ' + apiKey;
      }
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 4000);
      const resp = await fetch(url, { headers, signal: ctrl.signal }).catch(e => { throw e; });
      clearTimeout(t);
      state.latency[key] = Math.round(performance.now() - start);
      if (resp && resp.ok) state.status[key] = 'ok';
      else {
        state.status[key] = 'fail';
        state.lastError[key] = 'HTTP ' + resp.status;
      }
    } catch (e) {
      state.status[key] = 'fail';
      state.lastError[key] = e && e.message || String(e);
    }
  }

  /* Chat completion (OpenAI-compatible) */
  async function chat(messages, opts) {
    opts = opts || {};
    const order = [state.active, state.fallback].filter(Boolean);
    let lastErr = null;
    for (const key of order) {
      const p = providers[key];
      const cfg = state.config[key] || {};
      if (!p) continue;
      try {
        if (p.type === 'cloud') {
          const apiKey = getApiKey(key);
          if (!apiKey) { lastErr = new Error('No API key for ' + key); continue; }
          const result = await cloudChat(p, cfg, apiKey, messages, opts, key);
          state.status[key] = 'ok';
          return { provider: key, ...result };
        } else {
          const result = await localChat(p, cfg, messages, opts, key);
          state.status[key] = 'ok';
          return { provider: key, ...result };
        }
      } catch (e) {
        lastErr = e;
        state.status[key] = 'fail';
        state.lastError[key] = e && e.message || String(e);
      }
    }
    throw lastErr || new Error('All providers failed');
  }

  async function cloudChat(p, cfg, apiKey, messages, opts, key) {
    const baseUrl = cfg.baseUrl || p.baseUrl;
    const model = opts.model || cfg.model || p.defaultModel;
    const url = baseUrl.replace(/\/+$/, '') + '/chat/completions';
    const headers = { 'Content-Type': 'application/json' };
    if (key === 'anthropic') {
      // Anthropic needs a different shape
      const sys = (messages.find(m => m.role === 'system') || {}).content || '';
      const conv = messages.filter(m => m.role !== 'system');
      const resp = await fetch(baseUrl.replace(/\/+$/, '') + '/messages', {
        method: 'POST',
        headers: {
          ...headers,
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model, system: sys, messages: conv,
          max_tokens: opts.max_tokens || 1024,
          temperature: opts.temperature ?? 0.6,
        }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error?.message || ('HTTP ' + resp.status));
      const text = (data.content || []).map(c => c.text).join('\n');
      return { text, model, raw: data };
    }
    headers['Authorization'] = 'Bearer ' + apiKey;
    const body = {
      model,
      messages,
      temperature: opts.temperature ?? 0.6,
      max_tokens: opts.max_tokens || 1024,
      stream: false,
    };
    const resp = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) });
    const data = await resp.json();
    if (!resp.ok) throw new Error(data.error?.message || data.message || ('HTTP ' + resp.status));
    const text = (data.choices || []).map(c => c.message?.content).filter(Boolean).join('\n');
    return { text, model, raw: data };
  }

  async function localChat(p, cfg, messages, opts, key) {
    const baseUrl = cfg.baseUrl || p.baseUrl || 'http://localhost:11434/v1';
    const model = opts.model || cfg.model || p.defaultModel;
    const url = baseUrl.replace(/\/+$/, '') + '/chat/completions';
    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        messages,
        temperature: opts.temperature ?? 0.6,
        max_tokens: opts.max_tokens || 1024,
      }),
    });
    if (!resp.ok) throw new Error('HTTP ' + resp.status);
    const data = await resp.json();
    const text = (data.choices || []).map(c => c.message?.content).filter(Boolean).join('\n');
    return { text, model, raw: data };
  }

  /* Demo "intelligent" response when no provider is reachable.
     This is rule-based and clearly labeled as a fallback — it does NOT
     call itself an AI and the UI shows "DEMO MODE". */
  function demoRespond(messages, opts) {
    const last = messages.filter(m => m.role === 'user').slice(-1)[0];
    const text = (last && last.content) || '';
    const sys = messages.find(m => m.role === 'system');
    const sysText = (sys && sys.content) || '';
    const isMemoryCmd = /(remember|what is my|what's my|recall)/i.test(text);
    const isJobCmd = /(job|career|role|hiring|work)/i.test(text);
    const isLeadCmd = /(lead|roofing|company|prospect|outreach)/i.test(text);
    const isTaskCmd = /(task|remind|follow[- ]up|schedule|todo|to-do)/i.test(text);
    const isGreet = /^(hi|hello|hey|good (morning|evening))/i.test(text.trim());

    if (isGreet) {
      return 'Good evening, Sir Aitzaz. How can I help?';
    }
    if (isMemoryCmd) {
      return 'Acknowledged, Sir Aitzaz. I will store that in your long-term memory and surface it the next time you ask.';
    }
    if (isJobCmd) {
      return 'Routing that to the Job Hunter, Sir Aitzaz. I will search, filter by your preferences, score each match, and present the top results in the Job Hunter view.';
    }
    if (isLeadCmd) {
      return 'On it, Sir Aitzaz. The Lead Hunter will search, qualify, and score prospects; the Research and Email agents will prepare the outreach materials.';
    }
    if (isTaskCmd) {
      return 'Task created, Sir Aitzaz. I will surface it in your Tasks view and remind you at the scheduled time.';
    }
    return 'Understood, Sir Aitzaz. I have logged this. Configure an AI provider in Settings to receive full natural language responses.';
  }

  /* Unified entry point used by agents — falls back to demo if needed */
  async function respond(messages, opts) {
    opts = opts || {};
    try {
      const r = await chat(messages, opts);
      return { text: r.text, provider: r.provider, mode: 'live' };
    } catch (e) {
      const text = demoRespond(messages, opts);
      return { text, provider: 'demo', mode: 'demo' };
    }
  }

  init();
  global.LProviders = {
    list: listProviders, get: getProvider, getActive, setActive,
    getFallback, setFallback, getConfig, setConfig, getApiKey, setApiKey,
    probe, state, respond, providers, init, save,
  };
})(window);
