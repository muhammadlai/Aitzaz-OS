/* ==========================================================================
   LOSWRR CEO Orchestrator Agent
   Receives a single command from Aitzaz and decides which specialist
   agents to invoke, in what order, with what inputs.
   This is the heart of the multi-agent system.
   ========================================================================== */
(function (global) {
  'use strict';

  const agent = {
    id: 'ceo',
    name: 'CEO / Orchestrator',
    icon: '👑',
    role: 'Decides which agents to call and in what order',
    color: '#7cf6ff',
    status: 'IDLE',
    currentTask: '',
    progress: 0,
    lastAction: '',
    lastResult: null,
  };

  function reset() {
    agent.status = 'IDLE'; agent.currentTask = ''; agent.progress = 0;
    agent.lastAction = ''; agent.lastResult = null;
  }

  function set(patch) {
    Object.assign(agent, patch);
    if (global.LApp) LApp.emit('agent-update', { id: agent.id, ...patch });
  }

  /* Intent classification — picks a workflow */
  function classifyIntent(text) {
    const t = (text || '').toLowerCase().trim();
    if (!t) return 'chat';
    // Greeting first — short, social
    if (/^(hi|hello|hey|good (morning|evening|afternoon))\b/.test(t)) return 'greet';
    // Memory ops are explicit
    if (/^(remember\b|please remember\b|what('?s| is) my\b|^recall\b|^do you remember\b|^forget\b)/.test(t)) return 'memory';
    // Task creation — explicit markers
    if (/\bremind me\b|\bcreate (a )?(task|reminder|to-?do)\b|\badd (a )?task\b|\bnew task\b|\bfollow[- ]?up\b/.test(t)) return 'task';
    // Browser — opening URLs / searching
    if (/\bopen\b.*\b(chrome|browser|google|site|url|youtube|gmail|github|reddit)\b/.test(t)) return 'browser';
    if (/\bgo to\b.*(http|\.com|\.io|\.org|\.net)\b/.test(t)) return 'browser';
    if (/^(open|visit|navigate to)\b/.test(t)) return 'browser';
    if (/\bsearch (the web|google|on google|online)\b/.test(t)) return 'browser';
    // Computer
    if (/\b(run|execute)\b.*\bcommand\b|\bterminal\b|\bshell\b/.test(t)) return 'computer';
    // Coding
    if (/\b(code|debug|fix|patch|refactor|build|compile|test)\b/.test(t) && !/\broofing\b|\blead\b/.test(t)) return 'coding';
    // Files
    if (/\b(file|upload|read|analyze)\b.*\.(pdf|docx|csv|txt|json)/.test(t)) return 'files';
    // Automation
    if (/\b(schedule|automation|recurring|cron|every (morning|evening|hour|day|monday|tuesday|wednesday|thursday|friday|saturday|sunday))\b/.test(t)) return 'automation';
    // Save jobs explicitly
    if (/\b(save|track|shortlist)\b.*\b(job|jobs|best|top|results|them|these|five|3|5|10)\b/.test(t)) return 'job_save';
    if (/\bsave the best\b/.test(t)) return 'job_save';
    if (/^save\b.*\b(five|5|ten|10|three|3)\b/.test(t)) return 'job_save';
    // Cover letter
    if (/\b(cover letter|application message|application letter)\b/.test(t)) return 'cover_letter';
    // Email draft
    if (/\bemail\b/.test(t) && /(draft|write|compose|prepare|send)/.test(t)) return 'email_draft';
    // Research (must NOT also have lead/job find)
    if (/\bresearch\b|\binvestigate\b|\bfind out\b|\blook up\b|\bsummarize\b/.test(t)) return 'research';
    // Job hunt — needs job/career keywords AND a verb
    if (/\b(job|jobs|career|remote work|hiring|interview|salary|position|opening|vacancy)\b/.test(t)
        && /(find|search|hunt|looking|get|show|list|need|want)/.test(t)) return 'job_hunt';
    // Lead hunt — needs lead/prospect + verb
    if (/\b(lead|leads|prospect|prospects|roofing company|roofing companies|hvac company|plumbing company|outreach|home services)\b/.test(t)
        && /(find|search|hunt|get|show|list|generate)/.test(t)) return 'lead_hunt';
    // Shorter lead patterns
    if (/\b(find|generate)\b.*\b(lead|leads|prospect|prospects|roofing companies|contractors)\b/.test(t)) return 'lead_hunt';
    if (/\b(find|generate)\b.*\b\d+\s+(roofing|hvac|plumbing|solar|pest control|companies|leads)\b/.test(t)) return 'lead_hunt';
    // Task (default fallback for "create/schedule X")
    if (/\b(create|schedule|add|set)\b.*\b(reminder|task|to-?do|followup|follow up|meeting)\b/.test(t)) return 'task';
    return 'chat';
  }

  function plan(intent, text) {
    switch (intent) {
      case 'greet':
        return [
          { agent: 'ceo', action: 'greet' },
        ];
      case 'job_hunt':
        return [
          { agent: 'jobHunter', action: 'search', input: { query: text, filters: extractJobFilters(text) } },
          { agent: 'researchAgent', action: 'enrich' },
          { agent: 'crmAgent', action: 'persistJobs' },
          { agent: 'reportAgent', action: 'summary' },
        ];
      case 'job_save':
        return [
          { agent: 'jobHunter', action: 'saveTop', input: { query: text } },
          { agent: 'taskAgent', action: 'followUp' },
        ];
      case 'lead_hunt':
        return [
          { agent: 'leadHunter', action: 'search', input: { query: text, industry: extractIndustry(text), state: extractState(text) } },
          { agent: 'researchAgent', action: 'enrichLeads' },
          { agent: 'salesAgent', action: 'score' },
          { agent: 'crmAgent', action: 'persistLeads' },
          { agent: 'emailAgent', action: 'draftOutreach', input: { leads: '__PREV_LEADS__' } },
          { agent: 'reportAgent', action: 'summary' },
        ];
      case 'memory':
        return [
          { agent: 'memoryAgent', action: 'processUtterance', input: { text } },
        ];
      case 'task':
        return [
          { agent: 'taskAgent', action: 'createFromText', input: { text } },
        ];
      case 'email_draft':
        return [
          { agent: 'emailAgent', action: 'draft', input: { text } },
        ];
      case 'browser':
        return [
          { agent: 'browserAgent', action: 'openOrSearch', input: { text } },
        ];
      case 'research':
        return [
          { agent: 'researchAgent', action: 'research', input: { query: text } },
          { agent: 'reportAgent', action: 'summary' },
        ];
      case 'computer':
        return [
          { agent: 'computerAgent', action: 'runCommand', input: { text } },
        ];
      case 'coding':
        return [
          { agent: 'codingAgent', action: 'assist', input: { text } },
        ];
      case 'files':
        return [
          { agent: 'fileAgent', action: 'handle', input: { text } },
        ];
      case 'automation':
        return [
          { agent: 'taskAgent', action: 'createAutomation', input: { text } },
        ];
      case 'cover_letter':
        return [
          { agent: 'jobHunter', action: 'coverLetter', input: { text } },
        ];
      default:
        return [
          { agent: 'ceo', action: 'chat', input: { text } },
        ];
    }
  }

  function extractJobFilters(text) {
    const out = {};
    const t = text.toLowerCase();
    const salary = t.match(/(?:paying\s+)?(?:more\s+than\s+|>\s*|\$|over\s+)?\$?(\d{2,4})\s*(?:\/|\s*per\s*(?:month|mo|hour|hr))?/);
    if (salary) out.minSalary = parseInt(salary[1], 10);
    if (/remote/.test(t)) out.remote = true;
    if (/full[- ]?time/.test(t)) out.type = 'Full-time';
    if (/part[- ]?time/.test(t)) out.type = 'Part-time';
    if (/contract/.test(t)) out.type = 'Contract';
    if (/customer support|customer success|customer service/.test(t)) out.keywords = (out.keywords || []).concat(['customer support', 'customer success']);
    return out;
  }
  function extractIndustry(text) {
    const t = text.toLowerCase();
    const inds = ['roofing', 'hvac', 'plumbing', 'solar', 'insurance', 'real estate', 'restoration', 'pest control', 'garage door', 'landscaping'];
    for (const i of inds) if (t.includes(i)) return i.replace(/\b\w/g, c => c.toUpperCase());
    return null;
  }
  function extractState(text) {
    const t = text.toLowerCase();
    const states = ['texas', 'california', 'florida', 'new york', 'illinois', 'arizona', 'georgia', 'north carolina', 'colorado', 'washington'];
    for (const s of states) if (t.includes(s)) return s.replace(/\b\w/g, c => c.toUpperCase());
    return null;
  }

  /* Map step.agent name -> global module variable.
     The plan uses the name 'memoryAgent' / 'crmAgent' / etc. (with 'Agent' suffix).
     Some are simple PascalCase: 'ceo' -> 'CEO', 'research' -> 'Research'. */
  const AGENT_REGISTRY = {
    ceo: 'L_CEOAgent',
    research: 'L_ResearchAgent',
    jobHunter: 'L_JobHunterAgent',
    leadHunter: 'L_LeadHunterAgent',
    sales: 'L_SalesAgent',
    crmAgent: 'L_CrmAgent',
    emailAgent: 'L_EmailAgent',
    browserAgent: 'L_BrowserAgent',
    computerAgent: 'L_ComputerAgent',
    memoryAgent: 'L_MemoryAgent',
    codingAgent: 'L_CodingAgent',
    fileAgent: 'L_FileAgent',
    taskAgent: 'L_TaskAgent',
    reportAgent: 'L_ReportAgent',
  };
  async function dispatch(step, prevResult, allOut) {
    const key = AGENT_REGISTRY[step.agent] || ('L_' + step.agent.charAt(0).toUpperCase() + step.agent.slice(1) + 'Agent');
    const mod = global[key];
    if (!mod || !mod.run) {
      set({ status: 'FAILED', currentTask: 'unknown agent: ' + step.agent, lastAction: 'failed' });
      return { ok: false, reason: 'unknown agent ' + step.agent };
    }
    // Resolve __PREV__ placeholder by passing the previous step's result.
    // For nested placeholders like __PREV_LEADS__ we search the entire prior
    // history for the first step that produced leads.
    const input = JSON.parse(JSON.stringify(step.input || {}));
    if (input.leads === '__PREV__' && prevResult) {
      input.leads = (prevResult.result && prevResult.result.leads) || [];
    }
    if (input.leads === '__PREV_LEADS__' && allOut) {
      for (let i = allOut.length - 1; i >= 0; i--) {
        const r = (allOut[i] || {}).result || {};
        if (Array.isArray(r.leads) && r.leads.length) { input.leads = r.leads; break; }
      }
      if (!Array.isArray(input.leads) || !input.leads.length) input.leads = [];
    }
    return mod.run(step.action, input);
  }

  async function run(text, opts) {
    opts = opts || {};
    set({ status: 'THINKING', currentTask: text, progress: 5, lastAction: 'classifying intent' });
    if (global.LApp) LApp.emit('activity', { actor: 'CEO', verb: 'received command', target: text });
    const intent = classifyIntent(text);
    const steps = plan(intent, text);
    set({ currentTask: text, progress: 10, lastAction: 'planned ' + steps.length + ' step(s)', lastResult: { intent, steps } });
    if (global.LApp) LApp.emit('workflow', { steps, intent });
    if (intent === 'greet') {
      const resp = 'Good evening, Sir Aitzaz. How can I help?';
      set({ status: 'COMPLETED', progress: 100, lastAction: 'greeted', lastResult: { response: resp } });
      return { ok: true, response: resp };
    }
    const out = [];
    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      set({ status: 'WORKING', progress: Math.round(((i) / steps.length) * 100), currentTask: step.agent + '.' + step.action, lastAction: 'calling ' + step.agent });
      if (global.LApp) LApp.emit('activity', { actor: 'CEO', verb: 'calling', target: step.agent + ' / ' + step.action });
      try {
        const prev = i > 0 ? out[i - 1] : null;
        const r = await dispatch(step, prev, out);
        out.push({ step, result: r });
      } catch (e) {
        out.push({ step, error: e.message || String(e) });
        set({ status: 'FAILED', lastAction: 'error in ' + step.agent, lastResult: { error: e.message } });
        return { ok: false, error: e.message, partial: out };
      }
    }
    set({ status: 'COMPLETED', progress: 100, lastAction: 'workflow completed', lastResult: { steps, output: out } });
    if (intent === 'chat') {
      // No specialist agent matched — answer directly via the provider
      const r = await LProviders.respond([
        { role: 'system', content: 'You are LOSWRR AI OS, the personal AI operating system for Sir Aitzaz. Be concise, professional, and address the user as "Sir Aitzaz".' },
        { role: 'user', content: text },
      ], { temperature: 0.6, max_tokens: 600 });
      return { ok: true, intent, steps, output: out, response: r.text + (r.mode === 'demo' ? ' (DEMO MODE — no provider connected)' : '') };
    }
    if (global.LApp) LApp.emit('activity', { actor: 'CEO', verb: 'completed', target: 'workflow' });
    // Build a friendly summary
    const summary = buildSummary(intent, out, text);
    return { ok: true, intent, steps, output: out, response: summary };
  }

  function buildSummary(intent, out, originalText) {
    const lastResult = (out[out.length - 1] || {}).result || {};
    if (intent === 'job_hunt') {
      const jh = out.find(x => x.step.agent === 'jobHunter');
      const jobs = (jh && jh.result && jh.result.jobs) || [];
      if (!jobs.length) return 'No jobs matched your filters, Sir Aitzaz. Try widening the search.';
      const top = jobs.slice(0, 3).map(j => j.company + ' (' + j.position + ')').join(', ');
      return 'Found ' + jobs.length + ' matching jobs, Sir Aitzaz. Top results: ' + top + '.';
    }
    if (intent === 'lead_hunt') {
      const lh = out.find(x => x.step.agent === 'leadHunter');
      const leads = (lh && lh.result && lh.result.leads) || [];
      if (!leads.length) return 'No leads matched those criteria, Sir Aitzaz.';
      const ea = out.find(x => x.step.agent === 'emailAgent');
      const drafts = (ea && ea.result && ea.result.drafts) || [];
      const tail = drafts.length ? ' Outreach drafts prepared.' : '';
      return 'Found ' + leads.length + ' qualified leads, Sir Aitzaz. Top: ' + leads.slice(0, 3).map(l => l.company).join(', ') + '.' + tail;
    }
    if (intent === 'memory') {
      const r = (out[0] && out[0].result) || {};
      if (r.action === 'remembered') return 'Remembered, Sir Aitzaz: "' + r.item.text + '".';
      if (r.action === 'recalled') {
        const x = (r.results || [])[0];
        return x ? ('You told me: "' + x.text + '", Sir Aitzaz.') : 'I do not have that in memory yet, Sir Aitzaz.';
      }
      if (r.action === 'forgot') return 'Removed ' + (r.removed || 0) + ' memories, Sir Aitzaz.';
      return 'Memory updated, Sir Aitzaz.';
    }
    if (intent === 'task') {
      const t = (out[0] && out[0].result && out[0].result.task) || {};
      return 'Task created, Sir Aitzaz: "' + (t.title || 'untitled') + '" on ' + (t.date || 'unscheduled') + (t.time ? ' at ' + t.time : '') + '.';
    }
    if (intent === 'email_draft') {
      const d = (out[0] && out[0].result && out[0].result.draft) || '';
      return d ? ('Draft prepared, Sir Aitzaz. Ready for review in Email.') : 'Could not draft, Sir Aitzaz.';
    }
    if (intent === 'browser') {
      return 'Browser command dispatched, Sir Aitzaz. Confirm in the Browser view if approval is required.';
    }
    if (intent === 'research') {
      const r = (out[0] && out[0].result) || {};
      return r.summary ? 'Research complete, Sir Aitzaz. Summary saved.' : 'Research queued, Sir Aitzaz.';
    }
    if (intent === 'cover_letter') {
      return 'Cover letter draft ready, Sir Aitzaz. See Job Hunter → Cover Letter.';
    }
    if (intent === 'job_save') {
      return 'Top matches saved to Job Hunter, Sir Aitzaz. Follow-up task created.';
    }
    return 'Workflow complete, Sir Aitzaz. See the relevant view for details.';
  }

  function getAgent() { return agent; }

  global.L_CEOAgent = { getAgent, classifyIntent, plan, run, reset, set };
})(window);
