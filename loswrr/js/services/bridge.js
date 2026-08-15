/* ==========================================================================
   LOSWRR Desktop Bridge
   Optional local agent for Chromebook Linux / Windows / macOS / Linux
   to perform real local computer control.
   If not connected, the web app keeps working.
   ========================================================================== */
(function (global) {
  'use strict';

  const state = {
    connected: false,
    endpoint: '',
    permissions: {
      'READ_FILES': false, 'WRITE_FILES': false, 'RUN_COMMANDS': false,
      'SCREENSHOT': false, 'CLIPBOARD': false, 'BROWSER_CONTROL': false, 'NOTIFICATIONS': false,
    },
    approvedFolders: [],
    lastSeen: null,
    info: null,
  };

  const DEFAULT_PORT = 7878;

  function load() {
    const s = LStorage.get('bridge', null);
    if (s) {
      state.endpoint = s.endpoint || '';
      state.permissions = Object.assign(state.permissions, s.permissions || {});
      state.approvedFolders = s.approvedFolders || [];
      state.info = s.info || null;
    }
  }
  function save() {
    LStorage.set('bridge', {
      endpoint: state.endpoint, permissions: state.permissions,
      approvedFolders: state.approvedFolders, info: state.info,
    });
  }

  async function connect(endpoint) {
    if (endpoint) state.endpoint = endpoint;
    if (!state.endpoint) state.endpoint = 'http://127.0.0.1:' + DEFAULT_PORT;
    try {
      const resp = await fetch(state.endpoint.replace(/\/+$/, '') + '/info', {
        method: 'GET', signal: AbortSignal.timeout(2500),
      });
      if (!resp.ok) throw new Error('HTTP ' + resp.status);
      state.info = await resp.json();
      state.connected = true;
      state.lastSeen = Date.now();
      save();
      return true;
    } catch (e) {
      state.connected = false;
      state.lastSeen = null;
      return false;
    }
  }

  function disconnect() {
    state.connected = false;
    state.info = null;
    save();
  }

  function setEndpoint(url) { state.endpoint = url; save(); }
  function setPermission(key, val) {
    if (!(key in state.permissions)) return false;
    state.permissions[key] = !!val;
    save();
    return true;
  }
  function addFolder(p) {
    if (!p) return;
    if (!state.approvedFolders.includes(p)) state.approvedFolders.push(p);
    save();
  }
  function removeFolder(p) {
    state.approvedFolders = state.approvedFolders.filter(x => x !== p);
    save();
  }

  /* Bridge call with action classification.
     Returns { ok, data, blocked, reason } */
  async function call(action, payload) {
    if (!state.connected) return { ok: false, blocked: true, reason: 'Bridge not connected' };
    const cls = classify(action, payload);
    if (cls === 'BLOCKED') {
      return { ok: false, blocked: true, reason: 'Action blocked by policy' };
    }
    if (cls === 'REQUIRES_APPROVAL') {
      // Caller is responsible for showing approval modal; we expect confirm === true
      if (!payload || !payload.__confirmed) {
        return { ok: false, requiresApproval: true, reason: 'User approval required', action, payload };
      }
    }
    try {
      const url = state.endpoint.replace(/\/+$/, '') + '/action';
      const resp = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, payload }),
      });
      const data = await resp.json();
      if (!resp.ok) return { ok: false, reason: data.reason || ('HTTP ' + resp.status) };
      return { ok: true, data };
    } catch (e) {
      return { ok: false, reason: e && e.message || 'Bridge call failed' };
    }
  }

  /* SAFE: read-only, internal
     REQUIRES_APPROVAL: write, run, delete, network-shaping
     BLOCKED: anything outside explicit grant */
  function classify(action, payload) {
    switch (action) {
      case 'read_file':
      case 'list_dir':
      case 'get_info':
        return state.permissions.READ_FILES ? 'SAFE' : 'BLOCKED';
      case 'write_file':
      case 'move_file':
      case 'copy_file':
      case 'create_folder':
        return state.permissions.WRITE_FILES ? 'REQUIRES_APPROVAL' : 'BLOCKED';
      case 'run_command':
        return state.permissions.RUN_COMMANDS ? 'REQUIRES_APPROVAL' : 'BLOCKED';
      case 'delete_file':
        return 'BLOCKED'; // never auto-allow destructive deletes
      case 'screenshot':
        return state.permissions.SCREENSHOT ? 'SAFE' : 'BLOCKED';
      case 'read_clipboard':
      case 'write_clipboard':
        return state.permissions.CLIPBOARD ? 'SAFE' : 'BLOCKED';
      case 'browser_open':
      case 'browser_click':
      case 'browser_fill':
      case 'browser_submit':
        return state.permissions.BROWSER_CONTROL ? 'REQUIRES_APPROVAL' : 'BLOCKED';
      case 'notify':
        return state.permissions.NOTIFICATIONS ? 'SAFE' : 'BLOCKED';
      default:
        return 'BLOCKED';
    }
  }

  load();
  global.LBridge = {
    state, connect, disconnect, setEndpoint,
    setPermission, addFolder, removeFolder, call, classify,
  };
})(window);
