/**
 * src/dashboard/components/blocks/BlockDock.ts
 *
 * A small, collapsible dock fixed to the bottom of the canvas. Replaces
 * the old per-leaf "+ Adicionar Bloco" popover (a button living inside
 * every single leaf, opening its own little dropdown) with a single dock
 * for the whole canvas: drag a chip from here and drop it onto whichever
 * leaf you want to convert. Leaves that can accept a drop highlight
 * themselves while a chip is dragged over them — see
 * makeLeafDropTarget()/renderBranchTarget() in editor.ts, which reads
 * DOCK_DRAG_MIME below to recognize a drag that actually came from this
 * dock (as opposed to, say, the rule-column reordering drag, which
 * carries a plain 'text/plain' payload instead).
 *
 * Extending this for a future block type is one more entry in
 * BLOCK_DOCK_ITEMS below — no new button or popover to design.
 */
import { t } from '../../../shared/i18n/index.js';

export type BlockDockItemType = 'condition' | 'random' | 'repeat' | 'action';

/** Custom MIME type tagging a drag as "this came from the block dock,
 * carrying this specific block type" — lets a leaf's drop handler tell it
 * apart from unrelated drags on the same canvas. */
export const DOCK_DRAG_MIME = 'application/x-sote-block-type';

interface BlockDockItemDef {
  type: BlockDockItemType;
  viewbox: string;
  icon?: string;
  shapes?: string;
}

const BLOCK_DOCK_ITEMS: BlockDockItemDef[] = [
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
    type: 'repeat',
    viewbox: '0 0 24 24',
    shapes: '<path d="M17 2l4 4-4 4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/><path d="M3 11v-1a4 4 0 0 1 4-4h14" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/><path d="M7 22l-4-4 4-4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/><path d="M21 13v1a4 4 0 0 1-4 4H3" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/>',
  },
  {
    type: 'action',
    viewbox: '0 0 448 512',
    icon: 'M288 64c0 17.7-14.3 32-32 32H32C14.3 96 0 81.7 0 64S14.3 32 32 32H256c17.7 0 32 14.3 32 32zm0 256c0 17.7-14.3 32-32 32H32c-17.7 0-32-14.3-32-32s14.3-32 32-32H256c17.7 0 32 14.3 32 32zM0 192c0-17.7 14.3-32 32-32H416c17.7 0 32 14.3 32 32s-14.3 32-32 32H32c-17.7 0-32-14.3-32-32zM448 448c0 17.7-14.3 32-32 32H32c-17.7 0-32-14.3-32-32s14.3-32 32-32H416c17.7 0 32 14.3 32 32z',
  },
];

const CHEVRON_DOWN = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>`;
const CHEVRON_UP = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="18 15 12 9 6 15"></polyline></svg>`;

export class BlockDock {
  private el: HTMLElement;
  private collapsed = false;
  // Nível 2 (Condição) is unique and fixed right below the Trigger (Nível
  // 1) — once a flow already has one, the "Condição" chip is hidden from
  // the dock entirely, instead of staying draggable but landing nowhere,
  // since every drop target in the canvas only ever accepts 'random'
  // once a Condição already exists. See FlowEditorPage's calls to
  // setAvailableTypes() after every render.
  private availableTypes: Set<BlockDockItemType> = new Set(['condition', 'random', 'repeat', 'action']);

  constructor() {
    this.el = document.createElement('div');
    this.el.className = 'block-dock';
    this.render();
  }

  public getElement(): HTMLElement {
    return this.el;
  }

  /** Restricts which chips are shown — see `availableTypes` doc above. */
  public setAvailableTypes(types: BlockDockItemType[]): void {
    this.availableTypes = new Set(types);
    this.render();
  }

  private render(): void {
    const visibleItems = BLOCK_DOCK_ITEMS.filter((item) => this.availableTypes.has(item.type));
    this.el.innerHTML = /* html */ `
      <div class="block-dock-chips" ${this.collapsed ? 'style="display:none;"' : ''}>
        <span class="block-dock-label">${t('block_dock.add_label')}</span>
        ${visibleItems.map((item) => /* html */ `
          <div class="block-dock-chip" draggable="true" data-type="${item.type}" title="${t(`block.${item.type}.desc`)}">
            <span class="block-dock-chip-icon token-${item.type}">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="${item.viewbox}" fill="currentColor">
                ${item.shapes || `<path d="${item.icon}" />`}
              </svg>
            </span>
            <span class="block-dock-chip-label">${t(`block.${item.type}`)}</span>
          </div>
        `).join('')}
      </div>
      <button type="button" class="block-dock-toggle" title="${t(this.collapsed ? 'block_dock.expand' : 'block_dock.collapse')}">
        ${this.collapsed ? CHEVRON_UP : CHEVRON_DOWN}
        <span class="block-dock-toggle-label">${t('block_dock.label')}</span>
      </button>
    `;

    this.el.querySelector('.block-dock-toggle')!.addEventListener('click', () => {
      this.collapsed = !this.collapsed;
      this.render();
    });

    this.el.querySelectorAll<HTMLElement>('.block-dock-chip').forEach((chip) => {
      chip.addEventListener('dragstart', (e) => {
        const type = chip.dataset.type!;
        e.dataTransfer?.setData(DOCK_DRAG_MIME, type);
        if (e.dataTransfer) e.dataTransfer.effectAllowed = 'copy';
        // A drag image built from the chip itself (rather than the
        // browser's default, which would include the whole dock's
        // layout/shadow) keeps the drag preview tidy.
        e.dataTransfer?.setDragImage(chip, chip.offsetWidth / 2, chip.offsetHeight / 2);
        document.body.classList.add('is-dragging-block-chip');
      });
      chip.addEventListener('dragend', () => {
        document.body.classList.remove('is-dragging-block-chip');
      });
    });
  }
}
