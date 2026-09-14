const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  sendMetrics: (data) => ipcRenderer.send('pet-metrics', data),
  onMotionUpdate: (cb) => ipcRenderer.on('motion-update', (_, data) => cb(data)),
  onStateUpdate: (cb) => ipcRenderer.on('state-update', (_, data) => cb(data)),
  onCardUpdate: (cb) => ipcRenderer.on('card-update', (_, data) => cb(data)),
  setIgnoreMouseEvents: (ignore, options) => ipcRenderer.send('set-ignore-mouse-events', ignore, options),
  petClick: () => ipcRenderer.send('pet-clicked'),
  dismissCard: () => ipcRenderer.send('card-dismiss')
});
