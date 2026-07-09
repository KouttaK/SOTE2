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
    // Hosted on GitHub Pages. REPLACE both placeholders below, then never
    // change the id again (Firefox treats a changed id as a different addon):
    //   - id:         pick a unique id: "name@yourdomain.com" or "{uuid}".
    //   - update_url: https://SEU-USUARIO.github.io/SEU-REPO/updates.json
    //                 (see UPDATES.md for the full GitHub Pages setup).
    browser_specific_settings: {
      gecko: {
        id: 'sote2@example.com',
        update_url: 'https://SEU-USUARIO.github.io/SEU-REPO/updates.json',
        strict_min_version: '109.0'
      }
    }
  }
});
