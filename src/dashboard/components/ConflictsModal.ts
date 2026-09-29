/**
 * src/dashboard/components/ConflictsModal.ts
 *
 * Modal that renders all detected shortcut conflicts (duplicates, prefix overlaps, and search trigger collisions),
 * allowing users to jump straight to the editor or disable conflicting flows.
 */

import type { Flow, Settings } from '../../shared/types/index.js';
import { storage } from '../../shared/storage/StorageService.js';
import { detectAllConflicts, ShortcutConflict } from '../../shared/utils/conflictDetector.js';
import { t } from '../../shared/i18n/index.js';
import { escapeHtml } from '../../shared/utils/dom.js';
import { router } from '../router.js';
import './ConflictsModal.css';

export class ConflictsModal {
  public static async show(onResolved?: () => void): Promise<void> {
    const [flows, settings] = await Promise.all([
      storage.getFlows(),
      storage.getSettings(),
    ]);

    let conflicts = detectAllConflicts(flows, settings);
    const prefixWaitMs = settings.prefixWaitMs ?? 500;

    const backdrop = document.createElement('div');
    backdrop.className = 'modal-backdrop conflicts-modal-backdrop';
    backdrop.innerHTML = /* html */ `
      <div class="modal-container modal-container--wide conflicts-modal-container">
        <div class="modal-header">
          <div>
            <h2 class="modal-title">${t('conflicts.title')}</h2>
            <p class="conflicts-modal-subtitle">${t('conflicts.subtitle')}</p>
          </div>
          <button type="button" class="modal-close" id="conflicts-modal-close" aria-label="${t('common.close')}">&times;</button>
        </div>
        <div class="modal-body conflicts-modal-body">
          <div id="conflicts-list" class="conflicts-list"></div>
        </div>
        <div class="modal-footer">
          <button type="button" class="btn-secondary" id="conflicts-btn-close">${t('common.close')}</button>
        </div>
      </div>
    `;

    document.body.appendChild(backdrop);

    const listEl = backdrop.querySelector('#conflicts-list') as HTMLElement;

    const renderConflicts = () => {
      listEl.innerHTML = '';
      if (conflicts.length === 0) {
        listEl.innerHTML = /* html */ `
          <div class="conflicts-empty-state">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" fill="currentColor" class="conflicts-empty-icon"><path d="M256 512A256 256 0 1 0 256 0a256 256 0 1 0 0 512zM369 209L241 337c-9.4 9.4-24.6 9.4-33.9 0l-64-64c-9.4-9.4-9.4-24.6 0-33.9s24.6-9.4 33.9 0l47 47L335 175c9.4-9.4 24.6-9.4 33.9 0s9.4 24.6 0 33.9z"/></svg>
            <h3>${t('conflicts.empty_title')}</h3>
            <p>${t('conflicts.empty_desc')}</p>
          </div>
        `;
        return;
      }

      conflicts.forEach((conflict) => {
        const item = document.createElement('div');
        item.className = `conflict-card conflict-card--${conflict.severity}`;

        const badgeLabel = t(`conflicts.badge.${conflict.severity}`);
        const params: Record<string, any> = {
          ...(conflict.descriptionParams || {}),
          ms: prefixWaitMs,
        };
        const descText = t(conflict.descriptionKey, params);

        item.innerHTML = /* html */ `
          <div class="conflict-card-header">
            <span class="conflict-badge conflict-badge--${conflict.severity}">${badgeLabel}</span>
            <span class="conflict-shortcuts">
              <span class="conflict-sc-pill">/${escapeHtml(conflict.shortcutA)}</span>
              ${conflict.shortcutB ? `<span class="conflict-vs">vs</span><span class="conflict-sc-pill">/${escapeHtml(conflict.shortcutB)}</span>` : ''}
            </span>
          </div>
          <p class="conflict-desc">${descText}</p>
          <div class="conflict-actions">
            <button type="button" class="btn-secondary btn-sm conflict-edit-a" data-id="${conflict.flowA.id}">
              ${t('conflicts.action.edit_flow')} (/${escapeHtml(conflict.shortcutA)})
            </button>
            <button type="button" class="btn-secondary btn-sm conflict-disable-a" data-id="${conflict.flowA.id}">
              ${t('conflicts.action.disable_flow')}
            </button>
            ${
              conflict.flowB
                ? /* html */ `
                  <button type="button" class="btn-secondary btn-sm conflict-edit-b" data-id="${conflict.flowB.id}">
                    ${t('conflicts.action.edit_flow')} (/${escapeHtml(conflict.shortcutB || '')})
                  </button>
                  <button type="button" class="btn-secondary btn-sm conflict-disable-b" data-id="${conflict.flowB.id}">
                    ${t('conflicts.action.disable_flow')}
                  </button>
                `
                : ''
            }
          </div>
        `;

        // Action bindings
        item.querySelector('.conflict-edit-a')?.addEventListener('click', () => {
          close();
          router.navigate(`/editor/${conflict.flowA.id}`);
        });

        item.querySelector('.conflict-disable-a')?.addEventListener('click', async () => {
          conflict.flowA.enabled = false;
          await storage.saveFlow(conflict.flowA);
          refresh();
        });

        if (conflict.flowB) {
          item.querySelector('.conflict-edit-b')?.addEventListener('click', () => {
            close();
            router.navigate(`/editor/${conflict.flowB!.id}`);
          });

          item.querySelector('.conflict-disable-b')?.addEventListener('click', async () => {
            conflict.flowB!.enabled = false;
            await storage.saveFlow(conflict.flowB!);
            refresh();
          });
        }

        listEl.appendChild(item);
      });
    };

    const refresh = async () => {
      const updatedFlows = await storage.getFlows();
      conflicts = detectAllConflicts(updatedFlows, settings);
      renderConflicts();
      onResolved?.();
    };

    const close = () => {
      backdrop.remove();
      document.removeEventListener('keydown', onKeydown);
    };

    const onKeydown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };

    document.addEventListener('keydown', onKeydown);
    backdrop.querySelector('#conflicts-modal-close')?.addEventListener('click', close);
    backdrop.querySelector('#conflicts-btn-close')?.addEventListener('click', close);

    renderConflicts();
  }
}
