import { showToast } from '../shared/components/Toast.js';
/**
 * src/popup/index.ts — SOTE Popup logic
 *
 * Responsibilities:
 *  - Read current settings on open (globalEnabled, snoozeUntil, blocklist)
 *  - Render toggle state, status line, and conditional inline banner
 *  - Handle: master toggle, snooze durations, block-site-permanently, cancel snooze
 *  - Load and render recent snippets (last 3 used flows)
 *  - Open full dashboard in new tab
 *
 * No frameworks — vanilla TypeScript only.
 */

import { storage } from '../shared/storage/StorageService.js';
import { browser } from 'wxt/browser';
import { domainMatchesAny, isExtensionActive, isSnoozeActive } from '../shared/storage/helpers.js';
import { PENDING_SELECTION_KEY } from '../shared/storage/defaults.js';
import { buildSearchResults } from '../content/engine/SearchTriggerDetector.js';
import type { Flow, Settings, Variable } from '../shared/types/index.js';
import { sendMessage } from '../shared/messaging/client.js';
import { t, initI18n, getLanguage } from '../shared/i18n/index.js';
import { escapeHtml, htmlToPreviewText as htmlToPlainText } from '../shared/utils/dom.js';
import { resolveVariablesInText } from '../shared/utils/variableResolver.js';
import { SVG_BOLT, SVG_COPY } from './icons.js';

// ---------------------------------------------------------------------------
// DOM references (asserted non-null — element IDs are guaranteed by index.html)
// ---------------------------------------------------------------------------

const statusDot           = document.getElementById('status-indicator')!        as HTMLDivElement;
const statusState         = document.getElementById('status-state')!            as HTMLSpanElement;
const statusDomainSep     = document.getElementById('status-domain-separator')! as HTMLSpanElement;
const statusDomain        = document.getElementById('status-domain')!           as HTMLSpanElement;

const toggleTrack         = document.getElementById('toggle-track')!          as HTMLDivElement;
const btnSnooze           = document.getElementById('btn-snooze')!            as HTMLButtonElement;
const btnOpenDashboard    = document.getElementById('btn-open-dashboard')!    as HTMLButtonElement;
const btnBlockSitePerm    = document.getElementById('btn-block-site-perm')!   as HTMLButtonElement;

const searchInput         = document.getElementById('search-input')!          as HTMLInputElement;
const snippetsList        = document.getElementById('snippets-list')!         as HTMLDivElement;

const snoozeMenu          = document.getElementById('snooze-menu')!           as HTMLDivElement;
const labelSnoozeTitle    = document.getElementById('label-snooze-title')!   as HTMLDivElement;
const optSnooze15m        = document.getElementById('opt-snooze-15m')!       as HTMLButtonElement;
const optSnooze1h         = document.getElementById('opt-snooze-1h')!        as HTMLButtonElement;
const optSnooze4h         = document.getElementById('opt-snooze-4h')!        as HTMLButtonElement;
const optSnooze8h         = document.getElementById('opt-snooze-8h')!        as HTMLButtonElement;

const labelRecentSnippets = document.getElementById('label-recent-snippets')! as HTMLParagraphElement;
const labelOpenDashboard  = document.getElementById('label-open-dashboard')!  as HTMLSpanElement;
const btnQuickCapture     = document.getElementById('btn-quick-capture')!     as HTMLButtonElement;
const labelQuickCapture   = document.getElementById('label-quick-capture')!   as HTMLSpanElement;
const btnQuickVariables   = document.getElementById('btn-quick-variables')!   as HTMLButtonElement;
const labelQuickVariables = document.getElementById('label-quick-variables')! as HTMLSpanElement;

// Main card and top-level sections
const popupCard           = document.getElementById('popup-card')!            as HTMLDivElement;
const popupHeader         = document.getElementById('popup-header')!          as HTMLDivElement;
const popupBody           = document.getElementById('popup-body')!            as HTMLDivElement;
const popupFooter         = document.getElementById('popup-footer')!          as HTMLDivElement;

