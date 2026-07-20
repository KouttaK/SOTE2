/**
 * src/dashboard/components/blocks/BlockMenu.ts
 *
 * A single, consistent "+ Adicionar Bloco" control for turning a plain leaf
 * Action into something else — a Condition (Se/Senão Se/Senão) or a Random
 * Block today, and whatever else gets added in the future. Modeled directly
 * on tokens/TokenMenu.ts (same overlay/list-item look) so the whole editor
 * shares one visual language for "pick one of a few options from a small
 * dropdown" instead of every place inventing its own button styling.
 *
 * Previously, converting a leaf offered two differently-styled buttons
 * side by side (an amber-dashed "Turn into Random Block" pill and a
 * grey-dashed "Add Nested Condition" pill), and the top level had yet a
 * third, bigger button that only offered Condition at all — three
 * inconsistent affordances for what is conceptually one decision. This
 * component (plus editor.ts's renderAddBlockControl) replaces all three
 * with one button + one dropdown, used everywhere a block can be added.
 *
 * Extending this for a future block type is just: add one entry to
 * BLOCK_MENU_ITEMS below, one i18n label/desc pair, and one branch in
 * whatever `onSelect` callback the call site passes in — no new component,
 * no new button style to invent.
 */
import { t } from '../../../shared/i18n/index.js';

export type BlockMenuItemType = 'condition' | 'random' | 'script';

interface BlockMenuItemDef {
  type: BlockMenuItemType;
  viewbox: string;
  icon?: string;
  shapes?: string;
}

const BLOCK_MENU_ITEMS: BlockMenuItemDef[] = [
  {
    type: 'condition',
    viewbox: '0 0 448 512',
    icon: 'M80 104a24 24 0 1 0 0-48 24 24 0 1 0 0 48zm80-24c0 32.8-19.7 61-48 73.3v87.8c18.8-10.9 40.7-17.1 64-17.1h96c35.3 0 64-28.7 64-64v-6.7C307.7 141 288 112.8 288 80c0-44.2 35.8-80 80-80s80 35.8 80 80c0 32.8-19.7 61-48 73.3V160c0 70.7-57.3 128-128 128H176c-35.3 0-64 28.7-64 64v6.7c28.3 12.3 48 40.5 48 73.3c0 44.2-35.8 80-80 80s-80-35.8-80-80c0-32.8 19.7-61 48-73.3V352 153.3C19.7 141 0 112.8 0 80C0 35.8 35.8 0 80 0s80 35.8 80 80zm232 0a24 24 0 1 0 -48 0 24 24 0 1 0 48 0zM80 456a24 24 0 1 0 0-48 24 24 0 1 0 0 48z',
  },
  {
    type: 'random',
    viewbox: '0 0 24 24',
    shapes: '<rect x="3" y="3" width="18" height="18" rx="4" ry="4" stroke="currentColor" stroke-width="2" fill="none"/><circle cx="8" cy="8" r="1.6" fill="currentColor"/><circle cx="16" cy="8" r="1.6" fill="currentColor"/><circle cx="12" cy="12" r="1.6" fill="currentColor"/><circle cx="8" cy="16" r="1.6" fill="currentColor"/><circle cx="16" cy="16" r="1.6" fill="currentColor"/>',
  },
  {
    // "</>" code-brackets icon (fa-code), for the sandboxed Script/Fórmula
    // block — see ScriptBlock in shared/types/index.ts.
    type: 'script',
    viewbox: '0 0 640 512',
    icon: 'M392.8 1.2c17-4.9 34.7 5 39.6 22l128 448c4.9 17-5 34.7-22 39.6s-34.7-5-39.6-22l-128-448c-4.9-17 5-34.7 22-39.6zm80.6 120.1c12.5-12.5 32.8-12.5 45.3 0l128 128c12.5 12.5 12.5 32.8 0 45.3l-128 128c-12.5 12.5-32.8 12.5-45.3 0s-12.5-32.8 0-45.3L578.7 272 473.4 166.6c-12.5-12.5-12.5-32.8 0-45.3zm-306.7 0c12.5 12.5 12.5 32.8 0 45.3L61.3 272l105.4 105.4c12.5 12.5 12.5 32.8 0 45.3s-32.8 12.5-45.3 0l-128-128c-12.5-12.5-12.5-32.8 0-45.3l128-128c12.5-12.5 32.8-12.5 45.3 0z',
  },
];

export class BlockMenu {
  private el: HTMLElement;
  private allowedTypes: Set<BlockMenuItemType>;
  private onSelect: (type: BlockMenuItemType) => void;

  /** `allowedTypes` controls which items this particular instance offers —
   * e.g. a rule branch's own leaf only offers Random (its Condition need is
   * already covered by the rule's own AND/OR criteria group), while the
   * Senão branch and the top-level root offer both. */
  constructor(allowedTypes: BlockMenuItemType[], onSelect: (type: BlockMenuItemType) => void) {
    this.allowedTypes = new Set(allowedTypes);
    this.onSelect = onSelect;
    this.el = document.createElement('div');
    this.el.className = 'token-menu-overlay add-block-menu-overlay';
    this.render();
  }

  public getElement(): HTMLElement {
    return this.el;
  }

  public toggle() {
    this.el.classList.toggle('is-open');
  }

  public hide() {
    this.el.classList.remove('is-open');
  }

  private render() {
    let html = '';
    BLOCK_MENU_ITEMS.filter((item) => this.allowedTypes.has(item.type)).forEach((item) => {
      html += /* html */ `
        <div class="token-menu-item" data-type="${item.type}">
          <div class="token-menu-icon token-${item.type}">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="${item.viewbox}" fill="currentColor" style="width:0.75rem;height:0.75rem;">
              ${item.shapes || `<path d="${item.icon}" />`}
            </svg>
          </div>
          <div class="token-menu-text">
            <p>${t(`block.${item.type}`)}</p>
            <span>${t(`block.${item.type}.desc`)}</span>
          </div>
        </div>
      `;
    });
    this.el.innerHTML = html;

    this.el.querySelectorAll('.token-menu-item').forEach((el) => {
      el.addEventListener('mousedown', (e) => {
        e.preventDefault();
        const type = (el as HTMLElement).dataset.type as BlockMenuItemType;
        this.onSelect(type);
        this.hide();
      });
    });
  }
}
