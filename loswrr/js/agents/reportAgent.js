/* Report Agent */
(function (global) {
  'use strict';
  const agent = {
    id: 'report',
    name: 'Report Agent',
    icon: '📊',
    role: 'Summarize workflows, generate briefs',
    color: '#7cf6ff',
    status: 'IDLE', currentTask: '', progress: 0, lastAction: '', lastResult: null,
  };
  function set(p) { Object.assign(agent, p); if (global.LApp) LApp.emit('agent-update', { id: agent.id, ...p }); }

  async function run(action, input) {
    if (action === 'summary') {
      set({ status: 'WORKING', currentTask: 'building report', progress: 30, lastAction: 'compiling' });
      const jobs = LStorage.get('jobs', []);
      const leads = LStorage.get('leads', []);
      const tasks = LAutomation.listTasks();
      const drafts = LStorage.get('email-drafts', []);
      const summary = {
        ts: Date.now(),
        counts: { jobs: jobs.length, leads: leads.length, tasks: tasks.length, drafts: drafts.length },
        topJobs: jobs.slice(0, 3),
        topLeads: leads.slice(0, 3),
        openTasks: tasks.filter(t => t.status !== 'DONE').length,
      };
      const all = LStorage.get('reports', []);
      all.unshift(summary);
      LStorage.set('reports', all.slice(0, 30));
      set({ status: 'COMPLETED', progress: 100, lastAction: 'report ready', lastResult: summary });
      if (global.LApp) LApp.emit('activity', { actor: 'Report', verb: 'compiled', target: 'summary' });
      return { ok: true, summary };
    }
    set({ status: 'FAILED', lastAction: 'unknown action ' + action });
    return { ok: false };
  }

  global.L_ReportAgent = { getAgent: () => agent, run, set };
})(window);
