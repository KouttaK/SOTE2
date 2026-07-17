/**
 * src/background/index.ts — SOTE Background Service Worker
 *
 * The central hub for:
 * - Handling messages from Content Scripts, Popup, and Dashboard
 * - Broadcasting state changes (Flows/Settings) to all active tabs
 * - Managing Snooze via Alarms API
 * - Dynamically updating the browserAction icon
 */

import { browser } from 'wxt/browser';
import { storage } from '../shared/storage/StorageService.js';
import { domainMatchesAny } from '../shared/storage/helpers.js';
import type { Message } from '../shared/messaging/types.js';
import type { Settings } from '../shared/types/index.js';
import { t, initI18n } from '../shared/i18n/index.js';

/** Local-storage-only key (never synced/exported) used to hand the
 * selected text off to the dashboard when "Criar atalho com a seleção" is
 * clicked — the background script can't open the editor UI itself, so it
 * stashes the text here and opens '#/editor/new', which picks it up once
 * on mount (see editor.ts) and removes the key right away. */
const PENDING_SELECTION_KEY = '__sote_pending_selection__';
const CONTEXT_MENU_ID = 'sote-create-flow-from-selection';

export default defineBackground(() => {
  console.log('[SOTE] Background script initialized');

  // 1. Initial Icon Setup
  updateIcon();

  // 1b. Context menu ("Criar atalho com a seleção") — needs the current
  // language for its title, and respects the contextMenuEnabled setting.
  initI18n().then(() => updateContextMenus());

  // 2. Listen to Message Requests
  browser.runtime.onMessage.addListener((message: Message, sender, sendResponse) => {
    handleMessage(message, sender).then(sendResponse).catch((err) => {
      console.error('[SOTE Background] Message error:', err);
      sendResponse(null);
    });
    return true; // Keep the message channel open for async response
  });

  // 3. Listen to Alarms (Snooze)
  browser.alarms.onAlarm.addListener(async (alarm) => {
    if (alarm.name === 'sote-snooze') {
      console.log('[SOTE] Snooze expired');
      const settings = await storage.getSettings();
      settings.snoozeUntil = undefined;
      await storage.saveSettings({ snoozeUntil: undefined });
      
      // Update icon and broadcast
      updateIcon(settings);
    }
  });

  // 3b. Context menu clicks
  try {
    browser.contextMenus.onClicked.addListener(async (info, tab) => {
      if (info.menuItemId !== CONTEXT_MENU_ID) return;

      const selectionText = (info.selectionText || '').trim();
      if (!selectionText) return;

      // Stash the text for the editor to pick up once, then open it to a
      // brand-new flow. We can't build/populate the editor UI from here —
      // it lives in the dashboard document, a completely separate context.
      await browser.storage.local.set({ [PENDING_SELECTION_KEY]: selectionText });
      await browser.tabs.create({
        url: browser.runtime.getURL('/dashboard.html') + '#/editor/new',
      });
    });
  } catch (err) {
    console.error('[SOTE] Failed to register context menu click listener:', err);
  }

  // 4. Listen to Storage Changes to Broadcast
  // We only care about specific keys that affect content scripts
  browser.storage.onChanged.addListener(async (changes, areaName) => {
    // Only process changes from local or sync that actually happened
    // The StorageService might chunk flows, we just re-fetch everything and broadcast.
    
    // We can debounce this if needed, but for now we just do it.
    const relevantKeys = ['settings', 'flows', 'clipboardHistory', '__sote_sync_enabled__'];
    const isRelevant = Object.keys(changes).some(k => 
      relevantKeys.includes(k) || 
      k.startsWith('settings__') || 
      k.startsWith('flows__') || 
      k.startsWith('__sote_')
    );

    if (isRelevant) {
      const settings = await storage.getSettings();
      const flows = await storage.getFlows();

      updateIcon(settings);
      await initI18n();
      await updateContextMenus(settings);

      broadcastMessage({ type: 'SETTINGS_UPDATED', payload: settings });
      broadcastMessage({ type: 'FLOWS_UPDATED', payload: flows });
    }

    // Variables have their own key/broadcast, same reasoning as clipboard
    // history: they change independently of settings/flows and shouldn't
    // force a settings/flows re-fetch, but content scripts DO need to know
    // about edits so {{KEY}} resolution at expansion time stays current.
    const variablesChanged = Object.prototype.hasOwnProperty.call(changes, 'variables') ||
      Object.keys(changes).some(k => k.startsWith('variables__'));
    if (variablesChanged) {
      const variables = await storage.getVariables();
      broadcastMessage({ type: 'VARIABLES_UPDATED', payload: variables });
    }

    // Forms have their own key/broadcast, same reasoning as Variables:
    // they change independently of settings/flows and shouldn't force a
    // settings/flows re-fetch, but content scripts DO need fresh Forms for
    // the Gatilho de Busca (search trigger) and the Palette.
    const formsChanged = Object.prototype.hasOwnProperty.call(changes, 'forms') ||
      Object.keys(changes).some(k => k.startsWith('forms__'));
    if (formsChanged) {
      const forms = await storage.getForms();
      broadcastMessage({ type: 'FORMS_UPDATED', payload: forms });
    }

    // Clipboard history has its own key/broadcast so it doesn't get
    // re-fetched on every unrelated settings/flows change above.
    if (Object.prototype.hasOwnProperty.call(changes, 'clipboardHistory')) {
      const clipboardHistory = await storage.getClipboardHistory();
      broadcastMessage({ type: 'CLIPBOARD_HISTORY_UPDATED', payload: clipboardHistory });
    }
  });
});

