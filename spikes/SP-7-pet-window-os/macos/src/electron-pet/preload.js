const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  setIgnoreMouseEvents: (ignore, forward) => {
    ipcRenderer.send('set-ignore-mouse-events', ignore, forward);
  },
  onCardClicked: () => {
    ipcRenderer.send('card-clicked');
  },
  onPetClicked: () => {
    ipcRenderer.send('pet-clicked');
  }
});
