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

      // 4. Click directly on canvas background without Ctrl -> pans canvas
      const bgEvent = new MouseEvent('mousedown', { button: 0, bubbles: true, cancelable: true });
      canvas.dispatchEvent(bgEvent);
      expect(canvas.classList.contains('is-panning')).toBe(true);

      // Cleanup
      window.dispatchEvent(new MouseEvent('mouseup', { button: 0, bubbles: true }));
    });
  });
});
