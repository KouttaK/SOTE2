/**
 * src/dashboard/pages/settings.ts — Settings & Blocklist
 */
import type { Page } from './index.js';
import { storage } from '../../shared/storage/StorageService.js';
import type { Settings, StorageSchema, Folder } from '../../shared/types/index.js';
import { browser } from 'wxt/browser';
import { t, setLanguage, getLanguage } from '../../shared/i18n/index.js';
import { shortcutConflictsWithSearchTrigger } from '../../content/engine/SearchTriggerDetector.js';
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
  upload: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 384 512" fill="currentColor"><path d="M64 0C28.7 0 0 28.7 0 64V448c0 35.3 28.7 64 64 64H320c35.3 0 64-28.7 64-64V160H256c-17.7 0-32-14.3-32-32V0H64zM256 0V128H384L256 0zM216 408c0 13.3-10.7 24-24 24s-24-10.7-24-24V305.9l-31 31c-9.4 9.4-24.6 9.4-33.9 0s-9.4-24.6 0-33.9l72-72c9.4-9.4 24.6-9.4 33.9 0l72 72c9.4 9.4 9.4 24.6 0 33.9s-24.6 9.4-33.9 0l-31-31V408z"/></svg>`,
  clipboard: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 384 512" fill="currentColor"><path d="M192 0c-41.8 0-77.4 26.7-90.5 64H64C28.7 64 0 92.7 0 128V448c0 35.3 28.7 64 64 64H320c35.3 0 64-28.7 64-64V128c0-35.3-28.7-64-64-64H282.5C269.4 26.7 233.8 0 192 0zm0 64a32 32 0 1 1 0 64 32 32 0 1 1 0-64zM112 192H272c8.8 0 16 7.2 16 16s-7.2 16-16 16H112c-8.8 0-16-7.2-16-16s7.2-16 16-16z"/></svg>`,
  eye: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 576 512" fill="currentColor"><path d="M288 32c-80.8 0-146.1 39.3-196.2 82.5C42.1 157.2 8.3 208 1.2 231.1c-1.6 5.5-1.6 11.4 0 16.9C8.3 271.1 42.1 321.9 91.8 364.6C141.9 407.8 207.2 447.1 288 447.1s146.1-39.3 196.2-82.5c49.7-42.7 83.5-93.5 90.6-116.6c1.6-5.5 1.6-11.4 0-16.9c-7.1-23.1-40.9-73.9-90.6-116.6C434.1 71.3 368.8 32 288 32zM144 256a144 144 0 1 1 288 0 144 144 0 1 1 -288 0zm144-64c0 35.3-28.7 64-64 64c-7.1 0-13.9-1.2-20.3-3.3c-5.5-1.8-11.9 1.6-11.7 7.4c.3 6.9 1.3 13.8 3.2 20.7c13.7 51.2 66.4 81.6 117.6 67.9s81.6-66.4 67.9-117.6c-11.1-41.5-47.8-69.4-88.6-71.1c-5.8-.2-9.2 6.1-7.4 11.7c2.1 6.4 3.3 13.2 3.3 20.3z"/></svg>`,
  folder: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" fill="currentColor"><path d="M64 480H448c35.3 0 64-28.7 64-64V160c0-35.3-28.7-64-64-64H288c-18.9 0-36.8-7.3-50.5-20.4L205.8 44.1C196.2 34.1 182.7 28 168.4 28H64C28.7 28 0 56.7 0 92v324c0 35.3 28.7 64 64 64z"/></svg>`,
  search: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" fill="currentColor"><path d="M416 208c0 45.9-14.9 88.3-40 122.7L502.6 457.4c12.5 12.5 12.5 32.8 0 45.3s-32.8 12.5-45.3 0L330.7 376c-34.4 25.2-76.8 40-122.7 40C93.1 416 0 322.9 0 208S93.1 0 208 0S416 93.1 416 208zM208 352a144 144 0 1 0 0-288 144 144 0 1 0 0 288z"/></svg>`
};

export default class SettingsPage implements Page {
  private el: HTMLElement;
  private settings: Settings = {} as Settings;
  private syncEnabled = false;
  private allFolders: Folder[] = [];
  private flowCountByFolder: Record<string, number> = {};

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
                <h2 class="settings-section-title">${t('settings.section.general_triggers')}</h2>
                <p class="settings-section-desc">${t('settings.section.general_triggers_desc')}</p>
              </div>
            </div>
            <div class="settings-section-content">

              <!-- ── Card: Trigger Key ──────────────────────────────────────── -->
              <div class="exp-card" id="exp-card-trigger">
                <label class="exp-card-radio-label">
                  <input type="radio" name="exp-mode" value="trigger_key" id="radio-trigger" />
                  <div class="exp-card-body">
                    <span class="exp-card-title">${t('settings.trigger.title')}</span>
                    <span class="exp-card-desc">
                      ${t('settings.trigger.desc')}
                    </span>
                  </div>
                </label>

