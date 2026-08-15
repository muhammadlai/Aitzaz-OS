/* Research Agent */
(function (global) {
  'use strict';
  const agent = {
    id: 'research',
    name: 'Research Agent',
    icon: '🔍',
    role: 'Search, extract, verify, summarize',
    color: '#7cf6ff',
    status: 'IDLE', currentTask: '', progress: 0, lastAction: '', lastResult: null,
  };
  function set(p) { Object.assign(agent, p); if (global.LApp) LApp.emit('agent-update', { id: agent.id, ...p }); }

  async function run(action, input) {
    if (action === 'research') {
      set({ status: 'WORKING', currentTask: 'researching: ' + input.query, progress: 30, lastAction: 'searching' });
      if (global.LApp) LApp.emit('activity', { actor: 'Research', verb: 'searching', target: input.query });
      const r = await LResearch.research(input.query, { limit: 6 });
      set({ status: 'COMPLETED', progress: 100, lastAction: 'research complete', lastResult: r });
      return r;
    }
    if (action === 'enrich') {
      set({ status: 'WORKING', currentTask: 'enriching jobs', progress: 50, lastAction: 'enriching' });
      // Stub — could fetch company info for each job
      set({ status: 'COMPLETED', progress: 100, lastAction: 'enrichment skipped' });
      return { ok: true };
    }
    if (action === 'enrichLeads') {
      set({ status: 'WORKING', currentTask: 'enriching leads', progress: 50, lastAction: 'enriching' });
      set({ status: 'COMPLETED', progress: 100, lastAction: 'enrichment skipped' });
      return { ok: true };
    }
    set({ status: 'FAILED', lastAction: 'unknown action ' + action });
    return { ok: false, reason: 'unknown action' };
  }

  global.L_ResearchAgent = { getAgent: () => agent, run, set };
})(window);
