/**
 * src/dashboard/pages/settings.ts — Settings & Blocklist
 */
import type { Page } from './index.js';
import { storage } from '../../shared/storage/StorageService.js';
import type { Settings, StorageSchema } from '../../shared/types/index.js';
import { browser } from 'wxt/browser';
import { t, setLanguage } from '../../shared/i18n/index.js';
import './settings.css';

const ICONS = {
  keyboard: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 576 512" fill="currentColor"><path d="M64 64C28.7 64 0 92.7 0 128v256c0 35.3 28.7 64 64 64H512c35.3 0 64-28.7 64-64V128c0-35.3-28.7-64-64-64H64zM224 416H160c-17.7 0-32-14.3-32-32s14.3-32 32-32h64c17.7 0 32 14.3 32 32s-14.3 32-32 32zM128 320c-17.7 0-32-14.3-32-32s14.3-32 32-32s32 14.3 32 32s-14.3 32-32 32zm96 0c-17.7 0-32-14.3-32-32s14.3-32 32-32s32 14.3 32 32s-14.3 32-32 32zm96 0c-17.7 0-32-14.3-32-32s14.3-32 32-32s32 14.3 32 32s-14.3 32-32 32zm96 0c-17.7 0-32-14.3-32-32s14.3-32 32-32s32 14.3 32 32s-14.3 32-32 32zM192 224c-17.7 0-32-14.3-32-32s14.3-32 32-32s32 14.3 32 32s-14.3 32-32 32zm96 0c-17.7 0-32-14.3-32-32s14.3-32 32-32s32 14.3 32 32s-14.3 32-32 32zm96 0c-17.7 0-32-14.3-32-32s14.3-32 32-32s32 14.3 32 32s-14.3 32-32 32z"/></svg>`,
  ban: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" fill="currentColor"><path d="M367.2 412.5L99.5 144.8C77.1 176.1 64 214.5 64 256c0 106 86 192 192 192c41.5 0 79.9-13.1 111.2-35.5zm45.3-45.3C434.9 335.9 448 297.5 448 256c0-106-86-192-192-192c-41.5 0-79.9 13.1-111.2 35.5L412.5 367.2zM0 256a256 256 0 1 1 512 0A256 256 0 1 1 0 256z"/></svg>`,
  cloud: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 512" fill="currentColor"><path d="M144 480C64.5 480 0 415.5 0 336c0-62.8 40.2-116.2 96.2-135.9c-.1-2.7-.2-5.4-.2-8.1c0-88.4 71.6-160 160-160c59.3 0 111 32.2 138.7 80.2C409.9 102 428.3 96 448 96c53 0 96 43 96 96c0 12.2-2.3 23.8-6.4 34.6C596 238.4 640 290.1 640 352c0 70.7-57.3 128-128 128H144zm79-217c-9.4 9.4-9.4 24.6 0 33.9s24.6 9.4 33.9 0l39-39V392c0 13.3 10.7 24 24 24s24-10.7 24-24V257.9l39 39c9.4 9.4 24.6 9.4 33.9 0s9.4-24.6 0-33.9l-80-80c-9.4-9.4-24.6-9.4-33.9 0l-80 80z"/></svg>`,
  danger: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" fill="currentColor"><path d="M256 32c14.2 0 27.3 7.5 34.5 19.8l216 368c7.3 12.4 7.3 27.7 .2 40.1S486.3 480 472 480H40c-14.3 0-27.6-7.7-34.7-20.1s-7-27.8 .2-40.1l216-368C228.7 39.5 241.8 32 256 32zm0 128c-13.3 0-24 10.7-24 24V296c0 13.3 10.7 24 24 24s24-10.7 24-24V184c0-13.3-10.7-24-24-24zm32 224a32 32 0 1 0 -64 0 32 32 0 1 0 64 0z"/></svg>`,
  trash: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512" fill="currentColor"><path d="M170.5 51.6L151.5 80h145l-19-28.4c-1.5-2.2-4-3.6-6.7-3.6H177.1c-2.7 0-5.2 1.3-6.7 3.6zm147-26.6L354.2 80H368h48 8c13.3 0 24 10.7 24 24s-10.7 24-24 24h-8V432c0 44.2-35.8 80-80 80H112c-44.2 0-80-35.8-80-80V128H24c-13.3 0-24-10.7-24-24S10.7 80 24 80h8H80 93.8l36.7-55.1C140.9 9.4 158.4 0 177.1 0h93.7c18.7 0 36.2 9.4 46.6 24.9zM80 128V432c0 17.7 14.3 32 32 32H336c17.7 0 32-14.3 32-32V128H80zm80 64V400c0 8.8-7.2 16-16 16s-16-7.2-16-16V192c0-8.8 7.2-16 16-16s16 7.2 16 16zm80 0V400c0 8.8-7.2 16-16 16s-16-7.2-16-16V192c0-8.8 7.2-16 16-16s16 7.2 16 16zm80 0V400c0 8.8-7.2 16-16 16s-16-7.2-16-16V192c0-8.8 7.2-16 16-16s16 7.2 16 16z"/></svg>`,
  check: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512" fill="currentColor"><path d="M438.6 105.4c12.5 12.5 12.5 32.8 0 45.3l-256 256c-12.5 12.5-32.8 12.5-45.3 0l-128-128c-12.5-12.5-12.5-32.8 0-45.3s32.8-12.5 45.3 0L160 338.7 393.4 105.4c12.5-12.5 32.8-12.5 45.3 0z"/></svg>`,
  info: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" fill="currentColor"><path d="M256 512A256 256 0 1 0 256 0a256 256 0 1 0 0 512zM216 336h24V272H216c-13.3 0-24-10.7-24-24s10.7-24 24-24h48c13.3 0 24 10.7 24 24v88h8c13.3 0 24 10.7 24 24s-10.7 24-24 24H216c-13.3 0-24-10.7-24-24s10.7-24 24-24zm40-208a32 32 0 1 1 0 64 32 32 0 1 1 0-64z"/></svg>`,
  globe: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" fill="currentColor"><path d="M352 256c0 22.2-1.2 43.6-3.3 64H163.3c-2.2-20.4-3.3-41.8-3.3-64s1.2-43.6 3.3-64H348.7c2.2 20.4 3.3 41.8 3.3 64zm28.8-64H503.9c5.3 20.5 8.1 41.9 8.1 64s-2.8 43.5-8.1 64H380.8c2.1-20.6 3.2-42 3.2-64s-1.1-43.4-3.2-64zm112.6-32H376.7c-10-63.9-29.8-117.4-55.3-151.6c78.3 20.7 142 77.5 171.9 151.6zm-149.1 0H167.7c6.1-36.4 15.5-68.6 27-94.7c10.5-23.6 22.2-40.7 33.5-51.5C239.4 3.2 248.7 0 256 0s16.6 3.2 27.8 13.8c11.3 10.8 23 27.9 33.5 51.5c11.6 26 20.9 58.2 27 94.7zm-209 0H18.6C48.6 85.9 112.2 29.1 190.6 8.4C165.1 42.6 145.3 96.1 135.3 160zM8.1 192H131.2c-2.1 20.6-3.2 42-3.2 64s1.1 43.4 3.2 64H8.1C2.8 299.5 0 278.1 0 256s2.8-43.5 8.1-64zM194.7 446.6c-11.6-26-20.9-58.2-27-94.6H344.3c-6.1 36.4-15.5 68.6-27 94.6c-10.5 23.6-22.2 40.7-33.5 51.5C272.6 508.8 263.3 512 256 512s-16.6-3.2-27.8-13.8c-11.3-10.8-23-27.9-33.5-51.5zM135.3 352c10 63.9 29.8 117.4 55.3 151.6C112.2 482.9 48.6 426.1 18.6 352H135.3zm358.1 0c-30 74.1-93.6 130.9-171.9 151.6c25.5-34.2 45.2-87.7 55.3-151.6H493.4z"/></svg>`,
  plus: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512" fill="currentColor"><path d="M256 80c0-17.7-14.3-32-32-32s-32 14.3-32 32V224H48c-17.7 0-32 14.3-32 32s14.3 32 32 32H192V432c0 17.7 14.3 32 32 32s32-14.3 32-32V288H400c17.7 0 32-14.3 32-32s-14.3-32-32-32H256V80z"/></svg>`,
  download: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 384 512" fill="currentColor"><path d="M64 0C28.7 0 0 28.7 0 64V448c0 35.3 28.7 64 64 64H320c35.3 0 64-28.7 64-64V160H256c-17.7 0-32-14.3-32-32V0H64zM256 0V128H384L256 0zM216 232V334.1l31-31c9.4-9.4 24.6-9.4 33.9 0s9.4 24.6 0 33.9l-72 72c-9.4 9.4-24.6 9.4-33.9 0l-72-72c-9.4-9.4-9.4-24.6 0-33.9s24.6-9.4 33.9 0l31 31V232c0-13.3 10.7-24 24-24s24 10.7 24 24z"/></svg>`,
  upload: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 384 512" fill="currentColor"><path d="M64 0C28.7 0 0 28.7 0 64V448c0 35.3 28.7 64 64 64H320c35.3 0 64-28.7 64-64V160H256c-17.7 0-32-14.3-32-32V0H64zM256 0V128H384L256 0zM216 408c0 13.3-10.7 24-24 24s-24-10.7-24-24V305.9l-31 31c-9.4 9.4-24.6 9.4-33.9 0s-9.4-24.6 0-33.9l72-72c9.4-9.4 24.6-9.4 33.9 0l72 72c9.4 9.4 9.4 24.6 0 33.9s-24.6 9.4-33.9 0l-31-31V408z"/></svg>`
};