/**
 * Handles incoming messages from UI contexts and content scripts.
 */
async function handleMessage(message: Message, sender: any): Promise<any> {
  switch (message.type) {
    case 'GET_FLOWS':
      return await storage.getFlows();

    case 'GET_SETTINGS':
      return await storage.getSettings();

    case 'FLOW_USED':
      // Increment stats asynchronously, no need to wait or return anything
      await storage.incrementFlowStats(message.payload.flowId, message.payload.keysSaved);
      return { success: true };

    case 'SNOOZE':
      const snoozeUntil = Date.now() + message.payload.duration;
      await storage.saveSettings({ snoozeUntil });
      
      // Clear any existing alarm and create a new one
      await browser.alarms.clear('sote-snooze');
      browser.alarms.create('sote-snooze', { when: snoozeUntil });
      
      const updatedSettings = await storage.getSettings();
      updateIcon(updatedSettings);
      return { success: true, snoozeUntil };

    case 'BLOCKLIST_ADD':
      const settings = await storage.getSettings();
      const domain = message.payload.domain.toLowerCase().trim();
      const blocklist = settings.blocklist || [];
      if (domain && !blocklist.includes(domain)) {
        blocklist.push(domain);
        await storage.saveSettings({ blocklist });
        updateIcon(settings); // might be blocked on current tab now
      }
      return { success: true };

    case 'GET_TAB_INFO':
      if (sender.tab) {
        return { url: sender.tab.url, title: sender.tab.title };
      }
      return { url: null, title: null };

    case 'CLIPBOARD_COPY':
      // Storing triggers browser.storage.onChanged above, which broadcasts
      // CLIPBOARD_HISTORY_UPDATED to every tab — no manual broadcast needed here.
      await storage.addClipboardEntry(message.payload.text);
      return { success: true };

    case 'GET_CLIPBOARD_HISTORY':
      return await storage.getClipboardHistory();

    case 'CLEAR_CLIPBOARD_HISTORY':
      await storage.clearClipboardHistory();
      return { success: true };

    case 'GET_VARIABLES':
      return await storage.getVariables();

    case 'GET_FORMS':
      return await storage.getForms();

    case 'SAVE_FORM':
      await storage.saveForm(message.payload);
      // storage.onChanged above broadcasts FORMS_UPDATED to every tab.
      return { success: true };

    case 'DELETE_FORM':
      await storage.deleteForm(message.payload.id);
      return { success: true };

    case 'FORM_USED':
      await storage.incrementFormStats(message.payload.formId);
      return { success: true };

    default:
      console.warn('[SOTE] Unknown message type:', message);
      return null;
  }
}

