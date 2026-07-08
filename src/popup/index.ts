/**
 * src/popup/index.ts — SOTE Popup logic
 *
 * Responsibilities:
 *  - Read current settings on open (globalEnabled, snoozeUntil, blocklist)
 *  - Render toggle state, snooze banner, site-block state
 *  - Handle: toggle, snooze 1h, snooze 4h, block site, cancel snooze
 *  - Load and render recent snippets (last 3 used flows)
 *  - Open full dashboard in new tab
 *
 * No frameworks — vanilla TypeScript only.
 */

import { storage } from '../shared/storage/StorageService.js';
import type { Flow, Settings, Variable } from '../shared/types/index.js';
import { sendMessage } from '../shared/messaging/client.js';

// ---------------------------------------------------------------------------
// DOM references (asserted non-null — element IDs are guaranteed by index.html)
// ---------------------------------------------------------------------------

const toggleTrack   = document.getElementById('toggle-track')!   as HTMLDivElement;
const toggleLabel   = document.getElementById('toggle-label')!   as HTMLSpanElement;
const pauseGrid     = document.getElementById('pause-grid')!     as HTMLDivElement;
const snoozeBanner  = document.getElementById('popup-snooze-banner')! as HTMLDivElement;
const snoozeText    = document.getElementById('snooze-remaining-text')! as HTMLSpanElement;
const snippetsList  = document.getElementById('snippets-list')!  as HTMLDivElement;
const blockBtnLabel = document.getElementById('block-btn-label')! as HTMLSpanElement;
const feedbackToast = document.getElementById('feedback-toast')! as HTMLDivElement;
const searchInput   = document.getElementById('search-input')!   as HTMLInputElement;

const btnSnooze1h      = document.getElementById('btn-snooze-1h')!      as HTMLButtonElement;
const btnSnooze4h      = document.getElementById('btn-snooze-4h')!      as HTMLButtonElement;
const btnBlockSite     = document.getElementById('btn-block-site')!     as HTMLButtonElement;
const btnCancelSnooze  = document.getElementById('btn-cancel-snooze')!  as HTMLButtonElement;
const btnOpenDashboard = document.getElementById('btn-open-dashboard')! as HTMLButtonElement;

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

let currentSettings: Settings;
let currentDomain: string | null = null;
let allFlows: Flow[] = [];
let allVariables: Variable[] = [];
let toastTimer: ReturnType<typeof setTimeout> | null = null;

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
    return m > 0 ? `Paused for ${h}h ${m}m more` : `Paused for ${h}h more`;
  }
  return `Paused for ${minutes}m more`;
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

/** Shows a brief toast message and auto-dismisses it after 2 seconds. */
function showToast(message: string): void {
  feedbackToast.textContent = message;
  feedbackToast.classList.add('is-visible');

  if (toastTimer !== null) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    feedbackToast.classList.remove('is-visible');
    toastTimer = null;
  }, 2000);
}

// ---------------------------------------------------------------------------
// Render functions
// ---------------------------------------------------------------------------

/** Applies toggle visual state — does NOT write to storage. */
function renderToggle(enabled: boolean): void {
  if (enabled) {
    toggleTrack.classList.add('is-on');
    toggleTrack.setAttribute('aria-checked', 'true');
    toggleLabel.textContent = 'Enabled';
  } else {
    toggleTrack.classList.remove('is-on');
    toggleTrack.setAttribute('aria-checked', 'false');
    toggleLabel.textContent = 'Disabled';
  }
}

/** Renders the snooze section — grid vs. banner. */
function renderSnooze(snoozeUntil: number | undefined): void {
  const minutesLeft = snoozeMinutesLeft(snoozeUntil);

  if (minutesLeft !== null) {
    // Snooze is active: hide grid, show banner.
    pauseGrid.style.display    = 'none';
    snoozeBanner.classList.add('is-visible');
    snoozeText.textContent = formatSnoozeRemaining(minutesLeft);
  } else {
    // Not snoozed: show grid, hide banner.
    pauseGrid.style.display    = '';
    snoozeBanner.classList.remove('is-visible');
  }
}

