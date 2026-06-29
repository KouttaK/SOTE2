/**
 * src/dashboard/components/blocks/TriggerBlock.ts
 */

import type { TriggerBlock as ITriggerBlock, TriggerMode } from '../../../shared/types/index.js';

const ICONS = {
  play: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 384 512" fill="currentColor"><path d="M73 39c-14.8-9.1-33.4-9.4-48.5-.9S0 62.6 0 80V432c0 17.4 9.4 33.4 24.5 41.9s33.7 8.1 48.5-.9L361 297c14.3-8.7 23-24.2 23-41s-8.7-32.2-23-41L73 39z"/></svg>`,
  keyboard: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 576 512" fill="currentColor"><path d="M64 64C28.7 64 0 92.7 0 128V384c0 35.3 28.7 64 64 64H512c35.3 0 64-28.7 64-64V128c0-35.3-28.7-64-64-64H64zm16 64h32c8.8 0 16 7.2 16 16v32c0 8.8-7.2 16-16 16H80c-8.8 0-16-7.2-16-16V144c0-8.8 7.2-16 16-16zM64 240c0-8.8 7.2-16 16-16h32c8.8 0 16 7.2 16 16v32c0 8.8-7.2 16-16 16H80c-8.8 0-16-7.2-16-16V240zm16 80h32c8.8 0 16 7.2 16 16v32c0 8.8-7.2 16-16 16H80c-8.8 0-16-7.2-16-16V336c0-8.8 7.2-16 16-16zm80-176c0-8.8 7.2-16 16-16h32c8.8 0 16 7.2 16 16v32c0 8.8-7.2 16-16 16H176c-8.8 0-16-7.2-16-16V144zm16 80h32c8.8 0 16 7.2 16 16v32c0 8.8-7.2 16-16 16H176c-8.8 0-16-7.2-16-16V240c0-8.8 7.2-16 16-16zM160 336c0-8.8 7.2-16 16-16H400c8.8 0 16 7.2 16 16v32c0 8.8-7.2 16-16 16H176c-8.8 0-16-7.2-16-16V336zM272 128h32c8.8 0 16 7.2 16 16v32c0 8.8-7.2 16-16 16H272c-8.8 0-16-7.2-16-16V144c0-8.8 7.2-16 16-16zM256 240c0-8.8 7.2-16 16-16h32c8.8 0 16 7.2 16 16v32c0 8.8-7.2 16-16 16H272c-8.8 0-16-7.2-16-16V240zM368 128h32c8.8 0 16 7.2 16 16v32c0 8.8-7.2 16-16 16H368c-8.8 0-16-7.2-16-16V144c0-8.8 7.2-16 16-16zM352 240c0-8.8 7.2-16 16-16h32c8.8 0 16 7.2 16 16v32c0 8.8-7.2 16-16 16H368c-8.8 0-16-7.2-16-16V240zM464 128h32c8.8 0 16 7.2 16 16v32c0 8.8-7.2 16-16 16H464c-8.8 0-16-7.2-16-16V144c0-8.8 7.2-16 16-16zM448 240c0-8.8 7.2-16 16-16h32c8.8 0 16 7.2 16 16v32c0 8.8-7.2 16-16 16H464c-8.8 0-16-7.2-16-16V240zm16 80h32c8.8 0 16 7.2 16 16v32c0 8.8-7.2 16-16 16H464c-8.8 0-16-7.2-16-16V336c0-8.8 7.2-16 16-16z"/></svg>`,
};

export class TriggerBlock {
  private el: HTMLElement;
  public data: ITriggerBlock;
  private onChange: () => void;

  constructor(data: ITriggerBlock | undefined, onChange: () => void) {
    this.data = data || {
      shortcut: '',
      mode: 'trigger',
      smartCase: true,
      forceCapitalize: false,
    };
    this.onChange = onChange;
    this.el = document.createElement('div');
    this.el.className = 'block-card';
    this.el.id = 'trigger-block';
    this.render();
  }

  public getElement(): HTMLElement {
    return this.el;
  }

  public getData(): ITriggerBlock {
    return this.data;
  }

