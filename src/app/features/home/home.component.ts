import {
  Component, inject, OnInit, signal, computed, ChangeDetectionStrategy
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { NotesService } from '../../core/services/notes.service';
import { TabsService } from '../../core/services/tabs.service';
import { PaletteService } from '../../core/services/palette.service';
import { NotePreview } from '../../core/models/note.model';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="home">
      <div class="home-header">
        <h1 class="home-title">Notes</h1>
        <div class="home-actions">
          <button class="search-btn" (click)="openSearch()" title="Search (Ctrl+Shift+F)">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
            </svg>
            Search
          </button>
          <button class="new-btn" (click)="createNote()" title="New note (Ctrl+N)">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            New note
          </button>
        </div>
      </div>

      @if (allTags().length > 0) {
        <div class="tag-filters">
          <button
            class="tag-filter"
            [class.active]="activeTag() === null"
            (click)="setActiveTag(null)"
          >All</button>
          @for (tag of allTags(); track tag) {
            <button
              class="tag-filter"
              [class.active]="activeTag() === tag"
              (click)="setActiveTag(tag)"
            >#{{ tag }}</button>
          }
        </div>
      }

      <div class="notes-list">
        @if (filteredNotes().length === 0) {
          <div class="empty-state">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
            </svg>
            <p>No notes yet. Press <kbd>Ctrl+N</kbd> to create one.</p>
          </div>
        }
        @for (note of filteredNotes(); track note.id) {
          <div class="note-row" (click)="openNote(note)" tabindex="0" (keydown.enter)="openNote(note)">
            <div class="note-main">
              <span class="note-title">{{ note.title || 'Untitled' }}</span>
              @if (note.tags.length > 0) {
                <div class="note-tags">
                  @for (tag of note.tags.slice(0, 3); track tag) {
                    <span class="tag-bubble">{{ tag }}</span>
                  }
                  @if (note.tags.length > 3) {
                    <span class="tag-bubble overflow">+{{ note.tags.length - 3 }}</span>
                  }
                </div>
              }
            </div>
            <span class="note-date" [title]="note.updatedAt">{{ formatDate(note.updatedAt) }}</span>
          </div>
        }
      </div>
    </div>
  `,
  styleUrls: ['./home.component.scss'],
})
export class HomeComponent implements OnInit {
  private notesService = inject(NotesService);
  private tabsService = inject(TabsService);
  private paletteService = inject(PaletteService);

  readonly allTags = signal<string[]>([]);
  readonly activeTag = signal<string | null>(null);

  readonly filteredNotes = computed<NotePreview[]>(() => {
    const tag = this.activeTag();
    const previews = this.notesService.notePreviews();
    if (!tag) return previews;
    return previews.filter(n => n.tags.includes(tag));
  });

  async ngOnInit(): Promise<void> {
    const tags = await this.notesService.getAllTags();
    this.allTags.set(tags);
  }

  openNote(note: NotePreview): void {
    this.tabsService.openNote(note.id, note.title || 'Untitled');
  }

  openSearch(): void {
    this.paletteService.open('search');
  }

  async createNote(): Promise<void> {
    const note = await this.notesService.create();
    this.tabsService.openNote(note.id, 'Untitled');
  }

  setActiveTag(tag: string | null): void {
    this.activeTag.set(tag);
  }

  formatDate(isoDate: string): string {
    if (!isoDate) return '';
    const d = new Date(isoDate);
    if (isNaN(d.getTime())) return '';
    const now = new Date();
    const isToday =
      d.getDate() === now.getDate() &&
      d.getMonth() === now.getMonth() &&
      d.getFullYear() === now.getFullYear();
    if (isToday) {
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
  }
}
