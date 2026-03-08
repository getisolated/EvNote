"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron"); console.log("[DEBUG]", typeof electron_1, JSON.stringify(electron_1)?.slice?.(0,100) ?? String(electron_1).slice(0,100));
const path = __importStar(require("path"));
const database_1 = require("./database");
const isDev = process.env['NODE_ENV'] === 'development';
let mainWindow = null;
function createWindow() {
    mainWindow = new electron_1.BrowserWindow({
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
    }
    else {
        mainWindow.loadFile(path.join(__dirname, '../dist/browser/index.html'));
    }
    mainWindow.on('closed', () => { mainWindow = null; });
}
electron_1.app.whenReady().then(() => {
    (0, database_1.initDatabase)();
    createWindow();
    electron_1.app.on('activate', () => {
        if (electron_1.BrowserWindow.getAllWindows().length === 0)
            createWindow();
    });
});
electron_1.app.on('window-all-closed', () => {
    if (process.platform !== 'darwin')
        electron_1.app.quit();
});
// ── Window controls ──────────────────────────────────────────────────────────
electron_1.ipcMain.handle('window:minimize', () => mainWindow?.minimize());
electron_1.ipcMain.handle('window:maximize', () => {
    if (mainWindow?.isMaximized())
        mainWindow.unmaximize();
    else
        mainWindow?.maximize();
});
electron_1.ipcMain.handle('window:close', () => mainWindow?.close());
electron_1.ipcMain.handle('window:isMaximized', () => mainWindow?.isMaximized() ?? false);
// ── Notes CRUD ───────────────────────────────────────────────────────────────
electron_1.ipcMain.handle('notes:getAll', () => database_1.noteOps.getAll());
electron_1.ipcMain.handle('notes:getById', (_e, id) => database_1.noteOps.getById(id) ?? null);
electron_1.ipcMain.handle('notes:create', (_e, title, content) => database_1.noteOps.create(title, content));
electron_1.ipcMain.handle('notes:update', (_e, id, data) => database_1.noteOps.update(id, data) ?? null);
electron_1.ipcMain.handle('notes:delete', (_e, id) => { database_1.noteOps.delete(id); return true; });
electron_1.ipcMain.handle('notes:search', (_e, query) => database_1.noteOps.search(query));
electron_1.ipcMain.handle('notes:byTag', (_e, tag) => database_1.noteOps.getByTag(tag));
electron_1.ipcMain.handle('notes:allTags', () => database_1.noteOps.getAllTags());
// ── Shell ─────────────────────────────────────────────────────────────────────
electron_1.ipcMain.handle('shell:openExternal', (_e, url) => electron_1.shell.openExternal(url));
