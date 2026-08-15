/* Job Hunter Agent */
(function (global) {
  'use strict';
  const agent = {
    id: 'jobHunter',
    name: 'Job Hunter',
    icon: '💼',
    role: 'Search, filter, score, save jobs',
    color: '#a06bff',
    status: 'IDLE', currentTask: '', progress: 0, lastAction: '', lastResult: null,
  };
  function set(p) { Object.assign(agent, p); if (global.LApp) LApp.emit('agent-update', { id: agent.id, ...p }); }

  function all() { return LStorage.get('jobs', []); }
  function save(jobs) { LStorage.set('jobs', jobs); }

  function scoreJob(job, filters) {
    let s = 50;
    if (filters.minSalary && job.salary) {
      const m = (job.salary.match(/\$([\d,]+)/) || [])[1];
      if (m) {
        const n = parseInt(m.replace(/,/g, ''), 10);
        if (n >= filters.minSalary) s += 30;
        else s -= 20;
      }
    }
    if (filters.remote && /remote/i.test(job.location)) s += 10;
    if (filters.keywords) {
      for (const k of filters.keywords) if (job.position.toLowerCase().includes(k) || (job.skills || []).map(x => x.toLowerCase()).includes(k)) s += 5;
    }
    return Math.max(0, Math.min(100, s));
  }

  async function run(action, input) {
    if (action === 'search') {
      set({ status: 'WORKING', currentTask: 'hunting jobs: ' + (input.query || ''), progress: 20, lastAction: 'searching' });
      if (global.LApp) LApp.emit('activity', { actor: 'Job Hunter', verb: 'searching', target: input.query || '' });
      // Simulated remote search: returns demo data with scoring against filters
      const filters = input.filters || {};
      const results = LDemo.jobs.map(j => {
        const score = scoreJob(j, filters);
        return Object.assign({}, j, { matchScore: score });
      });
      const filtered = results.filter(j => {
        if (filters.minSalary) {
          const m = (j.salary.match(/\$([\d,]+)/) || [])[1];
          if (!m) return true; // keep unknowns
          const n = parseInt(m.replace(/,/g, ''), 10);
          if (n < filters.minSalary) return false;
        }
        if (filters.remote && !/remote/i.test(j.location)) return false;
        if (filters.type && j.type !== filters.type) return false;
        if (filters.keywords) {
          const has = filters.keywords.some(k => (j.position + ' ' + (j.skills || []).join(' ')).toLowerCase().includes(k));
          if (!has) return false;
        }
        return true;
      });
      filtered.sort((a, b) => b.matchScore - a.matchScore);
      set({ status: 'COMPLETED', progress: 100, lastAction: 'found ' + filtered.length + ' jobs', lastResult: { jobs: filtered } });
      if (global.LApp) LApp.emit('activity', { actor: 'Job Hunter', verb: 'found', target: filtered.length + ' jobs' });
      return { ok: true, jobs: filtered, mode: 'demo' };
    }
    if (action === 'saveTop') {
      set({ status: 'WORKING', currentTask: 'saving top jobs', progress: 30, lastAction: 'saving' });
      const existing = all();
      const m = (input.query || '').match(/(\d+)/);
      const n = m ? parseInt(m[1], 10) : 5;
      const top = LDemo.jobs.slice(0, n);
      for (const j of top) {
        if (!existing.find(x => x.id === j.id)) existing.push(Object.assign({ savedAt: Date.now() }, j));
      }
      save(existing);
      set({ status: 'COMPLETED', progress: 100, lastAction: 'saved ' + top.length + ' jobs', lastResult: { saved: top } });
      if (global.LApp) LApp.emit('activity', { actor: 'Job Hunter', verb: 'saved', target: top.length + ' jobs' });
      return { ok: true, saved: top };
    }
    if (action === 'coverLetter') {
      set({ status: 'WORKING', currentTask: 'drafting cover letter', progress: 30, lastAction: 'drafting' });
      const job = all()[0] || LDemo.jobs[0];
      const r = await LProviders.respond([
        { role: 'system', content: 'You are LOSWRR Cover Letter agent. Write a tight, 200-word cover letter tailored to the role, mentioning 2-3 role skills.' },
        { role: 'user', content: 'Company: ' + job.company + '\nPosition: ' + job.position + '\nSkills: ' + (job.skills || []).join(', ') + '\n' },
      ], { temperature: 0.6, max_tokens: 350 });
      const draft = { id: 'cl_' + Date.now(), jobId: job.id, body: r.text, created: Date.now() };
      const drafts = LStorage.get('cover-letters', []);
      drafts.unshift(draft);
      LStorage.set('cover-letters', drafts);
      set({ status: 'COMPLETED', progress: 100, lastAction: 'cover letter ready', lastResult: draft });
      if (global.LApp) LApp.emit('activity', { actor: 'Job Hunter', verb: 'drafted', target: 'cover letter' });
      return { ok: true, draft };
    }
    set({ status: 'FAILED', lastAction: 'unknown action ' + action });
    return { ok: false };
  }

  global.L_JobHunterAgent = { getAgent: () => agent, run, set, all, save };
})(window);
