const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  sendMetrics: (data) => ipcRenderer.send('pet-metrics', data),
  onStateChange: (callback) => ipcRenderer.on('state-change', (_, data) => callback(data)),
  onMotionUpdate: (callback) => ipcRenderer.on('motion-update', (_, data) => callback(data)),
  onCardShow: (callback) => ipcRenderer.on('card-show', (_, data) => callback(data)),
  onCardHide: (callback) => ipcRenderer.on('card-hide', (_, data) => callback(data)),
  setMouseIgnore: (ignore) => ipcRenderer.send('set-mouse-ignore', ignore),
  petClicked: () => ipcRenderer.send('pet-clicked'),
  dragStart: (pt) => ipcRenderer.send('drag-start', pt),
  dragMove: (pt) => ipcRenderer.send('drag-move', pt),
  dragEnd: (pt) => ipcRenderer.send('drag-end', pt)
});
