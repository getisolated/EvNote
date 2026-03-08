import { app, BrowserWindow, ipcMain, shell } from 'electron';
import * as path from 'path';
import { initDatabase, closeDatabase, noteOps } from './database';

const isDev = process.env['NODE_ENV'] === 'development';
let mainWindow: BrowserWindow | null = null;

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 600,
    minHeight: 400,
    frame: false,
    backgroundColor: '#1e1e1e',
    titleBarStyle: 'hidden',
    icon: path.join(__dirname, '../assets/logo.ico'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:4200');
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    mainWindow.loadFile(
      path.join(__dirname, '../dist/browser/index.html')
    );
  }

  mainWindow.on('closed', () => { mainWindow = null; });
}

app.whenReady().then(() => {
  initDatabase();
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => {
  closeDatabase();
});

// Wraps an IPC handler with try-catch to prevent unhandled exceptions
function safeHandle(channel: string, handler: (...args: any[]) => any): void {
  ipcMain.handle(channel, async (...args) => {
    try {
      return await handler(...args);
    } catch (err) {
      console.error(`[IPC] Error in ${channel}:`, err);
      throw err;
    }
  });
}

// ── Window controls ──────────────────────────────────────────────────────────
safeHandle('window:minimize', () => mainWindow?.minimize());
safeHandle('window:maximize', () => {
  if (mainWindow?.isMaximized()) mainWindow.unmaximize();
  else mainWindow?.maximize();
});
safeHandle('window:close', () => mainWindow?.close());
safeHandle('window:isMaximized', () => mainWindow?.isMaximized() ?? false);

// ── Notes CRUD ───────────────────────────────────────────────────────────────
safeHandle('notes:getAll', () => noteOps.getAll());
safeHandle('notes:getById', (_e, id: number) => noteOps.getById(id) ?? null);
safeHandle('notes:create', (_e, title: string, content: string) =>
  noteOps.create(title, content)
);
safeHandle('notes:update', (_e, id: number, data: { title?: string; content?: string; tags?: string }) =>
  noteOps.update(id, data) ?? null
);
safeHandle('notes:delete', (_e, id: number) => { noteOps.delete(id); return true; });
safeHandle('notes:search', (_e, query: string) => noteOps.search(query));
safeHandle('notes:byTag', (_e, tag: string) => noteOps.getByTag(tag));
safeHandle('notes:allTags', () => noteOps.getAllTags());

// ── Shell ─────────────────────────────────────────────────────────────────────
safeHandle('shell:openExternal', (_e, url: string) => shell.openExternal(url));
