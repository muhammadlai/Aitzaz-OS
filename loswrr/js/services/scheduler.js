/* ==========================================================================
   LOSWRR Scheduler
   In-page cron-like scheduler for automations. Survives reloads via storage.
   NOTE: For true background execution on a closed tab, a backend worker
   (PWA service worker) is required; this runs while the app is open.
   ========================================================================== */
(function (global) {
  'use strict';

  const tasks = new Map(); // id -> { id, name, trigger, action, lastRun, nextRun, status }
  let timer = null;

  function load() {
    const all = LStorage.get('schedules', []);
    for (const t of all) tasks.set(t.id, t);
    if (!tasks.size) seedDefaults();
    tick();
  }
  function save() {
    LStorage.set('schedules', Array.from(tasks.values()));
  }
  function seedDefaults() {
    add({
      name: 'Daily standup brief',
      trigger: { kind: 'cron', expr: '0 9 * * *' },
      action: { kind: 'workflow', workflow: 'daily_brief' },
    });
  }

  function add(spec) {
    const t = {
      id: 'sch_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
      name: spec.name || 'Untitled',
      trigger: spec.trigger || { kind: 'interval', ms: 60000 },
      action: spec.action || { kind: 'noop' },
      lastRun: null,
      nextRun: computeNextRun(spec.trigger),
      status: 'SCHEDULED',
      created: Date.now(),
    };
    tasks.set(t.id, t);
    save();
    return t;
  }
  function update(id, patch) {
    const t = tasks.get(id);
    if (!t) return null;
    Object.assign(t, patch);
    if (patch.trigger) t.nextRun = computeNextRun(t.trigger);
    save();
    return t;
  }
  function remove(id) { tasks.delete(id); save(); }
  function all() { return Array.from(tasks.values()); }
  function get(id) { return tasks.get(id); }

  function computeNextRun(trigger) {
    if (!trigger) return null;
    if (trigger.kind === 'interval') return Date.now() + (trigger.ms || 60000);
    if (trigger.kind === 'once') return trigger.at || Date.now();
    if (trigger.kind === 'cron') return nextCron(trigger.expr);
    return null;
  }
  function nextCron(expr) {
    // Very small cron parser: supports "m h dom mon dow" and "* * * * *"
    // Returns next matching minute in the future (rounded to minute)
    const parts = (expr || '* * * * *').trim().split(/\s+/);
    if (parts.length !== 5) return Date.now() + 60000;
    const [m, h, dom, mon, dow] = parts;
    const now = new Date();
    const next = new Date(now);
    next.setSeconds(0, 0);
    next.setMinutes((now.getMinutes() + 1));
    for (let i = 0; i < 60 * 24 * 7; i++) {
      if (matches(next, m, h, dom, mon, dow)) return next.getTime();
      next.setMinutes(next.getMinutes() + 1);
    }
    return Date.now() + 60000;
  }
  function matches(d, m, h, dom, mon, dow) {
    return matchField(d.getMinutes(), m)
      && matchField(d.getHours(), h)
      && matchField(d.getDate(), dom)
      && matchField(d.getMonth() + 1, mon)
      && matchField(d.getDay(), dow);
  }
  function matchField(val, spec) {
    if (spec === '*' || spec == null) return true;
    if (spec.includes(',')) return spec.split(',').some(s => matchField(val, s.trim()));
    if (spec.includes('/')) {
      const [base, step] = spec.split('/');
      const start = base === '*' ? 0 : parseInt(base, 10);
      return ((val - start) % parseInt(step, 10)) === 0;
    }
    if (spec.includes('-')) {
      const [a, b] = spec.split('-').map(n => parseInt(n, 10));
      return val >= a && val <= b;
    }
    return parseInt(spec, 10) === val;
  }

  function tick() {
    if (timer) clearTimeout(timer);
    const now = Date.now();
    for (const t of tasks.values()) {
      if (t.status === 'DISABLED') continue;
      if (t.nextRun && now >= t.nextRun) {
        runTask(t).catch(e => console.warn('[sched] task error', e));
      }
    }
    timer = setTimeout(tick, 15000);
  }

  async function runTask(t) {
    t.lastRun = Date.now();
    t.status = 'RUNNING';
    if (global.LApp) LApp.emit('activity', { actor: 'Scheduler', verb: 'running', target: t.name });
    try {
      const orch = global.LOrchestrator;
      if (t.action.kind === 'workflow' && orch) {
        await orch.runWorkflow(t.action.workflow, { source: 'scheduler' });
      } else if (t.action.kind === 'command' && global.LApp) {
        await LApp.handleCommand(t.action.text, { source: 'scheduler' });
      } else if (t.action.kind === 'webhook' && t.action.url) {
        await fetch(t.action.url, { method: 'POST', body: JSON.stringify(t.action.payload || {}), headers: { 'Content-Type': 'application/json' } });
      }
      t.status = 'OK';
    } catch (e) {
      t.status = 'FAILED';
      t.lastError = e && e.message || String(e);
    }
    t.nextRun = computeNextRun(t.trigger);
    save();
  }

  load();
  global.LScheduler = { add, update, remove, all, get, runTask };
})(window);
