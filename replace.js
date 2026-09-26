const fs = require('fs');

let html = fs.readFileSync('src/popup/index.html', 'utf8');
const headerRegex = /<!-- ── Header ─+ -->[\s\S]*?(?=<!-- Search bar -->)/;
const newHTML = `<!-- ── Header (Status Zone) ────────────────────────────────────────── -->
      <div id="popup-header" class="status-zone">
        <div class="status-main">
          <div id="status-indicator" class="status-dot"></div>
          <div class="status-text-wrap">
            <span id="status-state">Active</span>
            <span id="status-domain">on ...</span>
          </div>
        </div>

        <div class="status-actions">
          <button id="btn-block-site" class="icon-btn" type="button" title="Mute on site">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 512" aria-hidden="true" fill="currentColor"><path d="M38.8 5.1C28.4-3.1 13.3-1.2 5.1 9.2S-1.2 34.7 9.2 42.9l592 464c10.4 8.2 25.5 6.3 33.7-4.1s6.3-25.5-4.1-33.7L525.6 386.7c39.6-40.6 66.4-86.1 79.9-118.4c3.3-7.9 3.3-16.7 0-24.6c-14.9-35.7-46.2-87.7-93-131.1C465.5 68.8 400.8 32 320 32c-68.2 0-125 26.3-169.3 60.8L38.8 5.1zm151 118.3C226 97.7 269.5 80 320 80c65.2 0 118.8 29.6 159.9 67.7C518.4 183.5 545 226 558.6 256c-12.6 28-36.6 66.8-70.9 100.9l-53.8-42.2c9.1-17.6 14.2-37.5 14.2-58.7c0-70.7-57.3-128-128-128c-32.2 0-61.7 11.9-84.2 31.5l-46.1-36.1zM394.9 284.2l-81.5-63.9c4.2-8.5 6.6-18.2 6.6-28.3c0-5.5-.7-10.9-2-16c.7 0 1.3 0 2 0c44.2 0 80 35.8 80 80c0 9.9-1.8 19.4-5.1 28.2zm9.4 130.3C378.8 425.4 350.7 432 320 432c-65.2 0-118.8-29.6-159.9-67.7C121.6 328.5 95 286 81.4 256c8.3-18.4 21.5-41.5 39.4-64.8L83.1 161.5C60.3 191.2 44 220.8 34.5 243.7c-3.3 7.9-3.3 16.7 0 24.6c14.9 35.7 46.2 87.7 93 131.1C174.5 443.2 239.2 480 320 480c47.8 0 89.9-12.9 126.2-32.5l-41.9-33zM192 256c0 70.7 57.3 128 128 128c13.3 0 26.1-2 38.2-5.8L302 334c-23.5-5.4-43.1-21.2-53.7-42.3l-56.1-44.2c-.2 2.8-.3 5.6-.3 8.5z"/></svg>
          </button>

          <button id="btn-snooze" class="icon-btn" type="button" title="Snooze">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" aria-hidden="true" fill="currentColor"><path d="M464 256A208 208 0 1 1 48 256a208 208 0 1 1 416 0zM0 256a256 256 0 1 0 512 0A256 256 0 1 0 0 256zM232 120V256c0 8 4 15.5 10.7 20l96 64c11 7.4 25.9 4.4 33.3-6.7s4.4-25.9-6.7-33.3L280 243.2V120c0-13.3-10.7-24-24-24s-24 10.7-24 24z"/></svg>
          </button>

          <div id="toggle-track" class="popup-toggle-track is-on compact-toggle" role="switch" aria-checked="true" tabindex="0" title="Global Enabled">
            <div class="popup-toggle-knob"></div>
          </div>
        </div>
      </div>

      <!-- ── Body (Productivity Zone) ──────────────────────────────────── -->
      <div id="popup-body">

        `;
html = html.replace(headerRegex, newHTML);
fs.writeFileSync('src/popup/index.html', html);

let css = fs.readFileSync('src/popup/popup.css', 'utf8');
const cssHeaderRegex = /\/\* ── Header ─+ \*\/[\s\S]*?(?=\/\* ── Body ─+ \*\/)/;
const newCSSHeader = `/* ── Header (Status Zone) ─────────────────────────────────────────────────── */
.status-zone {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--spacing-4) var(--spacing-4) var(--spacing-3);
  border-bottom: 1px solid var(--color-hair);
  margin-bottom: var(--spacing-2);
}

.status-main {
  display: flex;
  align-items: center;
  gap: var(--spacing-3);
  min-width: 0;
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
  background-color: var(--color-chalk);
}

.status-dot.active { background-color: var(--color-green); }
.status-dot.paused { background-color: var(--color-yellow); }
.status-dot.blocked { background-color: var(--color-red); }

.status-text-wrap {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

#status-state {
  font-size: var(--font-size-sm);
  font-weight: 500;
  color: var(--color-white);
  line-height: var(--line-height-tight);
}

#status-domain {
  font-size: var(--font-size-xs);
  color: var(--color-mute);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  line-height: var(--line-height-tight);
}

.status-actions {
  display: flex;
  align-items: center;
  gap: var(--spacing-2);
  flex-shrink: 0;
}

.icon-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: var(--icon-size-lg);
  height: var(--icon-size-lg);
  border-radius: var(--radius-md);
  border: 1px solid transparent;
  background-color: transparent;
  color: var(--color-mute);
  cursor: pointer;
  transition: all var(--transition-duration) var(--transition-easing);
}

.icon-btn:hover {
  background-color: var(--color-panel);
  border-color: var(--color-hair);
  color: var(--color-white);
}

.icon-btn.is-active {
  color: var(--color-white);
  background-color: var(--color-panel);
  border-color: var(--color-hair);
}

.icon-btn svg {
  width: var(--icon-size-sm);
  height: var(--icon-size-sm);
}

.compact-toggle {
  transform: scale(0.85);
  margin-left: var(--spacing-1);
}

`;
css = css.replace(cssHeaderRegex, newCSSHeader);
const pauseCssRegex = /\/\* ── Quick Pause ─+ \*\/[\s\S]*?(?=\/\* ── Search ─+ \*\/)/;
css = css.replace(pauseCssRegex, '');
fs.writeFileSync('src/popup/popup.css', css);
