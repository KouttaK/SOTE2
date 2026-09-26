/**
 * src/shared/messaging/client.ts
 */
import { browser } from 'wxt/browser';
import type { Message } from './types.js';
import { safeContextCall } from '../utils/serviceWorkerSafety.js';

/**
 * Send a message to the background script and wait for a response.
 * Returns undefined if the extension context was invalidated (e.g. extension reload/update).
 */
export async function sendMessage<T = any>(message: Message): Promise<T | undefined> {
  return safeContextCall(async () => {
    const response = await browser.runtime.sendMessage(message);
    if (response && typeof response === 'object' && response.__error) {
      throw new Error(response.message || 'Unknown error from background script');
    }
    return response as T;
  }, undefined);
}

/**
 * Register a listener for incoming messages (e.g. broadcasts from background).
 */
export function onMessage(handler: (message: Message, sender: any) => void | Promise<void>): () => void {
  const listener = (message: Message, sender: any) => {
    safeContextCall(async () => {
      await handler(message, sender);
    });
    return false; // synchronous responses only
  };
  try {
    browser.runtime.onMessage.addListener(listener);
  } catch (e) {
    console.debug('[SOTE] Failed to add onMessage listener (context invalidated):', e);
  }
  return () => {
    try {
      browser.runtime.onMessage.removeListener(listener);
    } catch {}
  };
}
