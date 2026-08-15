/* Coding Agent */
(function (global) {
  'use strict';
  const agent = {
    id: 'coding',
    name: 'Coding Agent',
    icon: '⌨️',
    role: 'Read code, explain errors, generate patches',
    color: '#6bff9b',
    status: 'IDLE', currentTask: '', progress: 0, lastAction: '', lastResult: null,
  };
  function set(p) { Object.assign(agent, p); if (global.LApp) LApp.emit('agent-update', { id: agent.id, ...p }); }

  async function run(action, input) {
    if (action === 'assist') {
      set({ status: 'WORKING', currentTask: 'coding: ' + (input.text || ''), progress: 30, lastAction: 'analyzing' });
      try {
        const r = await LProviders.respond([
          { role: 'system', content: 'You are LOSWRR Coding Agent. Provide clear, runnable code, explain the change, and flag any risk. Prefer diff-style when editing existing code.' },
          { role: 'user', content: input.text || '' },
        ], { temperature: 0.3, max_tokens: 1200 });
        const out = { id: 'code_' + Date.now(), text: r.text, provider: r.provider, created: Date.now() };
        const all = LStorage.get('code-assists', []);
        all.unshift(out);
        LStorage.set('code-assists', all);
        set({ status: 'COMPLETED', progress: 100, lastAction: 'assistance ready', lastResult: out });
        return { ok: true, ...out };
      } catch (e) {
        set({ status: 'FAILED', lastAction: 'error', lastResult: { error: e.message } });
        return { ok: false, error: e.message };
      }
    }
    set({ status: 'FAILED', lastAction: 'unknown action ' + action });
    return { ok: false };
  }

  global.L_CodingAgent = { getAgent: () => agent, run, set };
})(window);
