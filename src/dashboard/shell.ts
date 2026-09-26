/**
 * src/dashboard/shell.ts — Dashboard Shell
 *
 * Renders the complete layout (sidebar + header + content area) extracted
 * pixel-perfectly from ref_pages/SOTE/home.htm.
 *
 * Responsible for:
 *  - Building the DOM structure once on startup
 *  - Highlighting the active nav item when the route changes
 *  - Showing a skeleton loader between page swaps
 *  - Calling page.mount() / page.unmount() correctly
 */

import { router, type ResolvedRoute } from './router.js';
import { loadPage, type Page } from './pages/index.js';
import { t, getLanguage, setLanguage } from '../shared/i18n/index.js';
import { storage } from '../shared/storage/StorageService.js';
import { ConfirmModal } from './components/ConfirmModal.js';
import { PromptModal } from './components/PromptModal.js';
import { showToast } from '../shared/components/Toast.js';

/**
 * Lets a full-bleed page (currently only the Flow Editor) take over the
 * shared `#dash-header` entirely instead of stacking its own header
 * underneath the default one — matching ref_pages/criadorFluxo.htm, which
 * has exactly one header. The default header's markup/listeners stay in
 * the DOM (just hidden), so nothing needs to be rebuilt when it comes back.
 * Standalone (not a Shell method) so pages can call it without needing a
 * reference to the Shell instance — it only ever touches these fixed IDs.
 */
export function setHeaderOverride(html: string): HTMLElement {
  const header = document.querySelector<HTMLElement>('#dash-header')!;
  const defaultEl = header.querySelector<HTMLElement>('#dash-header-default')!;
  const slot = header.querySelector<HTMLElement>('#dash-header-slot')!;

  header.classList.add('is-override');
  defaultEl.hidden = true;
  slot.hidden = false;
  slot.innerHTML = html;
  return slot;
}

/** Restores the default shared header. Called automatically on every route
 * change (see Shell._onRouteChange), so a page never has to remember to
 * clean up after itself when navigating away. */
export function clearHeaderOverride(): void {
  const header = document.querySelector<HTMLElement>('#dash-header');
  if (!header) return;
  const defaultEl = header.querySelector<HTMLElement>('#dash-header-default');
  const slot = header.querySelector<HTMLElement>('#dash-header-slot');
  header.classList.remove('is-override');
  if (defaultEl) defaultEl.hidden = false;
  if (slot) { slot.hidden = true; slot.innerHTML = ''; }
}


// ---------------------------------------------------------------------------
// SVG icons (inline — same paths as extracted from home.htm)
// ---------------------------------------------------------------------------

