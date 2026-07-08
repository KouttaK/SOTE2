/**
 * src/dashboard/components/tokens/modals/BaseModal.ts
 */

import { t } from '../../../../shared/i18n/index.js';

export abstract class BaseModal {
  protected backdrop!: HTMLElement;
  protected container!: HTMLElement;
  protected body!: HTMLElement;

  constructor(title: string) {
    this.createDOM(title);
  }

  private createDOM(title: string) {
    this.backdrop = document.createElement('div');
    this.backdrop.className = 'modal-backdrop';

    this.container = document.createElement('div');
    this.container.className = 'modal-container';

    // Header
    const header = document.createElement('div');
    header.className = 'modal-header';
    header.innerHTML = `
      <div class="modal-title">${title}</div>
      <button class="modal-close">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 384 512" fill="currentColor" style="width:1rem;height:1rem;">
          <path d="M342.6 150.6c12.5-12.5 12.5-32.8 0-45.3s-32.8-12.5-45.3 0L192 210.7 86.6 105.4c-12.5-12.5-32.8-12.5-45.3 0s-12.5 32.8 0 45.3L146.7 256 41.4 361.4c-12.5 12.5-12.5 32.8 0 45.3s32.8 12.5 45.3 0L192 301.3 297.4 406.6c12.5 12.5 32.8 12.5 45.3 0s12.5-32.8 0-45.3L237.3 256 342.6 150.6z"/>
        </svg>
      </button>
    `;

    // Body
    this.body = document.createElement('div');
    this.body.className = 'modal-body';

    // Footer
    const footer = document.createElement('div');
    footer.className = 'modal-footer';
    footer.innerHTML = `
      <button class="btn-secondary" id="btn-modal-cancel">${t('common.cancel')}</button>
      <button class="btn-primary" id="btn-modal-save">${t('common.save')}</button>
    `;

    this.container.appendChild(header);
    this.container.appendChild(this.body);
    this.container.appendChild(footer);
    this.backdrop.appendChild(this.container);

    // Event Listeners
    header.querySelector('.modal-close')!.addEventListener('click', () => this.close());
    footer.querySelector('#btn-modal-cancel')!.addEventListener('click', () => this.close());
    footer.querySelector('#btn-modal-save')!.addEventListener('click', () => this.onSave());
    this.backdrop.addEventListener('mousedown', (e) => {
      if (e.target === this.backdrop) this.close();
    });
  }

  public open() {
    document.body.appendChild(this.backdrop);
  }

  public close() {
    if (this.backdrop.parentNode) {
      this.backdrop.parentNode.removeChild(this.backdrop);
    }
  }

  protected abstract onSave(): void;
}
