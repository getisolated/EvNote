import { app, BrowserWindow, ipcMain, shell } from 'electron';
import * as path from 'path';
import { initDatabase, noteOps } from './database';

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

// ── Window controls ──────────────────────────────────────────────────────────
ipcMain.handle('window:minimize', () => mainWindow?.minimize());
ipcMain.handle('window:maximize', () => {
  if (mainWindow?.isMaximized()) mainWindow.unmaximize();
  else mainWindow?.maximize();
});
ipcMain.handle('window:close', () => mainWindow?.close());
ipcMain.handle('window:isMaximized', () => mainWindow?.isMaximized() ?? false);

// ── Notes CRUD ───────────────────────────────────────────────────────────────
ipcMain.handle('notes:getAll', () => noteOps.getAll());
ipcMain.handle('notes:getById', (_e, id: number) => noteOps.getById(id) ?? null);
ipcMain.handle('notes:create', (_e, title: string, content: string) =>
  noteOps.create(title, content)
);
ipcMain.handle('notes:update', (_e, id: number, data: { title?: string; content?: string; tags?: string }) =>
  noteOps.update(id, data) ?? null
);
ipcMain.handle('notes:delete', (_e, id: number) => { noteOps.delete(id); return true; });
ipcMain.handle('notes:search', (_e, query: string) => noteOps.search(query));
ipcMain.handle('notes:byTag', (_e, tag: string) => noteOps.getByTag(tag));
ipcMain.handle('notes:allTags', () => noteOps.getAllTags());

// ── Shell ─────────────────────────────────────────────────────────────────────
ipcMain.handle('shell:openExternal', (_e, url: string) => shell.openExternal(url));