const ICONS = {
  bolt: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512" aria-hidden="true" fill="currentColor"><path d="M349.4 44.6c5.9-13.7 1.5-29.7-10.6-38.5s-28.6-8-39.9 1.8l-256 224c-10 8.8-13.6 22.9-8.9 35.3S50.7 288 64 288H175.5L98.6 467.4c-5.9 13.7-1.5 29.7 10.6 38.5s28.6 8 39.9-1.8l256-224c10-8.8 13.6-22.9 8.9-35.3s-16.6-20.7-30-20.7H272.5L349.4 44.6z"/></svg>`,
  squaresFour: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" aria-hidden="true" fill="currentColor"><rect x="3" y="3" width="8" height="8" rx="1.5"/><rect x="13" y="3" width="8" height="8" rx="1.5"/><rect x="3" y="13" width="8" height="8" rx="1.5"/><rect x="13" y="13" width="8" height="8" rx="1.5"/></svg>`,
  sliders: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" aria-hidden="true" fill="currentColor"><path d="M0 416c0 17.7 14.3 32 32 32l54.7 0c12.3 28.3 40.5 48 73.3 48s61-19.7 73.3-48L480 448c17.7 0 32-14.3 32-32s-14.3-32-32-32l-246.7 0c-12.3-28.3-40.5-48-73.3-48s-61 19.7-73.3 48L32 384c-17.7 0-32 14.3-32 32zm128 0a32 32 0 1 1 64 0 32 32 0 1 1 -64 0zM320 256a32 32 0 1 1 64 0 32 32 0 1 1 -64 0zm32-80c-32.8 0-61 19.7-73.3 48L32 224c-17.7 0-32 14.3-32 32s14.3 32 32 32l246.7 0c12.3 28.3 40.5 48 73.3 48s61-19.7 73.3-48l54.7 0c17.7 0 32-14.3 32-32s-14.3-32-32-32l-54.7 0c-12.3-28.3-40.5-48-73.3-48zM192 128a32 32 0 1 1 0-64 32 32 0 1 1 0 64zm73.3-64C253 35.7 224.8 16 192 16s-61 19.7-73.3 48L32 64C14.3 64 0 78.3 0 96s14.3 32 32 32l86.7 0c12.3 28.3 40.5 48 73.3 48s61-19.7 73.3-48L480 128c17.7 0 32-14.3 32-32s-14.3-32-32-32L265.3 64z"/></svg>`,
  chevronRight: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 512" aria-hidden="true" fill="currentColor"><path d="M310.6 233.4c12.5 12.5 12.5 32.8 0 45.3l-192 192c-12.5 12.5-32.8 12.5-45.3 0s-12.5-32.8 0-45.3L242.7 256 73.4 86.6c-12.5-12.5-12.5-32.8 0-45.3s32.8-12.5 45.3 0l192 192z"/></svg>`,
  refresh: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" aria-hidden="true" fill="currentColor"><path d="M386.3 160H352c-17.7 0-32 14.3-32 32s14.3 32 32 32H478.3c17.7 0 32-14.3 32-32V64c0-17.7-14.3-32-32-32s-32 14.3-32 32v35.2L414.4 97.6c-87.5-87.5-229.3-87.5-316.8 0C73.2 122 55.6 150.7 44.8 181.4c-5.9 16.7 2.9 34.9 19.5 40.8s34.9-2.9 40.8-19.5c7.7-21.8 20.2-42.3 37.8-59.8c62.5-62.5 163.8-62.5 226.3 0zM125.7 352H33.7C16 352 1.7 366.3 1.7 384v96c0 17.7 14.3 32 32 32s32-14.3 32-32V444.8l17.9 17.9c87.5 87.5 229.3 87.5 316.8 0c24.5-24.5 42.1-53.2 52.9-83.8c5.9-16.7-2.9-34.9-19.5-40.8s-34.9 2.9-40.8 19.5c-7.7 21.8-20.2 42.3-37.8 59.8c-62.5 62.5-163.8 62.5-226.3 0L97.6 384h28.1c17.7 0 32-14.3 32-32s-14.3-32-32-32z"/></svg>`,
  funnel: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" aria-hidden="true" fill="currentColor"><path d="M3.9 54.9C10.5 40.9 24.5 32 40 32H472c15.5 0 29.5 8.9 36.1 22.9s4.6 30.5-5.2 42.5L320 320.9V448c0 12.1-6.8 23.2-17.7 28.6s-23.8 4.3-33.5-3l-64-48c-8.1-6-12.8-15.5-12.8-25.6V320.9L9 97.3C-.7 85.4-2.8 68.8 3.9 54.9z"/></svg>`,
  pulse: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12h4l2-7 4 14 3-9 2 4h5"/></svg>`,
  info: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" aria-hidden="true" fill="currentColor"><path d="M256 512A256 256 0 1 0 256 0a256 256 0 1 0 0 512zM216 336H232V272H216c-13.3 0-24-10.7-24-24s10.7-24 24-24h40c13.3 0 24 10.7 24 24v88h8c13.3 0 24 10.7 24 24s-10.7 24-24 24H216c-13.3 0-24-10.7-24-24s10.7-24 24-24zm40-208a32 32 0 1 1 0-64 32 32 0 1 1 0 64z"/></svg>`,
  globe: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" aria-hidden="true" fill="currentColor"><path d="M352 256c0 22.2-1.2 43.6-3.3 64H163.3c-2.2-20.4-3.3-41.8-3.3-64s1.2-43.6 3.3-64H348.7c2.2 20.4 3.3 41.8 3.3 64zm28.8-64H503.9c5.3 20.5 8.1 41.9 8.1 64s-2.8 43.5-8.1 64H380.8c2.1-20.6 3.2-42 3.2-64s-1.1-43.4-3.2-64zm112.6-32H376.7c-10-63.9-29.8-117.4-55.3-151.6c78.3 20.7 142 77.5 171.9 151.6zm-149.1 0H167.7c6.1-36.4 15.5-68.6 27-94.7c10.5-23.6 22.2-40.7 33.5-51.5C239.4 3.2 248.7 0 256 0s16.6 3.2 27.8 13.8c11.3 10.8 23 27.9 33.5 51.5c11.6 26 20.9 58.2 27 94.7zm-209 0H18.6C48.6 85.9 112.2 29.1 190.6 8.4C165.1 42.6 145.3 96.1 135.3 160zM8.1 192H131.2c-2.1 20.6-3.2 42-3.2 64s1.1 43.4 3.2 64H8.1C2.8 299.5 0 278.1 0 256s2.8-43.5 8.1-64zM194.7 446.6c-11.6-26-20.9-58.2-27-94.6H344.3c-6.1 36.4-15.5 68.6-27 94.6c-10.5 23.6-22.2 40.7-33.5 51.5C272.6 508.8 263.3 512 256 512s-16.6-3.2-27.8-13.8c-11.3-10.8-23-27.9-33.5-51.5zM135.3 352c10 63.9 29.8 117.4 55.3 151.6C112.2 482.9 48.6 426.1 18.6 352H135.3zm358.1 0c-30 74.1-93.6 130.9-171.9 151.6c25.5-34.2 45.2-87.7 55.3-151.6H493.4z"/></svg>`,
  gear: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" aria-hidden="true" fill="currentColor"><path d="M495.9 166.6c3.2 8.7 .5 18.4-6.4 24.6l-43.3 39.4c1.1 8.3 1.7 16.8 1.7 25.4s-.6 17.1-1.7 25.4l43.3 39.4c6.9 6.2 9.6 15.9 6.4 24.6c-4.4 11.9-9.7 23.3-15.8 34.3l-4.7 8.1c-6.6 11-14 21.4-22.1 31.2c-5.9 7.2-15.7 9.6-24.5 6.8l-55.7-17.7c-13.4 10.3-28.2 18.9-44 25.4l-12.5 57.1c-2 9.1-9 16.3-18.2 17.8c-13.8 2.3-28 3.5-42.5 3.5s-28.7-1.2-42.5-3.5c-9.2-1.5-16.2-8.7-18.2-17.8l-12.5-57.1c-15.8-6.5-30.6-15.1-44-25.4L83.1 425.9c-8.8 2.8-18.6 .3-24.5-6.8c-8.1-9.8-15.5-20.2-22.1-31.2l-4.7-8.1c-6.1-11-11.4-22.4-15.8-34.3c-3.2-8.7-.5-18.4 6.4-24.6l43.3-39.4C64.6 273.1 64 264.6 64 256s.6-17.1 1.7-25.4L22.4 191.2c-6.9-6.2-9.6-15.9-6.4-24.6c4.4-11.9 9.7-23.3 15.8-34.3l4.7-8.1c6.6-11 14-21.4 22.1-31.2c5.9-7.2 15.7-9.6 24.5-6.8l55.7 17.7c13.4-10.3 28.2-18.9 44-25.4l12.5-57.1c2-9.1 9-16.3 18.2-17.8C227.3 1.2 241.5 0 256 0s28.7 1.2 42.5 3.5c9.2 1.5 16.2 8.7 18.2 17.8l12.5 57.1c15.8 6.5 30.6 15.1 44 25.4l55.7-17.7c8.8-2.8 18.6-.3 24.5 6.8c8.1 9.8 15.5 20.2 22.1 31.2l4.7 8.1c6.1 11 11.4 22.4 15.8 34.3zM256 336a80 80 0 1 0 0-160 80 80 0 1 0 0 160z"/></svg>`,
  chartBar: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" aria-hidden="true" fill="currentColor"><path d="M32 32c17.7 0 32 14.3 32 32V400c0 8.8 7.2 16 16 16H480c17.7 0 32 14.3 32 32s-14.3 32-32 32H80c-44.2 0-80-35.8-80-80V64C0 46.3 14.3 32 32 32zm96 96c0-17.7 14.3-32 32-32l192 0c17.7 0 32 14.3 32 32s-14.3 32-32 32l-192 0c-17.7 0-32-14.3-32-32zm32 64H288c17.7 0 32 14.3 32 32s-14.3 32-32 32H160c-17.7 0-32-14.3-32-32s14.3-32 32-32zm0 96H416c17.7 0 32 14.3 32 32s-14.3 32-32 32H160c-17.7 0-32-14.3-32-32s14.3-32 32-32z"/></svg>`,
  ellipsisV: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 512" aria-hidden="true" fill="currentColor"><path d="M64 360a56 56 0 1 0 0 112 56 56 0 1 0 0-112zm0-160a56 56 0 1 0 0 112 56 56 0 1 0 0-112zM120 96A56 56 0 1 0 8 96a56 56 0 1 0 112 0z"/></svg>`,
  search: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" aria-hidden="true" fill="currentColor"><path d="M416 208c0 45.9-14.9 88.3-40 122.7L502.6 457.4c12.5 12.5 12.5 32.8 0 45.3s-32.8 12.5-45.3 0L330.7 376c-34.4 25.2-76.8 40-122.7 40C93.1 416 0 322.9 0 208S93.1 0 208 0S416 93.1 416 208zM208 352a144 144 0 1 0 0-288 144 144 0 1 0 0 288z"/></svg>`,
  plus: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512" aria-hidden="true" fill="currentColor"><path d="M256 80c0-17.7-14.3-32-32-32s-32 14.3-32 32V224H48c-17.7 0-32 14.3-32 32s14.3 32 32 32H192V432c0 17.7 14.3 32 32 32s32-14.3 32-32V288H400c17.7 0 32-14.3 32-32s-14.3-32-32-32H256V80z"/></svg>`,
  sortDesc: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 576 512" aria-hidden="true" fill="currentColor"><path d="M151.6 42.4C145.5 35.8 137 32 128 32s-17.5 3.8-23.6 10.4l-88 96c-11.9 13-11.1 33.3 2 45.2s33.3 11.1 45.2-2L96 146.3V448c0 17.7 14.3 32 32 32s32-14.3 32-32V146.3l32.4 35.4c11.9 13 32.2 13.9 45.2 2s13.9-32.2 2-45.2l-88-96zM320 480h32c17.7 0 32-14.3 32-32s-14.3-32-32-32H320c-17.7 0-32 14.3-32 32s14.3 32 32 32zm0-128h96c17.7 0 32-14.3 32-32s-14.3-32-32-32H320c-17.7 0-32 14.3-32 32s14.3 32 32 32zm0-128H480c17.7 0 32-14.3 32-32s-14.3-32-32-32H320c-17.7 0-32 14.3-32 32s14.3 32 32 32zm0-128H544c17.7 0 32-14.3 32-32s-14.3-32-32-32H320c-17.7 0-32 14.3-32 32s14.3 32 32 32z"/></svg>`,
  chevronDown: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" aria-hidden="true" fill="currentColor"><path d="M233.4 406.6c12.5 12.5 32.8 12.5 45.3 0l192-192c12.5-12.5 12.5-32.8 0-45.3s-32.8-12.5-45.3 0L256 338.7 86.6 169.4c-12.5-12.5-32.8-12.5-45.3 0s-12.5 32.8 0 45.3l192 192z"/></svg>`,
  clipboardList: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 384 512" aria-hidden="true" fill="currentColor"><path d="M192 0c-41.8 0-77.4 26.7-90.5 64H64C28.7 64 0 92.7 0 128V448c0 35.3 28.7 64 64 64H320c35.3 0 64-28.7 64-64V128c0-35.3-28.7-64-64-64H282.5C269.4 26.7 233.8 0 192 0zm0 64a32 32 0 1 1 0 64 32 32 0 1 1 0-64zM72 272a24 24 0 1 1 48 0 24 24 0 1 1 -48 0zm104-16H304c8.8 0 16 7.2 16 16s-7.2 16-16 16H176c-8.8 0-16-7.2-16-16s7.2-16 16-16zM72 368a24 24 0 1 1 48 0 24 24 0 1 1 -48 0zm104-16H304c8.8 0 16 7.2 16 16s-7.2 16-16 16H176c-8.8 0-16-7.2-16-16s7.2-16 16-16z"/></svg>`,
};

