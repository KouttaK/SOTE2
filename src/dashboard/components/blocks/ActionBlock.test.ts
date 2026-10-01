/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { ActionBlock } from './ActionBlock';

vi.mock('../../../shared/i18n/index.js', () => ({
  t: (key: string) => key
}));

vi.mock('../../../shared/storage/StorageService.js', () => ({
  storage: {
    getVariables: vi.fn().mockResolvedValue([]),
    getCounters: vi.fn().mockResolvedValue([]),
    saveCounter: vi.fn().mockResolvedValue(undefined),
  }
}));

describe('ActionBlock Variable Pills Unwrap', () => {
  it('unwraps a fully intact variable pill', () => {
    const data = { format: 'richtext' as const, content: '', tokens: [] };
    const block = new ActionBlock(data, () => {});
    
    // Simulate what happens in the DOM when a variable is inserted
    block.getElement().querySelector('#rt-editor')!.innerHTML = 
      `<p>Hello <span class="token-pill token-variable" contenteditable="false"><span class="token-pill-icon">X</span><span class="token-pill-label">{{NOME}}</span></span>!</p>`;
    
    const savedData = block.getData();
    expect(savedData.content).toBe('<p>Hello {{NOME}}!</p>');
  });

  it('unwraps safely even if the user maliciously edited the pill internally (partial deletion)', () => {
    const data = { format: 'richtext' as const, content: '', tokens: [] };
    const block = new ActionBlock(data, () => {});
    
    // Maliciously edited pill where the icon was deleted and the text is just "{{NO"
    block.getElement().querySelector('#rt-editor')!.innerHTML = 
      `<p>Hello <span class="token-pill token-variable" contenteditable="false">{{NO</span>!</p>`;
    
    const savedData = block.getData();
    expect(savedData.content).toBe('<p>Hello {{NO!</p>');
  });

  it('unwraps two adjacent variable pills without merging them incorrectly', () => {
    const data = { format: 'richtext' as const, content: '', tokens: [] };
    const block = new ActionBlock(data, () => {});
    
    block.getElement().querySelector('#rt-editor')!.innerHTML = 
      `<p><span class="token-pill token-variable" contenteditable="false"><span class="token-pill-icon">X</span><span class="token-pill-label">{{A}}</span></span><span class="token-pill token-variable" contenteditable="false"><span class="token-pill-icon">X</span><span class="token-pill-label">{{B}}</span></span></p>`;
    
    const savedData = block.getData();
    expect(savedData.content).toBe('<p>{{A}}{{B}}</p>');
  });

  it('does not leak HTML if the pill contains HTML inside its text content', () => {
    const data = { format: 'richtext' as const, content: '', tokens: [] };
    const block = new ActionBlock(data, () => {});
    
    block.getElement().querySelector('#rt-editor')!.innerHTML = 
      `<p>Hello <span class="token-pill token-variable" contenteditable="false"><b>{{BOLD}}</b></span>!</p>`;
    
    const savedData = block.getData();
    // Because pill.textContent returns the text without tags, the <b> is stripped naturally during unwrap
    expect(savedData.content).toBe('<p>Hello {{BOLD}}!</p>');
  });

  it('getData() removes UI leak elements from clone', () => {
    const data = { format: 'richtext' as const, content: '', tokens: [] };
    const block = new ActionBlock(data, () => {});

    block.getElement().querySelector('#rt-editor')!.innerHTML =
      `<p>Texto real <span class="block-dock-toggle-label">blocos</span><span class="block-type-label">Condição</span></p>`;

    const savedData = block.getData();
    expect(savedData.content).toBe('<p>Texto real </p>');
    expect(savedData.content).not.toContain('blocos');
    expect(savedData.content).not.toContain('Condição');
  });

  it('prevents default and stops propagation on dragover/drop with DOCK_DRAG_MIME', () => {
    const data = { format: 'richtext' as const, content: '', tokens: [] };
    const block = new ActionBlock(data, () => {});
    const editorEl = block.getElement().querySelector('#rt-editor')!;

    const dragOverEvent = new Event('dragover', { bubbles: true, cancelable: true }) as any;
    dragOverEvent.dataTransfer = {
      types: ['application/x-sote-block-type'],
    };
    const dragOverPreventDefault = vi.spyOn(dragOverEvent, 'preventDefault');
    editorEl.dispatchEvent(dragOverEvent);
    expect(dragOverPreventDefault).toHaveBeenCalled();

    const dropEvent = new Event('drop', { bubbles: true, cancelable: true }) as any;
    dropEvent.dataTransfer = {
      types: ['application/x-sote-block-type'],
    };
    const dropPreventDefault = vi.spyOn(dropEvent, 'preventDefault');
    const dropStopPropagation = vi.spyOn(dropEvent, 'stopPropagation');
    editorEl.dispatchEvent(dropEvent);
    expect(dropPreventDefault).toHaveBeenCalled();
    expect(dropStopPropagation).toHaveBeenCalled();
  });

  it('self-heals tokens and opens modal when clicking counter, math, and random pills in existing flows', () => {
    // Existing flow with pills in HTML but tokens array initially empty
    const data = {
      format: 'richtext' as const,
      content:
        '<p><span class="token-pill token-counter" data-token-id="c1" data-token-config="{&quot;start&quot;:5,&quot;step&quot;:2}">Contador</span> ' +
        '<span class="token-pill token-math" data-token-id="m1" data-token-config="{&quot;expression&quot;:&quot;20*4&quot;}">Math</span> ' +
        '<span class="token-pill token-random" data-token-id="r1" data-token-config="{&quot;options&quot;:[{&quot;id&quot;:&quot;1&quot;,&quot;text&quot;:&quot;A&quot;,&quot;weight&quot;:50},{&quot;id&quot;:&quot;2&quot;,&quot;text&quot;:&quot;B&quot;,&quot;weight&quot;:50}]}">Aleatório</span></p>',
      tokens: [] as any[],
    };

    let changed = false;
    const block = new ActionBlock(data, () => { changed = true; });
    const editorEl = block.getElement().querySelector('#rt-editor')!;

    // Tokens should have been self-healed and restored to data.tokens during bindExistingTokens()
    expect(block.data.tokens.length).toBe(3);
    expect(block.data.tokens.find(t => t.id === 'c1')?.type).toBe('counter');
    expect(block.data.tokens.find(t => t.id === 'm1')?.type).toBe('math');
    expect(block.data.tokens.find(t => t.id === 'r1')?.type).toBe('random');

    // Clicking counter pill opens CounterModal
    const counterPill = editorEl.querySelector<HTMLElement>('.token-counter')!;
    expect(counterPill).not.toBeNull();
    counterPill.click();
    const modalBackdropCounter = document.querySelector('.modal-backdrop');
    expect(modalBackdropCounter).not.toBeNull();
    expect(document.querySelector('#counter-start')).not.toBeNull();
    modalBackdropCounter?.remove();

    // Clicking math pill opens MathModal
    const mathPill = editorEl.querySelector<HTMLElement>('.token-math')!;
    expect(mathPill).not.toBeNull();
    mathPill.click();
    const modalBackdropMath = document.querySelector('.modal-backdrop');
    expect(modalBackdropMath).not.toBeNull();
    expect(document.querySelector('#math-expression')).not.toBeNull();
    modalBackdropMath?.remove();

    // Clicking random pill opens RandomModal
    const randomPill = editorEl.querySelector<HTMLElement>('.token-random')!;
    expect(randomPill).not.toBeNull();
    randomPill.click();
    const modalBackdropRandom = document.querySelector('.modal-backdrop');
    expect(modalBackdropRandom).not.toBeNull();
    expect(document.querySelector('#random-list-container')).not.toBeNull();
    modalBackdropRandom?.remove();
  });

  describe('Tokens Usados — Dynamic Derivation & Orphan Elimination', () => {
    it('purges orphan/phantom tokens on initialization when editor content is empty', () => {
      // Simulates an ActionBlock in a conditional branch where content was saved empty
      // but data.tokens retained leftover tokens (e.g. date and clipboard)
      const data = {
        format: 'richtext' as const,
        content: '',
        tokens: [
          { id: 'd1', type: 'date' as const, config: { format: 'DD/MM/YYYY' } },
          { id: 'cb1', type: 'clipboard' as const, config: { index: 1 } },
        ],
      };

      const block = new ActionBlock(data, () => {});
      const previewContainer = block.getElement().querySelector<HTMLElement>('#tokens-preview')!;
      const previewList = block.getElement().querySelector<HTMLElement>('#tokens-preview-list')!;

      // In-memory data.tokens must be strictly pruned to match the empty editor
      expect(block.data.tokens).toEqual([]);
      expect(previewContainer.style.display).toBe('none');
      expect(previewList.innerHTML).toBe('');
    });

    it('dynamically hides Tokens Usados when editor content is deleted/cleared in a branch', () => {
      // ActionBlock in a branch containing counter and math
      const data = {
        format: 'richtext' as const,
        content:
          '<p><span class="token-pill token-counter" data-token-id="c1" data-token-config="{&quot;start&quot;:1}">Contador</span> ' +
          '<span class="token-pill token-math" data-token-id="m1" data-token-config="{&quot;expression&quot;:&quot;10+5&quot;}">Math</span></p>',
        tokens: [
          { id: 'c1', type: 'counter' as const, config: { start: 1, step: 1 } },
          { id: 'm1', type: 'math' as const, config: { expression: '10+5' } },
        ],
      };

      let changed = false;
      const block = new ActionBlock(data, () => { changed = true; });
      const editorEl = block.getElement().querySelector<HTMLDivElement>('#rt-editor')!;
      const previewContainer = block.getElement().querySelector<HTMLElement>('#tokens-preview')!;
      const previewList = block.getElement().querySelector<HTMLElement>('#tokens-preview-list')!;

      expect(block.data.tokens.length).toBe(2);
      expect(previewContainer.style.display).toBe('');
      expect(previewList.querySelectorAll('.tokens-preview-item').length).toBe(2);

      // User deletes all content in this branch
      editorEl.innerHTML = '<p><br></p>';
      editorEl.dispatchEvent(new Event('input', { bubbles: true }));

      expect(block.data.tokens).toEqual([]);
      expect(previewContainer.style.display).toBe('none');
      expect(previewList.innerHTML).toBe('');
      expect(changed).toBe(true);

      // Calling getData() also guarantees no orphan tokens are returned
      const savedData = block.getData();
      expect(savedData.tokens).toEqual([]);
      expect(savedData.content).toBe('<p><br></p>');
    });

    it('ensures independent token derivation between duplicated/separate blocks', () => {
      // Block A with counter and math
      const dataA = {
        format: 'richtext' as const,
        content: '<p><span class="token-pill token-counter" data-token-id="c1" data-token-config="{&quot;start&quot;:1}">Contador</span></p>',
        tokens: [{ id: 'c1', type: 'counter' as const, config: { start: 1 } }],
      };
      const blockA = new ActionBlock(dataA, () => {});

      // Block B is a duplicate or another branch with its own content
      const dataB = structuredClone(dataA);
      const blockB = new ActionBlock(dataB, () => {});

      // Clearing Block B does not affect Block A
      blockB.getElement().querySelector('#rt-editor')!.innerHTML = '<p><br></p>';
      blockB.syncTokensFromDOM();
      blockB.renderTokensPreview();

      expect(blockB.data.tokens).toEqual([]);
      expect(blockB.getElement().querySelector<HTMLElement>('#tokens-preview')!.style.display).toBe('none');

      expect(blockA.data.tokens.length).toBe(1);
      expect(blockA.data.tokens[0].id).toBe('c1');
    });

    it('reacts dynamically to Undo (historyUndo) and Redo (historyRedo) events', () => {
      const data = {
        format: 'richtext' as const,
        content: '',
        tokens: [] as any[],
      };

      const block = new ActionBlock(data, () => {});
      const editorEl = block.getElement().querySelector<HTMLDivElement>('#rt-editor')!;
      const previewContainer = block.getElement().querySelector<HTMLElement>('#tokens-preview')!;
      const previewList = block.getElement().querySelector<HTMLElement>('#tokens-preview-list')!;

      expect(previewContainer.style.display).toBe('none');

      // 1. Simulate Undo: a pill is restored into the DOM by the browser
      editorEl.innerHTML = '<p><span class="token-pill token-math" data-token-id="m1" data-type="math" data-token-config="{&quot;expression&quot;:&quot;99*2&quot;}">Math</span></p>';
      const undoEvent = new Event('input', { bubbles: true }) as any;
      undoEvent.inputType = 'historyUndo';
      editorEl.dispatchEvent(undoEvent);

      expect(block.data.tokens.length).toBe(1);
      expect(block.data.tokens[0].id).toBe('m1');
      expect(previewContainer.style.display).toBe('');
      expect(previewList.querySelectorAll('.tokens-preview-item').length).toBe(1);

      // 2. Clicking the restored item in Tokens Usados opens MathModal
      const previewRow = previewList.querySelector<HTMLElement>('.tokens-preview-item.is-editable')!;
      expect(previewRow).not.toBeNull();
      previewRow.click();
      const modalBackdrop = document.querySelector('.modal-backdrop');
      expect(modalBackdrop).not.toBeNull();
      modalBackdrop?.remove();

      // 3. Simulate Redo: the pill is deleted again
      editorEl.innerHTML = '<p><br></p>';
      const redoEvent = new Event('input', { bubbles: true }) as any;
      redoEvent.inputType = 'historyRedo';
      editorEl.dispatchEvent(redoEvent);

      expect(block.data.tokens).toEqual([]);
      expect(previewContainer.style.display).toBe('none');
      expect(previewList.innerHTML).toBe('');
    });
  });
});