// Secondary view: Quick Variables
const viewVariables       = document.getElementById('view-variables')!        as HTMLDivElement;
const btnVarsBack         = document.getElementById('btn-vars-back')!         as HTMLButtonElement;
const labelVarsBack       = document.getElementById('label-vars-back')!       as HTMLSpanElement;
const labelVarsTitle      = document.getElementById('label-vars-title')!      as HTMLSpanElement;
const labelVarsSection    = document.getElementById('label-vars-section')!    as HTMLParagraphElement;
const varsList            = document.getElementById('vars-list')!             as HTMLDivElement;
const btnOpenVarsDash     = document.getElementById('btn-open-variables-dash')! as HTMLButtonElement;
const labelOpenVarsDash   = document.getElementById('label-open-vars-dash')!  as HTMLSpanElement;

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

let currentSettings: Settings;
let currentDomain: string | null = null;
let allFlows: Flow[] = [];
let allVariables: Variable[] = [];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Returns minutes remaining for an active snooze, or null if expired/unset. */
function snoozeMinutesLeft(snoozeUntil: number | undefined): number | null {
  if (!snoozeUntil) return null;
  const remaining = snoozeUntil - Date.now();
  if (remaining <= 0) return null;
  return Math.ceil(remaining / 60_000);
}

/** Formats remaining snooze time as a human-readable string. */
function formatSnoozeRemaining(minutes: number): string {
  if (minutes >= 60) {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return m > 0
      ? t('popup.page.snooze_remaining.hm', { h, m })
      : t('popup.page.snooze_remaining.h', { h });
  }
  return t('popup.page.snooze_remaining.m', { m: minutes });
}

