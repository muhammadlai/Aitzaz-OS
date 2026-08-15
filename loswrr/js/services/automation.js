/* ==========================================================================
   LOSWRR Automation Service
   Natural-language task creation, automations list, builder.
   ========================================================================== */
(function (global) {
  'use strict';

  function listTasks() { return LStorage.get('tasks', []); }
  function saveTasks(t) { LStorage.set('tasks', t); }

  function create(spec) {
    const t = {
      id: 'task_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
      title: spec.title || 'Untitled task',
      priority: spec.priority || 'normal',
      date: spec.date || null,
      time: spec.time || null,
      status: spec.status || 'TODO',
      relatedJob: spec.relatedJob || null,
      relatedLead: spec.relatedLead || null,
      notes: spec.notes || '',
      created: Date.now(),
    };
    const all = listTasks();
    all.unshift(t);
    saveTasks(all);
    return t;
  }
  function update(id, patch) {
    const all = listTasks();
    const t = all.find(x => x.id === id);
    if (!t) return null;
    Object.assign(t, patch);
    saveTasks(all);
    return t;
  }
  function remove(id) {
    saveTasks(listTasks().filter(t => t.id !== id));
  }

  /* Parse natural language like "tomorrow at 10 AM" or "next monday" */
  function parseDateTime(text) {
    const raw = String(text || '').trim();
    const t = raw.toLowerCase();
    const now = new Date();
    const out = { date: null, time: null, title: raw };
    const dayOffset = (n) => { const d = new Date(now); d.setDate(d.getDate() + n); d.setHours(9, 0, 0, 0); return d; };
    if (/today/.test(t)) out.date = dayOffset(0);
    else if (/tomorrow/.test(t)) out.date = dayOffset(1);
    else if (/next week/.test(t)) out.date = dayOffset(7);
    else {
      const wd = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
      for (let i = 0; i < wd.length; i++) {
        if (t.includes(wd[i])) { out.date = dayOffset(((i - now.getDay() + 7) % 7) || 7); break; }
      }
    }
    const tm = t.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/);
    if (tm) {
      let h = parseInt(tm[1], 10);
      const m = parseInt(tm[2] || '0', 10);
      const ap = (tm[3] || '').toLowerCase();
      if (ap === 'pm' && h < 12) h += 12;
      if (ap === 'am' && h === 12) h = 0;
      if (h < 24 && out.date) { out.date.setHours(h, m, 0, 0); out.time = String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0'); }
    }
    if (out.date) out.date = out.date.toISOString().slice(0, 10);
    // Clean title — strip the meta-prefixes and date/time tokens
    let title = raw
      .replace(/^(please\s+)?(remind me|remind)\s+(me\s+)?to\s+/i, '')
      .replace(/^(remind me|remind)\s+/i, '')
      // Multi-word patterns first
      .replace(/^create (a\s+)?follow[- ]?up task\b/i, 'follow up')
      .replace(/^add (a\s+)?follow[- ]?up task\b/i, 'follow up')
      .replace(/^create (a\s+)?new task\b/i, 'new task')
      // Single-word task verbs
      .replace(/^(please\s+)?create (a\s+)?(task|reminder|to-?do|new task)\s+(for|to|about|on)\s+/i, '')
      .replace(/^(please\s+)?add (a\s+)?(task|reminder|to-?do|new task)\s+(for|to|about|on)\s+/i, '')
      .replace(/^(please\s+)?schedule (a\s+)?(task|reminder|meeting|follow[- ]?up)\s+(for|to|about|on)\s+/i, '')
      .replace(/^(please\s+)?set (a\s+)?(reminder|task)\s+(for|to|about|on)\s+/i, '')
      .replace(/^create (a\s+)?(task|reminder|to-?do|new task)\s+/i, '')
      .replace(/^add (a\s+)?(task|reminder|to-?do|new task)\s+/i, '')
      .replace(/^schedule (a\s+)?(task|reminder|to-?do|new task)\s+/i, '')
      .replace(/^set (a\s+)?(reminder|task)\s+/i, '')
      .replace(/^(for|to|about|on)\s+/i, '') // strip leading preposition after meta-stripping
      .replace(/\s+(for|on|at)\s+(today|tomorrow|next week|next monday|next tuesday|next wednesday|next thursday|next friday)/gi, '')
      .replace(/\s+(at|by)\s+\d{1,2}(:\d{2})?\s*(am|pm)?/gi, '')
      .replace(/\s+(for|on|at)\s+(today|tomorrow|next week)/gi, '')
      .replace(/\btoday\b|\btomorrow\b|\bnext week\b/gi, '')
      .replace(/^to\s+/i, '')
      .replace(/\s{2,}/g, ' ')
      .trim();
    if (!title) title = raw;
    out.title = title;
    return out;
  }

  /* Automation list (extends scheduler) */
  function listAutomations() { return LScheduler.all(); }
  function createAutomation(spec) { return LScheduler.add(spec); }
  function removeAutomation(id) { return LScheduler.remove(id); }
  function toggleAutomation(id, on) {
    const a = LScheduler.get(id);
    if (!a) return null;
    return LScheduler.update(id, { status: on ? 'SCHEDULED' : 'DISABLED' });
  }

  global.LAutomation = {
    listTasks, create, update, remove,
    parseDateTime,
    listAutomations, createAutomation, removeAutomation, toggleAutomation,
  };
})(window);
