/* Sales Agent */
(function (global) {
  'use strict';
  const agent = {
    id: 'sales',
    name: 'Sales Agent',
    icon: '📈',
    role: 'Lead scoring, prioritization, pipeline',
    color: '#6bff9b',
    status: 'IDLE', currentTask: '', progress: 0, lastAction: '', lastResult: null,
  };
  function set(p) { Object.assign(agent, p); if (global.LApp) LApp.emit('agent-update', { id: agent.id, ...p }); }

  async function run(action, input) {
    if (action === 'score') {
      set({ status: 'WORKING', currentTask: 'scoring leads', progress: 50, lastAction: 'scoring' });
      const leads = LStorage.get('leads', []);
      const scored = leads.map(l => Object.assign({}, l, { leadScore: l.leadScore || 70 }));
      scored.sort((a, b) => b.leadScore - a.leadScore);
      LStorage.set('leads', scored);
      set({ status: 'COMPLETED', progress: 100, lastAction: 'scored ' + scored.length, lastResult: { count: scored.length } });
      return { ok: true, count: scored.length };
    }
    set({ status: 'FAILED', lastAction: 'unknown action ' + action });
    return { ok: false };
  }

  global.L_SalesAgent = { getAgent: () => agent, run, set };
})(window);
