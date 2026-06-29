import { defineConfig } from 'wxt';

export default defineConfig({
  browser: 'firefox',
  manifestVersion: 3,
  srcDir: 'src',
  entrypointsDir: '.',
  manifest: {
    permissions: [
      'storage',
      'alarms',
      'tabs',
      'scripting',
      'clipboardRead',
      'contextMenus'
    ]
  }
});
