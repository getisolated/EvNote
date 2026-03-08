import { Injectable } from '@angular/core';
import { Note } from '../models/note.model';

interface ElectronAPI {
  minimize: () => Promise<void>;
  maximize: () => Promise<void>;
  close: () => Promise<void>;
  isMaximized: () => Promise<boolean>;
  getAllNotes: () => Promise<Note[]>;
  getNoteById: (id: number) => Promise<Note | null>;
  createNote: (title: string, content: string) => Promise<Note>;
  updateNote: (id: number, data: { title?: string; content?: string; tags?: string }) => Promise<Note | null>;
  deleteNote: (id: number) => Promise<boolean>;
  searchNotes: (query: string) => Promise<Note[]>;
  getNotesByTag: (tag: string) => Promise<Note[]>;
  getAllTags: () => Promise<string[]>;
  openExternal: (url: string) => Promise<void>;
}

function mapRow(row: any): Note {
  return {
    id: row.id,
    title: row.title,
    content: row.content,
    tags: typeof row.tags === 'string' ? JSON.parse(row.tags) : (row.tags ?? []),
    createdAt: row.created_at ?? row.createdAt ?? '',
    updatedAt: row.updated_at ?? row.updatedAt ?? '',
  };
}

@Injectable({ providedIn: 'root' })
export class ElectronBridgeService {
  private readonly isElectron = !!(window as any)['electronAPI'];
  private readonly api: ElectronAPI | null = (window as any)['electronAPI'] ?? null;

  get inElectron(): boolean { return this.isElectron; }

  // Window
  minimize(): Promise<void> { return this.api?.minimize() ?? Promise.resolve(); }
  maximize(): Promise<void> { return this.api?.maximize() ?? Promise.resolve(); }
  close(): Promise<void> { return this.api?.close() ?? Promise.resolve(); }
  isMaximized(): Promise<boolean> { return this.api?.isMaximized() ?? Promise.resolve(false); }

  // Notes
  async getAllNotes(): Promise<Note[]> {
    if (!this.api) return [];
    const rows = await this.api.getAllNotes();
    return rows.map(mapRow);
  }

  async getNoteById(id: number): Promise<Note | null> {
    if (!this.api) return null;
    const row = await this.api.getNoteById(id);
    return row ? mapRow(row) : null;
  }

  async createNote(title: string, content: string): Promise<Note> {
    if (!this.api) throw new Error('Not in Electron');
    const row = await this.api.createNote(title, content);
    return mapRow(row);
  }

  async updateNote(id: number, data: { title?: string; content?: string; tags?: string[] }): Promise<Note | null> {
    if (!this.api) return null;
    const payload = {
      ...data,
      tags: data.tags !== undefined ? JSON.stringify(data.tags) : undefined,
    };
    const row = await this.api.updateNote(id, payload);
    return row ? mapRow(row) : null;
  }

  async deleteNote(id: number): Promise<boolean> {
    if (!this.api) return false;
    return this.api.deleteNote(id);
  }

  async searchNotes(query: string): Promise<Note[]> {
    if (!this.api) return [];
    const rows = await this.api.searchNotes(query);
    return rows.map(mapRow);
  }

  async getNotesByTag(tag: string): Promise<Note[]> {
    if (!this.api) return [];
    const rows = await this.api.getNotesByTag(tag);
    return rows.map(mapRow);
  }

  async getAllTags(): Promise<string[]> {
    if (!this.api) return [];
    return this.api.getAllTags();
  }
}