// ---------------------------------------------------------------------------
// Navigation items — matching home.htm sidebar exactly
// ---------------------------------------------------------------------------

interface NavItem {
  label: string;
  path: string;
  pattern: string;
  icon?: string;
  badge?: number;
}

const PRIMARY_NAV: NavItem[] = [
  { label: 'sidebar.flows',     path: '/flows',      pattern: '/flows',      icon: ICONS.squaresFour },
  { label: 'sidebar.variables', path: '/variables',  pattern: '/variables',  icon: ICONS.sliders },
];

const WORKSPACE_NAV: NavItem[] = [
  { label: 'sidebar.forms',     path: '/formularios', pattern: '/formularios', icon: ICONS.clipboardList },
  { label: 'sidebar.analytics', path: '/analytics',   pattern: '/analytics',   icon: ICONS.chartBar },
  { label: 'sidebar.settings',  path: '/settings',    pattern: '/settings',    icon: ICONS.gear },
];

/** Top-header quick nav — mirrors ref_pages' <nav> in the header (Fluxos /
 * Variáveis / Analytics / Configurações). Purely a second, compact way to
 * reach the same 4 core sections; Formulários stays sidebar-only since
 * there's no header slot for a 5th item in the reference layout. */
const HEADER_NAV: NavItem[] = [
  { label: 'sidebar.flows',     path: '/flows',     pattern: '/flows' },
  { label: 'sidebar.variables', path: '/variables', pattern: '/variables' },
  { label: 'sidebar.analytics', path: '/analytics', pattern: '/analytics' },
  { label: 'sidebar.settings',  path: '/settings',  pattern: '/settings' },
];

