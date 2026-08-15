/*
 * Aitzaz AI Pro — desktop shell (Electron)
 *
 * A thin native shell for the self-hosted Aitzaz voice HUD. It connects to the
 * HUD served by the Python voice pipeline server (server/server.py) over the
 * LAN, e.g. https://192.168.1.20/hud/ or https://jarvis.local/hud/.
 *
 * The HUD itself does all the real work (WebSocket audio, agent events, auth
 * PIN gate) using relative URLs, so the shell only needs to load the right URL,
 * accept the server's self-signed TLS certificate for that host, and remember
 * the address between launches.
 */

const { app, BrowserWindow, ipcMain, Menu, shell, session, systemPreferences } = require('electron');
const path = require('path');
const fs = require('fs');

const PARTITION = 'persist:aitzaz'; // keep cookies (HUD PIN) between launches
const ICON = path.join(__dirname, 'build', 'icon.png');

let mainWindow = null;
let configWindow = null;

// ---------------------------------------------------------------- config

const configFile = () => path.join(app.getPath('userData'), 'config.json');

function defaultConfig() {
  return { url: '' };
}

function loadConfig() {
  try {
    const raw = fs.readFileSync(configFile(), 'utf8');
    return { ...defaultConfig(), ...JSON.parse(raw) };
  } catch {
    return defaultConfig();
  }
}

function saveConfig(cfg) {
  try {
    fs.mkdirSync(path.dirname(configFile()), { recursive: true });
    fs.writeFileSync(configFile(), JSON.stringify(cfg, null, 2), 'utf8');
  } catch (err) {
    console.error('failed to save config', err);
  }
}

