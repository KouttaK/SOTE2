/**
 * src/content/search/SearchPopup.ts
 *
 * The Gatilho de Busca's popup (spec §4.3): a cursor-anchored, shadow-DOM
 * popup (same isolation pattern as ChoicePopup) that re-renders live as the
 * user keeps typing after `//`/`///`. Unlike ChoicePopup (one-shot, resolves
 * a single Promise), this one stays open across many `update()` calls and
 * reports the user's final pick via `onSelect`.
 *
 * Selecting a `form` result (Form matched by name only, no specific field)
 * drills into that Form's fields *in place* — same popup instance, no
 * close/reopen — per spec §4.1 ("mesmo popup, sem fechar/reabrir").
 */
import type { Form, FormField, Flow } from '../../shared/types/index.js';
import type { SearchResultItem } from '../engine/SearchTriggerDetector.js';

export type FinalSelection =
  | { kind: 'form-field'; form: Form; field: FormField }
  | { kind: 'flow'; flow: Flow };

export interface FooterSuggestion {
  label: string;
  onClick: () => void;
}

export class SearchPopup {
  private host: HTMLDivElement;
  private shadow: ShadowRoot;

  private results: SearchResultItem[] = [];
  private footer: FooterSuggestion | null = null;
  private mode: 'results' | 'submenu' = 'results';
  private submenuForm: Form | null = null;
  private activeIndex = 0;
  private open_ = false;

  private onSelectCb: ((sel: FinalSelection) => void) | null = null;
  private onCancelCb: (() => void) | null = null;

  private boundKeyDown = this.handleKeyDown.bind(this);
  private boundMouseDown = this.handleDocMouseDown.bind(this);

  constructor() {
    this.host = document.createElement('div');
    this.host.style.position = 'absolute';
    this.host.style.zIndex = '2147483647';
    this.shadow = this.host.attachShadow({ mode: 'open' });
    this.injectStyles();
  }

  public isOpen(): boolean {
    return this.open_;
  }

  public onSelect(cb: (sel: FinalSelection) => void): void {
    this.onSelectCb = cb;
  }

  public onCancel(cb: () => void): void {
    this.onCancelCb = cb;
  }

  public open(anchor: HTMLElement): void {
    if (this.open_) return;
    this.open_ = true;
    this.mode = 'results';
    this.submenuForm = null;
    this.activeIndex = 0;
    this.positionPopup(anchor);
    document.body.appendChild(this.host);
    document.addEventListener('keydown', this.boundKeyDown, true);
    // Registered on the next tick so the very keystroke that opened the
    // popup doesn't immediately count as an "outside click".
    setTimeout(() => document.addEventListener('mousedown', this.boundMouseDown, true), 0);
  }

  /** Re-renders with a fresh result set (called on every keystroke while the session is active). */
  public update(results: SearchResultItem[], footer: FooterSuggestion | null = null): void {
    this.results = results;
    this.footer = footer;
    if (this.mode === 'results') {
      this.activeIndex = 0;
    }
    this.render();
  }

  public close(): void {
    if (!this.open_) return;
    this.open_ = false;
    document.removeEventListener('keydown', this.boundKeyDown, true);
    document.removeEventListener('mousedown', this.boundMouseDown, true);
    if (this.host.parentNode) this.host.parentNode.removeChild(this.host);
  }

  // ── Rendering ────────────────────────────────────────────────────────────

  private currentRows(): SearchResultItem[] {
    if (this.mode === 'submenu' && this.submenuForm) {
      return this.submenuForm.fields.map((field) => ({
        kind: 'form-field' as const,
        form: this.submenuForm as Form,
        field,
        matchLevel: 0 as const,
        matchedIn: null,
      }));
    }
    return this.results;
  }

  private render(): void {
    const rows = this.currentRows();

    const container = document.createElement('div');
    container.className = 'sp-container';

    if (this.mode === 'submenu' && this.submenuForm) {
      const breadcrumb = document.createElement('div');
      breadcrumb.className = 'sp-breadcrumb';
      breadcrumb.textContent = this.submenuForm.name;
      container.appendChild(breadcrumb);
    }

    const list = document.createElement('div');
    list.className = 'sp-list';

    if (rows.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'sp-empty';
      empty.textContent = 'Nenhum resultado';
      list.appendChild(empty);
    }

    rows.forEach((item, idx) => {
      const row = document.createElement('button');
      row.className = 'sp-row' + (idx === this.activeIndex ? ' active' : '');

      const typeBadge = document.createElement('span');
      typeBadge.className = 'sp-badge ' + (item.kind === 'flow' ? 'sp-badge-flow' : 'sp-badge-form');
      typeBadge.textContent = item.kind === 'flow' ? 'Atalho' : 'Formulário';
      row.appendChild(typeBadge);

      const textWrap = document.createElement('span');
      textWrap.className = 'sp-row-text';

      const title = document.createElement('span');
      title.className = 'sp-row-title';
      title.textContent = this.titleFor(item);
      textWrap.appendChild(title);

      const subtitle = document.createElement('span');
      subtitle.className = 'sp-row-subtitle';
      subtitle.textContent = this.subtitleFor(item);
      textWrap.appendChild(subtitle);

      row.appendChild(textWrap);

      row.addEventListener('mouseenter', () => {
        this.activeIndex = idx;
        this.highlightActive(list);
      });
      row.addEventListener('click', () => this.activate(idx));

      list.appendChild(row);
    });

    container.appendChild(list);

    if (this.mode === 'results' && this.footer) {
      const footerEl = document.createElement('button');
      footerEl.className = 'sp-footer';
      footerEl.textContent = this.footer.label;
      footerEl.addEventListener('click', () => this.footer?.onClick());
      container.appendChild(footerEl);
    }

    this.shadow.innerHTML = '';
    this.injectStyles();
    this.shadow.appendChild(container);
  }

