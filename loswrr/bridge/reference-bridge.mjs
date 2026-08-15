// LOSWRR Desktop Bridge — reference implementation
// Run with:  node bridge/reference-bridge.mjs
//
// Listens on http://127.0.0.1:7878 by default.
// Set LOSWRR_BRIDGE_TOKEN to require an Authorization: Bearer <token>.
//
// Implements a small action surface. Every action is logged.
// Destructive actions (delete_file) are NOT implemented.

import http from 'node:http';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileP = promisify(execFile);

const PORT = parseInt(process.env.LOSWRR_BRIDGE_PORT || '7878', 10);
const HOST = process.env.LOSWRR_BRIDGE_HOST || '127.0.0.1';
const TOKEN = process.env.LOSWRR_BRIDGE_TOKEN || '';
const APPROVED = (process.env.LOSWRR_BRIDGE_FOLDERS || os.homedir())
  .split(':').map(s => path.resolve(s));
const AUDIT_LOG = process.env.LOSWRR_BRIDGE_AUDIT || path.join(os.homedir(), '.loswrr-bridge.audit.log');

const audit = (entry) => {
  const line = JSON.stringify({ ts: new Date().toISOString(), ...entry }) + '\n';
  fs.appendFile(AUDIT_LOG, line, () => {});
};

const inside = (p) => {
  const abs = path.resolve(p);
  return APPROVED.some(root => abs === root || abs.startsWith(root + path.sep));
};

const handlers = {
  get_info: async () => ({
    ok: true,
    info: {
      hostname: os.hostname(),
      platform: os.platform(),
      release: os.release(),
      arch: os.arch(),
      cpus: os.cpus().length,
      totalmem: os.totalmem(),
      freemem: os.freemem(),
      uptime: os.uptime(),
      user: os.userInfo().username,
      home: os.homedir(),
      approvedFolders: APPROVED,
      bridgeVersion: '0.1.0',
    },
  }),

  read_file: async ({ path: p }) => {
    if (!p) return { ok: false, reason: 'path required' };
    if (!inside(p)) return { ok: false, reason: 'outside approved folders' };
    const data = await fsp.readFile(p, 'utf8');
    return { ok: true, data };
  },

  list_dir: async ({ path: p }) => {
    if (!p) return { ok: false, reason: 'path required' };
    if (!inside(p)) return { ok: false, reason: 'outside approved folders' };
    const entries = await fsp.readdir(p, { withFileTypes: true });
    return { ok: true, entries: entries.map(e => ({ name: e.name, isDir: e.isDirectory() })) };
  },

  write_file: async ({ path: p, data }) => {
    if (!p || data == null) return { ok: false, reason: 'path and data required' };
    if (!inside(p)) return { ok: false, reason: 'outside approved folders' };
    await fsp.writeFile(p, data, 'utf8');
    return { ok: true };
  },

  create_folder: async ({ path: p }) => {
    if (!p) return { ok: false, reason: 'path required' };
    if (!inside(p)) return { ok: false, reason: 'outside approved folders' };
    await fsp.mkdir(p, { recursive: true });
    return { ok: true };
  },

  move_file: async ({ from, to }) => {
    if (!from || !to) return { ok: false, reason: 'from and to required' };
    if (!inside(from) || !inside(to)) return { ok: false, reason: 'outside approved folders' };
    await fsp.rename(from, to);
    return { ok: true };
  },

  copy_file: async ({ from, to }) => {
    if (!from || !to) return { ok: false, reason: 'from and to required' };
    if (!inside(from) || !inside(to)) return { ok: false, reason: 'outside approved folders' };
    await fsp.copyFile(from, to);
    return { ok: true };
  },

  // NOTE: delete_file is intentionally not implemented.

  run_command: async ({ cmd, args, cwd }) => {
    if (!cmd) return { ok: false, reason: 'cmd required' };
    if (typeof cmd !== 'string') return { ok: false, reason: 'cmd must be a string' };
    // Refuse obviously destructive patterns
    const block = /(^|\s)(rm\s+-rf|rm\s+-fr|rmdir\s+|format\s+|del\s+\/[a-z]+\s+|mkfs|dd\s+if=)/i;
    if (block.test(cmd)) return { ok: false, reason: 'command matches destructive pattern' };
    const argv = args ? [String(cmd), ...args.map(String)] : cmd.split(/\s+/);
    const realCmd = argv[0];
    const realArgs = argv.slice(1);
    try {
      const { stdout, stderr } = await execFileP(realCmd, realArgs, { cwd: cwd ? path.resolve(cwd) : undefined, timeout: 15000, maxBuffer: 1024 * 1024 });
      return { ok: true, stdout, stderr };
    } catch (e) {
      return { ok: false, reason: e.message, stdout: e.stdout, stderr: e.stderr, code: e.code };
    }
  },

  read_clipboard: async () => {
    // Linux: xclip or xsel; macOS: pbpaste; Windows: powershell Get-Clipboard
    try {
      if (os.platform() === 'darwin') {
        const { stdout } = await execFileP('pbpaste', []);
        return { ok: true, data: stdout };
      }
      if (os.platform() === 'win32') {
        const { stdout } = await execFileP('powershell', ['-NoProfile', '-Command', 'Get-Clipboard']);
        return { ok: true, data: stdout };
      }
      try {
        const { stdout } = await execFileP('xclip', ['-selection', 'clipboard', '-o']);
        return { ok: true, data: stdout };
      } catch (e) {
        const { stdout } = await execFileP('xsel', ['--clipboard', '--output']);
        return { ok: true, data: stdout };
      }
    } catch (e) {
      return { ok: false, reason: e.message };
    }
  },

  write_clipboard: async ({ data }) => {
    try {
      if (os.platform() === 'darwin') {
        await execFileP('pbcopy', []);
        return { ok: true };
      }
      if (os.platform() === 'win32') {
        await execFileP('powershell', ['-NoProfile', '-Command', `Set-Clipboard -Value ${JSON.stringify(data || '')}`]);
        return { ok: true };
      }
      try {
        await execFileP('xclip', ['-selection', 'clipboard']);
        return { ok: true };
      } catch (e) {
        await execFileP('xsel', ['--clipboard', '--input']);
        return { ok: true };
      }
    } catch (e) {
      return { ok: false, reason: e.message };
    }
  },

  notify: async ({ title, body }) => {
    try {
      if (os.platform() === 'darwin') {
        await execFileP('osascript', ['-e', `display notification ${JSON.stringify(body || '')} with title ${JSON.stringify(title || 'LOSWRR')}`]);
        return { ok: true };
      }
      if (os.platform() === 'win32') {
        // Skip for brevity
        return { ok: false, reason: 'notifications not implemented on Windows in reference bridge' };
      }
      await execFileP('notify-send', [title || 'LOSWRR', body || '']);
      return { ok: true };
    } catch (e) {
      return { ok: false, reason: e.message };
    }
  },

  screenshot: async () => {
    // Real implementation would capture the display. Reference returns a placeholder.
    return { ok: false, reason: 'screenshot not implemented in reference bridge; see docs to add an adapter' };
  },

  browser_open: async ({ url }) => {
    if (!url) return { ok: false, reason: 'url required' };
    try {
      const opener = os.platform() === 'darwin' ? 'open' : os.platform() === 'win32' ? 'start' : 'xdg-open';
      await execFileP(opener, [url]);
      return { ok: true };
    } catch (e) {
      return { ok: false, reason: e.message };
    }
  },
};