/** Returns the hostname of the current active tab, or null. */
async function getCurrentDomain(): Promise<string | null> {
  try {
    const tabs = await browser.tabs.query({ active: true, currentWindow: true });
    const url = tabs[0]?.url;
    if (!url) return null;
    const parsed = new URL(url);
    // Only block http/https sites.
    if (!['http:', 'https:'].includes(parsed.protocol)) return null;
    return parsed.hostname;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Banner — injected / removed from DOM (no residual whitespace in Active state)
// ---------------------------------------------------------------------------

/**
 * Renders the inline status banner (Paused / Blocked) right before #popup-body.
 * In the Active state, removes the element entirely from the DOM so there is
 * zero residual space or layout impact.
 */
function renderBanner(): void {
  // Always tear down the existing banner first.
  const existing = document.getElementById('status-banner');
  if (existing) existing.remove();

  if (!currentSettings.globalEnabled) {
    // Globally disabled — no banner (handled by toggle being off)
    return;
  }

  if (isSnoozeActive(currentSettings)) {
    // ── Paused banner ──────────────────────────────────────
    const mins = snoozeMinutesLeft(currentSettings.snoozeUntil);
    const timeText = mins ? formatSnoozeRemaining(mins) : (t('popup.page.status_globally') || 'Globally');

    const banner = document.createElement('div');
    banner.id = 'status-banner';
    banner.className = 'status-banner--paused';

    const textEl = document.createElement('span');
    textEl.className = 'banner-text';
    textEl.textContent = t('popup.page.banner_paused', { time: timeText }) || `Paused for ${timeText}`;

    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'banner-cancel';
    cancelBtn.type = 'button';
    cancelBtn.textContent = t('popup.page.banner_cancel') || 'Cancel';
    cancelBtn.addEventListener('click', async () => {
      await sendMessage({ type: 'SNOOZE', payload: { duration: 0 } });
      currentSettings.snoozeUntil = undefined;
      await storage.saveSettings({ snoozeUntil: undefined });
      renderStatus();
      showToast(t('popup.page.pause_cancelled') || 'Pause cancelled', 'info', 2000);
    });

    banner.appendChild(textEl);
    banner.appendChild(cancelBtn);
    if (!viewVariables.hidden) banner.hidden = true;
    popupCard.insertBefore(banner, popupBody);
    return;
  }

  if (currentDomain && domainMatchesAny(currentDomain, currentSettings.blocklist || [])) {
    // ── Blocked banner ─────────────────────────────────────
    const banner = document.createElement('div');
    banner.id = 'status-banner';
    banner.className = 'status-banner--blocked';

    const textEl = document.createElement('span');
    textEl.className = 'banner-text';
    textEl.textContent = t('popup.page.banner_blocked', { domain: currentDomain }) || `Blocked on ${currentDomain}`;

    banner.appendChild(textEl);
    if (!viewVariables.hidden) banner.hidden = true;
    popupCard.insertBefore(banner, popupBody);
    return;
  }

  // Active state — no banner; element is already removed above.
}

// ---------------------------------------------------------------------------
// Render functions
// ---------------------------------------------------------------------------

function renderStatus() {
  statusDot.className = 'status-dot';
  btnSnooze.classList.remove('is-active');
  btnSnooze.title = t('popup.page.snooze_btn_title') || 'Snooze...';

  // Update block-site-perm button label based on whether current domain is blocked
  const isBlocked = !!(currentDomain && domainMatchesAny(currentDomain, currentSettings.blocklist || []));
  btnBlockSitePerm.textContent = isBlocked
    ? t('popup.page.unblock_site') || 'Unblock this site'
    : t('popup.page.block_site_perm') || 'Block this site permanently';

  if (!currentSettings.globalEnabled) {
    statusDot.classList.add('paused');
    statusState.textContent = t('popup.page.state_disabled') || 'Globally Disabled';
    statusDomain.textContent = '';
    statusDomain.title = '';
    statusDomainSep.style.display = 'none';
  } else if (isSnoozeActive(currentSettings)) {
    statusDot.classList.add('paused');
    statusState.textContent = t('popup.page.state_paused') || 'Paused';
    // Domain line shows just current domain (time remaining is in the banner)
    statusDomain.textContent = currentDomain || '';
    statusDomain.title = currentDomain || '';
    statusDomainSep.style.display = currentDomain ? '' : 'none';
    btnSnooze.classList.add('is-active');
    btnSnooze.title = t('popup.page.cancel_pause') || 'Cancel pause';
  } else if (isBlocked) {
    statusDot.classList.add('blocked');
    statusState.textContent = t('popup.page.state_muted') || 'Blocked';
    statusDomain.textContent = currentDomain;
    statusDomain.title = currentDomain;
    statusDomainSep.style.display = '';
  } else {
    statusDot.classList.add('active');
    statusState.textContent = t('popup.page.state_active') || 'Active';
    statusDomain.textContent = currentDomain || '';
    statusDomain.title = currentDomain || '';
    statusDomainSep.style.display = currentDomain ? '' : 'none';
  }

  // Always re-render the banner after updating status state.
  renderBanner();
}

/** Applies toggle visual state — does NOT write to storage. */
function renderToggle(enabled: boolean): void {
  renderStatus();
  if (enabled) {
    toggleTrack.classList.add('is-on');
    toggleTrack.setAttribute('aria-checked', 'true');
    toggleTrack.setAttribute('aria-label', t('popup.page.enabled'));
    toggleTrack.title = t('popup.page.enabled');
  } else {
    toggleTrack.classList.remove('is-on');
    toggleTrack.setAttribute('aria-checked', 'false');
    toggleTrack.setAttribute('aria-label', t('popup.page.disabled'));
    toggleTrack.title = t('popup.page.disabled');
  }
}

/**
 * Replaces every `{{KEY}}` placeholder in plain text with the matching
 * Global Variable's value. Thin wrapper around the shared resolver so
 * call sites here don't need to pass `allVariables` explicitly.
 */
function resolveVariablesText(text: string): string {
  return resolveVariablesInText(text, false, allVariables);
}

/** Builds a snippet row DOM element matching ref_pages/popup.htm exactly. */
function buildSnippetRow(flow: Flow): HTMLDivElement {
  // Extract shortcut from first trigger block.
  const triggerBlock = flow.blocks.find((b) => b.type === 'trigger');
  const shortcut = escapeHtml(
    triggerBlock ? `/${(triggerBlock.data as { shortcut: string }).shortcut}` : `/${flow.name}`,
  );

  // Extract preview text from first action block: strip the rich-text
  // HTML down to plain text, then resolve any {{KEY}} Global Variable
  // placeholders against their actual values.
  const actionBlock = flow.blocks.find((b) => b.type === 'action');
  const rawContent = actionBlock ? (actionBlock.data as { content: string }).content : '';
  const previewPlain = actionBlock
    ? resolveVariablesText(htmlToPlainText(rawContent)).slice(0, 60)
    : '—';
  const preview = escapeHtml(previewPlain);

  const row = document.createElement('div');
  row.className = 'snippet-row';

  row.innerHTML = /* html */ `
    <div class="snippet-icon-box">
      ${SVG_BOLT}
    </div>
    <div class="snippet-text-block">
      <p class="snippet-shortcut">${shortcut}</p>
      <p class="snippet-preview">${preview}</p>
    </div>
    <button class="snippet-copy-btn" type="button" title="${t('popup.page.copy_title')}">
      ${SVG_COPY}
    </button>
  `;

  // Copy-to-clipboard handler.
  const copyBtn = row.querySelector<HTMLButtonElement>('.snippet-copy-btn')!;
  copyBtn.addEventListener('click', async (e) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(previewPlain);
      showToast(t('popup.page.copied'), 'info', 2000);
    } catch {
      showToast(t('popup.page.copy_failed'), 'info', 2000);
    }
  });

  return row;
}

