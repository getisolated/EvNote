export interface Note {
  id: number;
  title: string;
  content: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export interface NotePreview {
  id: number;
  title: string;
  tags: string[];
  updatedAt: string;
  preview: string;
}

export interface Tab {
  noteId: number;
  title: string;
  isDirty: boolean;
}

export type PaletteMode = 'command' | 'search' | 'tag';

export interface PaletteCommand {
  id: string;
  label: string;
  description?: string;
  shortcut?: string;
  category: 'note' | 'action' | 'settings';
  action: () => void;
}

export interface PaletteResult {
  type: 'command' | 'note' | 'tag';
  command?: PaletteCommand;
  note?: NotePreview;
  tag?: string;
}
