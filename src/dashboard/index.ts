/**
 * src/dashboard/index.ts — SOTE Dashboard Entry Point
 *
 * Initializes the shell, which will handle layout rendering, routing,
 * and page mounting/unmounting.
 */

import { Shell } from './shell.js';
import { initI18n } from '../shared/i18n/index.js';

// Boot the dashboard shell
async function init() {
  const root = document.getElementById('app');
  if (!root) {
    throw new Error('[SOTE Dashboard] Critical error: #app root element not found.');
  }

  // Load the user's saved language preference BEFORE the shell renders
  // anything. Without this, `t()` always used the module-level default
  // ('pt-BR') for the sidebar/header — the only thing that ever called
  // setLanguage() was the Settings page itself, and only after it mounted,
  // which is too late for the sidebar/header built during shell.boot().
  await initI18n();

  const shell = new Shell(root);
  await shell.boot();
}

// Ensure DOM is ready, though module scripts run deferred anyway
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => init().catch(console.error));
} else {
  init().catch(console.error);
}