// ---------------------------------------------------------------------------
// Shell class
// ---------------------------------------------------------------------------

export class Shell {
  private root: HTMLElement;
  private contentArea!: HTMLElement;
  private navLinks: Map<string, HTMLAnchorElement> = new Map();
  private currentPage: Page | null = null;
  private currentPageEl: HTMLElement | null = null;
  private unsubscribeRouter: (() => void) | null = null;
  private flowsBadge: HTMLSpanElement | null = null;
  private variablesBadge: HTMLSpanElement | null = null;
  private headerNavLinks: Map<string, HTMLAnchorElement> = new Map();
  private currentRoutePath: string | null = null;
  private skipNextDirtyCheck = false;
  private copyListener: ((e: ClipboardEvent) => void) | null = null;

  constructor(root: HTMLElement) {
    this.root = root;
  }

  // ── Boot ──────────────────────────────────────────────────────────────────

  async boot(): Promise<void> {
    this._renderLayout();
    this._refreshBadges();

    // Attach dashboard copy listener so copies inside dashboard are tracked in clipboard history
    this.copyListener = (e: ClipboardEvent) => {
      try {
        let text = '';
        const active = document.activeElement as HTMLElement | null;
        if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA')) {
          const field = active as HTMLInputElement | HTMLTextAreaElement;
          if (typeof field.selectionStart === 'number' && typeof field.selectionEnd === 'number') {
            text = field.value.substring(field.selectionStart, field.selectionEnd);
          }
        }
        if (!text) {
          text = window.getSelection()?.toString() || '';
        }
        if (text) {
          storage.addClipboardEntry(text).catch(() => {});
        }
      } catch (err) {
        console.debug('[SOTE] Failed to capture dashboard copy:', err);
      }
    };
    document.addEventListener('copy', this.copyListener, true);

