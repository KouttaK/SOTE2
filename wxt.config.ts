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
    ],
    // Self-hosted auto-updates (not distributing via addons.mozilla.org).
    // Firefox requires an explicit add-on ID whenever update_url is set —
    // https://extensionworkshop.com/documentation/manage/updating-your-extension/
    //
    // Hosted on GitHub Pages (KouttaK/SOTE2). The "id" below is just a
    // unique string — it does not need to be a domain you actually own —
    // but once you settle on one, NEVER change it again (Firefox treats a
    // changed id as a different addon and users lose their install/update
    // history). Feel free to pick a different id before your first release.
    browser_specific_settings: {
      gecko: {
        id: 'sote2@kouttak.github.io',
        update_url: 'https://kouttak.github.io/SOTE2/updates.json',
        strict_min_version: '109.0'
      }
    }
  }
});
