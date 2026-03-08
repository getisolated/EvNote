import Database from 'better-sqlite3';
import * as path from 'path';
import { app } from 'electron';

export interface NoteRow {
  id: number;
  title: string;
  content: string;
  tags: string; // JSON array string
  created_at: string;
  updated_at: string;
}

let db: Database.Database;

export function initDatabase(): void {
  const dbPath = path.join(app.getPath('userData'), 'evnote.db');
  db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  db.exec(`
    CREATE TABLE IF NOT EXISTS notes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL DEFAULT '',
      content TEXT NOT NULL DEFAULT '',
      tags TEXT NOT NULL DEFAULT '[]',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE VIRTUAL TABLE IF NOT EXISTS notes_fts USING fts5(
      title,
      content,
      content=notes,
      content_rowid=id
    );

    CREATE TRIGGER IF NOT EXISTS notes_ai AFTER INSERT ON notes BEGIN
      INSERT INTO notes_fts(rowid, title, content) VALUES (new.id, new.title, new.content);
    END;

    CREATE TRIGGER IF NOT EXISTS notes_ad AFTER DELETE ON notes BEGIN
      INSERT INTO notes_fts(notes_fts, rowid, title, content) VALUES('delete', old.id, old.title, old.content);
    END;

    CREATE TRIGGER IF NOT EXISTS notes_au AFTER UPDATE ON notes BEGIN
      INSERT INTO notes_fts(notes_fts, rowid, title, content) VALUES('delete', old.id, old.title, old.content);
      INSERT INTO notes_fts(rowid, title, content) VALUES (new.id, new.title, new.content);
    END;
  `);
}

export function closeDatabase(): void {
  if (db) {
    db.close();
  }
}

/** Escapes special FTS5 characters so user input is treated as literal text. */
function sanitizeFtsQuery(query: string): string {
  return query
    .trim()
    .split(/\s+/)
    .filter(token => token.length > 0)
    .map(token => `"${token.replace(/"/g, '""')}"`)
    .join(' ');
}

export const noteOps = {
  getAll(): NoteRow[] {
    return db.prepare(`SELECT * FROM notes ORDER BY updated_at DESC`).all() as NoteRow[];
  },

  getById(id: number): NoteRow | undefined {
    return db.prepare(`SELECT * FROM notes WHERE id = ?`).get(id) as NoteRow | undefined;
  },

  create(title: string, content: string): NoteRow {
    const stmt = db.prepare(
      `INSERT INTO notes (title, content, tags) VALUES (?, ?, '[]')`
    );
    const result = stmt.run(title, content);
    return this.getById(result.lastInsertRowid as number)!;
  },

  update(id: number, data: { title?: string; content?: string; tags?: string }): NoteRow | undefined {
    const fields: string[] = [];
    const values: (string | number)[] = [];

    if (data.title !== undefined) { fields.push('title = ?'); values.push(data.title); }
    if (data.content !== undefined) { fields.push('content = ?'); values.push(data.content); }
    if (data.tags !== undefined) { fields.push('tags = ?'); values.push(data.tags); }

    if (fields.length === 0) return this.getById(id);

    fields.push(`updated_at = datetime('now')`);
    values.push(id);

    db.prepare(`UPDATE notes SET ${fields.join(', ')} WHERE id = ?`).run(...values);
    return this.getById(id);
  },

  delete(id: number): void {
    db.prepare(`DELETE FROM notes WHERE id = ?`).run(id);
  },

  search(query: string): NoteRow[] {
    if (!query.trim()) return this.getAll();
    const sanitized = sanitizeFtsQuery(query);
    if (!sanitized) return this.getAll();
    return db.prepare(`
      SELECT notes.* FROM notes
      JOIN notes_fts ON notes.id = notes_fts.rowid
      WHERE notes_fts MATCH ?
      ORDER BY rank
    `).all(sanitized + '*') as NoteRow[];
  },

  getByTag(tag: string): NoteRow[] {
    const sanitizedTag = tag.replace(/"/g, '');
    return db.prepare(`
      SELECT * FROM notes WHERE tags LIKE ? ORDER BY updated_at DESC
    `).all(`%"${sanitizedTag}"%`) as NoteRow[];
  },

  getAllTags(): string[] {
    const rows = db.prepare(`SELECT tags FROM notes`).all() as { tags: string }[];
    const tagSet = new Set<string>();
    for (const row of rows) {
      try {
        const tags: string[] = JSON.parse(row.tags);
        tags.forEach(t => tagSet.add(t));
      } catch { /* skip malformed tags */ }
    }
    return Array.from(tagSet).sort();
  }
};