                <div class="exp-card-config" id="cfg-trigger">
                  <div class="exp-cfg-row">
                    <div>
                      <p class="exp-cfg-label">${t('settings.trigger.title')}</p>
                      <p class="exp-cfg-hint">${t('settings.trigger.hint')}</p>
                    </div>
                    <div class="exp-key-area">
                      <div class="exp-key-badge" id="trigger-key-badge">···</div>
                      <button class="btn-secondary btn-sm" id="btn-capture">${t('settings.trigger.capture_btn')}</button>
                    </div>
                  </div>
                </div>
              </div>

              <!-- ── Card: Exact Match ──────────────────────────────────────── -->
              <div class="exp-card" id="exp-card-exact">
                <label class="exp-card-radio-label">
                  <input type="radio" name="exp-mode" value="exact_match" id="radio-exact" />
                  <div class="exp-card-body">
                    <span class="exp-card-title">${t('settings.exact.title')}</span>
                    <span class="exp-card-desc">
                      ${t('settings.exact.desc')}
                    </span>
                  </div>
                </label>

                <div class="exp-card-config" id="cfg-exact">
                  <div style="display:flex; gap:1.5rem; flex-wrap:wrap;">
                    <div class="settings-input-group" style="flex:1; min-width:130px;">
                      <label class="settings-label">${t('settings.exact.prefix_label')}</label>
                      <input type="text" id="exact-char-input" class="settings-input"
                        maxlength="1"
                        style="text-align:center; font-size:1.125rem; letter-spacing:.1em;"
                        placeholder="/" />
                      <p class="exp-cfg-hint">${t('settings.exact.prefix_hint')}</p>
                    </div>
                    <div class="settings-input-group" style="width:160px;">
                      <label class="settings-label">${t('settings.exact.delay_label')}</label>
                      <div style="display:flex; align-items:center; gap:.5rem;">
                        <input type="number" id="delay-input" class="settings-input"
                          min="0" max="2000" step="50"
                          style="width:80px;" />
                        <span style="color:#737373; font-size:.8125rem;">ms</span>
                      </div>
                      <p class="exp-cfg-hint">${t('settings.exact.delay_hint')}</p>
                    </div>
                  </div>
                </div>
              </div>

              <div class="divider"></div>

              <!-- ── Command Palette + Language (mantidos) ─────────────────── -->
              <div style="display:flex; gap:1.5rem; flex-wrap:wrap;">
                <div class="settings-input-group" style="flex:1;">
                  <label class="settings-label">${t('settings.palette_shortcut')}</label>
                  <input type="text" id="setting-palette" class="settings-input"
                    readonly placeholder="${t('settings.palette_shortcut.placeholder')}" />
                </div>
                <div class="settings-input-group" style="width:10rem;">
                  <label class="settings-label">${t('settings.language')}</label>
                  <select id="setting-language" class="settings-input">
                    <option value="en">${t('settings.lang.en')}</option>
                    <option value="pt-BR">${t('settings.lang.pt_BR')}</option>
                  </select>
                </div>
              </div>

            </div>
          </section>

          <!-- Folders / Categories Section -->
          <section class="settings-section">
            <div class="settings-section-header">
              <div class="settings-section-icon">${ICONS.folder}</div>
              <div>
                <h2 class="settings-section-title">${t('settings.folders.title')}</h2>
                <p class="settings-section-desc">${t('settings.folders.desc')}</p>
              </div>
              <span class="blocklist-header-badge" id="folders-count">${t('settings.folders.count', { count: 0 })}</span>
            </div>
            <div class="settings-section-content">
              <div class="blocklist-input-wrapper">
                <div class="blocklist-input-box">
                  ${ICONS.folder}
                  <input type="text" id="folder-name-input" placeholder="${t('settings.folders.new_placeholder')}" />
                </div>
                <button class="btn-secondary" id="btn-add-folder">
                  ${ICONS.plus} ${t('settings.folders.create_btn')}
                </button>
              </div>

              <div class="blocklist-list" id="folders-container">
                <!-- Folder items go here -->
              </div>

              <div class="info-box">
                ${ICONS.info}
                <p>${t('settings.folders.info')}</p>
              </div>
            </div>
          </section>

