/**
 * src/dashboard/components/MissingVariablesModal.ts
 *
 * Shown when opening or saving a Flow that references one or more
 * `{{KEY}}` Global Variables that don't exist yet (see
 * shared/utils/flowVariableScanner.ts) — without this, the shortcut would
 * expand with the literal "{{KEY}}" text still sitting in it:
 * resolveVariablesInText() deliberately leaves an unknown key untouched
 * rather than swallowing it (so a typo doesn't just silently vanish), but
 * that also means a genuinely-missing variable stays silent until
 * something actively warns about it — this modal is that warning.
 *
 * Per missing key, offers:
 *  - "Remover": strips every `{{KEY}}` occurrence from THIS flow only —
 *    the Variable never existed, so there's nothing global to delete.
 *  - "Manter e Criar": creates the Global Variable so the reference
 *    resolves to something real instead of showing up literally. Its
 *    value comes from an imported backup file if one was loaded (see the
 *    "Importar de um backup" button below) and that backup happens to
 *    define the same key; otherwise it's created blank ('') — a
 *    deliberately generic value so nothing surprising appears in the
 *    expanded text.
 *
 * "Importar de um backup" reads a previously-exported sote-backup-*.json
 * file (see dashboard/pages/settings.ts's export/import — same
 * StorageSchema shape) and creates every one of *its* variables that
 * doesn't already exist locally, matched by `key` (never by `id`, so this
 * can never end up with two variables sharing a key) — not just the ones
 * this flow happens to be missing, since a backup is the most likely
 * place any other missing key's real value lives too. Any backup
 * variable whose key already exists locally is left completely alone and
 * reported instead of silently overwritten or duplicated.
 */
import type { Flow } from '../../shared/types/index.js';
import { removeVariableKeyFromFlow } from '../../shared/utils/flowVariableScanner.js';
import { storage } from '../../shared/storage/StorageService.js';
import { t } from '../../shared/i18n/index.js';
import { escapeHtml } from '../../shared/utils/dom.js';
import { showToast } from '../../shared/components/Toast.js';
import { validateImport } from '../../shared/utils/importValidator.js';

export interface MissingVariablesResult {
  /** True only if every missing key was either removed or created before the modal closed. */
  allResolved: boolean;
}

/**
 * `flow` is mutated in place for every key the user chooses to "Remover"
 * (its `{{KEY}}` occurrences are stripped from the flow's content) — the
 * caller is expected to re-render from the same `flow` object afterwards.
 * `dismissLabel` lets the two call sites word the "I'll deal with this
 * later" button appropriately ("Fechar" on open, "Salvar Mesmo Assim" on
 * save, since a soft warning like this shouldn't ever trap someone from
 * saving their work).
 */
