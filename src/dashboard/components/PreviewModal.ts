/**
 * src/dashboard/components/PreviewModal.ts
 *
 * Read-only "what will actually be typed" preview for the flow editor's
 * Preview button. Reuses the same visual language as the rest of the
 * extension (.modal-backdrop/.modal-container from tokens.css, and
 * .rt-editor-area from editor.css so token pills and rich-text formatting
 * render exactly as they do inside the Action block editor).
 */

import type { TriggerBlock as ITriggerBlock, ActionBlock as IActionBlock, Settings, Variable } from '../../shared/types/index.js';
import { t } from '../../shared/i18n/index.js';

const ICONS = {
  eye: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 576 512" fill="currentColor" style="width:1rem;height:1rem;"><path d="M288 32c-80.8 0-145.5 36.8-192.6 80.6C48.6 156 17.3 208 2.5 243.7c-3.3 7.9-3.3 16.7 0 24.6C17.3 304 48.6 356 95.4 399.4C142.5 443.2 207.2 480 288 480s145.5-36.8 192.6-80.6c46.8-43.5 78.1-95.4 93-131.1c3.3-7.9 3.3-16.7 0-24.6c-14.9-35.7-46.2-87.7-93-131.1C433.5 68.8 368.8 32 288 32zM144 256a144 144 0 1 1 288 0 144 144 0 1 1 -288 0zm144-64c0 35.3-28.7 64-64 64c-7.1 0-13.9-1.2-20.3-3.3c-5.5-1.8-11.9 1.6-11.7 7.4c.3 6.9 1.3 13.8 3.2 20.7c13.7 51.2 66.4 81.6 117.6 67.9s81.6-66.4 67.9-117.6c-11.1-41.5-47.8-69.4-88.6-71.1c-5.8-.2-9.2 6.1-7.4 11.7c2.1 6.4 3.3 13.2 3.3 20.3z"/></svg>`,
  close: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 384 512" fill="currentColor" style="width:1rem;height:1rem;"><path d="M342.6 150.6c12.5-12.5 12.5-32.8 0-45.3s-32.8-12.5-45.3 0L192 210.7 86.6 105.4c-12.5-12.5-32.8-12.5-45.3 0s-12.5 32.8 0 45.3L146.7 256 41.4 361.4c-12.5 12.5-12.5 32.8 0 45.3s32.8 12.5 45.3 0L192 301.3 297.4 406.6c12.5 12.5 32.8 12.5 45.3 0s12.5-32.8 0-45.3L237.3 256 342.6 150.6z"/></svg>`,
};

export interface PreviewBranch {
  /** 'SE' | 'SENÃO SE' | 'SENÃO' — omitted (undefined) when there's no condition step. */
  tag?: string;
  /** Human-readable rule summary (e.g. from describeConditionRule) — omitted for the Else branch. */
  ruleDescription?: string;
  action: IActionBlock;
}

export interface PreviewData {
  trigger: ITriggerBlock;
  settings: Settings;
  branches: PreviewBranch[];
  /** Global Variables, used to resolve {{KEY}} placeholders in each branch's action content — same substitution the runtime engine does in content.ts. */
  variables?: Variable[];
}

function escapeHtml(str: string): string {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

/**
 * Replaces every `{{KEY}}` placeholder in an action's (HTML) content with
 * the matching Global Variable's value, so the preview shows exactly what
 * will actually be typed — the same substitution content.ts performs at
 * expansion time. Unknown keys are left untouched. Values are HTML-escaped
 * since `content` here is trusted HTML rendered as-is (see renderActionPreview).
 */
function resolveVariablesInContent(html: string, variables: Variable[]): string {
  if (!variables.length || !html.includes('{{')) return html;
  const map = new Map(variables.map((v) => [v.key, v.value]));
  return html.replace(/\{\{\s*([A-Z0-9_]+)\s*\}\}/g, (match, key: string) => {
    const value = map.get(key);
    return value === undefined ? match : escapeHtml(value);
  });
}

export class PreviewModal {
  private backdrop: HTMLElement;
  private escHandler: (e: KeyboardEvent) => void;
  private variables: Variable[];

  constructor(data: PreviewData) {
    this.variables = data.variables || [];
    this.backdrop = document.createElement('div');
    this.backdrop.className = 'modal-backdrop';

    const prefix = data.settings.triggerMode === 'exact_match' ? (data.settings.exactMatchChar || '/') : '';
    const shortcut = data.trigger.shortcut?.trim();
    const shortcutDisplay = shortcut ? `${prefix}${shortcut}` : t('preview.no_shortcut');

    const branchesHtml = data.branches.map(b => `
      <div class="preview-branch">
        ${b.tag ? `
          <div class="preview-branch-label">
            <span class="preview-branch-tag">${escapeHtml(b.tag)}</span>
            ${b.ruleDescription ? `<span class="preview-branch-rule">${escapeHtml(b.ruleDescription)}</span>` : ''}
          </div>
        ` : ''}
        ${this.renderActionPreview(b.action)}
      </div>
    `).join('');

    this.backdrop.innerHTML = `
      <div class="modal-container modal-container--wide">
        <div class="modal-header">
          <div class="modal-title">${ICONS.eye} ${t('preview.title')}</div>
          <button class="modal-close" title="${t('common.close')}">${ICONS.close}</button>
        </div>
        <div class="modal-body preview-modal-body">
          <div class="preview-trigger-row">
            <span class="preview-trigger-label">${t('preview.trigger_label')}</span>
            <span class="preview-trigger-badge ${shortcut ? '' : 'preview-trigger-badge--empty'}">${escapeHtml(shortcutDisplay)}</span>
          </div>
          ${branchesHtml}
        </div>
      </div>
    `;

    this.backdrop.querySelector('.modal-close')!.addEventListener('click', () => this.close());
    this.backdrop.addEventListener('mousedown', (e) => {
      if (e.target === this.backdrop) this.close();
    });
    this.escHandler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') this.close();
    };
    document.addEventListener('keydown', this.escHandler);
  }

  private renderActionPreview(action: IActionBlock): string {
    const content = (action.content || '').trim();
    const isEmpty = content === '' || content === '<p><br></p>';
    if (isEmpty) {
      return `<div class="preview-content preview-content--empty">${t('preview.empty_content')}</div>`;
    }
    // action.content is already trusted HTML produced by our own
    // contenteditable Action-block editor (same-origin, never user-supplied
    // raw HTML from elsewhere), so it's safe to render as-is here — this is
    // what makes the preview an exact match of what will be typed,
    // including formatting and token pills. {{KEY}} placeholders are
    // resolved against Global Variables first, same as at runtime.
    const resolvedContent = resolveVariablesInContent(content, this.variables);
    return `<div class="preview-content rt-editor-area" style="min-height:0;">${resolvedContent}</div>`;
  }

  public open() {
    document.body.appendChild(this.backdrop);
  }

  public close() {
    document.removeEventListener('keydown', this.escHandler);
    if (this.backdrop.parentNode) {
      this.backdrop.parentNode.removeChild(this.backdrop);
    }
  }
}
