/* File Agent */
(function (global) {
  'use strict';
  const agent = {
    id: 'file',
    name: 'File Agent',
    icon: '📄',
    role: 'PDF, DOCX, CSV, JSON, images, summarize',
    color: '#a06bff',
    status: 'IDLE', currentTask: '', progress: 0, lastAction: '', lastResult: null,
  };
  function set(p) { Object.assign(agent, p); if (global.LApp) LApp.emit('agent-update', { id: agent.id, ...p }); }

  async function run(action, input) {
    if (action === 'handle') {
      set({ status: 'WORKING', currentTask: 'files: ' + (input.text || ''), progress: 30, lastAction: 'preparing' });
      // The actual file upload is handled by the Files view; this just summarizes intent
      const r = { ok: true, hint: 'Upload a file in the Files view. I will parse, summarize, and store it.', text: input.text };
      set({ status: 'COMPLETED', progress: 100, lastAction: 'awaiting file upload', lastResult: r });
      return r;
    }
    set({ status: 'FAILED', lastAction: 'unknown action ' + action });
    return { ok: false };
  }

  global.L_FileAgent = { getAgent: () => agent, run, set };
})(window);
