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
import { domainMatchesAny, isSnoozeActive } from '../shared/storage/helpers.js';
import { PENDING_SELECTION_KEY } from '../shared/storage/defaults.js';
import type { Message } from '../shared/messaging/types.js';
import type { Settings } from '../shared/types/index.js';
import { t, initI18n } from '../shared/i18n/index.js';
import { safeContextCall } from '../shared/utils/serviceWorkerSafety.js';
import { CounterService } from './CounterService.js';
import { sessionService } from './SessionService.js';

const CONTEXT_MENU_ID = 'sote-create-flow-from-selection';

// Tracks protection status of focused fields per tab and frame
const tabFrameProtection = new Map<number, Map<number, boolean>>();

export default defineBackground(() => {
  console.log('[SOTE] Background script initialized');

  browser.tabs.onRemoved.addListener((tabId) => {
    tabFrameProtection.delete(tabId);
    sessionService.handleTabRemoved(tabId);
  });

  // 0. Restore sync preference and seed defaults on first run.
  // 0. Restore sync preference and seed defaults on first run.
  const initPromise = safeContextCall(async () => {
    await storage.initialise();
    await updateIcon();
    return await initI18n();
  });

  // 1b. Only (re)create context menus on install/update (or when settings change later)
  browser.runtime.onInstalled.addListener(() => {
    safeContextCall(async () => {
      await initPromise;
      await updateContextMenus();
    });
  });

  // 2. Listen to Message Requests
  browser.runtime.onMessage.addListener((message: Message, sender, sendResponse) => {
    safeContextCall(async () => {
      await initPromise;
      const response = await handleMessage(message, sender);
      sendResponse(response);
    }).catch((err) => {
      console.error('[SOTE Background] Message error:', err);
      sendResponse({ __error: true, message: err?.message || String(err) });
    });
    return true; // Keep the message channel open for async response
  });

  // 3. Listen to Alarms (Snooze)
  browser.alarms.onAlarm.addListener((alarm) => {
    safeContextCall(async () => {
      await initPromise;
      if (alarm.name === 'sote-snooze') {
        console.log('[SOTE] Snooze expired');
        const settings = await storage.getSettings();
        settings.snoozeUntil = undefined;
        await storage.saveSettings({ snoozeUntil: undefined });
        
        // Update icon and broadcast
        await updateIcon(settings);
      }
    });
  });

  // 3b. Context menu clicks
  browser.contextMenus.onClicked.addListener((info, tab) => {
    safeContextCall(async () => {
      await initPromise;
      if (info.menuItemId !== CONTEXT_MENU_ID) return;

      const selectionText = (info.selectionText || '').trim();
      if (!selectionText) return;

      await browser.storage.local.set({ [PENDING_SELECTION_KEY]: selectionText });
      await browser.tabs.create({
        url: browser.runtime.getURL('/dashboard.html') + '#/editor/new',
      });
    });
  });


  // 4. Listen to Storage Changes to Broadcast
  browser.storage.onChanged.addListener((changes, areaName) => {
    safeContextCall(async () => {
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

        await updateIcon(settings);
        await initI18n();
        await updateContextMenus(settings);

        await broadcastMessage({ type: 'SETTINGS_UPDATED', payload: settings });
        await broadcastMessage({ type: 'FLOWS_UPDATED', payload: flows });
      }

      const variablesChanged = Object.prototype.hasOwnProperty.call(changes, 'variables') ||
        Object.keys(changes).some(k => k.startsWith('variables__'));
      if (variablesChanged) {
        const variables = await storage.getVariables();
        await broadcastMessage({ type: 'VARIABLES_UPDATED', payload: variables });
      }

      const formsChanged = Object.prototype.hasOwnProperty.call(changes, 'forms') ||
        Object.keys(changes).some(k => k.startsWith('forms__'));
      if (formsChanged) {
        const forms = await storage.getForms();
        await broadcastMessage({ type: 'FORMS_UPDATED', payload: forms });
      }

      if (Object.prototype.hasOwnProperty.call(changes, 'clipboardHistory')) {
        const clipboardHistory = await storage.getClipboardHistory();
        await broadcastMessage({ type: 'CLIPBOARD_HISTORY_UPDATED', payload: clipboardHistory });
      }
    });
  });

  // 5. Tabs events (TOP-LEVEL)
  browser.tabs.onActivated.addListener(() => {
    safeContextCall(async () => await updateIcon());
  });
  browser.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    safeContextCall(async () => {
      if (changeInfo.url && tab.active) await updateIcon();
    });
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

    case 'FLOW_EXECUTION_FAILED':
      await storage.incrementFlowFailure(message.payload.flowId);
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

    case 'VARIABLES_USED':
      await storage.incrementVariablesUsage(message.payload.keys);
      return { success: true };

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

    case 'FRAME_PROTECTED_STATUS_CHANGED': {
      const tabId = sender.tab?.id;
      const frameId = sender.frameId ?? 0;
      if (tabId !== undefined) {
        if (!tabFrameProtection.has(tabId)) {
          tabFrameProtection.set(tabId, new Map());
        }
        tabFrameProtection.get(tabId)!.set(frameId, message.payload.isProtected);
      }
      return { success: true };
    }

    case 'GET_ACTIVE_TAB_PROTECTION_STATUS': {
      const activeTabs = await browser.tabs.query({ active: true, currentWindow: true });
      const tabId = activeTabs[0]?.id;
      let isProtected = false;
      if (tabId !== undefined && tabFrameProtection.has(tabId)) {
        for (const status of tabFrameProtection.get(tabId)!.values()) {
          if (status) {
            isProtected = true;
            break;
          }
        }
      }
      return { isProtected };
    }

    case 'RESERVE_COUNTER': {
      const counterService = CounterService.getInstance();
      return await counterService.reserveCounter(
        message.payload.counterId,
        message.payload.incrementMode,
        message.payload.displayMode,
        message.payload.isSimulation
      );
    }

    case 'CONFIRM_COUNTERS': {
      const counterService = CounterService.getInstance();
      await counterService.confirmCounters(message.payload.reservations);
      return { success: true };
    }

    case 'RELEASE_COUNTERS': {
      const counterService = CounterService.getInstance();
      await counterService.releaseCounters(message.payload.reservations);
      return { success: true };
    }

    case 'GET_SESSION_DATA': {
      const tabId = message.payload?.tabId ?? sender.tab?.id;
      if (tabId === undefined) return {};
      return sessionService.getSession(tabId);
    }

    case 'SET_SESSION_DATA': {
      const tabId = message.payload?.tabId ?? sender.tab?.id;
      if (tabId !== undefined) {
        sessionService.setSessionValue(tabId, message.payload.key, message.payload.value);
      }
      return { success: true };
    }

    case 'REMOVE_SESSION_DATA': {
      const tabId = message.payload.tabId ?? sender.tab?.id;
      if (tabId !== undefined) {
        sessionService.removeSessionValue(tabId, message.payload.key);
      }
      return { success: true };
    }

    case 'CLEAR_SESSION_DATA': {
      const tabId = message.payload?.tabId ?? sender.tab?.id;
      if (tabId !== undefined) {
        sessionService.clearSession(tabId);
      }
      return { success: true };
    }

    case 'GET_GLOBAL_SESSION_VAR': {
      const entry = sessionService.getGlobalValue(message.payload.key);
      return { entry };
    }

    case 'SET_GLOBAL_SESSION_VAR': {
      sessionService.setGlobalValue(message.payload.key, message.payload.value);
      return { success: true };
    }

    case 'REMOVE_GLOBAL_SESSION_VAR': {
      sessionService.removeGlobalValue(message.payload.key);
      return { success: true };
    }

    case 'CLEAR_GLOBAL_SESSION': {
      sessionService.clearGlobalSession();
      return { success: true };
    }

    default:
      console.warn('[SOTE] Unknown message type:', message);
      return null;
  }
}