const server = http.createServer(async (req, res) => {
  // CORS for the web app
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }

  if (req.method === 'GET' && req.url === '/info') {
    if (TOKEN) {
      const auth = req.headers['authorization'] || '';
      if (auth !== 'Bearer ' + TOKEN) { res.writeHead(401); return res.end('unauthorized'); }
    }
    const r = await handlers.get_info({});
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify(r));
  }

  if (req.method === 'POST' && req.url === '/action') {
    if (TOKEN) {
      const auth = req.headers['authorization'] || '';
      if (auth !== 'Bearer ' + TOKEN) { res.writeHead(401); return res.end('unauthorized'); }
    }
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
      let parsed = {};
      try { parsed = JSON.parse(body || '{}'); } catch (e) { res.writeHead(400); return res.end('bad json'); }
      const { action, payload } = parsed;
      const fn = handlers[action];
      if (!fn) {
        audit({ action, result: 'unknown' });
        res.writeHead(400, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ ok: false, reason: 'unknown action' }));
      }
      try {
        const r = await fn(payload || {});
        audit({ action, payload, result: r.ok ? 'ok' : 'fail', reason: r.reason });
        res.writeHead(r.ok ? 200 : 400, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify(r));
      } catch (e) {
        audit({ action, payload, result: 'error', error: e.message });
        res.writeHead(500, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ ok: false, reason: e.message }));
      }
    });
    return;
  }

  res.writeHead(404);
  res.end('not found');
});

server.listen(PORT, HOST, () => {
  console.log('LOSWRR Desktop Bridge listening on http://' + HOST + ':' + PORT);
  console.log('Approved folders:', APPROVED);
  console.log('Audit log:', AUDIT_LOG);
  if (TOKEN) console.log('Token auth: ENABLED');
  else console.log('Token auth: DISABLED (set LOSWRR_BRIDGE_TOKEN to enable)');
});