/** Renders the recent snippets list (up to 3, sorted by lastUsed desc). */
function renderSnippets(flows: Flow[], query: string): void {
  snippetsList.innerHTML = '';

  let filtered: Flow[] = [];
  if (query) {
    const searchParams = {
      query,
      scope: 'global' as const,
      hostname: '',
      forms: [],
      flows: flows,
      includeFlows: true
    };
    const searchOut = buildSearchResults(searchParams);
    filtered = searchOut.results.map((r: any) => r.flow);
  } else {
    filtered = flows
        .filter((f) => f.enabled && f.stats.lastUsed)
        .sort((a, b) => (b.stats.lastUsed ?? 0) - (a.stats.lastUsed ?? 0))
        .slice(0, 3);
  }

  if (filtered.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'snippet-preview';
    empty.style.padding = '0.25rem 0.25rem';
    empty.textContent = query ? t('popup.page.no_results') : t('popup.page.no_recent_snippets');
    snippetsList.appendChild(empty);
    return;
  }

  filtered.slice(0, 5).forEach((flow) => {
    snippetsList.appendChild(buildSnippetRow(flow));
  });
}

// ---------------------------------------------------------------------------
// Event handlers
// ---------------------------------------------------------------------------

/** Toggle globalEnabled */
toggleTrack.addEventListener('click', async () => {
  const next = !currentSettings.globalEnabled;
  currentSettings.globalEnabled = next;
  renderToggle(next);
  await storage.saveSettings({ globalEnabled: next });
});

// Keyboard support for toggle (Space/Enter).
toggleTrack.addEventListener('keydown', (e) => {
  if (e.key === ' ' || e.key === 'Enter') {
    e.preventDefault();
    toggleTrack.click();
  }
});

/** Toggle Snooze dropdown or Cancel if already snoozed */
btnSnooze.addEventListener('click', async (e) => {
  e.stopPropagation();
  if (isSnoozeActive(currentSettings)) {
    await sendMessage({ type: 'SNOOZE', payload: { duration: 0 } });
    currentSettings.snoozeUntil = undefined;
    await storage.saveSettings({ snoozeUntil: undefined });
    snoozeMenu.hidden = true;
    renderStatus();
    showToast(t('popup.page.pause_cancelled') || 'Pause cancelled', 'info', 2000);
  } else {
    snoozeMenu.hidden = !snoozeMenu.hidden;
  }
});

