/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TextMonitor } from './TextMonitor.js';
import { UndoManager } from './UndoManager.js';
import { TextInjector } from './TextInjector.js';
import type { Settings } from '../../shared/types/index.js';

vi.mock('../../shared/messaging/client.js', () => ({
  sendMessage: vi.fn().mockResolvedValue({ success: true }),
  onMessage: vi.fn(),
}));

describe('Engine Integration: TextMonitor + UndoManager + TextInjector', () => {
  let settings: Settings;
  let monitor: TextMonitor;
  let undoManager: UndoManager;
  let inputEl: HTMLInputElement;
  let charTypedCount = 0;
  let lastCharTypedBuffer = '';

  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    charTypedCount = 0;
    lastCharTypedBuffer = '';

    settings = {
      triggerMode: 'exact_match',
      triggerKeys: ['Space'],
      exactMatchChar: '/',
      undoEnabled: true,
      undoWindowSeconds: 5,
      undoTrigger: 'both',
      globalEnabled: true,
      searchTrigger: { enabled: false, includeFlows: false, domainPrefix: '', globalPrefix: '' },
    };

    undoManager = new UndoManager(() => settings);

    monitor = new TextMonitor(
      () => settings,
      (_e, buffer) => {
        charTypedCount++;
        lastCharTypedBuffer = buffer;
      },
      () => {}
    );
    monitor.start();

    inputEl = document.createElement('input');
    inputEl.type = 'text';
    document.body.appendChild(inputEl);
    inputEl.focus();
  });

  afterEach(() => {
    monitor.stop();
    vi.useRealTimers();
    if (inputEl.parentNode) {
      inputEl.parentNode.removeChild(inputEl);
    }
  });

  it('Exact match: Undo restores shortcut without triggering re-expansion loop (Bugs 3 & 4)', () => {
    // 1. Simulate typing "/teste"
    inputEl.value = '/teste';
    inputEl.setSelectionRange(6, 6);
    inputEl.dispatchEvent(new Event('input', { bubbles: true }));

    expect(charTypedCount).toBe(1);
    expect(lastCharTypedBuffer).toBe('/teste');

    // 2. Perform expansion: "/teste" -> "Resultado Expandido 1"
    const shortcut = '/teste';
    const expansion = 'Resultado Expandido 1';
    monitor.pause();
    const injectMeta = TextInjector.inject(inputEl, shortcut, expansion, false, null);
    monitor.clearBuffer();
    undoManager.recordExpansion({
      element: inputEl,
      shortcutTyped: shortcut,
      expandedContent: expansion,
      isRichText: false,
      cursorOffset: null,
      shortcutStartPos: injectMeta?.shortcutStart,
    });
    monitor.resume();

    expect(inputEl.value).toBe('Resultado Expandido 1');
    expect(undoManager.hasPending()).toBe(true);

    // Reset monitor tracking count before pressing undo
    charTypedCount = 0;

    // 3. User presses Backspace to undo within window (e.g. at 1s)
    vi.advanceTimersByTime(1000);
    const backspaceEvent = new KeyboardEvent('keydown', { key: 'Backspace', bubbles: true, cancelable: true });

    // In content.ts, handleUndoKeydown wraps handleKeyDown in monitor.suppressDuring and clears buffer
    const undone = monitor.suppressDuring(() => undoManager.handleKeyDown(backspaceEvent));
    if (undone) {
      monitor.clearBuffer();
    }

    expect(undone).toBe(true);
    expect(backspaceEvent.defaultPrevented).toBe(true);
    // Value restored to shortcut!
    expect(inputEl.value).toBe('/teste');
    expect(undoManager.hasPending()).toBe(false);

    // CRITICAL REGRESSION CHECK: monitor MUST NOT have fired onCharTyped during undo!
    // If it had fired, charTypedCount would be > 0 and exact match would have re-expanded in 0ms!
    expect(charTypedCount).toBe(0);
    expect(monitor.getBuffer()).toBe('');

    // 4. A subsequent Backspace from the user is NOT intercepted by undoManager
    const secondBackspace = new KeyboardEvent('keydown', { key: 'Backspace', bubbles: true, cancelable: true });
    const secondUndone = monitor.suppressDuring(() => undoManager.handleKeyDown(secondBackspace));
    expect(secondUndone).toBe(false);
    expect(secondBackspace.defaultPrevented).toBe(false);
  });

  it('Trigger mode: Space trigger key does not kill undo window on trailing keydown (Bug 5)', () => {
    settings.triggerMode = 'trigger';
    let triggerKeyCount = 0;

    monitor.stop();
    monitor = new TextMonitor(
      () => settings,
      () => {},
      (e) => {
        triggerKeyCount++;
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();

        // Simulate trigger expansion on space
        const shortcut = '/cont';
        const expansion = 'Contador 10';
        monitor.pause();
        const injectMeta = TextInjector.inject(inputEl, shortcut, expansion, false, null);
        monitor.clearBuffer();
        undoManager.recordExpansion({
          element: inputEl,
          shortcutTyped: shortcut,
          expandedContent: expansion,
          isRichText: false,
          cursorOffset: null,
          shortcutStartPos: injectMeta?.shortcutStart,
        });
        monitor.resume();
      }
    );
    monitor.start();

    // 1. Simulate typing shortcut
    inputEl.value = '/cont';
    inputEl.setSelectionRange(5, 5);
    inputEl.dispatchEvent(new Event('input', { bubbles: true }));

    // 2. User presses Space to trigger
    const spaceEvent = new KeyboardEvent('keydown', { key: ' ', code: 'Space', bubbles: true, cancelable: true });
    inputEl.dispatchEvent(spaceEvent);

    expect(triggerKeyCount).toBe(1);
    expect(inputEl.value).toBe('Contador 10');

    // 3. Trailing keydown event in the same tick must NOT kill the pending expansion
    const trailingSpace = new KeyboardEvent('keydown', { key: ' ', code: 'Space', bubbles: true, cancelable: true });
    const trailingHandled = undoManager.handleKeyDown(trailingSpace);
    expect(trailingHandled).toBe(false);
    // Pending expansion survives!
    expect(undoManager.hasPending()).toBe(true);

    // 4. User presses Backspace 2s later
    vi.advanceTimersByTime(2000);
    const backspaceEvent = new KeyboardEvent('keydown', { key: 'Backspace', bubbles: true, cancelable: true });
    const undone = monitor.suppressDuring(() => undoManager.handleKeyDown(backspaceEvent));
    expect(undone).toBe(true);
    expect(inputEl.value).toBe('/cont');
    expect(undoManager.hasPending()).toBe(false);
  });

  it('ContentEditable multi-node undo: accurately replaces formatted rich content with shortcut (Bug 6)', () => {
    const ce = document.createElement('div');
    ce.contentEditable = 'true';
    ce.innerHTML = '<p><span>Olá </span><b>Mundo 42</b><span> fim</span></p>';
    document.body.appendChild(ce);
    ce.focus();

    const shortcut = '/ola';
    const expansion = 'Olá Mundo 42';

    undoManager.recordExpansion({
      element: ce,
      shortcutTyped: shortcut,
      expandedContent: expansion,
      isRichText: true,
      cursorOffset: null,
    });

    const undone = undoManager.undo();
    expect(undone).toBe(true);
    expect(ce.textContent).toContain('/ola');
    expect(ce.textContent).not.toContain('Mundo 42');

    document.body.removeChild(ce);
  });

  it('SensitiveFieldGuard: Refuses undo if element became protected between expansion and undo', () => {
    inputEl.value = 'Texto confidencial';
    const shortcut = '/conf';
    const expansion = 'Texto confidencial';

    undoManager.recordExpansion({
      element: inputEl,
      shortcutTyped: shortcut,
      expandedContent: expansion,
      isRichText: false,
      cursorOffset: null,
    });

    expect(undoManager.hasPending()).toBe(true);

    // Dynamic change: field becomes a password field
    inputEl.type = 'password';

    const backspaceEvent = new KeyboardEvent('keydown', { key: 'Backspace', bubbles: true, cancelable: true });
    const undone = monitor.suppressDuring(() => undoManager.handleKeyDown(backspaceEvent));

    expect(undone).toBe(false);
    // Element value is UNTOUCHED
    expect(inputEl.value).toBe('Texto confidencial');
    // Pending expansion was committed and cleared
    expect(undoManager.hasPending()).toBe(false);
  });
});
