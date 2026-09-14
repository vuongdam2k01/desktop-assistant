// preload.js - SP-16/mac Preload Script
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  onVersionInfo: (callback) => ipcRenderer.on('version-info', (event, data) => callback(data)),
  onAppLog: (callback) => ipcRenderer.on('app-log', (event, data) => callback(data)),
  onDownloadProgress: (callback) => ipcRenderer.on('download-progress', (event, percent) => callback(percent)),
  onReadyToRestart: (callback) => ipcRenderer.on('ready-to-restart', (event, ver) => callback(ver)),
  onJobConflict: (callback) => ipcRenderer.on('update-ready-job-conflict', (event, data) => callback(data)),

  checkUpdateManual: () => ipcRenderer.send('check-update-manual'),
  startJob: (name) => ipcRenderer.send('start-job', name),
  stopJob: () => ipcRenderer.send('stop-job'),
  confirmRestart: () => ipcRenderer.send('confirm-restart')
});