          <!-- Clipboard History Section -->
          <section class="settings-section">
            <div class="settings-section-header">
              <div class="settings-section-icon">${ICONS.clipboard}</div>
              <div>
                <h2 class="settings-section-title">${t('settings.clipboard.title')}</h2>
                <p class="settings-section-desc">${t('settings.clipboard.desc')}</p>
              </div>
            </div>
            <div class="settings-section-content">
              <div style="display:flex; gap:1.5rem; flex-wrap:wrap; align-items:flex-end;">
                <div class="settings-input-group" style="width:160px;">
                  <label class="settings-label">${t('settings.clipboard.count_label')}</label>
                  <input type="number" id="clipboard-max-input" class="settings-input"
                    min="1" max="50" step="1" style="width:80px;" />
                  <p class="exp-cfg-hint">${t('settings.clipboard.count_hint')}</p>
                </div>
                <button class="btn-secondary" id="btn-view-clipboard">
                  ${ICONS.eye} ${t('settings.clipboard.view_btn')}
                </button>
                <button class="btn-secondary" id="btn-clear-clipboard">
                  ${ICONS.trash} ${t('settings.clipboard.clear_btn')}
                </button>
              </div>

              <div id="clipboard-history-list" style="display:none; margin-top:1rem;"></div>

              <div class="info-box">
                ${ICONS.info}
                <p>${t('settings.clipboard.info')}</p>
              </div>
            </div>
          </section>

          <!-- Blocklist Section -->
          <section class="settings-section blocklist">
            <div class="settings-section-header">
              <div class="settings-section-icon">${ICONS.ban}</div>
              <div>
                <h2 class="settings-section-title">${t('settings.blocklist')} <span style="color: #737373;">${t('settings.blocklist.disabled_sites')}</span></h2>
                <p class="settings-section-desc">${t('settings.blocklist.desc')}</p>
              </div>
              <span class="blocklist-header-badge" id="blocklist-count">${t('settings.blocklist.count', { count: 0 })}</span>
            </div>
            <div class="settings-section-content">
              <div class="blocklist-input-wrapper">
                <div class="blocklist-input-box">
                  ${ICONS.globe}
                  <input type="text" id="blocklist-input" placeholder="${t('settings.blocklist.placeholder')}" />
                </div>
                <button class="btn-secondary" id="btn-add-domain">
                  ${ICONS.plus} ${t('settings.blocklist.add')}
                </button>
                <button class="btn-secondary" id="btn-add-current-site">
                  ${t('settings.blocklist.add_current')}
                </button>
              </div>
              
              <div class="blocklist-list" id="blocklist-container">
                <!-- Blocklist items go here -->
              </div>

              <div class="info-box">
                ${ICONS.info}
                <p>${t('settings.blocklist.info')}</p>
              </div>
            </div>
          </section>

          <!-- Gatilho de Busca Section -->
          <section class="settings-section">
            <div class="settings-section-header">
              <div class="settings-section-icon">${ICONS.search}</div>
              <div>
                <h2 class="settings-section-title">${t('settings.searchTrigger.title')}</h2>
                <p class="settings-section-desc">${t('settings.searchTrigger.desc')}</p>
              </div>
            </div>
            <div class="settings-section-content">
              <div class="settings-row">
                <div>
                  <p class="settings-row-title">${t('settings.searchTrigger.enable_label')}</p>
                  <p class="settings-row-desc">${t('settings.searchTrigger.enable_desc')}</p>
                </div>
                <div class="settings-toggle" id="toggle-search-trigger">
                  <div class="settings-toggle-knob"></div>
                </div>
              </div>

              <div class="settings-row">
                <div>
                  <p class="settings-row-title">${t('settings.searchTrigger.includeFlows_label')}</p>
                  <p class="settings-row-desc">${t('settings.searchTrigger.includeFlows_desc')}</p>
                </div>
                <div class="settings-toggle" id="toggle-search-include-flows">
                  <div class="settings-toggle-knob"></div>
                </div>
              </div>

              <div class="divider"></div>

              <div style="display:flex; gap:1.5rem; flex-wrap:wrap;">
                <div class="settings-input-group" style="width:160px;">
                  <label class="settings-label">${t('settings.searchTrigger.domainPrefix_label')}</label>
                  <input type="text" id="search-domain-prefix-input" class="settings-input" placeholder="//" />
                  <p class="settings-row-desc">${t('settings.searchTrigger.domainPrefix_hint')}</p>
                </div>
                <div class="settings-input-group" style="width:160px;">
                  <label class="settings-label">${t('settings.searchTrigger.globalPrefix_label')}</label>
                  <input type="text" id="search-global-prefix-input" class="settings-input" placeholder="///" />
                  <p class="settings-row-desc">${t('settings.searchTrigger.globalPrefix_hint')}</p>
                </div>
              </div>

              <div class="info-box" id="search-trigger-conflict-box" style="display:none; border-color:#f59e0b;">
                ${ICONS.info}
                <p id="search-trigger-conflict-text"></p>
              </div>

