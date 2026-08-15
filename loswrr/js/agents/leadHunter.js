/* Lead Hunter Agent */
(function (global) {
  'use strict';
  const agent = {
    id: 'leadHunter',
    name: 'Lead Hunter',
    icon: '🎯',
    role: 'Search, qualify, score business leads',
    color: '#ff5cb3',
    status: 'IDLE', currentTask: '', progress: 0, lastAction: '', lastResult: null,
  };
  function set(p) { Object.assign(agent, p); if (global.LApp) LApp.emit('agent-update', { id: agent.id, ...p }); }

  function all() { return LStorage.get('leads', []); }
  function save(leads) { LStorage.set('leads', leads); }

  function score(lead) {
    let s = 50;
    if (lead.website) s += 5;
    if (lead.email) s += 8;
    if (lead.phone) s += 5;
    if (/owner|ceo|president|founder|gm/.test((lead.title || '').toLowerCase())) s += 15;
    if (/roofing|hvac|plumbing/.test((lead.industry || '').toLowerCase())) s += 7;
    return Math.max(0, Math.min(100, s));
  }

  async function run(action, input) {
    if (action === 'search') {
      set({ status: 'WORKING', currentTask: 'hunting leads: ' + (input.industry || '') + ' ' + (input.state || ''), progress: 30, lastAction: 'searching' });
      if (global.LApp) LApp.emit('activity', { actor: 'Lead Hunter', verb: 'searching', target: (input.industry || '') + ' ' + (input.state || '') });
      // Simulated results: filter demo data by industry / state (state filter on Texas default)
      const industry = (input.industry || 'Roofing').toLowerCase();
      const state = (input.state || 'Texas').toLowerCase();
      let pool = LDemo.leads.filter(l =>
        (l.industry || '').toLowerCase().includes(industry)
      );
      if (!pool.length) pool = LDemo.leads; // fall back to all demo leads
      const m = (input.query || '').match(/(\d+)/);
      const limit = m ? parseInt(m[1], 10) : 10;
      const leads = pool.slice(0, limit).map(l => Object.assign({}, l, { leadScore: score(l), location: l.location || (state.replace(/\b\w/g, c => c.toUpperCase())) }));
      set({ status: 'COMPLETED', progress: 100, lastAction: 'found ' + leads.length + ' leads', lastResult: { leads } });
      if (global.LApp) LApp.emit('activity', { actor: 'Lead Hunter', verb: 'found', target: leads.length + ' leads' });
      return { ok: true, leads, mode: 'demo' };
    }
    set({ status: 'FAILED', lastAction: 'unknown action ' + action });
    return { ok: false };
  }

  global.L_LeadHunterAgent = { getAgent: () => agent, run, set, all, save };
})(window);
