import { contextBridge, ipcRenderer } from 'electron';

const api = {
  // Window controls
  minimize: () => ipcRenderer.invoke('window:minimize'),
  maximize: () => ipcRenderer.invoke('window:maximize'),
  close: () => ipcRenderer.invoke('window:close'),
  isMaximized: () => ipcRenderer.invoke('window:isMaximized'),

  // Notes
  getAllNotes: () => ipcRenderer.invoke('notes:getAll'),
  getNoteById: (id: number) => ipcRenderer.invoke('notes:getById', id),
  createNote: (title: string, content: string) =>
    ipcRenderer.invoke('notes:create', title, content),
  updateNote: (id: number, data: { title?: string; content?: string; tags?: string }) =>
    ipcRenderer.invoke('notes:update', id, data),
  deleteNote: (id: number) => ipcRenderer.invoke('notes:delete', id),
  searchNotes: (query: string) => ipcRenderer.invoke('notes:search', query),
  getNotesByTag: (tag: string) => ipcRenderer.invoke('notes:byTag', tag),
  getAllTags: () => ipcRenderer.invoke('notes:allTags'),

  // Shell
  openExternal: (url: string) => ipcRenderer.invoke('shell:openExternal', url),
};

contextBridge.exposeInMainWorld('electronAPI', api);