  private titleFor(item: SearchResultItem): string {
    if (item.kind === 'flow') return item.flow.name;
    if (item.kind === 'form') return item.form.name;
    return item.field.name || '—';
  }

  private subtitleFor(item: SearchResultItem): string {
    if (item.kind === 'form') {
      return `${item.form.fields.length} campo(s)`;
    }
    if (item.kind === 'form-field') {
      if (item.matchedIn === 'content' && item.snippet) return item.snippet;
      return this.mode === 'submenu' ? item.field.type || 'texto' : item.form.name;
    }
    // flow
    const trigger = item.flow.blocks.find((b) => b.type === 'trigger')?.data as any;
    const shortcut = trigger?.shortcut ? `/${trigger.shortcut}` : '';
    if (item.matchedIn === 'content' && item.snippet) return item.snippet;
    return shortcut;
  }

  private highlightActive(list: HTMLElement): void {
    Array.from(list.querySelectorAll('.sp-row')).forEach((el, i) => {
      el.classList.toggle('active', i === this.activeIndex);
    });
  }

  // ── Selection / navigation ────────────────────────────────────────────────

  private activate(index: number): void {
    const rows = this.currentRows();
    const item = rows[index];
    if (!item) return;

    if (item.kind === 'form') {
      // Drill into this Form's fields, same popup instance (spec §4.1).
      this.mode = 'submenu';
      this.submenuForm = item.form;
      this.activeIndex = 0;
      this.render();
      return;
    }

    const sel: FinalSelection =
      item.kind === 'flow' ? { kind: 'flow', flow: item.flow } : { kind: 'form-field', form: item.form, field: item.field };
    this.close();
    this.onSelectCb?.(sel);
  }

  private handleKeyDown(e: KeyboardEvent): void {
    if (!this.open_) return;
    const rows = this.currentRows();

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      e.stopPropagation();
      if (rows.length === 0) return;
      this.activeIndex = (this.activeIndex + 1) % rows.length;
      this.render();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      e.stopPropagation();
      if (rows.length === 0) return;
      this.activeIndex = (this.activeIndex - 1 + rows.length) % rows.length;
      this.render();
    } else if (e.key === 'Enter') {
      if (rows.length === 0) return;
      e.preventDefault();
      e.stopPropagation();
      this.activate(this.activeIndex);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      this.close();
      this.onCancelCb?.();
    }
    // Any other key (letters, backspace, etc.) is left alone so it keeps
    // reaching the underlying field — the query itself is driven by the
    // field's own input events, not by this popup.
  }

  private handleDocMouseDown(e: MouseEvent): void {
    const path = e.composedPath ? e.composedPath() : [];
    if (path.includes(this.host)) return;
    this.close();
    this.onCancelCb?.();
  }

  private positionPopup(target: HTMLElement): void {
    const rect = target.getBoundingClientRect();
    this.host.style.top = `${rect.bottom + window.scrollY + 6}px`;
    this.host.style.left = `${rect.left + window.scrollX}px`;
  }

  private injectStyles(): void {
    const style = document.createElement('style');
    style.textContent = `
      :host {
        display: block;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      }
      .sp-container {
        background: #171717;
        border: 1px solid #404040;
        border-radius: 0.5rem;
        box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.5);
        width: 22rem;
        max-width: 90vw;
        color: #fff;
        overflow: hidden;
      }
      .sp-breadcrumb {
        padding: 0.5rem 0.75rem;
        font-size: 0.75rem;
        color: #a3a3a3;
        border-bottom: 1px solid #262626;
      }
      .sp-list {
        max-height: 18rem;
        overflow-y: auto;
        display: flex;
        flex-direction: column;
        padding: 0.25rem;
      }
      .sp-empty {
        padding: 0.75rem;
        color: #737373;
        font-size: 0.8125rem;
        text-align: center;
      }
      .sp-row {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        background: transparent;
        border: none;
        color: #d4d4d4;
        text-align: left;
        padding: 0.5rem 0.625rem;
        border-radius: 0.375rem;
        cursor: pointer;
        font-size: 0.8125rem;
        width: 100%;
      }
      .sp-row.active, .sp-row:hover {
        background: #262626;
        color: #fff;
      }
      .sp-badge {
        flex-shrink: 0;
        font-size: 0.625rem;
        padding: 0.125rem 0.375rem;
        border-radius: 9999px;
        border: 1px solid #404040;
        color: #a3a3a3;
      }
      .sp-badge-form { color: #93c5fd; border-color: #1d4ed8; }
      .sp-badge-flow { color: #86efac; border-color: #15803d; }
      .sp-row-text {
        display: flex;
        flex-direction: column;
        min-width: 0;
      }
      .sp-row-title {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .sp-row-subtitle {
        font-size: 0.6875rem;
        color: #737373;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .sp-footer {
        display: block;
        width: 100%;
        background: #1c1c1c;
        border: none;
        border-top: 1px solid #262626;
        color: #93c5fd;
        font-size: 0.75rem;
        padding: 0.5rem 0.75rem;
        text-align: left;
        cursor: pointer;
      }
      .sp-footer:hover { background: #262626; }
    `;
    this.shadow.appendChild(style);
  }
}
