const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    /** Abre uma URL do Google (Docs/Sheets/Slides/Meet/Chat) numa janela própria do shell desktop. */
    openExternalApp: (url, title) => ipcRenderer.send('open-external-app', { url, title }),
});
