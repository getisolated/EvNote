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

export interface BacklinkRow {
  id: number;
  title: string;
  preview: string;
}

let db: Database.Database;

// Cached prepared statements (initialized after DB open)
let stmts: {
  getAll: Database.Statement;
  getById: Database.Statement;
  create: Database.Statement;
  delete: Database.Statement;
  search: Database.Statement;
  getByTag: Database.Statement;
  getAllTags: Database.Statement;
  // Links
  deleteLinksFrom: Database.Statement;
  insertLink: Database.Statement;
  getBacklinks: Database.Statement;
  findByTitleCI: Database.Statement;
  // Rename refactoring
  allNotesIdContent: Database.Statement;
};

/** Regex to extract [[...]] links from content. */
const WIKILINK_RE = /\[\[([^\]]+)\]\]/g;

/** Extract all [[...]] link targets from a string. */
function extractWikilinks(content: string): string[] {
  const targets: string[] = [];
  let m: RegExpExecArray | null;
  WIKILINK_RE.lastIndex = 0;
  while ((m = WIKILINK_RE.exec(content)) !== null) {
    const target = m[1].trim();
    if (target.length > 0) targets.push(target);
  }
  return targets;
}

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

    CREATE TABLE IF NOT EXISTS links (
      source_id INTEGER NOT NULL,
      target_id INTEGER NOT NULL,
      PRIMARY KEY (source_id, target_id),
      FOREIGN KEY (source_id) REFERENCES notes(id) ON DELETE CASCADE,
      FOREIGN KEY (target_id) REFERENCES notes(id) ON DELETE CASCADE
    );
  `);

  // Cache prepared statements after schema is ready
  stmts = {
    getAll: db.prepare('SELECT * FROM notes ORDER BY updated_at DESC'),
    getById: db.prepare('SELECT * FROM notes WHERE id = ?'),
    create: db.prepare("INSERT INTO notes (title, content, tags) VALUES (?, ?, '[]')"),
    delete: db.prepare('DELETE FROM notes WHERE id = ?'),
    search: db.prepare(`
      SELECT notes.* FROM notes
      JOIN notes_fts ON notes.id = notes_fts.rowid
      WHERE notes_fts MATCH ?
      ORDER BY rank
    `),
    getByTag: db.prepare("SELECT * FROM notes WHERE tags LIKE ? ESCAPE '\\' ORDER BY updated_at DESC"),
    getAllTags: db.prepare('SELECT tags FROM notes'),

    // Links
    deleteLinksFrom: db.prepare('DELETE FROM links WHERE source_id = ?'),
    insertLink: db.prepare('INSERT OR IGNORE INTO links (source_id, target_id) VALUES (?, ?)'),
    getBacklinks: db.prepare(`
      SELECT n.id, n.title, substr(n.content, 1, 200) AS preview
      FROM links l
      JOIN notes n ON n.id = l.source_id
      WHERE l.target_id = ?
      ORDER BY n.updated_at DESC
    `),
    findByTitleCI: db.prepare('SELECT id FROM notes WHERE title = ? COLLATE NOCASE'),

    // For rename refactoring
    allNotesIdContent: db.prepare('SELECT id, content FROM notes'),
  };
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

/** Escapes LIKE wildcards so user input is treated as literal text. */
function escapeLike(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/%/g, '\\%')
    .replace(/_/g, '\\_');
}

/**
 * Rebuild the links table for a given source note.
 * Parses [[...]] in content, resolves targets by title (case-insensitive),
 * and inserts rows into the links table.
 */
function syncLinks(sourceId: number, content: string): void {
  stmts.deleteLinksFrom.run(sourceId);
  const targets = extractWikilinks(content);
  for (const target of targets) {
    const row = stmts.findByTitleCI.get(target) as { id: number } | undefined;
    if (row && row.id !== sourceId) {
      stmts.insertLink.run(sourceId, row.id);
    }
  }
}

/**
 * When a note title changes from oldTitle → newTitle,
 * find all notes that reference [[oldTitle]] and replace with [[newTitle]].
 * Returns the IDs of notes whose content was modified.
 */
function refactorLinks(oldTitle: string, newTitle: string): number[] {
  if (!oldTitle || oldTitle === newTitle) return [];

  // Build a case-insensitive regex to find [[oldTitle]]
  const escaped = oldTitle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`\\[\\[${escaped}\\]\\]`, 'gi');

  const rows = stmts.allNotesIdContent.all() as { id: number; content: string }[];
  const modified: number[] = [];

  for (const row of rows) {
    if (!re.test(row.content)) continue;
    re.lastIndex = 0;
    const updated = row.content.replace(re, `[[${newTitle}]]`);
    db.prepare('UPDATE notes SET content = ? WHERE id = ?').run(updated, row.id);
    modified.push(row.id);
  }

  return modified;
}

export const noteOps = {
  getAll(): NoteRow[] {
    return stmts.getAll.all() as NoteRow[];
  },

  getById(id: number): NoteRow | undefined {
    return stmts.getById.get(id) as NoteRow | undefined;
  },

  create(title: string, content: string): NoteRow {
    const result = stmts.create.run(title, content);
    const id = result.lastInsertRowid as number;
    if (content) syncLinks(id, content);
    return this.getById(id)!;
  },

  update(id: number, data: { title?: string; content?: string; tags?: string }): NoteRow | undefined {
    // If title changed, refactor [[links]] in other notes first
    let refactored: number[] = [];
    if (data.title !== undefined) {
      const current = this.getById(id);
      if (current && current.title !== data.title) {
        refactored = refactorLinks(current.title, data.title);
      }
    }

    const fields: string[] = [];
    const values: (string | number)[] = [];

    if (data.title !== undefined) { fields.push('title = ?'); values.push(data.title); }
    if (data.content !== undefined) { fields.push('content = ?'); values.push(data.content); }
    if (data.tags !== undefined) { fields.push('tags = ?'); values.push(data.tags); }

    if (fields.length === 0) return this.getById(id);

    fields.push("updated_at = datetime('now')");
    values.push(id);

    db.prepare(`UPDATE notes SET ${fields.join(', ')} WHERE id = ?`).run(...values);

    // Rebuild links for the updated note
    const updatedNote = this.getById(id);
    if (updatedNote) {
      syncLinks(id, updatedNote.content);
    }

    // Also rebuild links for notes that were refactored (their content changed)
    for (const refId of refactored) {
      const refNote = this.getById(refId);
      if (refNote) syncLinks(refId, refNote.content);
    }

    return updatedNote;
  },

  delete(id: number): void {
    stmts.delete.run(id);
    // CASCADE handles link cleanup
  },

  search(query: string): NoteRow[] {
    if (!query.trim()) return this.getAll();
    const sanitized = sanitizeFtsQuery(query);
    if (!sanitized) return this.getAll();
    return stmts.search.all(sanitized + '*') as NoteRow[];
  },

  getByTag(tag: string): NoteRow[] {
    const escaped = escapeLike(tag.replace(/"/g, ''));
    return stmts.getByTag.all(`%"${escaped}"%`) as NoteRow[];
  },

  getAllTags(): string[] {
    const rows = stmts.getAllTags.all() as { tags: string }[];
    const tagSet = new Set<string>();
    for (const row of rows) {
      try {
        const tags: string[] = JSON.parse(row.tags);
        tags.forEach(t => tagSet.add(t));
      } catch { /* skip malformed tags */ }
    }
    return Array.from(tagSet).sort();
  },

  getBacklinks(noteId: number): BacklinkRow[] {
    return stmts.getBacklinks.all(noteId) as BacklinkRow[];
  },

  /** Find a note by exact title (case-insensitive). Returns id or null. */
  findByTitle(title: string): number | null {
    const row = stmts.findByTitleCI.get(title) as { id: number } | undefined;
    return row?.id ?? null;
  },

  /**
   * Rebuild all links from scratch (useful for migration / first launch).
   */
  rebuildAllLinks(): void {
    db.exec('DELETE FROM links');
    const rows = stmts.allNotesIdContent.all() as { id: number; content: string }[];
    for (const row of rows) {
      syncLinks(row.id, row.content);
    }
  }
};
