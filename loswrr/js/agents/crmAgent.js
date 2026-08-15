/* CRM Agent */
(function (global) {
  'use strict';
  const agent = {
    id: 'crm',
    name: 'CRM Agent',
    icon: '🗂',
    role: 'Persist leads/jobs, manage status, history',
    color: '#a06bff',
    status: 'IDLE', currentTask: '', progress: 0, lastAction: '', lastResult: null,
  };
  function set(p) { Object.assign(agent, p); if (global.LApp) LApp.emit('agent-update', { id: agent.id, ...p }); }

  function all() { return LStorage.get('leads', []); }
  function upsert(lead) {
    const arr = all();
    const i = arr.findIndex(x => x.id === lead.id);
    if (i >= 0) arr[i] = Object.assign({}, arr[i], lead, { updated: Date.now() });
    else arr.unshift(Object.assign({ created: Date.now() }, lead));
    LStorage.set('leads', arr);
    return arr[i >= 0 ? i : 0];
  }
  function remove(id) { LStorage.set('leads', all().filter(x => x.id !== id)); }
  function history(lead) { return LStorage.get('crm-history:' + lead.id, []); }
  function addHistory(leadId, entry) {
    const h = history({ id: leadId });
    h.unshift(Object.assign({ ts: Date.now() }, entry));
    LStorage.set('crm-history:' + leadId, h.slice(0, 100));
  }

  async function run(action, input) {
    if (action === 'persistLeads') {
      set({ status: 'WORKING', currentTask: 'saving leads to CRM', progress: 40, lastAction: 'persisting' });
      const leads = (input && input.leads) || [];
      let added = 0;
      for (const l of leads) {
        const existing = all().find(x => x.id === l.id);
        if (!existing) { upsert(l); added++; }
        else upsert(Object.assign({}, l, { id: existing.id }));
      }
      set({ status: 'COMPLETED', progress: 100, lastAction: 'saved ' + added, lastResult: { added } });
      if (global.LApp) LApp.emit('activity', { actor: 'CRM', verb: 'saved', target: added + ' leads' });
      return { ok: true, added };
    }
    if (action === 'persistJobs') {
      set({ status: 'WORKING', currentTask: 'saving jobs to CRM', progress: 40, lastAction: 'persisting' });
      const jobs = (input && input.jobs) || [];
      const existing = LStorage.get('jobs', []);
      let added = 0;
      for (const j of jobs) {
        if (!existing.find(x => x.id === j.id)) { existing.unshift(Object.assign({ savedAt: Date.now() }, j)); added++; }
      }
      LStorage.set('jobs', existing);
      set({ status: 'COMPLETED', progress: 100, lastAction: 'saved ' + added, lastResult: { added } });
      return { ok: true, added };
    }
    set({ status: 'FAILED', lastAction: 'unknown action ' + action });
    return { ok: false };
  }

  global.L_CrmAgent = { getAgent: () => agent, run, set, all, upsert, remove, history, addHistory };
})(window);