/** Handle clicking a snooze duration option */
const snoozeOptions = snoozeMenu.querySelectorAll<HTMLButtonElement>('.snooze-option:not(.snooze-option--block)');
snoozeOptions.forEach((btn) => {
  btn.addEventListener('click', async (e) => {
    e.stopPropagation();
    const duration = Number(btn.getAttribute('data-duration'));
    if (!duration) return;

    const res = await sendMessage({ type: 'SNOOZE', payload: { duration } });
    if (res && res.success) {
      currentSettings.snoozeUntil = res.snoozeUntil;
      snoozeMenu.hidden = true;
      renderStatus();

      const toastKey = btn.id === 'opt-snooze-15m'
        ? 'popup.page.snoozed_15m'
        : btn.id === 'opt-snooze-1h'
        ? 'popup.page.snoozed_1h'
        : btn.id === 'opt-snooze-4h'
        ? 'popup.page.snoozed_4h'
        : 'popup.page.snoozed_8h';

      showToast(t(toastKey) || 'Paused', 'info', 2000);
    }
  });
});

/** Block / unblock current site permanently (from snooze menu) */
btnBlockSitePerm.addEventListener('click', async (e) => {
  e.stopPropagation();
  snoozeMenu.hidden = true;

  if (!currentDomain) {
    showToast(t('popup.page.no_site_to_block'), 'info', 2000);
    return;
  }

  const blocklist = [...(currentSettings.blocklist ?? [])];
  const idx = blocklist.indexOf(currentDomain);

  if (idx >= 0) {
    // Already blocked — unblock.
    blocklist.splice(idx, 1);
    currentSettings.blocklist = blocklist;
    await storage.saveSettings({ blocklist });
    renderStatus();
    showToast(t('popup.page.site_unblocked', { domain: currentDomain }), 'info', 2000);
  } else {
    // Block it via messaging.
    await sendMessage({ type: 'BLOCKLIST_ADD', payload: { domain: currentDomain } });
    blocklist.push(currentDomain);
    currentSettings.blocklist = blocklist;
    renderStatus();
    showToast(t('popup.page.site_muted_toast', { domain: currentDomain }), 'info', 2000);
  }
});

/** Close snooze menu when clicking outside or pressing Escape */
document.addEventListener('click', (e) => {
  if (!snoozeMenu.hidden && !snoozeMenu.contains(e.target as Node) && e.target !== btnSnooze) {
    snoozeMenu.hidden = true;
  }
});

/**
 * Critério de ordenação para Variáveis Rápidas:
 * A ordenação prioritária é pela contagem de uso (`usageCount` decrescente)
 * e, em caso de empate, pela data de modificação (`updatedAt` decrescente).
 * Limitamos o retorno a no máximo 5 variáveis para garantir que o popup permaneça compacto,
 * sem rolagem vertical excessiva, respeitando o design system.
 */
export function getTopQuickVariables(vars: Variable[] = []): Variable[] {
  const list = Array.isArray(vars) ? vars : Object.values(vars || {});
  return [...list]
    .sort((a, b) => {
      const usageDiff = (b.usageCount ?? 0) - (a.usageCount ?? 0);
      if (usageDiff !== 0) return usageDiff;
      return (b.updatedAt || 0) - (a.updatedAt || 0);
    })
    .slice(0, 5);
}

