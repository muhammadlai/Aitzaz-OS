/* Email Agent */
(function (global) {
  'use strict';
  const agent = {
    id: 'email',
    name: 'Email Agent',
    icon: '✉️',
    role: 'Draft, organize, send (with approval)',
    color: '#ff5cb3',
    status: 'IDLE', currentTask: '', progress: 0, lastAction: '', lastResult: null,
  };
  function set(p) { Object.assign(agent, p); if (global.LApp) LApp.emit('agent-update', { id: agent.id, ...p }); }

  async function run(action, input) {
    if (action === 'draftOutreach') {
      set({ status: 'WORKING', currentTask: 'drafting outreach', progress: 30, lastAction: 'drafting' });
      const leads = (input && input.leads) || LStorage.get('leads', []);
      const drafts = [];
      for (const l of leads.slice(0, 3)) {
        const text = await LEmail.draft({
          to: l.email, company: l.company, title: l.title, owner: l.owner,
          context: 'Cold outreach for roofing/contractor lead generation services',
          goal: 'book a 15-min discovery call',
        });
        drafts.push({ id: 'dr_' + Date.now() + '_' + l.id, leadId: l.id, to: l.email, subject: 'Quick idea for ' + l.company, body: text, created: Date.now() });
      }
      const all = LStorage.get('email-drafts', []);
      for (const d of drafts) all.unshift(d);
      LStorage.set('email-drafts', all);
      set({ status: 'COMPLETED', progress: 100, lastAction: 'drafted ' + drafts.length, lastResult: { drafts } });
      if (global.LApp) LApp.emit('activity', { actor: 'Email', verb: 'drafted', target: drafts.length + ' outreach emails' });
      return { ok: true, drafts };
    }
    if (action === 'draft') {
      set({ status: 'WORKING', currentTask: 'drafting email', progress: 30, lastAction: 'drafting' });
      const text = await LEmail.draft({ context: input.text, goal: 'clear, single ask' });
      const d = { id: 'dr_' + Date.now(), body: text, created: Date.now() };
      const all = LStorage.get('email-drafts', []);
      all.unshift(d);
      LStorage.set('email-drafts', all);
      set({ status: 'COMPLETED', progress: 100, lastAction: 'draft ready', lastResult: { draft: d } });
      return { ok: true, draft: d };
    }
    set({ status: 'FAILED', lastAction: 'unknown action ' + action });
    return { ok: false };
  }

  global.L_EmailAgent = { getAgent: () => agent, run, set };
})(window);
