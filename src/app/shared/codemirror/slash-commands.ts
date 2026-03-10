import {
  ViewPlugin, ViewUpdate, EditorView, WidgetType, Decoration, DecorationSet,
  keymap,
} from '@codemirror/view';
import { StateField, StateEffect, EditorState, Transaction } from '@codemirror/state';
import { syntaxTree } from '@codemirror/language';

// ─── Slash Command Definitions ───────────────────────────────────────────────

export interface SlashCommand {
  id: string;
  label: string;
  group: string;
  icon: string;       // SVG path(s) for 24x24 viewBox
  description: string;
  execute: (view: EditorView, range: { from: number; to: number }) => void;
}

// Returns true if cursor is inside a fenced code block
function isInCodeBlock(state: EditorState, pos: number): boolean {
  let node = syntaxTree(state).resolveInner(pos, -1);
  while (node.parent) {
    if (node.name === 'FencedCode' || node.name === 'InlineCode') return true;
    node = node.parent;
  }
  return false;
}

/** Replaces `/query` with a line prefix (heading, list, quote, etc.) */
function insertLinePrefix(view: EditorView, range: { from: number; to: number }, prefix: string) {
  const line = view.state.doc.lineAt(range.from);
  // Remove existing line prefixes (headings, list markers, blockquotes)
  const stripped = line.text.replace(/^(\s*)(?:#{1,6}\s+|[-*+]\s+|\d+\.\s+|>\s+)?/, '$1');
  // Replace the entire line with prefix + stripped content (minus the /query part)
  const slashContent = view.state.sliceDoc(range.from, range.to);
  const contentAfterSlash = stripped.replace(slashContent, '').trimEnd();
  const newText = prefix + contentAfterSlash;
  view.dispatch({
    changes: { from: line.from, to: line.to, insert: newText },
    selection: { anchor: line.from + newText.length },
  });
  view.focus();
}

/** Wraps selection or inserts placeholder with wrap markers */
function insertWrap(view: EditorView, range: { from: number; to: number }, before: string, after: string, placeholder: string) {
  const insert = `${before}${placeholder}${after}`;
  view.dispatch({
    changes: { from: range.from, to: range.to, insert },
    selection: { anchor: range.from + before.length, head: range.from + before.length + placeholder.length },
  });
  view.focus();
}

/** Inserts a code block */
function insertCodeBlock(view: EditorView, range: { from: number; to: number }) {
  const line = view.state.doc.lineAt(range.from);
  const insert = '```\n\n```';
  view.dispatch({
    changes: { from: line.from, to: line.to, insert },
    selection: { anchor: line.from + 4 },
  });
  view.focus();
}

/** Inserts a horizontal rule */
function insertHorizontalRule(view: EditorView, range: { from: number; to: number }) {
  const line = view.state.doc.lineAt(range.from);
  const insert = '---\n';
  view.dispatch({
    changes: { from: line.from, to: line.to, insert },
    selection: { anchor: line.from + insert.length },
  });
  view.focus();
}

// SVG icon paths (24x24 viewBox)
const ICONS = {
  paragraph: '<path d="M13 4a4 4 0 0 1 0 8H7v8m6-16v16m4-16v16" stroke="currentColor" stroke-width="1.8" fill="none" stroke-linecap="round" stroke-linejoin="round"/>',
  h1: '<path d="M4 12h6M4 6v12M10 6v12" stroke="currentColor" stroke-width="1.8" fill="none" stroke-linecap="round"/><text x="15" y="18" font-size="12" font-weight="700" fill="currentColor">1</text>',
  h2: '<path d="M4 12h6M4 6v12M10 6v12" stroke="currentColor" stroke-width="1.8" fill="none" stroke-linecap="round"/><text x="15" y="18" font-size="12" font-weight="700" fill="currentColor">2</text>',
  h3: '<path d="M4 12h6M4 6v12M10 6v12" stroke="currentColor" stroke-width="1.8" fill="none" stroke-linecap="round"/><text x="15" y="18" font-size="12" font-weight="700" fill="currentColor">3</text>',
  h4: '<path d="M4 12h6M4 6v12M10 6v12" stroke="currentColor" stroke-width="1.8" fill="none" stroke-linecap="round"/><text x="15" y="18" font-size="12" font-weight="700" fill="currentColor">4</text>',
  bulletList: '<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" stroke="currentColor" stroke-width="1.8" fill="none" stroke-linecap="round" stroke-linejoin="round"/>',
  orderedList: '<path d="M10 6h11M10 12h11M10 18h11" stroke="currentColor" stroke-width="1.8" fill="none" stroke-linecap="round"/><text x="1" y="8" font-size="9" fill="currentColor">1.</text><text x="1" y="14" font-size="9" fill="currentColor">2.</text><text x="1" y="20" font-size="9" fill="currentColor">3.</text>',
  quote: '<path d="M3 21c3 0 7-1 7-8V5c0-1.25-.756-2.017-2-2H4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2 1 0 1 0 1 1v1c0 1-1 2-2 2s-1 .008-1 1.031V21z" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M15 21c3 0 7-1 7-8V5c0-1.25-.757-2.017-2-2h-4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2h.75c0 2.25.25 4-2.75 4v3c0 .001 0 1.003 1 1.003z" fill="none" stroke="currentColor" stroke-width="1.5"/>',
  codeBlock: '<polyline points="16 18 22 12 16 6" stroke="currentColor" stroke-width="1.8" fill="none" stroke-linecap="round" stroke-linejoin="round"/><polyline points="8 6 2 12 8 18" stroke="currentColor" stroke-width="1.8" fill="none" stroke-linecap="round" stroke-linejoin="round"/>',
  bold: '<path d="M6 4h8a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6zM6 12h9a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>',
  italic: '<line x1="19" y1="4" x2="10" y2="4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><line x1="14" y1="20" x2="5" y2="20" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><line x1="15" y1="4" x2="9" y2="20" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>',
  strikethrough: '<path d="M16 4a4 4 0 0 0-4.37-.37 4.95 4.95 0 0 0-3.39 2.87M4 12h16M12 12c5 0 5 8-1 8a3.5 3.5 0 0 1-3.5-3.5" stroke="currentColor" stroke-width="1.8" fill="none" stroke-linecap="round" stroke-linejoin="round"/>',
  code: '<path d="M16 18l6-6-6-6M8 6l-6 6 6 6" stroke="currentColor" stroke-width="1.8" fill="none" stroke-linecap="round" stroke-linejoin="round"/>',
  hr: '<path d="M3 12h18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><circle cx="6" cy="12" r="1" fill="currentColor"/><circle cx="12" cy="12" r="1" fill="currentColor"/><circle cx="18" cy="12" r="1" fill="currentColor"/>',
  taskList: '<rect x="3" y="5" width="6" height="6" rx="1" stroke="currentColor" stroke-width="1.8" fill="none"/><path d="M3.5 14.5h5v5h-5z" stroke="currentColor" stroke-width="1.8" fill="none" rx="1"/><path d="M11 8h10M11 17h10" stroke="currentColor" stroke-width="1.8" fill="none" stroke-linecap="round"/><path d="M4.5 8l1.5 1.5 3-3" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>',
};

export const slashCommands: SlashCommand[] = [
  // ── Style ──
  {
    id: 'paragraph', label: 'Paragraphe', group: 'Style', icon: ICONS.paragraph,
    description: 'Texte normal',
    execute: (view, range) => insertLinePrefix(view, range, ''),
  },
  {
    id: 'h1', label: 'Titre 1', group: 'Style', icon: ICONS.h1,
    description: 'Titre principal',
    execute: (view, range) => insertLinePrefix(view, range, '# '),
  },
  {
    id: 'h2', label: 'Titre 2', group: 'Style', icon: ICONS.h2,
    description: 'Sous-titre',
    execute: (view, range) => insertLinePrefix(view, range, '## '),
  },
  {
    id: 'h3', label: 'Titre 3', group: 'Style', icon: ICONS.h3,
    description: 'Sous-section',
    execute: (view, range) => insertLinePrefix(view, range, '### '),
  },
  {
    id: 'h4', label: 'Titre 4', group: 'Style', icon: ICONS.h4,
    description: 'Sous-sous-section',
    execute: (view, range) => insertLinePrefix(view, range, '#### '),
  },
  {
    id: 'bulletList', label: 'Liste à puces', group: 'Style', icon: ICONS.bulletList,
    description: 'Liste non ordonnée',
    execute: (view, range) => insertLinePrefix(view, range, '- '),
  },
  {
    id: 'orderedList', label: 'Liste numérotée', group: 'Style', icon: ICONS.orderedList,
    description: 'Liste ordonnée',
    execute: (view, range) => insertLinePrefix(view, range, '1. '),
  },
  {
    id: 'taskList', label: 'Liste de tâches', group: 'Style', icon: ICONS.taskList,
    description: 'Case à cocher',
    execute: (view, range) => insertLinePrefix(view, range, '- [ ] '),
  },
  {
    id: 'quote', label: 'Citation', group: 'Style', icon: ICONS.quote,
    description: 'Bloc de citation',
    execute: (view, range) => insertLinePrefix(view, range, '> '),
  },
  {
    id: 'codeBlock', label: 'Bloc de code', group: 'Style', icon: ICONS.codeBlock,
    description: 'Bloc de code multi-ligne',
    execute: (view, range) => insertCodeBlock(view, range),
  },
  // ── Formatage ──
  {
    id: 'bold', label: 'Gras', group: 'Formatage', icon: ICONS.bold,
    description: 'Texte en gras',
    execute: (view, range) => insertWrap(view, range, '**', '**', 'texte'),
  },
  {
    id: 'italic', label: 'Italique', group: 'Formatage', icon: ICONS.italic,
    description: 'Texte en italique',
    execute: (view, range) => insertWrap(view, range, '*', '*', 'texte'),
  },
  {
    id: 'strikethrough', label: 'Barré', group: 'Formatage', icon: ICONS.strikethrough,
    description: 'Texte barré',
    execute: (view, range) => insertWrap(view, range, '~~', '~~', 'texte'),
  },
  {
    id: 'inlineCode', label: 'Code', group: 'Formatage', icon: ICONS.code,
    description: 'Code en ligne',
    execute: (view, range) => insertWrap(view, range, '`', '`', 'code'),
  },
  // ── Insérer ──
  {
    id: 'hr', label: 'Séparateur', group: 'Insérer', icon: ICONS.hr,
    description: 'Ligne horizontale',
    execute: (view, range) => insertHorizontalRule(view, range),
  },
];

// ─── State Management ────────────────────────────────────────────────────────

interface SlashMenuState {
  active: boolean;
  from: number;      // position of the '/'
  to: number;        // end of the query text
  query: string;
  selectedIndex: number;
  filteredCommands: SlashCommand[];
}

const defaultState: SlashMenuState = {
  active: false, from: 0, to: 0, query: '', selectedIndex: 0, filteredCommands: [],
};

const openSlashMenu = StateEffect.define<{ from: number; to: number }>();
const closeSlashMenu = StateEffect.define<void>();
const updateSlashQuery = StateEffect.define<{ to: number; query: string }>();
const setSelectedIndex = StateEffect.define<number>();

function filterCommands(query: string): SlashCommand[] {
  if (!query) return slashCommands;
  const q = query.toLowerCase();
  return slashCommands.filter(cmd =>
    cmd.label.toLowerCase().includes(q) ||
    cmd.description.toLowerCase().includes(q) ||
    cmd.id.toLowerCase().includes(q)
  );
}

export const slashMenuState = StateField.define<SlashMenuState>({
  create: () => defaultState,
  update(state: SlashMenuState, tr: Transaction) {
    let newState = state;
    for (const effect of tr.effects) {
      if (effect.is(openSlashMenu)) {
        const filtered = filterCommands('');
        newState = {
          active: true,
          from: effect.value.from,
          to: effect.value.to,
          query: '',
          selectedIndex: 0,
          filteredCommands: filtered,
        };
      } else if (effect.is(closeSlashMenu)) {
        newState = defaultState;
      } else if (effect.is(updateSlashQuery)) {
        const filtered = filterCommands(effect.value.query);
        newState = {
          ...state,
          to: effect.value.to,
          query: effect.value.query,
          filteredCommands: filtered,
          selectedIndex: Math.min(state.selectedIndex, Math.max(0, filtered.length - 1)),
        };
      } else if (effect.is(setSelectedIndex)) {
        newState = { ...state, selectedIndex: effect.value };
      }
    }
    return newState;
  },
});

// ─── Slash Menu DOM Widget ───────────────────────────────────────────────────

class SlashMenuWidget {
  private dom: HTMLElement | null = null;
  private currentView: EditorView | null = null;

  show(view: EditorView, state: SlashMenuState) {
    this.currentView = view;

    if (!this.dom) {
      this.dom = document.createElement('div');
      this.dom.className = 'cm-slash-menu';
      this.dom.addEventListener('mousedown', (e) => e.preventDefault());
      document.body.appendChild(this.dom);
    }

    this.render(state);
    this.position(view, state.from);
    this.dom.style.display = 'block';
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
    if (!coords) return;

    const editorRect = view.dom.getBoundingClientRect();
    const lineHeight = view.defaultLineHeight;

    // Position below the cursor
    let top = coords.bottom + 4;
    let left = coords.left;

    // Ensure menu stays within viewport
    const menuHeight = this.dom.offsetHeight || 320;
    const menuWidth = this.dom.offsetWidth || 240;

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

  private render(state: SlashMenuState) {
    if (!this.dom) return;

    const { filteredCommands, selectedIndex } = state;

    if (filteredCommands.length === 0) {
      this.dom.innerHTML = '<div class="cm-slash-empty">Aucune commande trouvée</div>';
      return;
    }

    // Group commands
    const groups = new Map<string, { cmd: SlashCommand; globalIndex: number }[]>();
    filteredCommands.forEach((cmd, i) => {
      if (!groups.has(cmd.group)) groups.set(cmd.group, []);
      groups.get(cmd.group)!.push({ cmd, globalIndex: i });
    });

    let html = '';
    for (const [group, items] of groups) {
      html += `<div class="cm-slash-group-label">${group}</div>`;
      for (const { cmd, globalIndex } of items) {
        const isSelected = globalIndex === selectedIndex;
        html += `<div class="cm-slash-item${isSelected ? ' cm-slash-item-selected' : ''}" data-index="${globalIndex}">
          <div class="cm-slash-icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none">${cmd.icon}</svg></div>
          <div class="cm-slash-item-content">
            <span class="cm-slash-item-label">${cmd.label}</span>
            <span class="cm-slash-item-desc">${cmd.description}</span>
          </div>
        </div>`;
      }
    }

    this.dom.innerHTML = html;

    // Add click handlers
    this.dom.querySelectorAll('.cm-slash-item').forEach((el) => {
      el.addEventListener('mousedown', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const index = parseInt((el as HTMLElement).dataset['index']!);
        const view = this.currentView;
        if (!view) return;
        const menuState = view.state.field(slashMenuState);
        const cmd = menuState.filteredCommands[index];
        if (cmd) {
          view.dispatch({ effects: closeSlashMenu.of(undefined) });
          cmd.execute(view, { from: menuState.from, to: menuState.to });
        }
      });
    });

    // Scroll selected into view
    const selectedEl = this.dom.querySelector('.cm-slash-item-selected');
    if (selectedEl) {
      selectedEl.scrollIntoView({ block: 'nearest' });
    }
  }
}

// ─── Placeholder for empty lines ─────────────────────────────────────────────

class PlaceholderWidget extends WidgetType {
  override toDOM(): HTMLElement {
    const span = document.createElement('span');
    span.className = 'cm-slash-placeholder';
    span.textContent = "Tapez '/' pour les commandes...";
    return span;
  }

  override ignoreEvent(): boolean {
    return true;
  }
}

function buildPlaceholderDecorations(view: EditorView): DecorationSet {
  const state = view.state.field(slashMenuState);
  // Don't show placeholder when slash menu is active
  if (state.active) return Decoration.none;

  const doc = view.state.doc;
  // Only show placeholder on the current cursor line if it's empty
  const sel = view.state.selection.main;
  const cursorLine = doc.lineAt(sel.head);

  if (cursorLine.length === 0 && sel.empty) {
    return Decoration.set([
      Decoration.widget({
        widget: new PlaceholderWidget(),
        side: 0,
      }).range(cursorLine.from),
    ]);
  }

  return Decoration.none;
}

const placeholderPlugin = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;
    constructor(view: EditorView) {
      this.decorations = buildPlaceholderDecorations(view);
    }
    update(update: ViewUpdate) {
      if (update.docChanged || update.selectionSet) {
        this.decorations = buildPlaceholderDecorations(update.view);
      }
    }
  },
  { decorations: (v: { decorations: DecorationSet }) => v.decorations }
);

