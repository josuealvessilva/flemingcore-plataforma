import { app, BrowserWindow, Tray, Menu, Notification, nativeImage, ipcMain } from 'electron';
import path from 'node:path';

let janela: BrowserWindow | null = null;
let tray: Tray | null = null;
let encerrandoDeVerdade = false;

// Instância única: um segundo processo apenas foca a janela existente.
// Sem isso, abrir o atalho duas vezes cria duas bandejas e duplica a
// notificação — confuso para o farmacêutico.
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (janela) {
      if (janela.isMinimized()) janela.restore();
      janela.show();
      janela.focus();
    }
  });
}

function criarJanela() {
  janela = new BrowserWindow({
    width: 1280,
    height: 800,
    // Mesmo mínimo do window_manager no Flutter (main.dart).
    minWidth: 1024,
    minHeight: 768,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // Início automático com o Windows abre com --hidden: o app sobe direto
  // para a bandeja, sem roubar a tela do usuário no logon.
  janela.once('ready-to-show', () => {
    if (!process.argv.includes('--hidden')) janela?.show();
  });

  janela.loadFile(path.join(__dirname, '../dist/index.html'));

  // Fechar a janela esconde para a bandeja em vez de encerrar — é o que
  // mantém o processo vivo para receber notificação. Encerrar de verdade
  // só pelo menu da bandeja.
  janela.on('close', (evento) => {
    if (!encerrandoDeVerdade) {
      evento.preventDefault();
      janela?.hide();
    }
  });
}

function criarBandeja() {
  tray = new Tray(nativeImage.createEmpty());
  tray.setToolTip('FlemingCore');
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: 'Abrir FlemingCore', click: () => janela?.show() },
      { type: 'separator' },
      {
        label: 'Sair',
        click: () => {
          encerrandoDeVerdade = true;
          app.quit();
        },
      },
    ]),
  );
  tray.on('double-click', () => janela?.show());
}

function exibirNotificacao(titulo: string, corpo: string) {
  if (!Notification.isSupported()) return;
  const n = new Notification({ title: titulo, body: corpo });
  n.on('click', () => janela?.show());
  n.show();
}

app.whenReady().then(() => {
  // AppUserModelID: sem isso o Windows não associa a notificação ao app e
  // ela aparece como "electron.app.Electron".
  app.setAppUserModelId('com.flemingcore.desktop');

  // Handlers do preload. Sem registrar aqui, o ipcRenderer.invoke do
  // renderer fica pendurado e a notificação nunca aparece.
  ipcMain.handle('notificar', (_evento, dados: { titulo: string; corpo: string }) => {
    exibirNotificacao(dados.titulo, dados.corpo);
  });
  ipcMain.handle('versao', () => app.getVersion());

  // Inicia junto com o Windows, minimizado na bandeja. É isso que viabiliza
  // a notificação sem o usuário abrir o app manualmente.
  if (app.isPackaged) {
    app.setLoginItemSettings({ openAtLogin: true, args: ['--hidden'] });
  }

  criarJanela();
  criarBandeja();
});

// No Windows não encerramos em window-all-closed: a bandeja segura o
// processo. Sem esse override, esconder a janela mataria o app.
app.on('window-all-closed', () => {
  if (process.platform !== 'win32') app.quit();
});
