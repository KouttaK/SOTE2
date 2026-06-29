/**
 * src/dashboard/index.ts — SOTE Dashboard Entry Point
 *
 * Initializes the shell, which will handle layout rendering, routing,
 * and page mounting/unmounting.
 */

import { Shell } from './shell.js';

// Boot the dashboard shell
async function init() {
  const root = document.getElementById('app');
  if (!root) {
    throw new Error('[SOTE Dashboard] Critical error: #app root element not found.');
  }

  const shell = new Shell(root);
  await shell.boot();
}

// Ensure DOM is ready, though module scripts run deferred anyway
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => init().catch(console.error));
} else {
  init().catch(console.error);
}
