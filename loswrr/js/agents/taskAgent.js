/* Task Agent */
(function (global) {
  'use strict';
  const agent = {
    id: 'task',
    name: 'Task Agent',
    icon: '✅',
    role: 'Natural-language tasks, follow-ups, scheduling',
    color: '#6bff9b',
    status: 'IDLE', currentTask: '', progress: 0, lastAction: '', lastResult: null,
  };
  function set(p) { Object.assign(agent, p); if (global.LApp) LApp.emit('agent-update', { id: agent.id, ...p }); }

  async function run(action, input) {
    if (action === 'createFromText') {
      set({ status: 'WORKING', currentTask: 'task: ' + (input.text || ''), progress: 30, lastAction: 'parsing' });
      const parsed = LAutomation.parseDateTime(input.text || '');
      const t = LAutomation.create({
        title: parsed.title, date: parsed.date, time: parsed.time, status: 'TODO', priority: 'normal',
      });
      set({ status: 'COMPLETED', progress: 100, lastAction: 'task created', lastResult: { task: t } });
      if (global.LApp) LApp.emit('activity', { actor: 'Tasks', verb: 'created', target: t.title });
      return { ok: true, task: t };
    }
    if (action === 'followUp') {
      set({ status: 'WORKING', currentTask: 'creating follow-up', progress: 30, lastAction: 'creating' });
      const t = LAutomation.create({
        title: 'Follow up on saved job applications', date: new Date(Date.now() + 86400000).toISOString().slice(0, 10),
        time: '10:00', status: 'TODO', priority: 'high',
      });
      set({ status: 'COMPLETED', progress: 100, lastAction: 'follow-up created', lastResult: { task: t } });
      return { ok: true, task: t };
    }
    if (action === 'createAutomation') {
      set({ status: 'WORKING', currentTask: 'creating automation', progress: 30, lastAction: 'creating' });
      // crude parsing: "every 6 hours" / "every morning" / "every monday"
      const t = (input.text || '').toLowerCase();
      let trigger = { kind: 'cron', expr: '0 9 * * *' };
      if (/every\s+(\d+)\s+hour/.test(t)) {
        const h = parseInt(RegExp.$1, 10);
        trigger = { kind: 'interval', ms: h * 3600000 };
      } else if (/every\s+morning/.test(t)) trigger = { kind: 'cron', expr: '0 8 * * *' };
      else if (/every\s+evening/.test(t)) trigger = { kind: 'cron', expr: '0 19 * * *' };
      else if (/every\s+monday/.test(t)) trigger = { kind: 'cron', expr: '0 9 * * 1' };
      const wf = /lead/.test(t) ? 'lead_hunt' : /job/.test(t) ? 'job_hunt' : 'daily_brief';
      const a = LAutomation.createAutomation({
        name: (input.text || '').slice(0, 60),
        trigger, action: { kind: 'workflow', workflow: wf },
      });
      set({ status: 'COMPLETED', progress: 100, lastAction: 'automation scheduled', lastResult: a });
      if (global.LApp) LApp.emit('activity', { actor: 'Automation', verb: 'scheduled', target: a.name });
      return { ok: true, automation: a };
    }
    set({ status: 'FAILED', lastAction: 'unknown action ' + action });
    return { ok: false };
  }

  global.L_TaskAgent = { getAgent: () => agent, run, set };
})(window);
