import {
  autocompletion, CompletionContext, CompletionResult, Completion
} from '@codemirror/autocomplete';
import { EditorView } from '@codemirror/view';
import { Extension } from '@codemirror/state';

/**
 * Creates a CodeMirror extension that provides autocomplete suggestions
 * for [[wikilinks]]. When the user types `[[`, a dropdown appears with
 * note titles filtered by the query typed so far.
 *
 * @param getNoteTitles - callback returning all available note titles
 * @param currentNoteId - callback returning the current note's ID (to exclude it)
 */
export function wikilinkCompletion(
  getNoteTitles: () => { id: number; title: string }[],
  currentNoteId: () => number | null
): Extension {
  return autocompletion({
    override: [
      (context: CompletionContext): CompletionResult | null => {
        return wikilinkCompletionSource(context, getNoteTitles, currentNoteId);
      }
    ],
    defaultKeymap: true,
    icons: false,
  });
}

function wikilinkCompletionSource(
  context: CompletionContext,
  getNoteTitles: () => { id: number; title: string }[],
  currentNoteId: () => number | null
): CompletionResult | null {
  const { state, pos } = context;
  const doc = state.doc.toString();

  // Walk backwards from cursor to find `[[`
  const textBefore = doc.slice(Math.max(0, pos - 200), pos);
  const openIdx = textBefore.lastIndexOf('[[');
  if (openIdx === -1) return null;

  // Make sure there's no `]]` between `[[` and cursor (not already closed)
  const between = textBefore.slice(openIdx + 2);
  if (between.includes(']]')) return null;

  // Make sure there's no newline between [[ and cursor
  if (between.includes('\n')) return null;

  // The query is everything after [[
  const query = between.toLowerCase();
  const from = pos - between.length;

  // Check if ]] already exists right after cursor
  const hasClosing = doc.slice(pos, pos + 2) === ']]';

  const notes = getNoteTitles();
  const activeId = currentNoteId();

  const options: Completion[] = notes
    .filter(n => n.title && n.id !== activeId)
    .filter(n => !query || n.title.toLowerCase().includes(query))
    .slice(0, 12)
    .map(n => ({
      label: n.title,
      type: 'text',
      apply: (view: EditorView, _completion: Completion, from: number, to: number) => {
        // Always insert title + ]] — consume existing ]] if present (closeBrackets adds them)
        const insert = n.title + ']]';
        view.dispatch({
          changes: { from, to: hasClosing ? to + 2 : to, insert },
          selection: { anchor: from + insert.length },
        });
      },
    }));

  if (options.length === 0) return null;

  return {
    from,
    options,
    filter: false, // we already filtered
  };
}

/** Theme overrides for the wikilink autocomplete dropdown. */
export const wikilinkCompletionTheme = EditorView.theme({
  '.cm-tooltip-autocomplete': {
    background: '#252526 !important',
    border: '1px solid #454545 !important',
    borderRadius: '4px !important',
    boxShadow: '0 4px 16px rgba(0,0,0,0.5) !important',
    fontFamily: "'Segoe UI', system-ui, sans-serif !important",
    fontSize: '13px !important',
    padding: '4px 0 !important',
    maxHeight: '220px !important',
  },
  '.cm-tooltip-autocomplete ul': {
    fontFamily: "'Segoe UI', system-ui, sans-serif !important",
  },
  '.cm-tooltip-autocomplete ul li': {
    padding: '4px 12px !important',
    lineHeight: '1.5 !important',
    color: '#cccccc !important',
  },
  '.cm-tooltip-autocomplete ul li[aria-selected]': {
    background: '#04395e !important',
    color: '#ffffff !important',
  },
  '.cm-completionLabel': {
    fontFamily: "'Segoe UI', system-ui, sans-serif !important",
    fontSize: '13px !important',
  },
  '.cm-completionMatchedText': {
    color: '#9cdcfe !important',
    textDecoration: 'none !important',
    fontWeight: '600 !important',
  },
}, { dark: true });