export function showMissingVariablesModal(flow: Flow, missingKeys: string[], dismissLabel: string): Promise<MissingVariablesResult> {
  return new Promise((resolve) => {
    const pending = new Set(missingKeys);
    // Filled in as backup variables get imported — lets a still-pending
    // row auto-resolve instead of leaving a stale "Manter e Criar" button
    // for a key that a just-imported backup already created.
    const importedKeys = new Set<string>();

    const backdrop = document.createElement('div');
    backdrop.className = 'modal-backdrop';
    backdrop.innerHTML = /* html */ `
      <div class="modal-container modal-container--wide">
        <div class="modal-header">
          <span class="modal-title">${t('missing_vars.title')}</span>
          <button type="button" class="modal-close" aria-label="${t('common.close')}">&times;</button>
        </div>
        <div class="modal-body">
          <p class="mvm-desc">${t('missing_vars.desc')}</p>
          <div class="mvm-backup-row">
            <button type="button" class="btn-secondary" id="mvm-import-backup">${t('missing_vars.import_backup_btn')}</button>
            <input type="file" accept=".json,application/json" style="display:none" id="mvm-backup-file" />
          </div>
          <p class="mvm-backup-status" id="mvm-backup-status"></p>
          <div class="mvm-rows" id="mvm-rows"></div>
        </div>
        <div class="modal-footer">
          <button type="button" class="btn-secondary" id="mvm-dismiss">${escapeHtml(dismissLabel)}</button>
        </div>
      </div>
    `;
    document.body.appendChild(backdrop);

    const rowsEl = backdrop.querySelector('#mvm-rows') as HTMLElement;
    const statusEl = backdrop.querySelector('#mvm-backup-status') as HTMLElement;

    const renderRow = (key: string) => {
      const row = document.createElement('div');
      row.className = 'mvm-row';
      row.dataset.key = key;
      row.innerHTML = /* html */ `
        <code class="mvm-key">{{${escapeHtml(key)}}}</code>
        <div class="mvm-row-actions">
          <button type="button" class="btn-secondary mvm-remove">${t('missing_vars.remove_btn')}</button>
          <button type="button" class="btn-primary mvm-keep">${t('missing_vars.keep_create_btn')}</button>
        </div>
      `;
      row.querySelector('.mvm-remove')!.addEventListener('click', () => {
        removeVariableKeyFromFlow(flow, key);
        resolveRow(key);
      });
      row.querySelector('.mvm-keep')!.addEventListener('click', async () => {
        await storage.saveVariable({ id: crypto.randomUUID(), key, value: '', updatedAt: Date.now() });
        resolveRow(key);
      });
      rowsEl.appendChild(row);
    };

    missingKeys.forEach(renderRow);

    const close = (result: MissingVariablesResult) => {
      backdrop.remove();
      document.removeEventListener('keydown', onKeydown);
      resolve(result);
    };

    const resolveRow = (key: string) => {
      pending.delete(key);
      rowsEl.querySelector(`[data-key="${CSS.escape(key)}"]`)?.remove();
      if (pending.size === 0) close({ allResolved: true });
    };

    const onKeydown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close({ allResolved: pending.size === 0 });
    };
    document.addEventListener('keydown', onKeydown);

    backdrop.querySelector('.modal-close')!.addEventListener('click', () => close({ allResolved: pending.size === 0 }));
    backdrop.querySelector('#mvm-dismiss')!.addEventListener('click', () => close({ allResolved: pending.size === 0 }));

    const fileInput = backdrop.querySelector('#mvm-backup-file') as HTMLInputElement;
    backdrop.querySelector('#mvm-import-backup')!.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', async () => {
      const file = fileInput.files?.[0];
      fileInput.value = '';
      if (!file) return;

      statusEl.textContent = t('missing_vars.importing');
      try {
        const text = await file.text();
        const validation = validateImport(text);
        if (!validation.valid || !validation.data || !Array.isArray(validation.data.variables)) throw new Error('invalid shape');

        const currentVariables = await storage.getVariables();
        const currentKeys = new Set(currentVariables.map((v) => v.key));
        let created = 0;
        const collisions: string[] = [];

        for (const raw of validation.data.variables) {
          if (!raw || typeof raw.key !== 'string') continue;
          if (currentKeys.has(raw.key)) {
            collisions.push(raw.key);
            continue;
          }
          // Matched by key, never by the backup's own id — importing by
          // id (like the general Settings backup-restore flow does) risks
          // two variables ending up with the same key under different
          // ids, which is exactly the kind of duplicate this modal exists
          // to avoid introducing.
          await storage.saveVariable({ id: crypto.randomUUID(), key: raw.key, value: typeof raw.value === 'string' ? raw.value : '', updatedAt: Date.now() });
          currentKeys.add(raw.key);
          importedKeys.add(raw.key);
          created++;
        }

        // Any still-pending row this import just satisfied is resolved
        // automatically — its "Manter e Criar" button would otherwise
        // create a second, blank variable for a key that now already
        // has a real value.
        Array.from(pending).forEach((key) => { if (importedKeys.has(key)) resolveRow(key); });

        statusEl.textContent = t('missing_vars.import_summary', { count: created });
        if (collisions.length > 0) {
          showToast(t('missing_vars.import_collisions', { keys: collisions.join(', ') }), 'info');
        }
      } catch {
        statusEl.textContent = '';
        showToast(t('missing_vars.import_invalid'), 'error');
      }
    });
  });
}
