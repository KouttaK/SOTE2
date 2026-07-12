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
        // data_collection_permissions (below) only exists starting in
        // Firefox 140 (desktop) / 142 (Android) — setting a lower
        // strict_min_version here is what triggers AMO's "Manifest key
        // not supported by the specified minimum Firefox version" alert.
        // https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/manifest.json/browser_specific_settings
        strict_min_version: '140.0',
        // Required by Mozilla for new submissions since Nov 3, 2025 —
        // https://extensionworkshop.com/documentation/develop/firefox-builtin-data-consent/
        // SOTE2 only reads/writes browser.storage locally and makes no
        // network requests of its own, so it collects/transmits nothing.
        // If that ever changes (e.g. adding real analytics/telemetry),
        // this must be updated to list the actual data types collected.
        data_collection_permissions: {
          required: ['none']
        }
      },
      // gecko_android would otherwise silently inherit gecko.strict_min_version
      // (140), which is still one major short of the 142 Android needs for
      // this same manifest key — so it gets its own explicit minimum.
      gecko_android: {
        strict_min_version: '142.0'
      }
    }
  }
});
