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
import type { Message } from '../shared/messaging/types.js';
import type { Settings } from '../shared/types/index.js';

export default defineBackground(() => {
  console.log('[SOTE] Background script initialized');

  // 1. Initial Icon Setup
  updateIcon();

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

  // 4. Listen to Storage Changes to Broadcast
  // We only care about specific keys that affect content scripts
  browser.storage.onChanged.addListener(async (changes, areaName) => {
    // Only process changes from local or sync that actually happened
    // The StorageService might chunk flows, we just re-fetch everything and broadcast.
    
    // We can debounce this if needed, but for now we just do it.
    const relevantKeys = ['settings', 'flows', '__sote_sync_enabled__'];
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

      broadcastMessage({ type: 'SETTINGS_UPDATED', payload: settings });
      broadcastMessage({ type: 'FLOWS_UPDATED', payload: flows });
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
      if (isBlocked(url.hostname, settings.blocklist || [])) {
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

/** Helper to check blocklist */
function isBlocked(hostname: string, blocklist: string[]): boolean {
  for (const b of blocklist) {
    if (b.startsWith('*.')) {
      const domain = b.slice(2);
      if (hostname === domain || hostname.endsWith('.' + domain)) return true;
    } else {
      if (hostname === b) return true;
    }
  }
  return false;
}

// Update icon when tabs change to reflect blocklist status
browser.tabs.onActivated.addListener(() => updateIcon());
browser.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.url && tab.active) updateIcon();
});
