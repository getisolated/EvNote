import {
  Component, inject, ElementRef, ViewChild, AfterViewInit,
  ChangeDetectionStrategy, HostListener
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { TabsService } from '../../core/services/tabs.service';
import { ElectronBridgeService } from '../../core/services/electron-bridge.service';
import { PaletteService } from '../../core/services/palette.service';
import { Tab } from '../../core/models/note.model';

@Component({
  selector: 'app-tabs-bar',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="tabs-bar" (dblclick)="onTitleBarDblClick()">
      <!-- Home button -->
      <button
        class="home-btn"
        [class.active]="activeIndex() === -1"
        (click)="goHome()"
        title="Home"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
          <polyline points="9 22 9 12 15 12 15 22"/>
        </svg>
      </button>

      <!-- Window drag region -->
      <div class="drag-region"></div>

      <!-- Tabs -->
      <div class="tabs-container" #tabsContainer>
        @for (tab of tabs(); track tab.noteId; let i = $index) {
          <div
            class="tab"
            [class.active]="i === activeIndex()"
            [class.dirty]="tab.isDirty"
            (click)="selectTab(i)"
            (mousedown)="onTabMouseDown($event, i)"
            (auxclick)="onAuxClick($event, i)"
            [title]="tab.title || 'Untitled'"
          >
            <span class="tab-title">{{ tab.title || 'Untitled' }}</span>
            @if (tab.isDirty) {
              <span class="dirty-dot" title="Unsaved changes"></span>
            }
            <button
              class="tab-close"
              (click)="closeTab($event, i)"
              tabindex="-1"
              title="Close (Ctrl+W)"
            >×</button>
          </div>
        }
      </div>

      <!-- Search icon -->
      <button class="search-icon-btn" (click)="openSearch()" title="Search notes (Ctrl+Shift+F)">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
        </svg>
      </button>

      <!-- Window controls -->
      <div class="window-controls">
        <button class="wc-btn minimize" (click)="minimize()" title="Minimize">
          <svg width="10" height="1" viewBox="0 0 10 1"><rect width="10" height="1" fill="currentColor"/></svg>
        </button>
        <button class="wc-btn maximize" (click)="toggleMaximize()" title="Maximize">
          <svg width="10" height="10" viewBox="0 0 10 10"><rect x="0.5" y="0.5" width="9" height="9" fill="none" stroke="currentColor"/></svg>
        </button>
        <button class="wc-btn close" (click)="closeWindow()" title="Close">
          <svg width="10" height="10" viewBox="0 0 10 10">
            <line x1="0" y1="0" x2="10" y2="10" stroke="currentColor" stroke-width="1.2"/>
            <line x1="10" y1="0" x2="0" y2="10" stroke="currentColor" stroke-width="1.2"/>
          </svg>
        </button>
      </div>
    </div>
  `,
  styleUrls: ['./tabs-bar.component.scss'],
})
export class TabsBarComponent implements AfterViewInit {
  private tabs$ = inject(TabsService);
  private electron = inject(ElectronBridgeService);
  private palette = inject(PaletteService);

  @ViewChild('tabsContainer') tabsContainer!: ElementRef<HTMLElement>;

  readonly tabs = this.tabs$.tabs;
  readonly activeIndex = this.tabs$.activeIndex;

  ngAfterViewInit(): void {}

  goHome(): void {
    this.tabs$.goHome();
  }

  openSearch(): void {
    this.palette.open('search');
  }

  selectTab(index: number): void {
    this.tabs$.setActiveIndex(index);
  }

  closeTab(event: MouseEvent, index: number): void {
    event.stopPropagation();
    this.tabs$.closeTab(index);
  }

  onTabMouseDown(event: MouseEvent, index: number): void {
    if (event.button === 1) {
      event.preventDefault();
    }
  }

  onAuxClick(event: MouseEvent, index: number): void {
    if (event.button === 1) this.tabs$.closeTab(index);
  }

  @HostListener('wheel', ['$event'])
  onWheel(event: WheelEvent): void {
    const el = this.tabsContainer?.nativeElement;
    if (el) {
      el.scrollLeft += event.deltaY;
      event.preventDefault();
    }
  }

  minimize(): void { this.electron.minimize(); }
  async toggleMaximize(): Promise<void> { await this.electron.maximize(); }
  closeWindow(): void { this.electron.close(); }

  async onTitleBarDblClick(): Promise<void> {
    await this.electron.maximize();
  }
}
