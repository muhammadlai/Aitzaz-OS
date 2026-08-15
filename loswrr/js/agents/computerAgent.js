/* Computer Agent */
(function (global) {
  'use strict';
  const agent = {
    id: 'computer',
    name: 'Computer Agent',
    icon: '🖥',
    role: 'Files, commands, screenshots (Desktop Bridge)',
    color: '#a06bff',
    status: 'IDLE', currentTask: '', progress: 0, lastAction: '', lastResult: null,
  };
  function set(p) { Object.assign(agent, p); if (global.LApp) LApp.emit('agent-update', { id: agent.id, ...p }); }

  async function run(action, input) {
    if (action === 'runCommand') {
      set({ status: 'WORKING', currentTask: 'computer: ' + (input.text || ''), progress: 30, lastAction: 'preparing command' });
      if (!global.LBridge || !LBridge.state.connected) {
        set({ status: 'FAILED', lastAction: 'Desktop Bridge not connected', lastResult: { reason: 'no-bridge' } });
        return { ok: false, reason: 'Desktop Bridge not connected. Enable the bridge in Settings or Computer view.' };
      }
      const r = await LBridge.call('run_command', { cmd: input.text, confirmed: input.__confirmed });
      if (r.requiresApproval) {
        set({ status: 'WAITING', lastAction: 'awaiting user approval', lastResult: r });
        if (global.LApp) LApp.emit('approval-required', { agent: 'computer', ...r });
        return r;
      }
      set({ status: r.ok ? 'COMPLETED' : 'FAILED', progress: 100, lastAction: r.ok ? 'command executed' : 'command failed', lastResult: r });
      return r;
    }
    set({ status: 'FAILED', lastAction: 'unknown action ' + action });
    return { ok: false };
  }

  global.L_ComputerAgent = { getAgent: () => agent, run, set };
})(window);
