// Shell desktop do Google OS (Electron).
//
// A janela principal carrega o próprio Google OS (React/Vite). Para Docs,
// Sheets, Slides, Meet e Chat — apps que não têm como ser recriados dentro do
// OS — o frontend chama window.electronAPI.openExternalApp(url), que abre uma
// janela Chrome de verdade apontando direto para o domínio oficial do Google.
// Todas as janelas compartilham a mesma sessão persistida, então o login do
// Google feito em uma delas vale para as outras (como abas do mesmo navegador).

const { app, BrowserWindow, ipcMain, session, shell } = require('electron');
const path = require('path');

const SESSION_PARTITION = 'persist:google-os';
const DEV_SERVER_URL = process.env.GOOGLE_OS_DEV_URL || 'http://localhost:3000';

/** @type {Map<string, BrowserWindow>} janelas de apps do Google já abertas, por origem */
const googleAppWindows = new Map();

function createMainWindow() {
    const win = new BrowserWindow({
        width: 1440,
        height: 900,
        minWidth: 980,
        minHeight: 640,
        backgroundColor: '#050505',
        autoHideMenuBar: true,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: true,
            session: session.fromPartition(SESSION_PARTITION),
        },
    });

    if (!app.isPackaged) {
        win.loadURL(DEV_SERVER_URL);
    } else {
        win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
    }

    return win;
}

function openGoogleAppWindow(url, title) {
    let origin;
    try { origin = new URL(url).origin; } catch { return; }

    const existing = googleAppWindows.get(origin);
    if (existing && !existing.isDestroyed()) {
        existing.loadURL(url);
        existing.focus();
        return;
    }

    const win = new BrowserWindow({
        width: 1280,
        height: 860,
        title: title || 'Google',
        autoHideMenuBar: true,
        webPreferences: {
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: true,
            session: session.fromPartition(SESSION_PARTITION),
        },
    });

    win.loadURL(url);
    win.on('closed', () => googleAppWindows.delete(origin));
    // Links que abrem em nova aba dentro do próprio Google (ex.: exportar, imprimir)
    // continuam na sessão do app em vez de abrir o navegador padrão do sistema.
    win.webContents.setWindowOpenHandler(({ url: targetUrl }) => {
        if (targetUrl.startsWith('https://accounts.google.com') || targetUrl.includes('google.com')) {
            return { action: 'allow' };
        }
        shell.openExternal(targetUrl);
        return { action: 'deny' };
    });

    googleAppWindows.set(origin, win);
}

app.whenReady().then(() => {
    createMainWindow();

    ipcMain.on('open-external-app', (_event, payload) => {
        const url = payload?.url;
        if (typeof url === 'string' && /^https:\/\//.test(url)) {
            openGoogleAppWindow(url, payload?.title);
        }
    });

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});
