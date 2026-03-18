import {
  ViewPlugin, ViewUpdate, EditorView, keymap,
} from '@codemirror/view';
import { StateField, StateEffect, Transaction } from '@codemirror/state';
import { syntaxTree } from '@codemirror/language';
import { Extension } from '@codemirror/state';

// ─── Types ───────────────────────────────────────────────────────────────────

interface NoteItem {
  id: number;
  title: string;
  preview: string;
}

interface NoteLinkMenuState {
  active: boolean;
  bracketFrom: number;   // position of '['
  triggerFrom: number;    // position of ']'
  to: number;             // end of current query text
  query: string;
  selectedIndex: number;
  filteredNotes: NoteItem[];
}

export interface NoteLinkConfig {
  getNotes: () => NoteItem[];
  onOpenNote: (noteId: number, title: string) => void;
  onOpenExternal: (url: string) => void;
}

// ─── State Management ────────────────────────────────────────────────────────

const defaultState: NoteLinkMenuState = {
  active: false, bracketFrom: 0, triggerFrom: 0, to: 0,
  query: '', selectedIndex: 0, filteredNotes: [],
};

const openNoteLinkMenu = StateEffect.define<{ bracketFrom: number; triggerFrom: number; to: number }>();
const closeNoteLinkMenu = StateEffect.define<void>();
const updateNoteLinkQuery = StateEffect.define<{ to: number; query: string; filteredNotes: NoteItem[] }>();
const setNoteLinkIndex = StateEffect.define<number>();

const noteLinkMenuState = StateField.define<NoteLinkMenuState>({
  create: () => defaultState,
  update(state: NoteLinkMenuState, tr: Transaction) {
    let s = state;
    for (const effect of tr.effects) {
      if (effect.is(openNoteLinkMenu)) {
        s = {
          active: true,
          bracketFrom: effect.value.bracketFrom,
          triggerFrom: effect.value.triggerFrom,
          to: effect.value.to,
          query: '',
          selectedIndex: 0,
          filteredNotes: [],
        };
      } else if (effect.is(closeNoteLinkMenu)) {
        s = defaultState;
      } else if (effect.is(updateNoteLinkQuery)) {
        s = {
          ...s,
          to: effect.value.to,
          query: effect.value.query,
          filteredNotes: effect.value.filteredNotes,
          selectedIndex: Math.min(s.selectedIndex, Math.max(0, effect.value.filteredNotes.length - 1)),
        };
      } else if (effect.is(setNoteLinkIndex)) {
        s = { ...s, selectedIndex: effect.value };
      }
    }
    return s;
  },
});

// ─── Menu DOM Widget ─────────────────────────────────────────────────────────

class NoteLinkMenuWidget {
  private dom: HTMLElement | null = null;
  private currentView: EditorView | null = null;

  show(view: EditorView, state: NoteLinkMenuState) {
    this.currentView = view;

    if (!this.dom) {
      this.dom = document.createElement('div');
      this.dom.className = 'cm-notelink-menu';
      this.dom.addEventListener('mousedown', (e) => e.preventDefault());
      document.body.appendChild(this.dom);
    }

    this.render(state);
    this.dom.style.display = 'block';

    requestAnimationFrame(() => this.position(view, state.triggerFrom));
  }

  hide() {
    if (this.dom) {
      this.dom.style.display = 'none';
    }
    this.currentView = null;
  }

  destroy() {
    if (this.dom) {
      this.dom.remove();
      this.dom = null;
    }
  }

  private position(view: EditorView, pos: number) {
    if (!this.dom) return;
    const coords = view.coordsAtPos(pos);
    if (!coords) {
      const rect = view.dom.getBoundingClientRect();
      this.dom.style.top = `${rect.top + 40}px`;
      this.dom.style.left = `${rect.left + 48}px`;
      return;
    }

    let top = coords.bottom + 4;
    let left = coords.left;

    const menuHeight = this.dom.offsetHeight || 300;
    const menuWidth = this.dom.offsetWidth || 280;

    if (top + menuHeight > window.innerHeight) {
      top = coords.top - menuHeight - 4;
    }
    if (left + menuWidth > window.innerWidth) {
      left = window.innerWidth - menuWidth - 8;
    }
    if (left < 0) left = 8;

    this.dom.style.top = `${top}px`;
    this.dom.style.left = `${left}px`;
  }