    // Subscribe to route changes.
    this.unsubscribeRouter = router.onRouteChange((route) => {
      this._onRouteChange(route);
    });

    // Render the initial route immediately.
    await this._onRouteChange(router.current);
  }

  /** Refreshes the Fluxos/Variáveis sidebar badge counts from real storage data. */
  private async _refreshBadges(): Promise<void> {
    try {
      const [flows, variables] = await Promise.all([storage.getFlows(), storage.getVariables()]);
      if (this.flowsBadge) this.flowsBadge.textContent = String(flows.length);
      if (this.variablesBadge) this.variablesBadge.textContent = String(variables.length);
    } catch (e) {
      console.error('[SOTE Shell] Failed to refresh badges:', e);
    }
  }

  destroy(): void {
    if (this.copyListener) {
      document.removeEventListener('copy', this.copyListener, true);
      this.copyListener = null;
    }
    this.unsubscribeRouter?.();
    this.currentPage?.unmount();
  }

  /**
   * Toggles the app language between pt-BR and en, updates storage,
   * re-renders the shell chrome, and remounts the current page in-place.
   */
  public async toggleLanguage(): Promise<void> {
    if (this.currentPage && typeof this.currentPage.isDirty === 'function' && this.currentPage.isDirty()) {
      ConfirmModal.show({
        title: t('confirm_modal.leave_unsaved_title'),
        message: t('shell.leave_unsaved.desc'),
        confirmLabel: t('common.leave'),
        onConfirm: async () => {
          await this._applyLanguageToggle();
        },
      });
      return;
    }
    await this._applyLanguageToggle();
  }

  private async _applyLanguageToggle(): Promise<void> {
    const current = getLanguage();
    const next = current === 'pt-BR' ? 'en' : 'pt-BR';

    setLanguage(next);
    document.documentElement.lang = next;

    try {
      const settings = await storage.getSettings();
      settings.language = next;
      await storage.saveSettings(settings);
    } catch (e) {
      console.error('[SOTE Shell] Failed to persist language change:', e);
    }

    // Re-render labels on active PromptModal while preserving user input
    PromptModal.updateLanguage();

    // For other modals: check if they have unsaved user input in input/textarea elements
    document.querySelectorAll('.confirm-modal-overlay, .token-modal-overlay, .mvm-overlay').forEach((el) => {
      // If this is the active PromptModal, keep it open!
      if (el.querySelector('#prompt-modal-input')) {
        return;
      }

      // Check if this modal has any input with user-entered text
      const inputs = el.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>('input, textarea');
      let hasUserInput = false;
      for (const input of inputs) {
        if (input.value && input.value.trim().length > 0) {
          hasUserInput = true;
          break;
        }
      }

      // If user has input in the modal, preserve it and do not dismiss silently!
      if (hasUserInput) {
        const cancelBtn = el.querySelector<HTMLElement>('#confirm-modal-cancel, .btn-secondary');
        if (cancelBtn && cancelBtn.id === 'confirm-modal-cancel') {
          cancelBtn.textContent = t('common.cancel');
        }
        return;
      }

      // If modal has no unsaved user data (e.g. empty confirmation dialog), close safely
      const closeBtn = el.querySelector<HTMLElement>('.confirm-modal-close, #confirm-modal-cancel, .token-modal-close, .mvm-close');
      if (closeBtn) {
        closeBtn.click();
      } else {
        el.remove();
      }
    });

    // Rebuild shell layout and re-render current route
    this.navLinks.clear();
    this.headerNavLinks.clear();
    this._renderLayout();
    this._refreshBadges();

    if (router.current) {
      await this._completeRouteChange(router.current);
    }

    showToast(next === 'pt-BR' ? 'Idioma alterado para Português' : 'Language changed to English', 'success');
  }

  // ── Layout (pixel-exact from home.htm) ───────────────────────────────────

  private _renderLayout(): void {
    this.root.innerHTML = '';
    this.root.className = 'dash-root';

    // Layout: `.dash-root` agora é a LINHA externa (sidebar | coluna
    // principal), não mais uma coluna com o header em cima de tudo. Isso
    // é o que permite o sidebar ocupar a altura inteira da página (até o
    // topo), com a logo dentro dele — antes o header vinha primeiro, full
    // width, e só then o sidebar começava (por isso ele ficava "preso"
    // abaixo do header, sem chegar ao topo). Ver _buildSidebar() (contém
    // a logo agora) e #dash-sidebar/.dash-main-col em dashboard.css.
    const sidebar = this._buildSidebar();

    const mainCol = document.createElement('div');
    mainCol.className = 'dash-main-col';

    const header = this._buildHeader();

    this.contentArea = document.createElement('main');
    this.contentArea.id = 'dash-content';
    this.contentArea.className = 'dash-content';

    mainCol.appendChild(header);
    mainCol.appendChild(this.contentArea);

    this.root.appendChild(sidebar);
    this.root.appendChild(mainCol);
  }

  /** Left sidebar — 240px, full-height (top da página até embaixo), com a
   * logo no topo seguida da navegação. */
  private _buildSidebar(): HTMLElement {
    const aside = document.createElement('aside');
    aside.id = 'dash-sidebar';
    aside.className = 'dash-sidebar';

    const logo = document.createElement('div');
    logo.className = 'dash-sidebar-logo';
    logo.innerHTML = /* html */ `
      <div class="dash-logo-mark">${ICONS.bolt}</div>
      <span class="dash-logo-text">SOTE</span>
    `;

    const nav = document.createElement('nav');
    nav.className = 'dash-sidebar-nav';

    for (const item of PRIMARY_NAV) {
      nav.appendChild(this._buildNavLink(item));
    }
    for (const item of WORKSPACE_NAV) {
      nav.appendChild(this._buildNavLink(item));
    }

    aside.appendChild(logo);
    aside.appendChild(nav);
    return aside;
  }

  /** Single sidebar nav link element — icon + label + optional badge (Fluxos count). */
  private _buildNavLink(item: NavItem): HTMLAnchorElement {
    const a = document.createElement('a');
    a.href = `#${item.path}`;
    a.className = 'dash-nav-link';
    a.dataset['pattern'] = item.pattern;
    a.setAttribute('role', 'menuitem');

    const showBadge = item.pattern === '/flows' || item.pattern === '/variables';

    a.innerHTML = /* html */ `
      <span class="dash-nav-link-left">
        <span class="dash-nav-icon">${item.icon ?? ''}</span>
        <span class="dash-nav-label">${t(item.label)}</span>
      </span>
      ${showBadge ? `<span class="dash-nav-badge">0</span>` : ''}
    `;

    if (item.pattern === '/flows') {
      this.flowsBadge = a.querySelector<HTMLSpanElement>('.dash-nav-badge');
    }
    if (item.pattern === '/variables') {
      this.variablesBadge = a.querySelector<HTMLSpanElement>('.dash-nav-badge');
    }

    a.addEventListener('click', (e) => {
      e.preventDefault();
      router.navigate(item.path);
    });

    this.navLinks.set(item.pattern, a);
    return a;
  }

  /** Top header — logo + quick-nav (md+) on the left, search + CTA on the right. Sticky. */
  private _buildHeader(): HTMLElement {
    const header = document.createElement('header');
    header.id = 'dash-header';
    header.className = 'dash-header';

    const navLinksHtml = HEADER_NAV.map(
      (item) => `<a href="#${item.path}" class="dash-header-nav-link" data-pattern="${item.pattern}">${t(item.label)}</a>`
    ).join('');

    header.innerHTML = /* html */ `
      <div id="dash-header-default" class="dash-header-default">
        <div class="dash-header-left">
          <nav class="dash-header-nav">${navLinksHtml}</nav>
        </div>

        <div class="dash-header-actions">
          <div class="dash-search-bar">
            <span class="dash-search-icon">${ICONS.search}</span>
            <input
              id="dash-search-input"
              type="text"
              class="dash-search-input"
              placeholder="${t('search.placeholder')}"
              autocomplete="off"
              spellcheck="false"
            />
            <span class="dash-search-kbd">⌘K</span>
          </div>

          <!-- Language Toggle -->
          <button class="dash-icon-btn" id="dash-lang-btn" title="${t('settings.language')} (${getLanguage() === 'pt-BR' ? 'Português' : 'English'})" aria-label="${t('settings.language')}">
            ${ICONS.globe}
          </button>

          <!-- Create New Flow CTA -->
          <button id="dash-create-btn" class="dash-cta-btn" type="button">
            <span class="dash-cta-icon">${ICONS.plus}</span>
            <span class="dash-cta-label">${t('header.create_flow')}</span>
          </button>
        </div>
      </div>

      <!-- Full-bleed pages (e.g. the Flow Editor) replace this slot's
           content instead of stacking a second header underneath the
           default one — see Shell.setHeaderOverride(). -->
      <div id="dash-header-slot" class="dash-header-slot" hidden></div>
    `;

    // Language toggle button listener
    header.querySelector<HTMLButtonElement>('#dash-lang-btn')?.addEventListener('click', async () => {
      await this.toggleLanguage();
    });

    // Header quick-nav links also drive SPA navigation + active state.
    header.querySelectorAll<HTMLAnchorElement>('.dash-header-nav-link').forEach((a) => {
      const pattern = a.dataset['pattern']!;
      const path = a.getAttribute('href')!.slice(1);
      a.addEventListener('click', (e) => {
        e.preventDefault();
        router.navigate(path);
      });
      this.headerNavLinks.set(pattern, a);
    });

    // Create New Flow → ask to save unsaved changes on the current page first (if any).
    // Pages can override this (e.g. Variables opens its own "create variable" modal)
    // by implementing Page.onCreateClick().
    header.querySelector<HTMLButtonElement>('#dash-create-btn')?.addEventListener('click', () => {
      if (this.currentPage && typeof this.currentPage.onCreateClick === 'function') {
        this.currentPage.onCreateClick();
      } else {
        this._handleCreateNewFlow();
      }
    });

    return header;
  }

  /**
   * Handles the "Create New Flow" header CTA. If the page currently mounted
   * has unsaved changes (e.g. the flow editor), asks the user whether to
   * save them before navigating to a fresh flow. Only proceeds to /editor/new
   * once the current work is either saved or explicitly discarded.
   */
  private _handleCreateNewFlow(): void {
    const page = this.currentPage;

    if (page && typeof page.isDirty === 'function' && page.isDirty()) {
      // Unlike the old native confirm() (whose Cancel button still silently
      // discarded the unsaved changes and navigated away — a real footgun),
      // the modal's Cancel now safely stays put; only "Salvar e continuar"
      // proceeds.
      ConfirmModal.show({
        title: t('confirm_modal.save_before_new_title'),
        message: t('shell.save_before_new.desc'),
        confirmLabel: t('common.save_and_continue'),
        onConfirm: async () => {
          if (typeof page.saveFlow === 'function') {
            const saved = await page.saveFlow();
            if (!saved) {
              // Save failed (e.g. validation) — stay put so the user can fix it.
              return;
            }
          }
          this.skipNextDirtyCheck = true;
          router.navigate('/editor/new');
        },
      });
      return;
    }

    this.skipNextDirtyCheck = true;
    router.navigate('/editor/new');
  }

  /**
   * Adapts the shared header per-route:
   *  - Sort control only makes sense on the flows list.
   *  - The CTA label/placeholder switch to variable-flavored copy on /variables,
   *    since its click (Page.onCreateClick) and search input are now driven by
   *    that page instead of a duplicated local header.
   */
  private _updateHeaderControls(route: ResolvedRoute): void {
    const hideSortOn = ['/editor/:id', '/settings', '/variables', '/formularios'];
    const shouldHideSort = hideSortOn.includes(route.pattern);

    const sortBtn = document.getElementById('dash-sort-btn');
    if (sortBtn) sortBtn.style.display = shouldHideSort ? 'none' : '';

    const isVariables = route.pattern === '/variables';
    const isForms = route.pattern === '/formularios';

    const createLabel = document.querySelector('#dash-create-btn .dash-cta-label');
    if (createLabel) {
      createLabel.textContent = isVariables
        ? t('modal.createVariable')
        : isForms
        ? t('forms.new')
        : t('header.create_flow');
    }

    const searchInput = document.getElementById('dash-search-input') as HTMLInputElement | null;
    if (searchInput) {
      searchInput.placeholder = isVariables
        ? t('variables.search_placeholder')
        : isForms
        ? t('forms.search_placeholder')
        : t('search.placeholder');
    }
  }

  // ── Routing ───────────────────────────────────────────────────────────────

  private async _onRouteChange(route: ResolvedRoute): Promise<void> {
    // Guard: if the page we're currently on has unsaved changes, confirm
    // before leaving. This single choke point covers every way the route
    // can change — sidebar links, browser Back/Forward, and (via the
    // skipNextDirtyCheck flag) "Create New Flow", which already handles
    // its own save-before-leaving prompt and shouldn't be asked twice.
    if (this.skipNextDirtyCheck) {
      this.skipNextDirtyCheck = false;
    } else if (
      this.currentPage &&
      typeof this.currentPage.isDirty === 'function' &&
      this.currentPage.isDirty()
    ) {
      // The hash has already changed by the time we get here (that's what
      // triggered this route change), so both outcomes need to actively
      // decide what the address bar should show — there's no "do nothing"
      // option like there was with the old blocking confirm().
      ConfirmModal.show({
        title: t('confirm_modal.leave_unsaved_title'),
        message: t('shell.leave_unsaved.desc'),
        confirmLabel: t('common.leave'),
        onConfirm: () => this._completeRouteChange(route),
        onCancel: () => {
          // Put the address bar back where it was, without remounting
          // anything, since we're staying on the current page.
          if (this.currentRoutePath) {
            router.replace(this.currentRoutePath);
          }
        },
      });
      return;
    }

    await this._completeRouteChange(route);
  }

  /**
   * The actual "swap the mounted page for whatever `route` resolves to"
   * work — split out from `_onRouteChange` so the unsaved-changes prompt
   * above can delay it behind an (async, non-blocking) confirm modal
   * instead of the synchronous native `confirm()` this used to be built
   * around.
   */
  private async _completeRouteChange(route: ResolvedRoute): Promise<void> {
    this.currentRoutePath = route.path;

    // Restore the shared header to its default state before mounting the
    // next page — if the page we're leaving overrode it (the Flow Editor),
    // this guarantees it never leaks into whatever comes next.
    clearHeaderOverride();

    // Update active nav state immediately (no wait for page load).
    this._updateActiveNav(route);
    this._updateHeaderControls(route);

    // Show skeleton while loading.
    this._showSkeleton();


    // Unmount previous page.
    if (this.currentPage) {
      try { this.currentPage.unmount(); } catch (e) { console.error(e); }
      this.currentPage = null;
    }

    // Remove old page element.
    if (this.currentPageEl && this.currentPageEl.parentNode === this.contentArea) {
      this.contentArea.removeChild(this.currentPageEl);
    }
    this.currentPageEl = null;

    // Dynamically load + render new page.
    try {
      const page = await loadPage(route.pattern);
      const el   = page.render();

      this._hideSkeleton();

      this.contentArea.appendChild(el);
      this.currentPage   = page;
      this.currentPageEl = el;

      await page.mount(route.params);
      this._refreshBadges();
    } catch (err) {
      console.error('[SOTE Shell] Page load failed:', err);
      this._hideSkeleton();
      this._showError(String(err));
    }
  }

  /** Highlights the nav link matching the current route pattern. */
  private _updateActiveNav(route: ResolvedRoute): void {
    for (const [pattern, link] of this.navLinks) {
      if (pattern === route.pattern) {
        link.classList.add('is-active');
        link.setAttribute('aria-current', 'page');
      } else {
        link.classList.remove('is-active');
        link.removeAttribute('aria-current');
      }
    }
    for (const [pattern, link] of this.headerNavLinks) {
      link.classList.toggle('is-active', pattern === route.pattern);
    }
  }

  // ── Skeleton / loading state ──────────────────────────────────────────────

  private _showSkeleton(): void {
    // Remove any existing skeleton first.
    this.contentArea.querySelectorAll('.dash-skeleton-wrap').forEach((el) => el.remove());

    const skeleton = document.createElement('div');
    skeleton.className = 'dash-skeleton-wrap';
    skeleton.innerHTML = /* html */ `
      <div class="dash-skeleton-header">
        <div class="dash-skeleton-block" style="width:180px;height:24px;"></div>
        <div class="dash-skeleton-block" style="width:280px;height:16px;margin-top:8px;"></div>
      </div>
      <div class="dash-skeleton-row"></div>
      <div class="dash-skeleton-row" style="opacity:.7;"></div>
      <div class="dash-skeleton-row" style="opacity:.5;"></div>
      <div class="dash-skeleton-row" style="opacity:.3;"></div>
    `;
    this.contentArea.appendChild(skeleton);
  }

  private _hideSkeleton(): void {
    this.contentArea.querySelectorAll('.dash-skeleton-wrap').forEach((el) => el.remove());
  }

  private _showError(msg: string): void {
    const el = document.createElement('div');
    el.className = 'dash-error';
    el.textContent = `Error loading page: ${msg}`;
    this.contentArea.appendChild(el);
  }
}
