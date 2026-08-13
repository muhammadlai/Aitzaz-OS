/* Aitzaz AI Pro — desktop shell (Electron).
 *
 * The desktop app is the same HUD that runs in the browser, wrapped in an
 * installable window. It connects to the LOCAL voice pipeline server
 * (server/server.py), so the brain (Hermes Agent), STT, VAD and TTS all run
 * on the user's own machine — this wrapper adds no cloud dependency.
 *
 * Point AITZAZ_HUD_URL at the server if it listens on a custom port
 * (default http://127.0.0.1:8765/hud/). */
"use strict";

const { app, BrowserWindow, shell, Menu } = require("electron");
const path = require("path");

const HUD_URL = process.env.AITZAZ_HUD_URL || "http://127.0.0.1:8765/hud/";

function createWindow() {
  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 900,
    minHeight: 640,
    title: "Aitzaz AI Pro",
    icon: path.join(__dirname, "icon.png"),
    backgroundColor: "#050b14",
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // keep external links (docs, dashboards) in the user's browser
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });

  win.loadURL(HUD_URL).catch(() => {
    win.loadURL("data:text/html,<body style='background:#050b14;color:#9fd8e8;font-family:sans-serif;display:flex;align-items:center;justify-content:center'><div><h2>Aitzaz AI Pro</h2><p>Voice server not reachable at " +
      HUD_URL + ".</p><p>Start it with: <code>cd server &amp;&amp; .venv/bin/python server.py</code> (see README), then restart this app.</p></div></body>");
  });

  return win;
}

const template = [
  { label: "Aitzaz", submenu: [
    { role: "reload", label: "Reload HUD" },
    { role: "toggleDevTools", label: "Developer Tools" },
    { type: "separator" },
    { role: "quit", label: "Quit Aitzaz AI Pro" },
  ]},
  { label: "Edit", submenu: [
    { role: "undo" }, { role: "redo" }, { type: "separator" },
    { role: "cut" }, { role: "copy" }, { role: "paste" }, { role: "selectAll" },
  ]},
];

app.whenReady().then(() => {
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