  private render(state: NoteLinkMenuState) {
    if (!this.dom) return;

    const { filteredNotes, selectedIndex } = state;

    if (filteredNotes.length === 0) {
      this.dom.innerHTML = '<div class="cm-notelink-empty">Aucune note trouvée</div>';
      return;
    }

    let html = '';
    for (let i = 0; i < filteredNotes.length; i++) {
      const note = filteredNotes[i];
      const isSelected = i === selectedIndex;
      html += `<div class="cm-notelink-item${isSelected ? ' cm-notelink-item-selected' : ''}" data-index="${i}">
        <div class="cm-notelink-icon">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
            <polyline points="14 2 14 8 20 8"/>
          </svg>
        </div>
        <div class="cm-notelink-item-content">
          <span class="cm-notelink-title">${this.escapeHtml(note.title)}</span>
          ${note.preview ? `<span class="cm-notelink-preview">${this.escapeHtml(note.preview)}</span>` : ''}
        </div>
      </div>`;
    }

    this.dom.innerHTML = html;

    // Click handlers
    this.dom.querySelectorAll('.cm-notelink-item').forEach((el) => {
      el.addEventListener('mousedown', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const index = parseInt((el as HTMLElement).dataset['index']!);
        this.executeSelection(index);
      });
    });

    // Scroll selected into view
    const selectedEl = this.dom.querySelector('.cm-notelink-item-selected');
    if (selectedEl) {
      selectedEl.scrollIntoView({ block: 'nearest' });
    }
  }

  private executeSelection(index: number) {
    const view = this.currentView;
    if (!view) return;
    const state = view.state.field(noteLinkMenuState);
    const note = state.filteredNotes[index];
    if (!note) return;

    executeNoteLinkSelection(view, state, note);
  }

  private escapeHtml(text: string): string {
    const d = document.createElement('div');
    d.textContent = text;
    return d.innerHTML;
  }
}

// ─── Execute selection ───────────────────────────────────────────────────────

