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
});
