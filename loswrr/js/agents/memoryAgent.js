/* Memory Agent */
(function (global) {
  'use strict';
  const agent = {
    id: 'memory',
    name: 'Memory Agent',
    icon: '🧠',
    role: 'Remember, recall, search long-term memory',
    color: '#7cf6ff',
    status: 'IDLE', currentTask: '', progress: 0, lastAction: '', lastResult: null,
  };
  function set(p) { Object.assign(agent, p); if (global.LApp) LApp.emit('agent-update', { id: agent.id, ...p }); }

  async function run(action, input) {
    if (action === 'processUtterance') {
      set({ status: 'WORKING', currentTask: 'memory: ' + (input.text || ''), progress: 30, lastAction: 'processing' });
      const r = await LMemory.processUtterance(input.text || '');
      set({ status: 'COMPLETED', progress: 100, lastAction: 'memory ' + r.action, lastResult: r });
      if (global.LApp) LApp.emit('activity', { actor: 'Memory', verb: r.action, target: (r.item && r.item.text) || '' });
      return r;
    }
    set({ status: 'FAILED', lastAction: 'unknown action ' + action });
    return { ok: false };
  }

  global.L_MemoryAgent = { getAgent: () => agent, run, set };
})(window);