/** Renders the "Mute on Site" button label based on blocklist state. */
function renderBlockSiteBtn(domain: string | null, blocklist: string[]): void {
  if (!domain) {
    blockBtnLabel.textContent = 'Mute on Site';
    btnBlockSite.title = 'No site to block';
    return;
  }

  const isBlocked = blocklist.includes(domain);
  if (isBlocked) {
    blockBtnLabel.textContent = 'Site Muted';
    btnBlockSite.classList.add('is-active');
  } else {
    blockBtnLabel.textContent = 'Mute on Site';
    btnBlockSite.classList.remove('is-active');
    btnBlockSite.title = `Block ${domain}`;
  }
}

// ---------------------------------------------------------------------------
// SVG icon template (bolt — used in snippet rows, identical to ref)
// ---------------------------------------------------------------------------

const SVG_BOLT = /* html */ `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512" aria-hidden="true" fill="currentColor">
  <path d="M349.4 44.6c5.9-13.7 1.5-29.7-10.6-38.5s-28.6-8-39.9 1.8l-256 224c-10 8.8-13.6 22.9-8.9 35.3S50.7 288 64 288H175.5L98.6 467.4c-5.9 13.7-1.5 29.7 10.6 38.5s28.6 8 39.9-1.8l256-224c10-8.8 13.6-22.9 8.9-35.3s-16.6-20.7-30-20.7H272.5L349.4 44.6z"/>
</svg>`;

const SVG_COPY = /* html */ `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" aria-hidden="true" fill="currentColor">
  <path d="M448 384H256c-35.3 0-64-28.7-64-64V64c0-35.3 28.7-64 64-64H396.1c12.7 0 24.9 5.1 33.9 14.1l67.9 67.9c9 9 14.1 21.2 14.1 33.9V320c0 35.3-28.7 64-64 64zM64 128h96v48H64c-8.8 0-16 7.2-16 16V448c0 8.8 7.2 16 16 16H256c8.8 0 16-7.2 16-16V416h48v32c0 35.3-28.7 64-64 64H64c-35.3 0-64-28.7-64-64V192c0-35.3 28.7-64 64-64z"/>
</svg>`;

