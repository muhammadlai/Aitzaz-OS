/* Browser Agent */
(function (global) {
  'use strict';
  const agent = {
    id: 'browser',
    name: 'Browser Agent',
    icon: '🌐',
    role: 'Open, search, read pages (with bridge: click/fill)',
    color: '#7cf6ff',
    status: 'IDLE', currentTask: '', progress: 0, lastAction: '', lastResult: null,
  };
  function set(p) { Object.assign(agent, p); if (global.LApp) LApp.emit('agent-update', { id: agent.id, ...p }); }

  function extractUrl(text) {
    const m = (text || '').match(/https?:\/\/\S+/);
    if (m) return m[0];
    return null;
  }
  function extractQuery(text) {
    return (text || '').replace(/^(open|search|go to|navigate to)\s+/i, '').replace(/^https?:\/\/\S+\s*/i, '').replace(/^(in|on|with)\s+(chrome|browser|google)\b/i, '').trim();
  }

  async function run(action, input) {
    if (action === 'openOrSearch') {
      const text = input.text || '';
      const url = extractUrl(text);
      set({ status: 'WORKING', currentTask: 'browser: ' + text, progress: 30, lastAction: 'preparing' });
      let target = url;
      if (!target) {
        const q = extractQuery(text) || text;
        target = LBrowser.searchUrl(q);
      }
      const r = await LBrowser.open(target);
      if (r.requiresApproval) {
        set({ status: 'WAITING', lastAction: 'awaiting user approval', lastResult: r });
        if (global.LApp) LApp.emit('approval-required', { agent: 'browser', ...r });
        return r;
      }
      set({ status: 'COMPLETED', progress: 100, lastAction: 'opened ' + target, lastResult: r });
      if (global.LApp) LApp.emit('activity', { actor: 'Browser', verb: 'opened', target });
      return r;
    }
    set({ status: 'FAILED', lastAction: 'unknown action ' + action });
    return { ok: false };
  }

  global.L_BrowserAgent = { getAgent: () => agent, run, set };
})(window);
