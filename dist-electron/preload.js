"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
const api = {
    // Window controls
    minimize: () => electron_1.ipcRenderer.invoke('window:minimize'),
    maximize: () => electron_1.ipcRenderer.invoke('window:maximize'),
    close: () => electron_1.ipcRenderer.invoke('window:close'),
    isMaximized: () => electron_1.ipcRenderer.invoke('window:isMaximized'),
    // Notes
    getAllNotes: () => electron_1.ipcRenderer.invoke('notes:getAll'),
    getNoteById: (id) => electron_1.ipcRenderer.invoke('notes:getById', id),
    createNote: (title, content) => electron_1.ipcRenderer.invoke('notes:create', title, content),
    updateNote: (id, data) => electron_1.ipcRenderer.invoke('notes:update', id, data),
    deleteNote: (id) => electron_1.ipcRenderer.invoke('notes:delete', id),
    searchNotes: (query) => electron_1.ipcRenderer.invoke('notes:search', query),
    getNotesByTag: (tag) => electron_1.ipcRenderer.invoke('notes:byTag', tag),
    getAllTags: () => electron_1.ipcRenderer.invoke('notes:allTags'),
    // Shell
    openExternal: (url) => electron_1.ipcRenderer.invoke('shell:openExternal', url),
};
electron_1.contextBridge.exposeInMainWorld('electronAPI', api);
