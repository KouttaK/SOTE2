/**
 * src/dashboard/components/tokens/modals/FlowRefModal.ts
 *
 * Configures a `flow_ref` ("Incluir Fluxo") token: lets the user search and
 * pick which other flow's action gets pulled in by reference at expansion
 * time (see resolveFlowRefToken in ActionContentResolver.ts). This is the
 * mechanism that lets two shortcuts share a common snippet — e.g. a
 * signature — from a single source of truth instead of copy-pasting it
 * into every flow that needs it.
 */
import { BaseModal } from './BaseModal.js';
import type { Flow, Token, FlowRefTokenConfig } from '../../../../shared/types/index.js';
import { t } from '../../../../shared/i18n/index.js';
import { storage } from '../../../../shared/storage/StorageService.js';

function escapeHtml(str: string): string {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

export class FlowRefModal extends BaseModal {
  private onSaveCallback: (newConfig: FlowRefTokenConfig) => void;
  private excludeFlowId?: string;
  private listEl!: HTMLElement;
  private searchEl!: HTMLInputElement;
  private allFlows: Flow[] = [];
  private selectedFlowId: string | null;

  constructor(token: Token, excludeFlowId: string | undefined, onSave: (newConfig: FlowRefTokenConfig) => void) {
    super(t('token.modal.configure_flow_ref'));
    this.onSaveCallback = onSave;
    this.excludeFlowId = excludeFlowId;
    this.selectedFlowId = ((token.config || {}) as unknown as FlowRefTokenConfig).flowId || null;

    this.body.innerHTML = /* html */ `
      <div class="field-group">
        <label>${t('token.flow_ref.picker_label')}</label>
        <p class="text-sm text-gray" style="margin-bottom:0.5rem">${t('token.flow_ref.picker_hint')}</p>
        <input type="text" class="form-input" id="flow-ref-search" placeholder="${t('token.flow_ref.search_placeholder')}" style="margin-bottom:0.5rem" />
        <div id="flow-ref-list" style="max-height:280px;overflow-y:auto;"></div>
      </div>
    `;

    this.searchEl = this.body.querySelector('#flow-ref-search') as HTMLInputElement;
    this.listEl = this.body.querySelector('#flow-ref-list') as HTMLElement;

    this.searchEl.addEventListener('input', () => this.renderList());
    this.loadFlows();
  }

  private async loadFlows() {
    this.listEl.innerHTML = `<p class="text-sm text-gray">${t('common.loading')}</p>`;
    const flows = await storage.getFlows();
    // A flow can't include itself directly — the runtime's cycle-guard
    // would also catch this at expansion time, but filtering it out of
    // the picker up front avoids offering a choice that can only ever
    // resolve to nothing.
    this.allFlows = flows.filter((f) => f.id !== this.excludeFlowId);
    this.renderList();
  }

  private renderList() {
    const query = this.searchEl.value.trim().toLowerCase();
    const filtered = query
      ? this.allFlows.filter((f) => f.name.toLowerCase().includes(query))
      : this.allFlows;

    if (this.allFlows.length === 0) {
      this.listEl.innerHTML = /* html */ `
        <div class="token-menu-item is-disabled">
          <div class="token-menu-text">
            <p>${t('token.flow_ref.no_flows_title')}</p>
            <span>${t('token.flow_ref.no_flows_desc')}</span>
          </div>
        </div>
      `;
      return;
    }

    if (filtered.length === 0) {
      this.listEl.innerHTML = `<p class="text-sm text-gray">${t('token.flow_ref.no_results')}</p>`;
      return;
    }

    this.listEl.innerHTML = filtered.map((f) => {
      const isSelected = f.id === this.selectedFlowId;
      return /* html */ `
        <div class="token-menu-item${isSelected ? ' is-selected' : ''}" data-flow-id="${f.id}" style="cursor:pointer;${isSelected ? 'background:rgba(13,148,136,0.12);' : ''}">
          <div class="token-menu-text">
            <p>${escapeHtml(f.name)}</p>
          </div>
        </div>
      `;
    }).join('');

    this.listEl.querySelectorAll<HTMLElement>('[data-flow-id]').forEach((row) => {
      row.addEventListener('click', () => {
        this.selectedFlowId = row.dataset.flowId!;
        this.renderList();
      });
    });
  }

  protected onSave(): void {
    if (!this.selectedFlowId) {
      alert(t('token.flow_ref.select_alert'));
      return;
    }
    const flow = this.allFlows.find((f) => f.id === this.selectedFlowId);
    this.onSaveCallback({ flowId: this.selectedFlowId, flowLabel: flow?.name || '' });
    this.close();
  }
}