function escapeHtml(str: string): string {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

/**
 * Converts the rich HTML produced by the Action-block contenteditable
 * editor (e.g. "<p>Hello</p><p>World</p>") into a single line of plain
 * text. Mirrors dashboard/pages/flows.ts's htmlToPreviewText — without
 * this, slicing raw HTML and dropping it straight into another element's
 * innerHTML can produce nested/broken tags (multi-line previews) and
 * shows literal tags instead of text.
 */
function htmlToPlainText(html: string): string {
  const withBreaks = (html || '').replace(/<\/(p|div|li|h[1-6])>|<br\s*\/?>/gi, ' $&');
  const div = document.createElement('div');
  div.innerHTML = withBreaks;
  return (div.textContent || div.innerText || '').replace(/\s+/g, ' ').trim();
}

/**
 * Replaces every `{{KEY}}` placeholder in plain text with the matching
 * Global Variable's value, same substitution the runtime engine performs
 * in content.ts and the editor's Preview modal performs in PreviewModal.ts.
 * Unknown keys are left untouched.
 */
function resolveVariablesText(text: string): string {
  if (!allVariables.length || !text.includes('{{')) return text;
  const map = new Map(allVariables.map((v) => [v.key, v.value]));
  return text.replace(/\{\{\s*([A-Z0-9_]+)\s*\}\}/g, (match, key: string) => {
    const value = map.get(key);
    return value === undefined ? match : value;
  });
}

/** Builds a snippet row DOM element matching ref_pages/popup.htm exactly. */
function buildSnippetRow(flow: Flow): HTMLDivElement {
  // Extract shortcut from first trigger block.
  const triggerBlock = flow.blocks.find((b) => b.type === 'trigger');
  const shortcut = triggerBlock
    ? `/${(triggerBlock.data as { shortcut: string }).shortcut}`
    : `/${flow.name}`;

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
    <button class="snippet-copy-btn" type="button" title="Copy to clipboard">
      ${SVG_COPY}
    </button>
  `;

  // Copy-to-clipboard handler.
  const copyBtn = row.querySelector<HTMLButtonElement>('.snippet-copy-btn')!;
  copyBtn.addEventListener('click', async (e) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(previewPlain);
      showToast('Copied!');
    } catch {
      showToast('Copy failed');
    }
  });

  return row;
}

/** Renders the recent snippets list (up to 3, sorted by lastUsed desc). */
function renderSnippets(flows: Flow[], query: string): void {
  snippetsList.innerHTML = '';

  const filtered = query
    ? flows.filter((f) => {
        const triggerBlock = f.blocks.find((b) => b.type === 'trigger');
        const shortcut = triggerBlock
          ? (triggerBlock.data as { shortcut: string }).shortcut
          : f.name;
        return (
          shortcut.toLowerCase().includes(query.toLowerCase()) ||
          f.name.toLowerCase().includes(query.toLowerCase())
        );
      })
    : flows
        .filter((f) => f.enabled && f.stats.lastUsed)
        .sort((a, b) => (b.stats.lastUsed ?? 0) - (a.stats.lastUsed ?? 0))
        .slice(0, 3);

  if (filtered.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'snippet-preview';
    empty.style.padding = '0.25rem 0.25rem';
    empty.textContent = query ? 'No results found.' : 'No recent snippets.';
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

/** Snooze 1 hour */
btnSnooze1h.addEventListener('click', async () => {
  const res = await sendMessage({ type: 'SNOOZE', payload: { duration: 60 * 60 * 1000 } });
  if (res && res.success) {
    currentSettings.snoozeUntil = res.snoozeUntil;
    renderSnooze(res.snoozeUntil);
    showToast('Snoozed for 1 hour');
  }
});

/** Snooze 4 hours */
btnSnooze4h.addEventListener('click', async () => {
  const res = await sendMessage({ type: 'SNOOZE', payload: { duration: 4 * 60 * 60 * 1000 } });
  if (res && res.success) {
    currentSettings.snoozeUntil = res.snoozeUntil;
    renderSnooze(res.snoozeUntil);
    showToast('Snoozed for 4 hours');
  }
});

/** Cancel snooze */
btnCancelSnooze.addEventListener('click', async () => {
  // We can just use the SNOOZE message with 0 duration, or handle it via storage since it cancels.
  // Using SNOOZE with negative duration or 0 can work. Let's send 0.
  const res = await sendMessage({ type: 'SNOOZE', payload: { duration: 0 } });
  currentSettings.snoozeUntil = undefined;
  await storage.saveSettings({ snoozeUntil: undefined }); // Also do it directly to be safe
  renderSnooze(undefined);
  showToast('Pause cancelled');
});

/** Block / unblock current site */
btnBlockSite.addEventListener('click', async () => {
  if (!currentDomain) {
    showToast('No site to block');
    return;
  }

  const blocklist = [...(currentSettings.blocklist ?? [])];
  const idx = blocklist.indexOf(currentDomain);

  if (idx >= 0) {
    // Already blocked — unblock. We can just do this via storage.
    blocklist.splice(idx, 1);
    currentSettings.blocklist = blocklist;
    await storage.saveSettings({ blocklist });
    renderBlockSiteBtn(currentDomain, blocklist);
    showToast(`${currentDomain} unblocked`);
  } else {
    // Block it via messaging.
    await sendMessage({ type: 'BLOCKLIST_ADD', payload: { domain: currentDomain } });
    blocklist.push(currentDomain);
    currentSettings.blocklist = blocklist;
    renderBlockSiteBtn(currentDomain, blocklist);
    showToast(`${currentDomain} muted`);
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
searchInput.addEventListener('input', () => {
  renderSnippets(allFlows, searchInput.value.trim());
});

// ---------------------------------------------------------------------------
// Initialise
// ---------------------------------------------------------------------------

async function init(): Promise<void> {
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
  renderSnooze(settings.snoozeUntil);
  renderBlockSiteBtn(domain, settings.blocklist ?? []);
  renderSnippets(flows, '');
}

// Boot on DOMContentLoaded (already fired since script is deferred by module).
init().catch((err) => console.error('[SOTE Popup] init failed:', err));