// ─── Main Plugin ─────────────────────────────────────────────────────────────

const slashMenuPlugin = ViewPlugin.fromClass(
  class {
    private widget = new SlashMenuWidget();

    constructor(private view: EditorView) {
      this.syncWidget();
    }

    update(update: ViewUpdate) {
      const state = update.state.field(slashMenuState);
      const prevState = update.startState.field(slashMenuState);

      if (state.active !== prevState.active ||
          state.query !== prevState.query ||
          state.selectedIndex !== prevState.selectedIndex ||
          state.filteredCommands !== prevState.filteredCommands) {
        this.syncWidget();
      }

      // Track typing after '/' was inserted
      if (state.active && update.docChanged) {
        this.trackQuery(update);
      }

      // Close menu if cursor moves away from the slash range
      if (state.active && update.selectionSet) {
        const sel = update.state.selection.main;
        const line = update.state.doc.lineAt(state.from);
        const cursorLine = update.state.doc.lineAt(sel.head);
        if (cursorLine.number !== line.number || sel.head < state.from) {
          update.view.dispatch({ effects: closeSlashMenu.of(undefined) });
        }
      }
    }

    destroy() {
      this.widget.destroy();
    }

    private syncWidget() {
      const state = this.view.state.field(slashMenuState);
      if (state.active && state.filteredCommands.length > 0) {
        this.widget.show(this.view, state);
      } else {
        this.widget.hide();
      }
    }

    private trackQuery(update: ViewUpdate) {
      const state = update.state.field(slashMenuState);
      if (!state.active) return;

      const line = update.state.doc.lineAt(state.from);
      const textAfterSlash = update.state.sliceDoc(state.from, line.to);

      // If the slash itself was deleted, close menu
      if (state.from > line.to || !textAfterSlash.startsWith('/')) {
        update.view.dispatch({ effects: closeSlashMenu.of(undefined) });
        return;
      }

      const query = textAfterSlash.slice(1); // remove the '/' prefix

      // Close if user typed a space (they're just writing a normal /)
      if (query.includes(' ')) {
        update.view.dispatch({ effects: closeSlashMenu.of(undefined) });
        return;
      }

      update.view.dispatch({
        effects: updateSlashQuery.of({ to: line.to, query }),
      });
    }
  }
);

