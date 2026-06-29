/**
 * src/shared/messaging/client.ts
 */
import { browser } from 'wxt/browser';
import type { Message } from './types.js';

/**
 * Send a message to the background script and wait for a response.
 */
export async function sendMessage<T = any>(message: Message): Promise<T> {
  return browser.runtime.sendMessage(message);
}

/**
 * Register a listener for incoming messages (e.g. broadcasts from background).
 */
export function onMessage(handler: (message: Message, sender: any) => void | Promise<void>): void {
  browser.runtime.onMessage.addListener((message: Message, sender) => {
    handler(message, sender);
    return false; // synchronous responses only, or we return true if we want async, but here we don't return anything
  });
}