  private render() {
    this.el.innerHTML = /* html */ `
      <div class="block-header">
        <div class="block-icon">${ICONS.play}</div>
        <div class="block-title-wrap">
          <p class="block-step">Step 1</p>
          <h2 class="block-title">Trigger: When I type</h2>
        </div>
        <span class="block-badge">Keyboard</span>
      </div>
      <div class="block-body">
        
        <!-- Shortcut input -->
        <div style="margin-bottom: 1.25rem;">
          <label class="form-label">Abbreviation / Shortcut</label>
          <div class="input-wrap">
            <div class="input-field">
              <span>/</span>
              <input type="text" id="trigger-shortcut" value="${this.data.shortcut}" placeholder="e.g. hello" />
            </div>
            <div class="input-hint">
              ${ICONS.keyboard} Prefix: <span style="color:#e5e5e5">/</span>
            </div>
          </div>
        </div>

        <!-- Mode Select -->
        <div style="margin-bottom: 1.25rem;">
          <label class="form-label">Trigger Mode</label>
          <select id="trigger-mode" class="input-field" style="width:100%; border:1px solid #404040; background:#0a0a0a; color:#fff; padding:0.625rem; border-radius:0.5rem; outline:none;">
            <option value="trigger" ${this.data.mode === 'trigger' ? 'selected' : ''}>Trigger (Space/Tab/Enter)</option>
            <option value="exact_match" ${this.data.mode === 'exact_match' ? 'selected' : ''}>Exact Match (Custom char)</option>
          </select>
        </div>

        <div id="trigger-exact-char" style="margin-bottom: 1.25rem; display: ${this.data.mode === 'exact_match' ? 'block' : 'none'};">
          <label class="form-label">Exact Match Trigger Character</label>
          <div class="input-field">
            <input type="text" id="trigger-char" value="${this.data.exactMatchChar || '/'}" maxlength="1" />
          </div>
        </div>

        <!-- Toggles -->
        <div class="toggle-row">
          <div class="toggle-info">
            <p>Smart Case</p>
            <p>Matches regardless of letter casing</p>
          </div>
          <div class="switch ${this.data.smartCase ? 'is-on' : ''}" id="trigger-smartcase"></div>
        </div>
        
        <div class="toggle-row">
          <div class="toggle-info">
            <p>Force Capitalize</p>
            <p>Always capitalize the first letter of the output</p>
          </div>
          <div class="switch ${this.data.forceCapitalize ? 'is-on' : ''}" id="trigger-capitalize"></div>
        </div>
      </div>
    `;

    this.bindEvents();
  }

  private bindEvents() {
    const input = this.el.querySelector<HTMLInputElement>('#trigger-shortcut')!;
    input.addEventListener('input', (e) => {
      this.data.shortcut = (e.target as HTMLInputElement).value;
      this.onChange();
    });

    const mode = this.el.querySelector<HTMLSelectElement>('#trigger-mode')!;
    const exactCharContainer = this.el.querySelector<HTMLElement>('#trigger-exact-char')!;
    mode.addEventListener('change', (e) => {
      this.data.mode = (e.target as HTMLSelectElement).value as TriggerMode;
      exactCharContainer.style.display = this.data.mode === 'exact_match' ? 'block' : 'none';
      this.onChange();
    });

    const charInput = this.el.querySelector<HTMLInputElement>('#trigger-char')!;
    charInput.addEventListener('input', (e) => {
      this.data.exactMatchChar = (e.target as HTMLInputElement).value;
      this.onChange();
    });

    const smartCase = this.el.querySelector<HTMLElement>('#trigger-smartcase')!;
    smartCase.addEventListener('click', () => {
      this.data.smartCase = !this.data.smartCase;
      smartCase.classList.toggle('is-on', this.data.smartCase);
      this.onChange();
    });

    const forceCap = this.el.querySelector<HTMLElement>('#trigger-capitalize')!;
    forceCap.addEventListener('click', () => {
      this.data.forceCapitalize = !this.data.forceCapitalize;
      forceCap.classList.toggle('is-on', this.data.forceCapitalize);
      this.onChange();
    });
  }
}