function renderQuickVariables(): void {
  varsList.innerHTML = '';
  const topVars = getTopQuickVariables(allVariables || []);

  if (topVars.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'vars-empty';
    empty.textContent = t('popup.page.vars_empty');
    varsList.appendChild(empty);
    return;
  }

  topVars.forEach((v) => {
    const item = document.createElement('div');
    item.className = 'quick-var-item';

    const header = document.createElement('div');
    header.className = 'quick-var-header';

    const keyEl = document.createElement('code');
    keyEl.className = 'quick-var-key';
    keyEl.textContent = `{{${v.key}}}`;
    header.appendChild(keyEl);

    if (v.description) {
      const descEl = document.createElement('span');
      descEl.className = 'quick-var-desc';
      descEl.textContent = v.description;
      descEl.title = v.description;
      header.appendChild(descEl);
    }

    const inputWrap = document.createElement('div');
    inputWrap.className = 'quick-var-input-wrap';

    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'quick-var-input';
    input.value = v.value;
    input.spellcheck = false;
    input.setAttribute('data-var-id', v.id);
    input.setAttribute('aria-label', v.key);

    let originalValue = v.value;
    let isSaving = false;

    const commitChange = async () => {
      const newVal = input.value;
      if (newVal === originalValue || isSaving) return;

      isSaving = true;
      try {
        const updatedVar: Variable = {
          ...v,
          value: newVal,
          updatedAt: Date.now(),
        };
        await storage.saveVariable(updatedVar);
        originalValue = newVal;
        v.value = newVal;
        v.updatedAt = updatedVar.updatedAt;

        // Keep local in-memory allVariables in sync
        const idx = allVariables.findIndex((item) => item.id === v.id);
        if (idx >= 0) {
          allVariables[idx] = updatedVar;
        }

        showToast(t('popup.page.var_saved'), 'success', 2000);
      } catch (err) {
        console.error('[SOTE Popup] Failed to save variable:', err);
        showToast(t('popup.page.var_save_failed'), 'error', 2000);
      } finally {
        isSaving = false;
      }
    };

    input.addEventListener('blur', () => {
      commitChange();
    });

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        commitChange();
        input.blur();
      } else if (e.key === 'Escape') {
        e.stopPropagation();
        input.value = originalValue;
        input.blur();
      }
    });

    inputWrap.appendChild(input);
    item.appendChild(header);
    item.appendChild(inputWrap);
    varsList.appendChild(item);
  });
}

function showVariablesView(): void {
  popupHeader.hidden = true;
  const banner = document.getElementById('status-banner');
  if (banner) banner.hidden = true;
  popupBody.hidden = true;
  popupFooter.hidden = true;
  viewVariables.hidden = false;
  renderQuickVariables();
}

function showMainView(): void {
  viewVariables.hidden = true;
  popupHeader.hidden = false;
  const banner = document.getElementById('status-banner');
  if (banner) banner.hidden = false;
  popupBody.hidden = false;
  popupFooter.hidden = false;
  renderSnippets(allFlows || [], searchInput.value.trim());
}

/** Quick Capture button handler */
btnQuickCapture.addEventListener('click', async () => {
  try {
    const tabs = await browser.tabs.query({ active: true, currentWindow: true });
    const tab = tabs[0];
    if (!tab?.id) {
      showToast(t('popup.page.quick_capture_no_selection'), 'info', 2000);
      return;
    }

    let selectionText = '';
    try {
      const res = await browser.tabs.sendMessage(tab.id, { type: 'GET_SELECTION' });
      const rawText = typeof res === 'string' ? res : (res?.text || '');
      selectionText = (rawText || '').trim();
    } catch (err) {
      console.debug('[SOTE Popup] Could not get selection from active tab:', err);
    }

    if (!selectionText) {
      showToast(t('popup.page.quick_capture_no_selection'), 'info', 2000);
      return;
    }

    await browser.storage.local.set({ [PENDING_SELECTION_KEY]: selectionText });
    await browser.tabs.create({
      url: browser.runtime.getURL('/dashboard.html') + '#/editor/new',
    });
    window.close();
  } catch (err) {
    console.error('[SOTE Popup] Quick capture failed:', err);
    showToast(t('popup.page.quick_capture_no_selection'), 'info', 2000);
  }
});

/** Quick Variables button handler */
btnQuickVariables.addEventListener('click', () => {
  showVariablesView();
});

/** Return from Quick Variables to Main view */
btnVarsBack.addEventListener('click', () => {
  showMainView();
});

/** Open full Variables page on Dashboard */
btnOpenVarsDash.addEventListener('click', () => {
  browser.tabs.create({
    url: browser.runtime.getURL('/dashboard.html') + '#/variables',
  });
  window.close();
});

