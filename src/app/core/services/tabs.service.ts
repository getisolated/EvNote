import { Injectable, signal, computed } from '@angular/core';
import { Tab } from '../models/note.model';

const SESSION_KEY = 'evnote-session';

@Injectable({ providedIn: 'root' })
export class TabsService {
  private readonly _tabs = signal<Tab[]>([]);
  private readonly _activeIndex = signal<number>(-1);
  private _initialized = false;

  readonly tabs = this._tabs.asReadonly();
  readonly activeIndex = this._activeIndex.asReadonly();

  readonly activeTab = computed<Tab | null>(() => {
    const idx = this._activeIndex();
    const tabs = this._tabs();
    return idx >= 0 && idx < tabs.length ? tabs[idx] : null;
  });

  readonly activeNoteId = computed<number | null>(() => {
    return this.activeTab()?.noteId ?? null;
  });

  // ── Session persistence ────────────────────────────────────────────────────

  /** Call after notes are loaded. Restores open tabs from localStorage. */
  restoreSession(validNoteIds: Set<number>): void {
    try {
      const raw = localStorage.getItem(SESSION_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as { tabs: Tab[]; activeIndex: number };
        const validTabs = parsed.tabs.filter(t => validNoteIds.has(t.noteId));
        if (validTabs.length > 0) {
          this._tabs.set(validTabs);
          const clamped = Math.min(Math.max(parsed.activeIndex, -1), validTabs.length - 1);
          this._activeIndex.set(clamped);
        }
      }
    } catch { /* ignore corrupt storage */ }
    this._initialized = true;
  }

  private persist(): void {
    if (!this._initialized) return;
    localStorage.setItem(SESSION_KEY, JSON.stringify({
      tabs: this._tabs(),
      activeIndex: this._activeIndex(),
    }));
  }

  // ── Navigation ─────────────────────────────────────────────────────────────

  goHome(): void {
    this._activeIndex.set(-1);
    this.persist();
  }

  openNote(noteId: number, title: string): void {
    const existing = this._tabs().findIndex(t => t.noteId === noteId);
    if (existing >= 0) {
      this._activeIndex.set(existing);
    } else {
      this._tabs.update(tabs => [...tabs, { noteId, title, isDirty: false }]);
      this._activeIndex.set(this._tabs().length - 1);
    }
    this.persist();
  }

  closeTab(index: number): void {
    const tabs = this._tabs();
    if (index < 0 || index >= tabs.length) return;

    this._tabs.update(t => t.filter((_, i) => i !== index));

    const newTabs = this._tabs();
    if (newTabs.length === 0) {
      this._activeIndex.set(-1);
    } else {
      const currentActive = this._activeIndex();
      if (index < currentActive) {
        this._activeIndex.set(currentActive - 1);
      } else if (index === currentActive) {
        this._activeIndex.set(Math.min(index, newTabs.length - 1));
      }
    }
    this.persist();
  }

  closeActiveTab(): void {
    this.closeTab(this._activeIndex());
  }

  closeByNoteId(noteId: number): void {
    const idx = this._tabs().findIndex(t => t.noteId === noteId);
    if (idx >= 0) this.closeTab(idx);
  }

  nextTab(): void {
    const len = this._tabs().length;
    if (len === 0) return;
    this._activeIndex.update(i => (i + 1) % len);
    this.persist();
  }

  prevTab(): void {
    const len = this._tabs().length;
    if (len === 0) return;
    this._activeIndex.update(i => (i - 1 + len) % len);
    this.persist();
  }

  setActiveIndex(index: number): void {
    if (index >= 0 && index < this._tabs().length) {
      this._activeIndex.set(index);
      this.persist();
    }
  }

  markDirty(noteId: number, dirty: boolean): void {
    this._tabs.update(tabs =>
      tabs.map(t => t.noteId === noteId ? { ...t, isDirty: dirty } : t)
    );
  }

  updateTitle(noteId: number, title: string): void {
    this._tabs.update(tabs =>
      tabs.map(t => t.noteId === noteId ? { ...t, title } : t)
    );
    this.persist();
  }
}