              <div class="info-box">
                ${ICONS.info}
                <p>${t('settings.searchTrigger.info')}</p>
              </div>
            </div>
          </section>

          <!-- Backup & Sync Section -->
          <section class="settings-section">
            <div class="settings-section-header">
              <div class="settings-section-icon">${ICONS.cloud}</div>
              <div>
                <h2 class="settings-section-title">${t('settings.backup.title')}</h2>
                <p class="settings-section-desc">${t('settings.backup.desc')}</p>
              </div>
            </div>
            <div class="settings-section-content">
              
              <div class="settings-row">
                <div class="settings-row-left">
                  <div class="settings-row-icon" style="color: #fca5a5;">${ICONS.cloud}</div>
                  <div>
                    <p class="settings-row-title">${t('settings.sync.enable_label')}</p>
                    <p class="settings-row-desc" id="sync-status-text">${t('settings.sync.desc')}</p>
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
                <h2 class="settings-section-title">${t('settings.danger.title')}</h2>
                <p class="settings-section-desc">${t('settings.danger.desc')}</p>
              </div>
            </div>
            <div class="settings-section-content">
              <div class="settings-row">
                <div>
                  <p class="settings-row-title">${t('settings.danger.reset_title')}</p>
                  <p class="settings-row-desc">${t('settings.danger.reset_desc')}</p>
                </div>
                <button class="btn-danger-outline" id="btn-reset">
                  ${ICONS.trash} ${t('settings.danger.reset_title')}
                </button>
              </div>
            </div>
          </section>