/**
 * Broadcasts a message to all active content scripts in all windows.
 */
async function broadcastMessage(message: Message) {
  await safeContextCall(async () => {
    const tabs = await browser.tabs.query({ url: ['http://*/*', 'https://*/*'] });
    for (const tab of tabs) {
      if (tab.id) {
        browser.tabs.sendMessage(tab.id, message).catch(() => {
          // Ignore errors for tabs where content script isn't injected
        });
      }
    }
  });
}

let contextMenuUpdatePromise = Promise.resolve();

/**
 * (Re)creates SOTE's right-click context menu items, or removes them
 * entirely when disabled in Settings. Called on startup and whenever
 * settings change (the toggle itself, or the language — the title needs
 * re-translating).
 */
async function updateContextMenus(settingsCache?: Settings) {
  contextMenuUpdatePromise = contextMenuUpdatePromise.then(async () => {
    await safeContextCall(async () => {
      const settings = settingsCache || await storage.getSettings();

      // removeAll() first either way: if disabled, that's the whole job; if
      // enabled, it avoids "duplicate id" errors from creating over an
      // already-existing item (e.g. on a settings change that isn't a
      // clean extension restart).
      await browser.contextMenus.removeAll();

      if (settings.contextMenuEnabled === false) return;

      try {
        await browser.contextMenus.create({
          id: CONTEXT_MENU_ID,
          title: t('contextmenu.create_flow_from_selection'),
          contexts: ['selection'],
        });
      } catch (createErr) {
        console.warn('[SOTE] contextMenus.create warning (likely harmless duplicate id):', createErr);
      }
    });
  });
  return contextMenuUpdatePromise;
}

/**
 * Checks current settings and active tab to set the dynamic icon.
 */
export async function updateIcon(settingsCache?: Settings) {
  await safeContextCall(async () => {
    const settings = settingsCache || await storage.getSettings();

    // 1. Check Global Disable
    if (!settings.globalEnabled) {
      await setIconState('disabled');
      return;
    }

    // 2. Check Snooze
    if (isSnoozeActive(settings)) {
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
  });
}

/**
 * Applies the icon and badge based on the state.
 */
async function setIconState(state: 'active' | 'disabled' | 'snoozed' | 'blocked', snoozeUntil?: number) {
  await safeContextCall(async () => {
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
  });
}