function executeNoteLinkSelection(view: EditorView, state: NoteLinkMenuState, note: NoteItem) {
  const { bracketFrom, triggerFrom } = state;

  // Text between [ and ] (bracketFrom+1 to triggerFrom)
  const textBetweenBrackets = view.state.sliceDoc(bracketFrom + 1, triggerFrom);
  const cursor = view.state.selection.main.head;

  // Build the replacement
  let insert: string;
  let cursorPos: number;

  if (textBetweenBrackets.trim() === '') {
    insert = `[${note.title}](note://${note.id})`;
    cursorPos = bracketFrom + insert.length;
  } else {
    insert = `[${textBetweenBrackets}](note://${note.id})`;
    cursorPos = bracketFrom + insert.length;
  }

  // Find the end of what we need to replace
  // The cursor might be after ]( with some query text, and closeBrackets may have added ')'
  let replaceEnd = cursor;
  // Check if there's a ')' right after cursor (from closeBrackets auto-close)
  if (replaceEnd < view.state.doc.length) {
    const charAfter = view.state.sliceDoc(replaceEnd, replaceEnd + 1);
    if (charAfter === ')') {
      replaceEnd += 1;
    }
  }

  view.dispatch({
    changes: { from: bracketFrom, to: replaceEnd, insert },
    selection: { anchor: cursorPos },
    effects: closeNoteLinkMenu.of(undefined),
  });
  view.focus();
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Search backwards from `pos` on the same line to find a matching '[' */
function findMatchingBracket(doc: { sliceString(from: number, to: number): void; lineAt(pos: number): { from: number } }, state: { sliceDoc(from: number, to: number): string; doc: { lineAt(pos: number): { from: number } } }, pos: number): number {
  const line = state.doc.lineAt(pos);
  let depth = 0;
  for (let i = pos - 1; i >= line.from; i--) {
    const ch = state.sliceDoc(i, i + 1);
    if (ch === ']') depth++;
    else if (ch === '[') {
      if (depth === 0) return i;
      depth--;
    }
  }
  return -1;
}

function isInCodeBlock(state: { sliceDoc(from: number, to: number): string }, pos: number, tree: ReturnType<typeof syntaxTree>): boolean {
  let node = tree.resolveInner(pos, -1);
  while (node.parent) {
    if (node.name === 'FencedCode' || node.name === 'InlineCode') return true;
    node = node.parent;
  }
  return false;
}

// ─── Main Plugin (detects ]( via doc changes instead of inputHandler) ────────

function createPlugin(config: NoteLinkConfig) {
  return ViewPlugin.fromClass(
    class {
      private widget = new NoteLinkMenuWidget();
      private trackTimeout: ReturnType<typeof setTimeout> | null = null;

      constructor(private view: EditorView) {
        this.syncWidget();
      }

      update(update: ViewUpdate) {
        const state = update.state.field(noteLinkMenuState);
        const prevState = update.startState.field(noteLinkMenuState);

        // Sync widget on any state change
        if (state.active !== prevState.active ||
            state.query !== prevState.query ||
            state.selectedIndex !== prevState.selectedIndex ||
            state.filteredNotes !== prevState.filteredNotes) {
          console.log('[NoteLink] State changed:', { active: state.active, query: state.query, notesCount: state.filteredNotes.length });
          this.syncWidget();
        }

        // --- Detect ]( pattern when doc changes and menu is NOT active ---
        if (update.docChanged) {
          console.log('[NoteLink] Doc changed, menu active:', state.active);
        }
        if (!state.active && update.docChanged) {
          this.tryOpenMenu(update);
        }

        // --- Track typing while menu IS active ---
        if (state.active && update.docChanged) {
          this.scheduleTrackQuery(update);
        }

        // --- Close if cursor moves away ---
        if (state.active && update.selectionSet && !update.docChanged) {
          const sel = update.state.selection.main;
          if (state.triggerFrom >= update.state.doc.length) {
            update.view.dispatch({ effects: closeNoteLinkMenu.of(undefined) });
          } else {
            const triggerLine = update.state.doc.lineAt(state.triggerFrom);
            const cursorLine = update.state.doc.lineAt(sel.head);
            if (cursorLine.number !== triggerLine.number || sel.head <= state.triggerFrom) {
              update.view.dispatch({ effects: closeNoteLinkMenu.of(undefined) });
            }
          }
        }
      }

      destroy() {
        this.widget.destroy();
        if (this.trackTimeout) clearTimeout(this.trackTimeout);
      }

      private tryOpenMenu(update: ViewUpdate) {
        const view = update.view;
        const sel = update.state.selection.main;
        const head = sel.head;

        if (head < 2) {
          console.log('[NoteLink] tryOpenMenu: head < 2, skip');
          return;
        }

        // Show surrounding text for context
        const contextStart = Math.max(0, head - 10);
        const contextEnd = Math.min(update.state.doc.length, head + 5);
        const context = update.state.sliceDoc(contextStart, contextEnd);
        const twoBefore = update.state.sliceDoc(head - 2, head);
        console.log('[NoteLink] tryOpenMenu: head=', head, 'twoBefore="' + twoBefore + '"', 'context="' + context + '"', 'cursorAt=^' + (head - contextStart));

        if (twoBefore !== '](') {
          // Also check one position earlier in case closeBrackets put cursor between ()
          if (head >= 3) {
            const threeBefore = update.state.sliceDoc(head - 3, head);
            console.log('[NoteLink] tryOpenMenu: threeBefore="' + threeBefore + '"');
          }
          return;
        }

        // Check we're not in a code block
        if (isInCodeBlock(update.state, head, syntaxTree(update.state))) {
          console.log('[NoteLink] tryOpenMenu: inside code block, skip');
          return;
        }

        // Find the matching '['
        const bracketClose = head - 2; // position of ']'
        const line = update.state.doc.lineAt(bracketClose);
        let bracketOpen = -1;
        let depth = 0;

        for (let i = bracketClose - 1; i >= line.from; i--) {
          const ch = update.state.sliceDoc(i, i + 1);
          if (ch === ']') depth++;
          else if (ch === '[') {
            if (depth === 0) {
              bracketOpen = i;
              break;
            }
            depth--;
          }
        }

        console.log('[NoteLink] tryOpenMenu: bracketOpen=', bracketOpen, 'bracketClose=', bracketClose);
        if (bracketOpen < 0) {
          console.log('[NoteLink] tryOpenMenu: no matching [ found');
          return;
        }

        console.log('[NoteLink] tryOpenMenu: OPENING MENU, bracket range:', bracketOpen, '-', bracketClose);

        // Schedule to avoid dispatching during update
        setTimeout(() => {
          const currentState = view.state.field(noteLinkMenuState);
          if (currentState.active) {
            console.log('[NoteLink] setTimeout: already active, skip');
            return;
          }

          const notes = config.getNotes();
          console.log('[NoteLink] setTimeout: opening with', notes.length, 'notes available');

          view.dispatch({
            effects: [
              openNoteLinkMenu.of({
                bracketFrom: bracketOpen,
                triggerFrom: bracketClose,
                to: view.state.selection.main.head,
              }),
              updateNoteLinkQuery.of({
                to: view.state.selection.main.head,
                query: '',
                filteredNotes: notes.slice(0, 50),
              }),
            ],
          });
          console.log('[NoteLink] setTimeout: dispatch done');
        }, 0);
      }

      private syncWidget() {
        const state = this.view.state.field(noteLinkMenuState);
        if (state.active && state.filteredNotes.length > 0) {
          this.widget.show(this.view, state);
        } else {
          this.widget.hide();
        }
      }

      private scheduleTrackQuery(update: ViewUpdate) {
        if (this.trackTimeout) clearTimeout(this.trackTimeout);
        const view = update.view;
        this.trackTimeout = setTimeout(() => {
          this.trackTimeout = null;
          const state = view.state.field(noteLinkMenuState);
          if (!state.active) return;

          const cursor = view.state.selection.main.head;
          // triggerFrom is ']', so '(' is at triggerFrom+1
          // query text starts at triggerFrom+2
          const queryStart = state.triggerFrom + 2;
          if (queryStart > cursor) {
            view.dispatch({ effects: closeNoteLinkMenu.of(undefined) });
            return;
          }

          const query = view.state.sliceDoc(queryStart, cursor);

          // Close if user typed ')' — they finished manually
          if (query.includes(')')) {
            view.dispatch({ effects: closeNoteLinkMenu.of(undefined) });
            return;
          }

          const allNotes = config.getNotes();
          let filtered: NoteItem[];
          if (!query) {
            filtered = allNotes.slice(0, 50);
          } else {
            const q = query.toLowerCase();
            filtered = allNotes
              .filter(n => n.title.toLowerCase().includes(q) || n.preview.toLowerCase().includes(q))
              .slice(0, 50);
          }

          view.dispatch({
            effects: updateNoteLinkQuery.of({
              to: cursor,
              query,
              filteredNotes: filtered,
            }),
          });
        }, 0);
      }
    }
  );
}

// ─── Keymap ──────────────────────────────────────────────────────────────────

function createKeymap(_config: NoteLinkConfig) {
  return keymap.of([
    {
      key: 'ArrowDown',
      run(view: EditorView) {
        const state = view.state.field(noteLinkMenuState);
        if (!state.active) return false;
        const next = Math.min(state.selectedIndex + 1, state.filteredNotes.length - 1);
        view.dispatch({ effects: setNoteLinkIndex.of(next) });
        return true;
      },
    },
    {
      key: 'ArrowUp',
      run(view: EditorView) {
        const state = view.state.field(noteLinkMenuState);
        if (!state.active) return false;
        const prev = Math.max(state.selectedIndex - 1, 0);
        view.dispatch({ effects: setNoteLinkIndex.of(prev) });
        return true;
      },
    },
    {
      key: 'Enter',
      run(view: EditorView) {
        const state = view.state.field(noteLinkMenuState);
        if (!state.active) return false;
        const note = state.filteredNotes[state.selectedIndex];
        if (note) {
          executeNoteLinkSelection(view, state, note);
        }
        return true;
      },
    },
    {
      key: 'Tab',
      run(view: EditorView) {
        const state = view.state.field(noteLinkMenuState);
        if (!state.active) return false;
        const note = state.filteredNotes[state.selectedIndex];
        if (note) {
          executeNoteLinkSelection(view, state, note);
        }
        return true;
      },
    },
    {
      key: 'Escape',
      run(view: EditorView) {
        const state = view.state.field(noteLinkMenuState);
        if (!state.active) return false;
        view.dispatch({ effects: closeNoteLinkMenu.of(undefined) });
        return true;
      },
    },
  ]);
}

// ─── Ctrl key tracking (toggle pointer cursor) ─────────────────────────────

function createCtrlTracker() {
  return EditorView.domEventHandlers({
    mousemove(event: MouseEvent, view: EditorView) {
      const has = view.dom.classList.contains('cm-ctrl-held');
      if (event.ctrlKey && !has) {
        view.dom.classList.add('cm-ctrl-held');
      } else if (!event.ctrlKey && has) {
        view.dom.classList.remove('cm-ctrl-held');
      }
      return false;
    },
    mouseleave(_event: MouseEvent, view: EditorView) {
      view.dom.classList.remove('cm-ctrl-held');
      return false;
    },
  });
}

// ─── Ctrl+Click handler ─────────────────────────────────────────────────────

function createClickHandler(config: NoteLinkConfig) {
  return EditorView.domEventHandlers({
    mousedown(event: MouseEvent, view: EditorView) {
      if (!event.ctrlKey) return false;

      const pos = view.posAtCoords({ x: event.clientX, y: event.clientY });
      if (pos === null) return false;

      // Walk the syntax tree to find a Link node at this position
      const tree = syntaxTree(view.state);
      let linkNode = tree.resolveInner(pos, 0);

      // Walk up to find a Link parent
      while (linkNode && linkNode.name !== 'Link') {
        if (!linkNode.parent) break;
        linkNode = linkNode.parent;
      }

      if (linkNode.name !== 'Link') return false;

      // Extract URL from the link node text
      const linkText = view.state.sliceDoc(linkNode.from, linkNode.to);
      const urlMatch = linkText.match(/\]\((.+?)\)/);
      if (!urlMatch) return false;

      const url = urlMatch[1];

      event.preventDefault();

      // note:// links → open note in new tab
      const noteMatch = url.match(/^note:\/\/(\d+)$/);
      if (noteMatch) {
        const noteId = parseInt(noteMatch[1], 10);
        const titleMatch = linkText.match(/^\[([^\]]*)\]/);
        const title = titleMatch ? titleMatch[1] : 'Untitled';
        config.onOpenNote(noteId, title);
      } else {
        // External links → open in browser
        config.onOpenExternal(url);
      }

      return true;
    },
  });
}

// ─── Export factory ──────────────────────────────────────────────────────────

export function noteLinkExtensions(config: NoteLinkConfig): Extension[] {
  return [
    noteLinkMenuState,
    createKeymap(config),
    createPlugin(config),
    createCtrlTracker(),
    createClickHandler(config),
  ];
}
