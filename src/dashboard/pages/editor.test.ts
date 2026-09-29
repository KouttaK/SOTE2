/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import FlowEditorPage from './editor.js';

vi.mock('wxt/browser', () => ({
  browser: {
    storage: {
      local: {
        get: vi.fn().mockResolvedValue({}),
        remove: vi.fn().mockResolvedValue(undefined),
      },
    },
  },
}));

vi.mock('../../shared/i18n/index.js', () => ({
  t: (key: string) => key,
}));

vi.mock('../../shared/storage/StorageService.js', () => ({
  storage: {
    getFlow: vi.fn().mockResolvedValue({
      id: 'f1',
      name: '/test',
      enabled: true,
      tags: [],
      createdAt: 0,
      updatedAt: 0,
      blocks: [
        { id: 'b1', type: 'trigger', data: { shortcut: 'test', smartCase: false, forceCapitalize: false } },
        { id: 'b2', type: 'action', data: { format: 'plaintext', content: 'hello', tokens: [] } },
      ],
    }),
    getSettings: vi.fn().mockResolvedValue({
      triggerMode: 'exact_match',
      exactMatchChar: '/',
    }),
    getFolders: vi.fn().mockResolvedValue([]),
    getVariables: vi.fn().mockResolvedValue([]),
    saveFlow: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('../shell.js', () => ({
  setHeaderOverride: vi.fn((html: string) => {
    const el = document.createElement('div');
    el.innerHTML = html;
    document.body.appendChild(el);
    return el;
  }),
}));

describe('FlowEditorPage Pan Cursor Feedback (Bug 1)', () => {
  let page: FlowEditorPage;

  beforeEach(async () => {
    document.body.innerHTML = '';
    page = new FlowEditorPage();
    const el = page.render();
    document.body.appendChild(el);
    await page.mount({ id: 'f1' });
  });

  afterEach(() => {
    page.unmount();
    document.body.innerHTML = '';
    vi.restoreAllMocks();
  });

  it('adds is-ctrl-held class when Ctrl or Meta is pressed and removes on keyup or blur', () => {
    const canvas = document.querySelector<HTMLElement>('#editor-canvas-bg')!;
    expect(canvas).not.toBeNull();
    expect(canvas.classList.contains('is-ctrl-held')).toBe(false);

    // Press Ctrl
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Control', ctrlKey: true }));
    expect(canvas.classList.contains('is-ctrl-held')).toBe(true);

    // Release Ctrl
    window.dispatchEvent(new KeyboardEvent('keyup', { key: 'Control', ctrlKey: false }));
    expect(canvas.classList.contains('is-ctrl-held')).toBe(false);

    // Press Meta (Mac Cmd)
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Meta', metaKey: true }));
    expect(canvas.classList.contains('is-ctrl-held')).toBe(true);

    // Window blur clears is-ctrl-held
    window.dispatchEvent(new Event('blur'));
    expect(canvas.classList.contains('is-ctrl-held')).toBe(false);
  });

  it('toggles is-panning class during mousedown and mouseup', () => {
    const canvas = document.querySelector<HTMLElement>('#editor-canvas-bg')!;
    expect(canvas).not.toBeNull();

    // Mousedown on canvas with Ctrl (pan gesture)
    const mousedownEvent = new MouseEvent('mousedown', {
      button: 0,
      ctrlKey: true,
      bubbles: true,
      cancelable: true,
    });
    canvas.dispatchEvent(mousedownEvent);
    expect(canvas.classList.contains('is-panning')).toBe(true);

    // Mouseup terminates pan
    window.dispatchEvent(new MouseEvent('mouseup', { button: 0, bubbles: true }));
    expect(canvas.classList.contains('is-panning')).toBe(false);
  });

  it('unmount cleans up event listeners so subsequent key events do not throw or affect canvas', () => {
    const canvas = document.querySelector<HTMLElement>('#editor-canvas-bg')!;
    page.unmount();

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Control', ctrlKey: true }));
    expect(canvas.classList.contains('is-ctrl-held')).toBe(false);
  });

  describe('Bug 2 - Canvas pan interception on ConditionBlock output and floating nodes', () => {
    it('does not pan or preventDefault on mousedown without Ctrl over floating nodes and handles', () => {
      const canvas = document.querySelector<HTMLElement>('#editor-canvas-bg')!;
      const container = document.querySelector<HTMLElement>('#node-flow-container')!;

      // Create a mock floating node with header and grip (as produced by ConditionBlock detached branches)
      const floatingNode = document.createElement('div');
      floatingNode.className = 'floating-node';
      const header = document.createElement('div');
      header.className = 'floating-node-header';
      const grip = document.createElement('span');
      grip.className = 'floating-node-grip';
      header.appendChild(grip);
      floatingNode.appendChild(header);
      container.appendChild(floatingNode);

      // Create a mock branch-tag and branch-leaf-anchor
      const branchTag = document.createElement('div');
      branchTag.className = 'branch-tag is-draggable';
      branchTag.setAttribute('draggable', 'true');
      container.appendChild(branchTag);

      const leafAnchor = document.createElement('div');
      leafAnchor.className = 'branch-leaf-anchor';
      container.appendChild(leafAnchor);

      const connectorDot = document.createElement('div');
      connectorDot.className = 'connector-dot';
      container.appendChild(connectorDot);

      // 1. Click on grip without Ctrl
      const gripEvent = new MouseEvent('mousedown', { button: 0, bubbles: true, cancelable: true });
      grip.dispatchEvent(gripEvent);
      expect(canvas.classList.contains('is-panning')).toBe(false);
      expect(gripEvent.defaultPrevented).toBe(false);

      // 2. Click on branch tag without Ctrl
      const tagEvent = new MouseEvent('mousedown', { button: 0, bubbles: true, cancelable: true });
      branchTag.dispatchEvent(tagEvent);
      expect(canvas.classList.contains('is-panning')).toBe(false);
      expect(tagEvent.defaultPrevented).toBe(false);

      // 3. Click on leaf anchor without Ctrl
      const anchorEvent = new MouseEvent('mousedown', { button: 0, bubbles: true, cancelable: true });
      leafAnchor.dispatchEvent(anchorEvent);
      expect(canvas.classList.contains('is-panning')).toBe(false);
      expect(anchorEvent.defaultPrevented).toBe(false);

      // 4. Click on conector entre blocos sem Ctrl (Bug 2 regresso)
      const dotEvent = new MouseEvent('mousedown', { button: 0, bubbles: true, cancelable: true });
      connectorDot.dispatchEvent(dotEvent);
      expect(canvas.classList.contains('is-panning')).toBe(false);
      expect(dotEvent.defaultPrevented).toBe(false);

      // 5. Click directly on canvas background without Ctrl -> pans canvas
      const bgEvent = new MouseEvent('mousedown', { button: 0, bubbles: true, cancelable: true });
      canvas.dispatchEvent(bgEvent);
      expect(canvas.classList.contains('is-panning')).toBe(true);

      // Cleanup
      window.dispatchEvent(new MouseEvent('mouseup', { button: 0, bubbles: true }));
    });
  });
});
describe('Auto-scroll during drag', () => {
  let editor: any;
  let container: HTMLElement;
  let canvas: HTMLElement;

  beforeEach(() => {
    vi.useFakeTimers();
    let perfNow = 0;
    vi.spyOn(performance, 'now').mockImplementation(() => perfNow);
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
      return setTimeout(() => {
        perfNow += 16;
        cb(perfNow);
      }, 16) as any;
    });
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(clearTimeout as any);
    
    document.body.innerHTML = '<div id="app"></div>';
    // Import FlowEditorPage has already happened in the file
    editor = new (FlowEditorPage as any)();
    document.getElementById('app')!.appendChild(editor.render());
    editor.mount();
    
    container = document.querySelector('#editor-canvas-bg') as HTMLElement;
    canvas = document.querySelector('#canvas-viewport') as HTMLElement;
    
    vi.spyOn(container, 'getBoundingClientRect').mockReturnValue({
      left: 100,
      right: 900,
      top: 100,
      bottom: 700,
      width: 800,
      height: 600,
    } as any);
  });

  afterEach(() => {
    editor.unmount();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('scrolls canvas correctly at all 4 edges and stops in center or when drag ends', () => {
    const triggerDragAt = (x: number, y: number) => {
      const e = new Event('dragover', { bubbles: true }) as any;
      e.dataTransfer = {};
      e.clientX = x;
      e.clientY = y;
      window.dispatchEvent(e);
    };

    // No drag active -> no scroll
    editor.canvasPanX = 0;
    editor.canvasPanY = 0;
    // so let's simulate just mousemove first to test "no scroll without active drag"
    const moveEvent = new MouseEvent('mousemove', { bubbles: true });
    Object.defineProperty(moveEvent, 'clientX', { value: 110 });
    Object.defineProperty(moveEvent, 'clientY', { value: 400 });
    window.dispatchEvent(moveEvent);
    vi.advanceTimersByTime(50);
    expect(editor.canvasPanX).toBe(0); // Did not scroll

    // Now start drag at left edge
    triggerDragAt(110, 400); // 10px from left edge
    vi.advanceTimersByTime(50);
    expect(editor.canvasPanX).toBeGreaterThan(0);
    
    // Top edge
    editor.canvasPanX = 0; editor.canvasPanY = 0;
    triggerDragAt(500, 110); // 10px from top edge
    vi.advanceTimersByTime(50);
    expect(editor.canvasPanY).toBeGreaterThan(0);

    // Right edge
    editor.canvasPanX = 0; editor.canvasPanY = 0;
    triggerDragAt(890, 400); // 10px from right edge
    vi.advanceTimersByTime(50);
    expect(editor.canvasPanX).toBeLessThan(0);

    // Bottom edge
    editor.canvasPanX = 0; editor.canvasPanY = 0;
    triggerDragAt(500, 690); // 10px from bottom edge
    vi.advanceTimersByTime(50);
    expect(editor.canvasPanY).toBeLessThan(0);

    // Diagonal (Top-Left)
    editor.canvasPanX = 0; editor.canvasPanY = 0;
    triggerDragAt(110, 110); 
    vi.advanceTimersByTime(50);
    expect(editor.canvasPanX).toBeGreaterThan(0);
    expect(editor.canvasPanY).toBeGreaterThan(0);

    // Center -> stops scrolling
    editor.canvasPanX = 0; editor.canvasPanY = 0;
    triggerDragAt(500, 400); 
    vi.advanceTimersByTime(50);
    expect(editor.canvasPanX).toBe(0);
    expect(editor.canvasPanY).toBe(0);

    // Drop -> ends drag -> stops scrolling
    triggerDragAt(110, 400); // back to left edge, should scroll
    vi.advanceTimersByTime(50);
    expect(editor.canvasPanX).toBeGreaterThan(0);
    
    editor.canvasPanX = 0;
    window.dispatchEvent(new Event('drop', { bubbles: true })); // drag ends
    vi.advanceTimersByTime(50);
    expect(editor.canvasPanX).toBe(0); // no further scrolling
  });
});
