import { WidgetType, EditorView } from '@codemirror/view';

// ── Checkbox widget ───────────────────────────────────────────────────────────
export class CheckboxWidget extends WidgetType {
  constructor(
    readonly checked: boolean,
    readonly from: number,
    readonly syntax: '[]' | '()'
  ) { super(); }

  toDOM(view: EditorView): HTMLElement {
    const wrap = document.createElement('span');
    wrap.className = 'cm-checkbox-wrap';

    if (this.syntax === '[]') {
      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.checked = this.checked;
      cb.className = 'cm-task-checkbox';
      cb.addEventListener('mousedown', (e) => e.preventDefault());
      cb.addEventListener('change', () => {
        const insert = this.syntax === '[]'
          ? (cb.checked ? '[x]' : '[ ]')
          : (cb.checked ? '(x)' : '( )');
        view.dispatch({
          changes: { from: this.from, to: this.from + 3, insert }
        });
      });
      wrap.appendChild(cb);
    } else {
      // Circle bullet for () syntax
      const bullet = document.createElement('span');
      bullet.className = this.checked ? 'cm-bullet-done' : 'cm-bullet-todo';
      bullet.innerHTML = this.checked ? '●' : '○';
      bullet.addEventListener('mousedown', (e) => e.preventDefault());
      bullet.addEventListener('click', () => {
        const insert = this.checked ? '( )' : '(x)';
        view.dispatch({
          changes: { from: this.from, to: this.from + 3, insert }
        });
      });
      wrap.appendChild(bullet);
    }

    return wrap;
  }

  override eq(other: CheckboxWidget): boolean {
    return this.checked === other.checked &&
           this.from === other.from &&
           this.syntax === other.syntax;
  }

  override ignoreEvent(): boolean { return false; }
}

// ── Heading level widget (hidden # symbols) ───────────────────────────────────
export class HiddenMarkWidget extends WidgetType {
  toDOM(): HTMLElement {
    const span = document.createElement('span');
    span.className = 'cm-hidden-mark';
    return span;
  }
  override eq(): boolean { return true; }
  override ignoreEvent(): boolean { return true; }
}
