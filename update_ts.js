const fs = require('fs');
let ts = fs.readFileSync('src/popup/index.ts', 'utf8');

// 1. Add import for buildSearchResults and SVG_BELL (for unmute)
ts = ts.replace(
  "import { domainMatchesAny, isExtensionActive } from '../shared/storage/helpers.js';",
  "import { domainMatchesAny, isExtensionActive, isSnoozeActive } from '../shared/storage/helpers.js';\nimport { buildSearchResults } from '../content/engine/SearchTriggerDetector.js';"
);

// We need an SVG for "eye" (unmute) and "bell". Let's use the snooze outline for snooze, but what for unmute?
// We already have eye-slash in HTML.

// 2. Update the DOM elements queried
ts = ts.replace(
  "const labelQuickPause = document.getElementById('label-quick-pause')!;",
  ""
);
ts = ts.replace(
  "const btnSnooze1h = document.getElementById('btn-snooze-1h') as HTMLButtonElement;",
  "const btnSnooze = document.getElementById('btn-snooze') as HTMLButtonElement;"
);
ts = ts.replace(
  "const btnSnooze4h = document.getElementById('btn-snooze-4h') as HTMLButtonElement;",
  ""
);
ts = ts.replace(
  "const labelSnooze1h = document.getElementById('label-snooze-1h')!;\nconst labelSnooze4h = document.getElementById('label-snooze-4h')!;\nconst labelCancelPause = document.getElementById('label-cancel-pause')!;",
  ""
);
ts = ts.replace(
  "const btnCancelSnooze = document.getElementById('btn-cancel-snooze') as HTMLButtonElement;",
  ""
);
ts = ts.replace(
  "const popupSnoozeBanner = document.getElementById('popup-snooze-banner')!;",
  ""
);
ts = ts.replace(
  "const pauseGrid = document.getElementById('pause-grid')!;",
  ""
);

ts = ts.replace(
  "// ---------------------------------------------------------------------------",
  `const statusDot = document.getElementById('status-indicator')!;
const statusState = document.getElementById('status-state')!;
const statusDomain = document.getElementById('status-domain')!;

// ---------------------------------------------------------------------------`
);


// 3. Update Status renderer
// Remove renderSnooze and renderBlockSiteBtn
const renderSnoozeRegex = /\/\*\* Renders the snooze banner .*?\}\n/s;
const renderBlockSiteBtnRegex = /\/\*\* Renders the block-site button .*?\}\n/s;
ts = ts.replace(renderSnoozeRegex, "");
ts = ts.replace(renderBlockSiteBtnRegex, "");

// Add renderStatus
ts = ts.replace(
  "/** Renders the master toggle",
  `function renderStatus() {
  statusDot.className = 'status-dot';
  btnSnooze.classList.remove('is-active');
  btnBlockSite.classList.remove('is-active');
  btnBlockSite.title = t('popup.page.mute_site') || 'Mute on site';
  btnSnooze.title = t('popup.page.snooze_4h') || 'Snooze 4 Hours';

  if (!currentDomain) {
    statusDomain.textContent = '';
  } else {
    statusDomain.textContent = 'on ' + currentDomain;
  }

  if (!currentSettings.globalEnabled) {
    statusDot.classList.add('paused');
    statusState.textContent = t('popup.page.state_disabled') || 'Disabled';
    statusDomain.textContent = 'Globally';
  } else if (isSnoozeActive(currentSettings)) {
    statusDot.classList.add('paused');
    statusState.textContent = t('popup.page.state_paused') || 'Paused';
    statusDomain.textContent = 'Globally';
    btnSnooze.classList.add('is-active');
    btnSnooze.title = t('popup.page.cancel_pause') || 'Cancel pause';
  } else if (currentDomain && domainMatchesAny(currentDomain, currentSettings.blocklist || [])) {
    statusDot.classList.add('blocked');
    statusState.textContent = t('popup.page.state_muted') || 'Muted';
    btnBlockSite.classList.add('is-active');
    btnBlockSite.title = t('popup.page.unmute_site') || 'Unmute on site';
  } else {
    statusDot.classList.add('active');
    statusState.textContent = t('popup.page.state_active') || 'Active';
  }
}

/** Renders the master toggle`
);

// Update renderToggle to also call renderStatus
ts = ts.replace(
  "function renderToggle(enabled: boolean): void {",
  "function renderToggle(enabled: boolean): void {\n  renderStatus();"
);


// 4. Update renderSnippets to use buildSearchResults
ts = ts.replace(
  /function renderSnippets\(flows: Flow\[\], query: string\): void \{[\s\S]*?if \(filtered\.length === 0\) \{/s,
  `function renderSnippets(flows: Flow[], query: string): void {
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

  if (filtered.length === 0) {`
);

// 5. Update snooze handlers
const snooze1hRegex = /\/\*\* Snooze 1 hour \*\/[\s\S]*?(?=\/\*\* Snooze 4 hours \*\/)/s;
ts = ts.replace(snooze1hRegex, "");

const snooze4hRegex = /\/\*\* Snooze 4 hours \*\/[\s\S]*?\}\);/s;
ts = ts.replace(snooze4hRegex, `/** Toggle Snooze (4 hours or cancel) */
btnSnooze.addEventListener('click', async () => {
  if (isSnoozeActive(currentSettings)) {
    await sendMessage({ type: 'SNOOZE', payload: { duration: 0 } });
    currentSettings.snoozeUntil = undefined;
    await storage.saveSettings({ snoozeUntil: undefined });
    renderStatus();
    showToast(t('popup.page.pause_cancelled') || 'Pause cancelled', 'info', 2000);
  } else {
    const res = await sendMessage({ type: 'SNOOZE', payload: { duration: 4 * 60 * 60 * 1000 } });
    if (res && res.success) {
      currentSettings.snoozeUntil = res.snoozeUntil;
      renderStatus();
      showToast(t('popup.page.snoozed_4h') || 'Paused for 4 hours', 'info', 2000);
    }
  }
});`);

const cancelSnoozeRegex = /\/\*\* Cancel snooze \*\/[\s\S]*?(?=\/\*\* Block \/ unblock current site \*\/)/s;
ts = ts.replace(cancelSnoozeRegex, "");

// 6. Update block site handler to use renderStatus
ts = ts.replace("renderBlockSiteBtn(currentDomain, blocklist);", "renderStatus();");
ts = ts.replace("renderBlockSiteBtn(currentDomain, blocklist);", "renderStatus();");

// 7. Debounce search
const searchRegex = /\/\*\* Live search \*\/[\s\S]*?\}\);/s;
ts = ts.replace(searchRegex, `/** Live search */
let searchDebounceTimer: number | null = null;
searchInput.addEventListener('input', () => {
  if (searchDebounceTimer !== null) clearTimeout(searchDebounceTimer);
  searchDebounceTimer = window.setTimeout(() => {
    renderSnippets(allFlows, searchInput.value.trim());
  }, 150);
});`);


// 8. Update init
ts = ts.replace("labelQuickPause.textContent = t('popup.page.quick_pause');\n", "");
ts = ts.replace("labelSnooze1h.textContent = t('popup.page.snooze_1h');\n", "");
ts = ts.replace("labelSnooze4h.textContent = t('popup.page.snooze_4h');\n", "");
ts = ts.replace("labelCancelPause.textContent = t('popup.page.cancel_pause');\n", "");

ts = ts.replace("renderSnooze(settings.snoozeUntil);\n  renderBlockSiteBtn(domain, settings.blocklist ?? []);", "");

fs.writeFileSync('src/popup/index.ts', ts);