          <footer class="settings-footer">
            <p class="settings-footer-text">${t('settings.footer.text')}</p>
            <div class="settings-footer-status">
              ${ICONS.check} ${t('settings.footer.saved')}
            </div>
          </footer>
        </div>
      </main>
    `;
    return this.el;
  }

  async mount() {
    this.settings = await storage.getSettings();
    // Only override the language if the user has explicitly chosen one.
    // initI18n() (called once at dashboard boot, before anything renders)
    // already loaded the correct language — falling back to 'en' here
    // would silently override that on every visit to this page whenever
    // settings.language happens to be unset.
    if (this.settings.language) {
      setLanguage(this.settings.language);
    }
    // Re-render with the now-confirmed language so labels stay in sync
    // with the <select> below (this.el is reused in place, not replaced).
    this.render();

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
    this.bindExpansionMode();
    this.bindSearchTrigger();
    this.renderBlocklist();

    this.allFolders = await storage.getFolders();
    const flows = await storage.getFlows();
    this.flowCountByFolder = {};
    for (const flow of flows) {
      if (flow.folderId) {
        this.flowCountByFolder[flow.folderId] = (this.flowCountByFolder[flow.folderId] || 0) + 1;
      }
    }
    this.bindFolders();
    this.renderFolders();
  }

  unmount() {}

  private async updateSetting(key: keyof Settings, value: any) {
    this.settings[key] = value as never;
    await storage.saveSettings({ [key]: value });
  }

  private bindInputs() {


    const langSelect = this.el.querySelector('#setting-language') as HTMLSelectElement;
    langSelect.value = this.settings.language || getLanguage();
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



    // Clipboard History
    const clipboardMaxInput = this.el.querySelector<HTMLInputElement>('#clipboard-max-input');
    if (clipboardMaxInput) {
      clipboardMaxInput.value = String(this.settings.clipboardHistoryMax ?? 10);
      clipboardMaxInput.addEventListener('change', async (e) => {
        const target = e.target as HTMLInputElement;
        const val = Math.max(1, Math.min(50, parseInt(target.value, 10) || 10));
        target.value = String(val);
        await this.updateSetting('clipboardHistoryMax', val);
        // Applies the new (possibly smaller) cap to whatever is already stored,
        // instead of waiting for the next copy to trim it.
        await storage.trimClipboardHistory();
        if (clipboardHistoryList && clipboardHistoryList.style.display !== 'none') {
          await renderClipboardHistoryList();
        }
      });
    }

    const clipboardHistoryList = this.el.querySelector<HTMLDivElement>('#clipboard-history-list');
    const btnViewClipboard = this.el.querySelector<HTMLButtonElement>('#btn-view-clipboard');

    const escapeHtml = (str: string): string =>
      str.replace(/[&<>"']/g, (c) => (
        { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string
      ));

    const renderClipboardHistoryList = async () => {
      if (!clipboardHistoryList) return;
      const history = await storage.getClipboardHistory();
      if (history.length === 0) {
        clipboardHistoryList.innerHTML =
          `<p class="text-sm text-gray" style="padding:0.5rem 0;">${t('settings.clipboard.history_empty')}</p>`;
        return;
      }
      clipboardHistoryList.innerHTML = history
        .map((entry, i) => `
          <div style="display:flex; gap:0.75rem; padding:0.5rem 0; border-bottom:1px solid rgba(128,128,128,0.2); align-items:flex-start;">
            <span style="flex-shrink:0; white-space:nowrap; font-size:0.75rem; font-weight:600; padding:0.15rem 0.5rem; border-radius:4px; background:rgba(128,128,128,0.15);">Clipboard ${i + 1}</span>
            <span style="word-break:break-word; white-space:pre-wrap; flex:1; font-size:0.875rem;">${escapeHtml(entry.text) || `<em>${t('settings.clipboard.entry_empty')}</em>`}</span>
          </div>
        `)
        .join('');
    };

    if (btnViewClipboard && clipboardHistoryList) {
      btnViewClipboard.addEventListener('click', async () => {
        const isHidden = clipboardHistoryList.style.display === 'none';
        if (isHidden) {
          await renderClipboardHistoryList();
          clipboardHistoryList.style.display = 'block';
          btnViewClipboard.innerHTML = `${ICONS.eye} ${t('settings.clipboard.hide_btn')}`;
        } else {
          clipboardHistoryList.style.display = 'none';
          btnViewClipboard.innerHTML = `${ICONS.eye} ${t('settings.clipboard.view_btn')}`;
        }
      });
    }

    const btnClearClipboard = this.el.querySelector<HTMLButtonElement>('#btn-clear-clipboard');
    if (btnClearClipboard) {
      btnClearClipboard.addEventListener('click', async () => {
        if (confirm(t('settings.clipboard.clear_confirm'))) {
          await storage.clearClipboardHistory();
          if (clipboardHistoryList && clipboardHistoryList.style.display !== 'none') {
            await renderClipboardHistoryList();
          }
        }
      });
    }

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
        if (syncText) syncText.textContent = t('settings.sync.lastSync', { mins: 0 });
      } else {
        await storage.disableSync();
        if (syncText) syncText.textContent = t('settings.sync.desc');
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
          alert(t('settings.blocklist.no_active_site'));
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
        folders: await storage.getFolders(),
        forms: await storage.getForms(),
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
        alert(t('settings.import_modal.invalid_file'));
      }
      fileInput.value = '';
    });

    // Reset All Data
    this.el.querySelector('#btn-reset')?.addEventListener('click', () => {
      this.showResetModal();
    });
  }

  private renderBlocklist() {
    this.el.querySelector('#blocklist-count')!.textContent = t('settings.blocklist.count', { count: this.settings.blocklist.length });
    const container = this.el.querySelector('#blocklist-container')!;
    
    if (this.settings.blocklist.length === 0) {
      container.innerHTML = `<p style="color: #737373; font-size: 0.875rem;">${t('settings.blocklist.empty')}</p>`;
      return;
    }

    container.innerHTML = this.settings.blocklist.map(domain => {
      const isWildcard = domain.startsWith('*.');
      return /* html */ `
        <div class="blocklist-item">
          <div class="blocklist-item-icon">${ICONS.ban}</div>
          <div class="blocklist-item-info">
            <p class="blocklist-item-domain">${this.escapeHTML(domain)}</p>
            <p class="blocklist-item-desc">${isWildcard ? t('settings.blocklist.wildcard_desc') : t('settings.blocklist.exact_desc')}</p>
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

