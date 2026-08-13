// Minimal, safe bridge between the config/offline pages and the main process.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('aitzaz', {
  getConfig: () => ipcRenderer.invoke('config:get'),
  connect: (url) => ipcRenderer.invoke('config:connect', url),
  openSettings: () => ipcRenderer.invoke('config:open'),
  retry: () => ipcRenderer.invoke('config:retry'),
});