export default class SettingsPage implements Page {
  private el: HTMLElement;
  private settings: Settings = {} as Settings;
  private syncEnabled = false;

  constructor() {
    this.el = document.createElement('div');
    this.el.id = 'page-settings';
  }

  render(): HTMLElement {
    this.el.innerHTML = /* html */ `
      <header class="settings-header">
        <h1 class="settings-header-title">${t('settings.title')}</h1>
        <p class="settings-header-subtitle">${t('settings.subtitle')}</p>
      </header>

      <main class="settings-main">
        <div class="settings-container">

          <!-- General Section -->
          <section class="settings-section">
            <div class="settings-section-header">
              <div class="settings-section-icon">${ICONS.keyboard}</div>
              <div>
                <h2 class="settings-section-title">General & Triggers</h2>
                <p class="settings-section-desc">Configure how and when your snippets expand</p>
              </div>
            </div>
            <div class="settings-section-content">
              
              <div style="display: flex; gap: 1.5rem;">
                <div class="settings-input-group" style="flex: 1;">
                  <label class="settings-label">Command Palette Shortcut</label>
                  <input type="text" id="setting-palette" class="settings-input" readonly placeholder="Press keys..." />
                </div>
                <div class="settings-input-group" style="width: 8rem;">
                  <label class="settings-label">${t('settings.exactMatchChar')}</label>
                  <input type="text" id="setting-exact" class="settings-input" maxlength="1" />
                </div>
                <div class="settings-input-group" style="width: 10rem;">
                  <label class="settings-label">${t('settings.language')}</label>
                  <select id="setting-language" class="settings-input">
                    <option value="en">English</option>
                    <option value="pt-BR">Português (BR)</option>
                  </select>
                </div>
              </div>

              <div class="divider"></div>
              <p class="settings-label">Trigger Keys</p>
              
              <div class="settings-row">
                <div class="settings-row-left">
                  <div class="settings-row-icon" style="background: transparent; border: none; font-weight: bold; color: #a3a3a3; font-size: 0.75rem;">SPC</div>
                  <div>
                    <p class="settings-row-title">Expand on Space</p>
                    <p class="settings-row-desc">Trigger expansion when pressing the Spacebar</p>
                  </div>
                </div>
                <div class="settings-toggle" id="toggle-space">
                  <div class="settings-toggle-knob"></div>
                </div>
              </div>

              <div class="settings-row">
                <div class="settings-row-left">
                  <div class="settings-row-icon" style="background: transparent; border: none; font-weight: bold; color: #a3a3a3; font-size: 0.75rem;">TAB</div>
                  <div>
                    <p class="settings-row-title">Expand on Tab</p>
                    <p class="settings-row-desc">Trigger expansion when pressing the Tab key</p>
                  </div>
                </div>
                <div class="settings-toggle" id="toggle-tab">
                  <div class="settings-toggle-knob"></div>
                </div>
              </div>

              <div class="settings-row">
                <div class="settings-row-left">
                  <div class="settings-row-icon" style="background: transparent; border: none; font-weight: bold; color: #a3a3a3; font-size: 0.75rem;">ENT</div>
                  <div>
                    <p class="settings-row-title">Expand on Enter</p>
                    <p class="settings-row-desc">Trigger expansion when pressing the Enter key</p>
                  </div>
                </div>
                <div class="settings-toggle" id="toggle-enter">
                  <div class="settings-toggle-knob"></div>
                </div>
              </div>
            </div>
          </section>

          <!-- Blocklist Section -->
          <section class="settings-section blocklist">
            <div class="settings-section-header">
              <div class="settings-section-icon">${ICONS.ban}</div>
              <div>
                <h2 class="settings-section-title">${t('settings.blocklist')} <span style="color: #737373;">(Disabled Sites)</span></h2>
                <p class="settings-section-desc">SOTE will be completely disabled on these domains</p>
              </div>
              <span class="blocklist-header-badge" id="blocklist-count">0 domains</span>
            </div>
            <div class="settings-section-content">
              <div class="blocklist-input-wrapper">
                <div class="blocklist-input-box">
                  ${ICONS.globe}
                  <input type="text" id="blocklist-input" placeholder="e.g. *.example.com or specific-site.com" />
                </div>
                <button class="btn-secondary" id="btn-add-domain">
                  ${ICONS.plus} Add Domain
                </button>
                <button class="btn-secondary" id="btn-add-current-site">
                  Add Current Site
                </button>
              </div>
              
              <div class="blocklist-list" id="blocklist-container">
                <!-- Blocklist items go here -->
              </div>

              <div class="info-box">
                ${ICONS.info}
                <p>Use <span style="color:#d4d4d4;">*.</span> before a domain to block all subdomains. Changes take effect immediately.</p>
              </div>
            </div>
          </section>

          <!-- Backup & Sync Section -->
          <section class="settings-section">
            <div class="settings-section-header">
              <div class="settings-section-icon">${ICONS.cloud}</div>
              <div>
                <h2 class="settings-section-title">Backup & Sync</h2>
                <p class="settings-section-desc">Manage your data, export backups, and sync across devices</p>
              </div>
            </div>
            <div class="settings-section-content">
              
              <div class="settings-row">
                <div class="settings-row-left">
                  <div class="settings-row-icon" style="color: #fca5a5;">${ICONS.cloud}</div>
                  <div>
                    <p class="settings-row-title">Enable Firefox Sync</p>
                    <p class="settings-row-desc" id="sync-status-text">Sync all flows and variables across your Firefox devices automatically</p>
                  </div>
                </div>
                <div class="settings-toggle" id="toggle-sync">
                  <div class="settings-toggle-knob"></div>
                </div>
              </div>

              <div class="divider"></div>

              <p class="settings-label">${t('dashboard.dataManagement')}</p>
              <div class="data-management-actions">
                <button class="btn-secondary" id="btn-export">
                  ${ICONS.download} ${t('button.export')}
                </button>
                <button class="btn-secondary" id="btn-import">
                  ${ICONS.upload} ${t('button.import')}
                </button>
                <input type="file" id="file-import" accept=".json" style="display: none;" />
              </div>
            </div>
          </section>

          <!-- Danger Zone -->
          <section class="settings-section danger-zone">
            <div class="settings-section-header">
              <div class="settings-section-icon">${ICONS.danger}</div>
              <div>
                <h2 class="settings-section-title">Danger Zone</h2>
                <p class="settings-section-desc">Irreversible actions — proceed with caution</p>
              </div>
            </div>
            <div class="settings-section-content">
              <div class="settings-row">
                <div>
                  <p class="settings-row-title">Reset All Data</p>
                  <p class="settings-row-desc">Permanently delete all flows, variables, and settings. This cannot be undone.</p>
                </div>
                <button class="btn-danger-outline" id="btn-reset">
                  ${ICONS.trash} Reset All Data
                </button>
              </div>
            </div>
          </section>

          <footer class="settings-footer">
            <p class="settings-footer-text">SOTE v2.4.1 · Extension settings apply globally across all websites</p>
            <div class="settings-footer-status">
              ${ICONS.check} All changes saved
            </div>
          </footer>
        </div>
      </main>
    `;
    return this.el;
  }