/** Normalize whatever the user typed into the HUD entry URL. */
function hudUrl(raw) {
  let u = String(raw || '').trim();
  if (!u) return '';
  // Only http/https are valid; reject any other explicit scheme (ftp:// etc.).
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(u) && !/^https?:\/\//i.test(u)) return '';
  if (!/^https?:\/\//i.test(u)) u = 'https://' + u;
  let parsed;
  try {
    parsed = new URL(u);
  } catch {
    return '';
  }
  if (parsed.pathname === '/' || parsed.pathname === '') parsed.pathname = '/hud/';
  if (!parsed.pathname.endsWith('/')) parsed.pathname += '/';
  return parsed.toString();
}

// ---------------------------------------------------------------- windows

function windowPrefs(extra) {
  return Object.assign(
    {
      icon: ICON,
      webPreferences: {
        preload: path.join(__dirname, 'preload.js'),
        contextIsolation: true,
        nodeIntegration: false,
      },
    },
    extra
  );
}

function createMainWindow(url) {
  const parsed = new URL(url);

  mainWindow = new BrowserWindow(
    windowPrefs({
      width: 1280,
      height: 820,
      minWidth: 760,
      minHeight: 560,
      backgroundColor: '#050b14',
      autoHideMenuBar: true,
      show: false,
      webPreferences: {
        partition: PARTITION,
        preload: path.join(__dirname, 'preload.js'),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: false,
      },
    })
  );

  mainWindow.setMenuBarVisibility(false);
  mainWindow.once('ready-to-show', () => mainWindow.show());

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // The HUD drives iframe dashboards and media panels; anything that would
  // open a brand-new top-level window goes to the default browser instead.
  mainWindow.webContents.setWindowOpenHandler(({ url: target }) => {
    if (/^https?:\/\//i.test(target)) shell.openExternal(target);
    return { action: 'deny' };
  });

  // Stay inside the server; allow the HUD's own reloads/auth redirects.
  mainWindow.webContents.on('will-navigate', (event, target) => {
    try {
      const t = new URL(target);
      if (t.host !== parsed.host) {
        event.preventDefault();
        if (/^https?:\/\//i.test(target)) shell.openExternal(target);
      }
    } catch {
      /* ignore malformed */
    }
  });

  mainWindow.webContents.on(
    'did-fail-load',
    (event, errorCode, errorDescription, validatedURL, isMainFrame) => {
      if (isMainFrame && errorCode !== -3) showUnreachable(errorDescription); // -3 = aborted
    }
  );

  mainWindow.loadURL(url);
}

function openMain(url) {
  const target = hudUrl(url);
  if (!target) {
    openConfig();
    return;
  }
  if (mainWindow) {
    mainWindow.loadURL(target);
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  } else {
    createMainWindow(target);
  }
}

function openConfig() {
  if (configWindow) {
    configWindow.focus();
    return;
  }
  configWindow = new BrowserWindow(
    windowPrefs({
      width: 560,
      height: 620,
      resizable: false,
      minimizable: false,
      maximizable: false,
      backgroundColor: '#050b14',
      title: 'Aitzaz AI Pro — Connect',
    })
  );
  configWindow.setMenuBarVisibility(false);
  configWindow.loadFile('config.html');
  configWindow.on('closed', () => {
    configWindow = null;
  });
}

function showUnreachable(reason) {
  if (!mainWindow) return;
  const q = encodeURIComponent(String(reason || 'unknown'));
  mainWindow
    .loadFile('offline.html', { query: { reason: q } })
    .catch(() => {});
}

// ---------------------------------------------------------------- IPC

ipcMain.handle('config:get', () => loadConfig());

ipcMain.handle('config:connect', (_event, url) => {
  const cfg = loadConfig();
  cfg.url = String(url || '').trim();
  saveConfig(cfg);
  openMain(cfg.url);
  if (configWindow) configWindow.close();
  return { ok: true, url: hudUrl(cfg.url) };
});

ipcMain.handle('config:open', () => {
  openConfig();
});

ipcMain.handle('config:retry', () => {
  if (mainWindow) {
    const cfg = loadConfig();
    const target = hudUrl(cfg.url);
    if (target) mainWindow.loadURL(target);
  }
});

// ---------------------------------------------------------------- menu

function buildMenu() {
  const template = [
    ...(process.platform === 'darwin'
      ? [{ role: 'appMenu' }]
      : [
          {
            label: 'File',
            submenu: [
              { label: 'Settings…', accelerator: 'CmdOrCtrl+,', click: () => openConfig() },
              { type: 'separator' },
              { role: 'quit', label: 'Quit' },
            ],
          },
        ]),
    {
      label: 'View',
      submenu: [
        { role: 'reload', label: 'Reload HUD' },
        { role: 'togglefullscreen', label: 'Toggle Full Screen' },
        { type: 'separator' },
        { role: 'toggleDevTools', label: 'Developer Tools' },
      ],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

// ---------------------------------------------------------------- app life

// Command-line switches must be set before the app is ready to take effect.
// 1) Let TTS audio play without a user gesture.
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');
// 2) ChromeOS Crostini: Electron's sandbox often fails under Sommelier.
if (process.platform === 'linux' && (fs.existsSync('/dev/.cros_milestone') || fs.existsSync('/mnt/chromeos'))) {
  app.commandLine.appendSwitch('no-sandbox');
}
// 3) Plain-http servers: mark that origin as secure so the browser mic works.
//    (The recommended setup is HTTPS — see docs/SETUP.md "TLS certificates".)
const _bootCfg = loadConfig();
const _bootTarget = hudUrl(_bootCfg.url);
if (_bootTarget && _bootTarget.startsWith('http://')) {
  try {
    app.commandLine.appendSwitch(
      'unsafely-treat-insecure-origin-as-secure',
      new URL(_bootTarget).origin
    );
  } catch {
    /* ignore */
  }
}

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    } else {
      start();
    }
  });

  app.whenReady().then(start);
}

function start() {
  buildMenu();

  // Mic permission (the whole point of this app):
  // 1) Only the configured HUD origin may request media permissions.
  session.fromPartition(PARTITION).setPermissionRequestHandler(
    (wc, permission, callback, details) => {
      let allowed = false;
      if (permission === 'media') {
        try {
          const cfg = loadConfig();
          const target = hudUrl(cfg.url);
          const req = new URL(details.requestingUrl || wc.getURL());
          allowed = Boolean(target) && req.host === new URL(target).host;
        } catch {
          allowed = false;
        }
      }
      callback(allowed);
    }
  );
  // 2) macOS: ask once up front so the TCC entry exists with a prompt
  //    (requires NSMicrophoneUsageDescription in the packaged build).
  if (process.platform === 'darwin') {
    try {
      systemPreferences.askForMediaAccess('microphone').catch(() => {});
    } catch {
      /* ignore */
    }
  }

  const cfg = loadConfig();
  const target = hudUrl(cfg.url);

  if (target) openMain(target);
  else openConfig();
}

// macOS: re-open a window when the dock icon is clicked.
app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    const c = loadConfig();
    if (hudUrl(c.url)) openMain(c.url);
    else openConfig();
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// ---------------------------------------------------------------- TLS

// The server uses a self-signed cert (docs/SETUP.md "TLS certificates").
// Accept it only for the host the user configured, not for anything else.
app.on('certificate-error', (event, _webContents, url, _error, _cert, callback) => {
  const cfg = loadConfig();
  const target = hudUrl(cfg.url);
  try {
    if (target && new URL(url).hostname === new URL(target).hostname) {
      event.preventDefault();
      callback(true);
      return;
    }
  } catch {
    /* fall through */
  }
  callback(false);
});
