/* ==========================================================================
   LOSWRR Orchestrator
   Wraps the CEO and exposes a high-level API for commands and workflows.
   ========================================================================== */
(function (global) {
  'use strict';

  async function run(text, opts) { return L_CEOAgent.run(text, opts || {}); }

  async function runWorkflow(name, opts) {
    opts = opts || {};
    let text = '';
    if (name === 'daily_brief') text = 'Prepare my daily brief.';
    if (name === 'job_hunt') text = 'Find remote customer support jobs paying more than $800.';
    if (name === 'lead_hunt') text = 'Find 10 roofing companies in Texas and prepare outreach.';
    return L_CEOAgent.run(text, opts);
  }

  /* Aggregated agent roster for the Agents view */
  function allAgents() {
    return [
      L_CEOAgent.getAgent(),
      L_ResearchAgent.getAgent(),
      L_JobHunterAgent.getAgent(),
      L_LeadHunterAgent.getAgent(),
      L_SalesAgent.getAgent(),
      L_CrmAgent.getAgent(),
      L_EmailAgent.getAgent(),
      L_BrowserAgent.getAgent(),
      L_ComputerAgent.getAgent(),
      L_MemoryAgent.getAgent(),
      L_CodingAgent.getAgent(),
      L_FileAgent.getAgent(),
      L_TaskAgent.getAgent(),
      L_ReportAgent.getAgent(),
    ];
  }

  function getAgent(id) { return allAgents().find(a => a.id === id); }

  global.LOrchestrator = { run, runWorkflow, allAgents, getAgent };
})(window);
