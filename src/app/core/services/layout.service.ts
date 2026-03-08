import { Injectable, signal } from '@angular/core';

const STORAGE_KEY = 'evnote-wide-mode';

@Injectable({ providedIn: 'root' })
export class LayoutService {
  private readonly _wideMode = signal(this.loadWideMode());

  readonly wideMode = this._wideMode.asReadonly();

  toggle(): void {
    const next = !this._wideMode();
    this._wideMode.set(next);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }

  private loadWideMode(): boolean {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'false');
    } catch {
      return false;
    }
  }
}