  private bindFolders() {
    const btnAdd = this.el.querySelector<HTMLButtonElement>('#btn-add-folder')!;
    const input = this.el.querySelector<HTMLInputElement>('#folder-name-input')!;

    const createFolder = async () => {
      const name = input.value.trim();
      if (!name) return;
      await storage.saveFolder({ id: crypto.randomUUID(), name, color: '#3b82f6', order: this.allFolders.length });
      this.allFolders = await storage.getFolders();
      input.value = '';
      this.renderFolders();
    };

    btnAdd.addEventListener('click', createFolder);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') createFolder();
    });
  }

  private renderFolders() {
    const countBadge = this.el.querySelector('#folders-count');
    if (countBadge) countBadge.textContent = t('settings.folders.count', { count: this.allFolders.length });

    const container = this.el.querySelector('#folders-container');
    if (!container) return;

    if (this.allFolders.length === 0) {
      container.innerHTML = `<p style="color: #737373; font-size: 0.875rem;">${t('settings.folders.empty')}</p>`;
      return;
    }

    container.innerHTML = this.allFolders.map(folder => {
      const count = this.flowCountByFolder[folder.id] || 0;
      return /* html */ `
        <div class="blocklist-item">
          <div class="blocklist-item-icon" style="color: ${this.escapeHTML(folder.color || '#3b82f6')};">${ICONS.folder}</div>
          <div class="blocklist-item-info">
            <p class="blocklist-item-domain">${this.escapeHTML(folder.name)}</p>
            <p class="blocklist-item-desc">${t('settings.folders.flow_count', { count })}</p>
          </div>
          <button class="btn-icon-danger" data-folder-id="${folder.id}" title="${t('settings.folders.delete_title')}">
            ${ICONS.trash}
          </button>
        </div>
      `;
    }).join('');

    container.querySelectorAll('.btn-icon-danger').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const id = (e.currentTarget as HTMLElement).dataset.folderId!;
        const folder = this.allFolders.find(f => f.id === id);
        if (!folder) return;
        const count = this.flowCountByFolder[id] || 0;
        const msg = count > 0
          ? t('settings.folders.delete_confirm_with_flows', { name: folder.name, count })
          : t('settings.folders.delete_confirm_empty', { name: folder.name });
        if (confirm(msg)) {
          await storage.deleteFolder(id);
          this.allFolders = this.allFolders.filter(f => f.id !== id);
          delete this.flowCountByFolder[id];
          this.renderFolders();
        }
      });
    });
  }

  private showImportModal(data: StorageSchema) {
    const modal = document.createElement('div');
    modal.className = 'settings-modal-overlay';
    modal.innerHTML = /* html */ `
      <div class="settings-modal-content">
        <div class="settings-modal-header">
          <h2 class="settings-modal-title">${t('settings.import_modal.title')}</h2>
          <p class="settings-modal-desc">${t('settings.import_modal.desc', { flows: data.flows.length, vars: data.variables.length })}</p>
        </div>
        <div style="display: flex; flex-direction: column; gap: 1rem;">
          <div style="background: #171717; border: 1px solid #404040; border-radius: 0.5rem; padding: 1rem; cursor: pointer;" id="opt-merge">
            <p style="color: #fff; margin: 0; font-size: 0.875rem; font-weight: 500;">${t('settings.import_modal.merge_title')}</p>
            <p style="color: #a3a3a3; margin: 0.25rem 0 0 0; font-size: 0.75rem;">${t('settings.import_modal.merge_desc')}</p>
          </div>
          <div style="background: #171717; border: 1px solid #404040; border-radius: 0.5rem; padding: 1rem; cursor: pointer;" id="opt-replace">
            <p style="color: #fff; margin: 0; font-size: 0.875rem; font-weight: 500;">${t('settings.import_modal.replace_title')}</p>
            <p style="color: #ef4444; margin: 0.25rem 0 0 0; font-size: 0.75rem;">${t('settings.import_modal.replace_desc')}</p>
          </div>
        </div>
        <div class="settings-modal-footer">
          <button class="settings-btn-primary" id="modal-cancel">${t('settings.common.cancel')}</button>
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
      for (const f of data.folders) await storage.saveFolder(f);
      for (const form of data.forms || []) await storage.saveForm(form);
      await storage.saveSettings(data.settings);
      
      alert(t('settings.import_modal.replaced_alert'));
      modal.remove();
      this.mount();
    });

    modal.querySelector('#opt-merge')?.addEventListener('click', async () => {
      // Merge logic: saveFlow overwrites matching IDs, otherwise appends.
      for (const flow of data.flows) await storage.saveFlow(flow);
      for (const v of data.variables) await storage.saveVariable(v);
      for (const f of data.folders) await storage.saveFolder(f);
      for (const form of data.forms || []) await storage.saveForm(form);
      await storage.saveSettings(data.settings);
      
      alert(t('settings.import_modal.merged_alert'));
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
          <h2 class="settings-modal-title" style="color: #ef4444;">${t('settings.danger.reset_title')}</h2>
          <p class="settings-modal-desc">${t('settings.reset_modal.desc')}</p>
        </div>
        <div class="settings-modal-footer">
          <button class="settings-btn-primary" id="modal-cancel" style="background: #262626; color: #fff;">${t('settings.common.cancel')}</button>
          <button class="settings-btn-danger" id="modal-confirm">${t('settings.reset_modal.confirm_btn')}</button>
        </div>
      </div>
    `;
    this.el.appendChild(modal);

    modal.querySelector('#modal-cancel')?.addEventListener('click', () => modal.remove());
    modal.querySelector('#modal-confirm')?.addEventListener('click', async () => {
      await browser.storage.local.clear();
      if (browser.storage.sync) await browser.storage.sync.clear();
      await storage.initialise();
      alert(t('settings.reset_modal.done_alert'));
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

  private bindExpansionMode(): void {
    const radioTrigger  = this.el.querySelector<HTMLInputElement>('#radio-trigger')!;
    const radioExact    = this.el.querySelector<HTMLInputElement>('#radio-exact')!;
    const cardTrigger   = this.el.querySelector<HTMLElement>('#exp-card-trigger')!;
    const cardExact     = this.el.querySelector<HTMLElement>('#exp-card-exact')!;
    const cfgTrigger    = this.el.querySelector<HTMLElement>('#cfg-trigger')!;
    const cfgExact      = this.el.querySelector<HTMLElement>('#cfg-exact')!;

    const keyBadge      = this.el.querySelector<HTMLElement>('#trigger-key-badge')!;
    const btnCapture    = this.el.querySelector<HTMLButtonElement>('#btn-capture')!;
    const exactCharInp  = this.el.querySelector<HTMLInputElement>('#exact-char-input')!;
    const delayInp      = this.el.querySelector<HTMLInputElement>('#delay-input')!;

    // ── Inicializar valores ────────────────────────────────────────────────────
    const mode = this.settings.triggerMode ?? 'trigger';
    radioTrigger.checked = mode === 'trigger';
    radioExact.checked   = mode === 'exact_match';
    this.applyModeUI(mode, cardTrigger, cardExact, cfgTrigger, cfgExact);

    const triggerKey = (this.settings.triggerKeys && this.settings.triggerKeys.length > 0) ? this.settings.triggerKeys[0] : 'Space';
    keyBadge.textContent = this.formatKey(triggerKey);
    exactCharInp.value   = this.settings.exactMatchChar ?? '/';
    delayInp.value       = String(this.settings.exactMatchDelay ?? 0);

    // ── Troca de modo ─────────────────────────────────────────────────────────
    radioTrigger.addEventListener('change', () => {
      this.updateSetting('triggerMode', 'trigger');
      this.applyModeUI('trigger', cardTrigger, cardExact, cfgTrigger, cfgExact);
    });
    radioExact.addEventListener('change', () => {
      this.updateSetting('triggerMode', 'exact_match');
      this.applyModeUI('exact_match', cardTrigger, cardExact, cfgTrigger, cfgExact);
    });

    // ── Captura de tecla ───────────────────────────────────────────────────────
    let capturing = false;
    let captureHandler: ((e: KeyboardEvent) => void) | null = null;

    const stopCapture = (key?: string) => {
      capturing = false;
      keyBadge.classList.remove('exp-key-badge--capturing');
      btnCapture.disabled = false;
      btnCapture.textContent = t('settings.trigger.capture_btn');
      if (key !== undefined) keyBadge.textContent = this.formatKey(key);
      if (captureHandler) {
        document.removeEventListener('keydown', captureHandler, true);
        captureHandler = null;
      }
    };

    btnCapture.addEventListener('click', () => {
      if (capturing) return;
      capturing = true;
      keyBadge.textContent = t('settings.trigger.capture_press');
      keyBadge.classList.add('exp-key-badge--capturing');
      btnCapture.disabled = true;
      btnCapture.textContent = t('settings.trigger.capture_waiting');

      captureHandler = (e: KeyboardEvent) => {
        e.preventDefault();
        e.stopPropagation();

        // Ignorar teclas modificadoras isoladas
        if (['Control','Shift','Alt','Meta','CapsLock'].includes(e.key)) return;

        // Enter: proibido
        if (e.key === 'Enter') {
          keyBadge.textContent = t('settings.trigger.enter_forbidden');
          keyBadge.style.color = '#ef4444';
          setTimeout(() => {
            keyBadge.style.color = '';
            const fallback = (this.settings.triggerKeys && this.settings.triggerKeys.length > 0) ? this.settings.triggerKeys[0] : 'Space';
            stopCapture(fallback);
          }, 1500);
          return;
        }

        // Escape: cancelar captura sem mudar
        if (e.key === 'Escape') {
          const fallback = (this.settings.triggerKeys && this.settings.triggerKeys.length > 0) ? this.settings.triggerKeys[0] : 'Space';
          stopCapture(fallback);
          return;
        }

        // Tecla válida
        let codeName = e.code;
        if (e.key === ' ') codeName = 'Space';
        if (e.key === 'Tab') codeName = 'Tab';
        if (e.key === 'Enter') codeName = 'Enter';

        this.updateSetting('triggerKeys', [codeName]);
        this.settings.triggerKeys = [codeName];
        stopCapture(codeName);
      };

      document.addEventListener('keydown', captureHandler, true);
    });

    // ── Prefixo de Exact Match ─────────────────────────────────────────────────
    exactCharInp.addEventListener('change', (e) => {
      const val = (e.target as HTMLInputElement).value;
      this.updateSetting('exactMatchChar', val);
    });

    // ── Delay ─────────────────────────────────────────────────────────────────
    delayInp.addEventListener('change', (e) => {
      const val = Math.max(0, Math.min(2000, parseInt((e.target as HTMLInputElement).value, 10) || 0));
      (e.target as HTMLInputElement).value = String(val);
      this.updateSetting('exactMatchDelay', val);
    });
  }

  /**
   * "Gatilho de Busca" section — spec §5 (settings) + §6 (reserved
   * prefixes / migration scan when (re)activating or changing a prefix).
   */
  private bindSearchTrigger(): void {
    const cfg = this.settings.searchTrigger || { enabled: true, includeFlows: true, domainPrefix: '//', globalPrefix: '///' };

    const toggleEnabled = this.el.querySelector<HTMLElement>('#toggle-search-trigger')!;
    const toggleIncludeFlows = this.el.querySelector<HTMLElement>('#toggle-search-include-flows')!;
    const domainInput = this.el.querySelector<HTMLInputElement>('#search-domain-prefix-input')!;
    const globalInput = this.el.querySelector<HTMLInputElement>('#search-global-prefix-input')!;
    const conflictBox = this.el.querySelector<HTMLElement>('#search-trigger-conflict-box')!;
    const conflictText = this.el.querySelector<HTMLElement>('#search-trigger-conflict-text')!;

    toggleEnabled.classList.toggle('active', cfg.enabled);
    toggleIncludeFlows.classList.toggle('active', cfg.includeFlows);
    domainInput.value = cfg.domainPrefix;
    globalInput.value = cfg.globalPrefix;

    const saveSearchTrigger = async (next: typeof cfg) => {
      this.settings.searchTrigger = next;
      await this.updateSetting('searchTrigger', next);
      await scanForConflicts(next);
    };

    /** Spec §6: scan existing Flows for shortcuts that collide with the (now active) prefixes, and just *warn* — never block either feature. */
    const scanForConflicts = async (activeCfg: typeof cfg) => {
      if (!activeCfg.enabled) {
        conflictBox.style.display = 'none';
        return;
      }
      const flows = await storage.getFlows();
      const conflicting = flows
        .map((f) => {
          const trigger = f.blocks.find((b) => b.type === 'trigger')?.data as any;
          return trigger?.shortcut as string | undefined;
        })
        .filter((shortcut): shortcut is string => !!shortcut && shortcutConflictsWithSearchTrigger(shortcut, activeCfg));

      if (conflicting.length === 0) {
        conflictBox.style.display = 'none';
        return;
      }

      conflictBox.style.display = 'flex';
      conflictText.textContent =
        conflicting.length === 1
          ? t('settings.searchTrigger.conflict_one', { shortcut: conflicting[0] })
          : t('settings.searchTrigger.conflict_many', { count: conflicting.length, list: conflicting.join(', ') });
    };

    toggleEnabled.addEventListener('click', async () => {
      const next = { ...cfg, enabled: !this.settings.searchTrigger?.enabled };
      toggleEnabled.classList.toggle('active', next.enabled);
      await saveSearchTrigger(next);
    });

    toggleIncludeFlows.addEventListener('click', async () => {
      const next = { ...this.settings.searchTrigger, includeFlows: !this.settings.searchTrigger?.includeFlows } as typeof cfg;
      toggleIncludeFlows.classList.toggle('active', next.includeFlows);
      await saveSearchTrigger(next);
    });

    const commitPrefixes = async () => {
      const domainPrefix = domainInput.value.trim();
      const globalPrefix = globalInput.value.trim();

      if (!domainPrefix || !globalPrefix || domainPrefix === globalPrefix) {
        alert(t('settings.searchTrigger.error_equal_or_empty'));
        // Revert to the last known-good values.
        domainInput.value = this.settings.searchTrigger?.domainPrefix ?? '//';
        globalInput.value = this.settings.searchTrigger?.globalPrefix ?? '///';
        return;
      }

      const next = { ...this.settings.searchTrigger, domainPrefix, globalPrefix } as typeof cfg;
      await saveSearchTrigger(next);
    };

    domainInput.addEventListener('change', commitPrefixes);
    globalInput.addEventListener('change', commitPrefixes);

    // Initial scan on page load too, in case Flows changed elsewhere since the feature was last active.
    scanForConflicts(cfg);
  }

  private applyModeUI(
    mode: string,
    cardT: HTMLElement, cardE: HTMLElement,
    cfgT: HTMLElement,  cfgE: HTMLElement,
  ): void {
    const isTrigger = mode === 'trigger';
    cardT.classList.toggle('exp-card--selected', isTrigger);
    cardE.classList.toggle('exp-card--selected', !isTrigger);
    cfgT.style.display = isTrigger  ? 'block' : 'none';
    cfgE.style.display = !isTrigger ? 'block' : 'none';
  }

  private formatKey(key: string): string {
    const map: Record<string, string> = {
      ' ':   t('settings.key.space'),
      'Tab': 'Tab',
    };
    return map[key] ?? key.toUpperCase();
  }
}