/** Close snooze menu or variables screen on Escape, and handle global shortcuts */
document.addEventListener('keydown', (e) => {
  // Guard against IME / virtual keyboard text composition on mobile
  if (e.isComposing) return;

  if (e.key === 'Escape') {
    if (!snoozeMenu.hidden) {
      snoozeMenu.hidden = true;
      return;
    }
    if (!viewVariables.hidden) {
      showMainView();
      return;
    }
  }

  // Alt+C: Quick Capture (guarded against AltGr / Ctrl / Meta)
  if (e.altKey && !e.ctrlKey && !e.metaKey && (e.key === 'c' || e.key === 'C')) {
    e.preventDefault();
    btnQuickCapture.click();
    return;
  }

  // Alt+V: Quick Variables toggle (guarded against AltGr / Ctrl / Meta)
  if (e.altKey && !e.ctrlKey && !e.metaKey && (e.key === 'v' || e.key === 'V')) {
    e.preventDefault();
    if (!viewVariables.hidden) {
      showMainView();
    } else {
      showVariablesView();
    }
    return;
  }

  // /: Focus search input if not currently typing in an input/textarea/contenteditable
  if (e.key === '/' && !e.ctrlKey && !e.altKey && !e.metaKey) {
    const target = e.target as HTMLElement | null;
    const isTyping =
      target &&
      (target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable);
    if (!isTyping) {
      e.preventDefault();
      searchInput.focus();
    }
  }
});

/** Open full dashboard */
btnOpenDashboard.addEventListener('click', () => {
  browser.tabs.create({
    url: browser.runtime.getURL('/dashboard.html'),
  });
  window.close();
});

/** Live search */
let searchDebounceTimer: number | null = null;
searchInput.addEventListener('input', () => {
  if (searchDebounceTimer !== null) clearTimeout(searchDebounceTimer);
  searchDebounceTimer = window.setTimeout(() => {
    renderSnippets(allFlows, searchInput.value.trim());
  }, 150);
});

// ---------------------------------------------------------------------------
// Initialise
// ---------------------------------------------------------------------------

async function init(): Promise<void> {
  // Language comes from Settings, same source the dashboard reads from —
  // must resolve before anything below calls t(), or every label renders
  // in the fallback language for one frame (or permanently, if init()
  // never re-runs after this point, which it doesn't).
  await initI18n();
  document.documentElement.lang = getLanguage();

  // Static labels — the dynamic ones (toggle, snooze countdown, banner)
  // are (re)populated by their own render*() functions below.
  labelRecentSnippets.textContent = t('popup.page.recent_snippets');
  labelOpenDashboard.textContent  = t('popup.page.open_dashboard');
  searchInput.placeholder         = t('popup.page.search_placeholder');
  labelQuickCapture.textContent   = t('popup.page.quick_capture');
  labelQuickVariables.textContent = t('popup.page.quick_variables');

  labelVarsBack.textContent       = t('popup.page.vars_back');
  labelVarsTitle.textContent      = t('popup.page.vars_title');
  labelVarsSection.textContent    = t('popup.page.vars_section');
  labelOpenVarsDash.textContent   = t('popup.page.vars_open_dashboard');

  labelSnoozeTitle.textContent    = t('popup.page.snooze_options_title');
  optSnooze15m.textContent        = t('popup.page.snooze_15m');
  optSnooze1h.textContent         = t('popup.page.snooze_1h_short');
  optSnooze4h.textContent         = t('popup.page.snooze_4h_short');
  optSnooze8h.textContent         = t('popup.page.snooze_8h');

  // Parallelise all async reads for fast startup (<100ms target).
  const [settings, flows, variables, domain] = await Promise.all([
    storage.getSettings(),
    storage.getFlows(),
    storage.getVariables(),
    getCurrentDomain(),
  ]);

  currentSettings = settings;
  allFlows        = flows;
  allVariables    = variables;
  currentDomain   = domain;

  // Apply initial render.
  renderToggle(settings.globalEnabled);
  
  renderSnippets(flows, '');
  searchInput.focus();
}

// Boot on DOMContentLoaded (already fired since script is deferred by module).
init().catch((err) => console.error('[SOTE Popup] init failed:', err));