/**
 * Broadcasts a message to all active content scripts in all windows.
 */
async function broadcastMessage(message: Message) {
  try {
    const tabs = await browser.tabs.query({ url: ['http://*/*', 'https://*/*'] });
    for (const tab of tabs) {
      if (tab.id) {
        browser.tabs.sendMessage(tab.id, message).catch(() => {
          // Ignore errors for tabs where content script isn't injected
        });
      }
    }
  } catch (err) {
    console.error('[SOTE] Broadcast error:', err);
  }
}

/**
 * (Re)creates SOTE's right-click context menu items, or removes them
 * entirely when disabled in Settings. Called on startup and whenever
 * settings change (the toggle itself, or the language — the title needs
 * re-translating).
 */
async function updateContextMenus(settingsCache?: Settings) {
  try {
    const settings = settingsCache || await storage.getSettings();

    // removeAll() first either way: if disabled, that's the whole job; if
    // enabled, it avoids "duplicate id" errors from creating over an
    // already-existing item (e.g. on a settings change that isn't a
    // clean extension restart).
    await browser.contextMenus.removeAll();

    if (settings.contextMenuEnabled === false) return;

    browser.contextMenus.create({
      id: CONTEXT_MENU_ID,
      title: t('contextmenu.create_flow_from_selection'),
      contexts: ['selection'],
    });
  } catch (err) {
    console.error('[SOTE] Context menu setup error:', err);
  }
}

/**
 * Checks current settings and active tab to set the dynamic icon.
 */
async function updateIcon(settingsCache?: Settings) {
  try {
    const settings = settingsCache || await storage.getSettings();

    // 1. Check Global Disable
    if (!settings.globalEnabled) {
      await setIconState('disabled');
      return;
    }

    // 2. Check Snooze
    if (settings.snoozeUntil && Date.now() < settings.snoozeUntil) {
      await setIconState('snoozed', settings.snoozeUntil);
      return;
    }

    // 3. Check Blocklist on active tab
    const tabs = await browser.tabs.query({ active: true, currentWindow: true });
    const urlStr = tabs[0]?.url;
    if (urlStr && (urlStr.startsWith('http://') || urlStr.startsWith('https://'))) {
      const url = new URL(urlStr);
      if (domainMatchesAny(url.hostname, settings.blocklist || [])) {
        await setIconState('blocked');
        return;
      }
    }

    // Default: Active
    await setIconState('active');
  } catch (err) {
    console.error('[SOTE] Update icon error:', err);
  }
}

/**
 * Applies the icon and badge based on the state.
 */
async function setIconState(state: 'active' | 'disabled' | 'snoozed' | 'blocked', snoozeUntil?: number) {
  // Using WXT's default icon paths. In a real app, you'd have grayscale versions.
  // We'll simulate by using badge text and colors.
  const action = browser.action || browser.browserAction;
  if (!action) return;

  switch (state) {
    case 'active':
      await action.setBadgeText({ text: '' });
      break;

    case 'disabled':
      await action.setBadgeText({ text: 'OFF' });
      await action.setBadgeBackgroundColor({ color: '#737373' });
      break;

    case 'snoozed':
      // Calculate hours/mins for badge
      if (snoozeUntil) {
        const mins = Math.ceil((snoozeUntil - Date.now()) / 60000);
        const text = mins >= 60 ? `${Math.floor(mins / 60)}h` : `${mins}m`;
        await action.setBadgeText({ text });
        await action.setBadgeBackgroundColor({ color: '#f59e0b' }); // Amber
      }
      break;

    case 'blocked':
      await action.setBadgeText({ text: 'X' });
      await action.setBadgeBackgroundColor({ color: '#ef4444' }); // Red
      break;
  }
}

/** Update icon when tabs change to reflect blocklist status */
browser.tabs.onActivated.addListener(() => updateIcon());
browser.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.url && tab.active) updateIcon();
});
