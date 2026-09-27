import { contextBridge, ipcRenderer } from 'electron';

// Superfície mínima exposta ao renderer. contextIsolation está ligado e
// nodeIntegration desligado — o React nunca toca em API do Node
// diretamente, só nestes três métodos.
contextBridge.exposeInMainWorld('flemingcore', {
  ehDesktop: true,
  notificar: (titulo: string, corpo: string) =>
    ipcRenderer.invoke('notificar', { titulo, corpo }),
  versao: () => ipcRenderer.invoke('versao'),
});