  async mount() {
    this.settings = await storage.getSettings();
    setLanguage(this.settings.language || 'en');
    
    // Re-render UI after language load
    this.render();
    const parent = this.el.parentNode;
    if (parent) {
      parent.replaceChild(this.el, this.el);
    }
    
    const localRaw = await browser.storage.local.get(['__sote_sync_enabled__', '__sote_last_sync_time__']);
    this.syncEnabled = localRaw['__sote_sync_enabled__'] === true;

    if (this.syncEnabled) {
      let lastSync = localRaw['__sote_last_sync_time__'];
      if (!lastSync) {
        lastSync = Date.now();
        browser.storage.local.set({ '__sote_last_sync_time__': lastSync });
      }
      const mins = Math.floor((Date.now() - lastSync) / 60000);
      const syncText = this.el.querySelector('#sync-status-text');
      if (syncText) syncText.textContent = t('settings.sync.lastSync', { mins });
    }

    this.bindInputs();
    this.renderBlocklist();
  }

  unmount() {}

  private async updateSetting(key: keyof Settings, value: any) {
    this.settings[key] = value as never;
    await storage.saveSettings({ [key]: value });
  }

  private bindInputs() {
    // Exact Match Char
    const extMatch = this.el.querySelector('#setting-exact') as HTMLInputElement;
    extMatch.value = this.settings.exactMatchChar;
    extMatch.addEventListener('change', (e) => {
      this.settings.exactMatchChar = (e.target as HTMLInputElement).value || '/';
      this.updateSetting('exactMatchChar', this.settings.exactMatchChar);
    });

    const langSelect = this.el.querySelector('#setting-language') as HTMLSelectElement;
    langSelect.value = this.settings.language || 'en';
    langSelect.addEventListener('change', (e) => {
      this.settings.language = (e.target as HTMLSelectElement).value;
      this.updateSetting('language', this.settings.language);
      // Reload page to apply language
      window.location.reload();
    });

    // Palette Shortcut
    const paletteInput = this.el.querySelector<HTMLInputElement>('#setting-palette')!;
    paletteInput.value = this.settings.commandPaletteShortcut;
    paletteInput.addEventListener('keydown', (e) => {
      e.preventDefault();
      const keys = [];
      if (e.ctrlKey) keys.push('Ctrl');
      if (e.shiftKey) keys.push('Shift');
      if (e.altKey) keys.push('Alt');
      if (e.key !== 'Control' && e.key !== 'Shift' && e.key !== 'Alt' && e.key !== 'Meta') {
        keys.push(e.key === ' ' ? 'Space' : e.key.toUpperCase());
        const shortcut = keys.join('+');
        paletteInput.value = shortcut;
        this.updateSetting('commandPaletteShortcut', shortcut);
        paletteInput.blur();
      }
    });

    // Toggles
    const toggleSpace = this.el.querySelector('#toggle-space')!;
    const toggleTab = this.el.querySelector('#toggle-tab')!;
    const toggleEnter = this.el.querySelector('#toggle-enter')!;

    const updateTriggers = () => {
      toggleSpace.classList.toggle('active', this.settings.triggerKeys.includes('Space'));
      toggleTab.classList.toggle('active', this.settings.triggerKeys.includes('Tab'));
      toggleEnter.classList.toggle('active', this.settings.triggerKeys.includes('Enter'));
    };
    updateTriggers();

    const toggleTrigger = (key: 'Space'|'Tab'|'Enter') => {
      const keys = new Set(this.settings.triggerKeys);
      if (keys.has(key)) keys.delete(key);
      else keys.add(key);
      this.updateSetting('triggerKeys', Array.from(keys));
      updateTriggers();
    };
    toggleSpace.addEventListener('click', () => toggleTrigger('Space'));
    toggleTab.addEventListener('click', () => toggleTrigger('Tab'));
    toggleEnter.addEventListener('click', () => toggleTrigger('Enter'));

    // Sync Toggle
    const toggleSync = this.el.querySelector('#toggle-sync')!;
    toggleSync.classList.toggle('active', this.syncEnabled);
    toggleSync.addEventListener('click', async () => {
      this.syncEnabled = !this.syncEnabled;
      toggleSync.classList.toggle('active', this.syncEnabled);
      const syncText = this.el.querySelector('#sync-status-text');
      if (this.syncEnabled) {
        await storage.enableSync();
        browser.storage.local.set({ '__sote_last_sync_time__': Date.now() });
        if (syncText) syncText.textContent = `Sincronizado há 0 min`;
      } else {
        await storage.disableSync();
        if (syncText) syncText.textContent = 'Sync all flows and variables across your Firefox devices automatically';
      }
    });

    // Blocklist
    const btnAddDomain = this.el.querySelector('#btn-add-domain')!;
    const inputDomain = this.el.querySelector<HTMLInputElement>('#blocklist-input')!;
    const btnAddCurrentSite = this.el.querySelector('#btn-add-current-site')!;

    const addDomain = (domain: string) => {
      domain = domain.trim().toLowerCase();
      if (domain && !this.settings.blocklist.includes(domain)) {
        this.settings.blocklist.push(domain);
        this.updateSetting('blocklist', this.settings.blocklist);
        this.renderBlocklist();
      }
    };

    btnAddDomain.addEventListener('click', () => {
      addDomain(inputDomain.value);
      inputDomain.value = '';
    });

    btnAddCurrentSite.addEventListener('click', async () => {
      try {
        const tabs = await browser.tabs.query({ active: true, lastFocusedWindow: true });
        const urlStr = tabs[0]?.url;
        if (urlStr && urlStr.startsWith('http')) {
          const url = new URL(urlStr);
          addDomain(url.hostname);
        } else {
          alert('No valid website found in the active tab.');
        }
      } catch (err) {
        console.error('Failed to get current tab', err);
      }
    });

    // Export Data
    this.el.querySelector('#btn-export')?.addEventListener('click', async () => {
      const data: StorageSchema = {
        flows: await storage.getFlows(),
        variables: await storage.getVariables(),
        templates: await storage.getTemplates(),
        folders: await storage.getFolders(),
        settings: await storage.getSettings()
      };
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `sote-backup-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
    });

    // Import Data
    const fileInput = this.el.querySelector<HTMLInputElement>('#file-import')!;
    this.el.querySelector('#btn-import')?.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      try {
        const text = await file.text();
        const data = JSON.parse(text) as StorageSchema;
        // Basic validation
        if (!data.flows || !Array.isArray(data.flows)) throw new Error('Invalid schema');
        this.showImportModal(data);
      } catch (err) {
        alert('Invalid backup file. Could not import.');
      }
      fileInput.value = '';
    });

    // Reset All Data
    this.el.querySelector('#btn-reset')?.addEventListener('click', () => {
      this.showResetModal();
    });
  }

  private renderBlocklist() {
    this.el.querySelector('#blocklist-count')!.textContent = `${this.settings.blocklist.length} domains`;
    const container = this.el.querySelector('#blocklist-container')!;
    
    if (this.settings.blocklist.length === 0) {
      container.innerHTML = '<p style="color: #737373; font-size: 0.875rem;">No domains blocked.</p>';
      return;
    }

    container.innerHTML = this.settings.blocklist.map(domain => {
      const isWildcard = domain.startsWith('*.');
      return /* html */ `
        <div class="blocklist-item">
          <div class="blocklist-item-icon">${ICONS.ban}</div>
          <div class="blocklist-item-info">
            <p class="blocklist-item-domain">${this.escapeHTML(domain)}</p>
            <p class="blocklist-item-desc">${isWildcard ? 'Wildcard — all subdomains' : 'Exact match — this domain only'}</p>
          </div>
          <span class="blocklist-item-type">${isWildcard ? 'wildcard' : 'exact'}</span>
          <button class="btn-icon-danger" data-domain="${this.escapeHTML(domain)}">
            ${ICONS.trash}
          </button>
        </div>
      `;
    }).join('');

    container.querySelectorAll('.btn-icon-danger').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const domain = (e.currentTarget as HTMLElement).dataset.domain!;
        this.settings.blocklist = this.settings.blocklist.filter(d => d !== domain);
        this.updateSetting('blocklist', this.settings.blocklist);
        this.renderBlocklist();
      });
    });
  }

  private showImportModal(data: StorageSchema) {
    const modal = document.createElement('div');
    modal.className = 'settings-modal-overlay';
    modal.innerHTML = /* html */ `
      <div class="settings-modal-content">
        <div class="settings-modal-header">
          <h2 class="settings-modal-title">Import Backup Data</h2>
          <p class="settings-modal-desc">This backup contains ${data.flows.length} flows and ${data.variables.length} variables. How do you want to proceed?</p>
        </div>
        <div style="display: flex; flex-direction: column; gap: 1rem;">
          <div style="background: #171717; border: 1px solid #404040; border-radius: 0.5rem; padding: 1rem; cursor: pointer;" id="opt-merge">
            <p style="color: #fff; margin: 0; font-size: 0.875rem; font-weight: 500;">Merge Data</p>
            <p style="color: #a3a3a3; margin: 0.25rem 0 0 0; font-size: 0.75rem;">Add new items and update existing ones. Your current data is preserved.</p>
          </div>
          <div style="background: #171717; border: 1px solid #404040; border-radius: 0.5rem; padding: 1rem; cursor: pointer;" id="opt-replace">
            <p style="color: #fff; margin: 0; font-size: 0.875rem; font-weight: 500;">Replace All</p>
            <p style="color: #ef4444; margin: 0.25rem 0 0 0; font-size: 0.75rem;">Erase all current data and replace it entirely with this backup.</p>
          </div>
        </div>
        <div class="settings-modal-footer">
          <button class="settings-btn-primary" id="modal-cancel">Cancel</button>
        </div>
      </div>
    `;
    this.el.appendChild(modal);

    modal.querySelector('#modal-cancel')?.addEventListener('click', () => modal.remove());
    
    modal.querySelector('#opt-replace')?.addEventListener('click', async () => {
      await browser.storage.local.clear();
      if (browser.storage.sync) await browser.storage.sync.clear();
      
      for (const flow of data.flows) await storage.saveFlow(flow);
      for (const v of data.variables) await storage.saveVariable(v);
      for (const t of data.templates) await storage.saveTemplate(t);
      for (const f of data.folders) await storage.saveFolder(f);
      await storage.saveSettings(data.settings);
      
      alert('Data replaced successfully.');
      modal.remove();
      this.mount();
    });

    modal.querySelector('#opt-merge')?.addEventListener('click', async () => {
      // Merge logic: saveFlow overwrites matching IDs, otherwise appends.
      for (const flow of data.flows) await storage.saveFlow(flow);
      for (const v of data.variables) await storage.saveVariable(v);
      for (const t of data.templates) await storage.saveTemplate(t);
      for (const f of data.folders) await storage.saveFolder(f);
      await storage.saveSettings(data.settings);
      
      alert('Data merged successfully.');
      modal.remove();
      this.mount();
    });
  }

  private showResetModal() {
    const modal = document.createElement('div');
    modal.className = 'settings-modal-overlay';
    modal.innerHTML = /* html */ `
      <div class="settings-modal-content" style="border-color: #3f2c2c;">
        <div class="settings-modal-header">
          <h2 class="settings-modal-title" style="color: #ef4444;">Reset All Data</h2>
          <p class="settings-modal-desc">Are you absolutely sure you want to permanently delete all flows, variables, templates, and settings? This action cannot be undone.</p>
        </div>
        <div class="settings-modal-footer">
          <button class="settings-btn-primary" id="modal-cancel" style="background: #262626; color: #fff;">Cancel</button>
          <button class="settings-btn-danger" id="modal-confirm">Yes, Reset Everything</button>
        </div>
      </div>
    `;
    this.el.appendChild(modal);

    modal.querySelector('#modal-cancel')?.addEventListener('click', () => modal.remove());
    modal.querySelector('#modal-confirm')?.addEventListener('click', async () => {
      await browser.storage.local.clear();
      if (browser.storage.sync) await browser.storage.sync.clear();
      await storage.initialise();
      alert('All data has been reset.');
      modal.remove();
      this.mount();
    });
  }

  private escapeHTML(str: string): string {
    return str.replace(/[&<>'"]/g, 
      tag => ({
          '&': '&amp;',
          '<': '&lt;',
          '>': '&gt;',
          "'": '&#39;',
          '"': '&quot;'
        }[tag] || tag)
    );
  }
}


