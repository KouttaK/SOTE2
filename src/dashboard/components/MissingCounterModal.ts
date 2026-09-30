import type { Flow } from '../../shared/types/index.js';
import { StorageService } from '../../shared/storage/StorageService.js';
import { sanitizeHtml } from '../../shared/utils/sanitizeHtml.js';

/**
 * Modal to display missing counters when a user imports a flow.
 * Shows which counters are missing and prompts the user to create them or proceed without.
 */
export function showMissingCounterModal(
  flow: Flow,
  missingCounterIds: string[],
  onConfirm: () => void,
  onCancel: () => void
): void {
  const overlay = document.createElement('div');
  overlay.className = 'modal-backdrop';

  const modal = document.createElement('div');
  modal.className = 'modal';

  const header = document.createElement('div');
  header.className = 'modal-header';
  const title = document.createElement('h3');
  title.textContent = 'Contadores Ausentes Identificados';
  header.appendChild(title);

  const body = document.createElement('div');
  body.className = 'modal-body';
  body.innerHTML = `
    <p>O fluxo <strong>${sanitizeHtml(flow.name)}</strong> faz referência a contadores que não existem neste ambiente:</p>
    <ul class="missing-list">
      ${missingCounterIds.map(id => `<li><span class="pill">${sanitizeHtml(id)}</span></li>`).join('')}
    </ul>
    <p>Isso pode ocorrer se os contadores foram apagados ou não foram exportados junto com o fluxo. Se prosseguir, os tokens desses contadores serão ignorados durante a expansão.</p>
  `;

  const footer = document.createElement('div');
  footer.className = 'modal-footer';

  const cancelBtn = document.createElement('button');
  cancelBtn.className = 'btn btn-secondary';
  cancelBtn.textContent = 'Cancelar Importação';
  cancelBtn.onclick = () => {
    overlay.remove();
    onCancel();
  };

  const confirmBtn = document.createElement('button');
  confirmBtn.className = 'btn btn-primary';
  confirmBtn.textContent = 'Importar Mesmo Assim';
  confirmBtn.onclick = () => {
    overlay.remove();
    onConfirm();
  };

  footer.appendChild(cancelBtn);
  footer.appendChild(confirmBtn);

  modal.appendChild(header);
  modal.appendChild(body);
  modal.appendChild(footer);
  overlay.appendChild(modal);

  document.body.appendChild(overlay);
}