// ─── Keymap for slash trigger + menu navigation ──────────────────────────────

export const slashCommandKeymap = keymap.of([
  {
    key: '/',
    run(view: EditorView) {
      const sel = view.state.selection.main;
      if (!sel.empty) return false;

      // Don't activate inside code blocks
      if (isInCodeBlock(view.state, sel.head)) return false;

      const line = view.state.doc.lineAt(sel.head);
      const textBefore = view.state.sliceDoc(line.from, sel.head);

      // Only activate if at start of line (optionally preceded by whitespace)
      if (textBefore.trim() !== '') return false;

      // Insert the '/' character
      const from = sel.head;
      view.dispatch({
        changes: { from, to: from, insert: '/' },
        selection: { anchor: from + 1 },
        effects: openSlashMenu.of({ from, to: from + 1 }),
      });
      return true;
    },
  },
  {
    key: 'ArrowDown',
    run(view: EditorView) {
      const state = view.state.field(slashMenuState);
      if (!state.active) return false;
      const next = Math.min(state.selectedIndex + 1, state.filteredCommands.length - 1);
      view.dispatch({ effects: setSelectedIndex.of(next) });
      return true;
    },
  },
  {
    key: 'ArrowUp',
    run(view: EditorView) {
      const state = view.state.field(slashMenuState);
      if (!state.active) return false;
      const prev = Math.max(state.selectedIndex - 1, 0);
      view.dispatch({ effects: setSelectedIndex.of(prev) });
      return true;
    },
  },
  {
    key: 'Enter',
    run(view: EditorView) {
      const state = view.state.field(slashMenuState);
      if (!state.active) return false;
      const cmd = state.filteredCommands[state.selectedIndex];
      if (cmd) {
        view.dispatch({ effects: closeSlashMenu.of(undefined) });
        cmd.execute(view, { from: state.from, to: state.to });
      }
      return true;
    },
  },
  {
    key: 'Escape',
    run(view: EditorView) {
      const state = view.state.field(slashMenuState);
      if (!state.active) return false;
      view.dispatch({ effects: closeSlashMenu.of(undefined) });
      return true;
    },
  },
  {
    key: 'Tab',
    run(view: EditorView) {
      const state = view.state.field(slashMenuState);
      if (!state.active) return false;
      const cmd = state.filteredCommands[state.selectedIndex];
      if (cmd) {
        view.dispatch({ effects: closeSlashMenu.of(undefined) });
        cmd.execute(view, { from: state.from, to: state.to });
      }
      return true;
    },
  },
]);

// ─── Export all extensions ───────────────────────────────────────────────────

export const slashCommandExtensions = [
  slashMenuState,
  slashCommandKeymap,
  slashMenuPlugin,
  placeholderPlugin,
];
