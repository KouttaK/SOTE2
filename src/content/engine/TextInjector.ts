/**
 * src/content/engine/TextInjector.ts
 */

export class TextInjector {
  /**
   * Main entry point to inject text and handle cursor positioning.
   * @param element The active element
   * @param shortcutTyped The exact string the user typed (to be erased)
   * @param expansionHtml The expanded HTML (or plaintext) — must already
   *   have any cursor marker removed; use `cursorOffset` to say where the
   *   cursor should land instead.
   * @param isRichText Whether the source action block was richtext
   * @param cursorOffset Where to place the cursor, expressed as a plain-text
   *   character count from the start of the inserted content (i.e. counting
   *   visible characters only, ignoring HTML tags). `null` (default) keeps
   *   the old behavior of placing the cursor at the very end.
   */
  public static inject(
    element: HTMLElement,
    shortcutTyped: string,
    expansionHtml: string,
    isRichText: boolean,
    cursorOffset: number | null = null
  ) {
    if (this.isInputOrTextarea(element)) {
      this.injectIntoInput(element as HTMLInputElement | HTMLTextAreaElement, shortcutTyped, expansionHtml, cursorOffset);
    } else if (element.isContentEditable) {
      this.injectIntoContentEditable(element, shortcutTyped, expansionHtml, isRichText, cursorOffset);
    }
  }

  private static isInputOrTextarea(el: HTMLElement): boolean {
    return el.tagName === 'INPUT' || el.tagName === 'TEXTAREA';
  }

  private static injectIntoInput(el: HTMLInputElement | HTMLTextAreaElement, shortcut: string, text: string, cursorOffset: number | null) {
    // Strip HTML if we are injecting into plain text field
    const plainText = this.stripHtml(text);
    
    const start = el.selectionStart || 0;
    const end = el.selectionEnd || 0;
    
    const currentValue = el.value;
    
    // Calculate where the shortcut starts
    const shortcutStart = start - shortcut.length;
    if (shortcutStart < 0) return; // Something is wrong

    const newValue = currentValue.substring(0, shortcutStart) + plainText + currentValue.substring(end);
    
    // Use native setter for React/Vue compatibility
    this.setNativeValue(el, newValue);

    // Dispatch events
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));

    // Reposition cursor: honor an explicit Cursor token position if one was
    // resolved (clamped to the inserted text's length, just in case),
    // otherwise fall back to the end of the injected text as before.
    const offset = cursorOffset !== null ? Math.min(Math.max(cursorOffset, 0), plainText.length) : plainText.length;
    const newCursorPos = shortcutStart + offset;
    el.setSelectionRange(newCursorPos, newCursorPos);
  }

  private static injectIntoContentEditable(el: HTMLElement, shortcut: string, html: string, isRichText: boolean, cursorOffset: number | null) {
    el.focus();
    
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;

    const range = selection.getRangeAt(0);

    // Delete the shortcut. 
    // In contenteditable, deleting backwards by N characters programmatically is tricky because of HTML tags.
    // However, if the user *just* typed it, it's usually in a single text node.
    let charsToDelete = shortcut.length;
    
    // A simplified approach for contenteditable: use selection to expand backwards
    if (range.startContainer.nodeType === Node.TEXT_NODE) {
      let startOffset = range.startOffset - charsToDelete;
      if (startOffset >= 0) {
        range.setStart(range.startContainer, startOffset);
        range.deleteContents();
      } else {
        // Complex case: spans across elements. We will use execCommand 'delete' as a hack
        // Not perfect, but execCommand('undo') isn't right either.
        // For production, a robust DOM walker is needed. 
        // We'll do a basic loop of delete commands.
        for(let i = 0; i < charsToDelete; i++) {
          document.execCommand('delete', false);
        }
      }
    }

    // Now insert the new content
    if (isRichText) {
      document.execCommand('insertHTML', false, html);
    } else {
      document.execCommand('insertText', false, this.stripHtml(html));
    }

    // execCommand always leaves the caret at the END of what was just
    // inserted. If a Cursor token asked for a specific spot instead, walk
    // the caret backward (character by character, via the Selection API so
    // it correctly steps across any bold/italic/link elements) from the end
    // to that position.
    if (cursorOffset !== null) {
      const insertedPlainLength = this.stripHtml(html).length;
      const charsToMoveBack = insertedPlainLength - Math.min(Math.max(cursorOffset, 0), insertedPlainLength);
      const sel = window.getSelection();
      if (sel && charsToMoveBack > 0) {
        for (let i = 0; i < charsToMoveBack; i++) {
          sel.modify('move', 'backward', 'character');
        }
      }
    }
    
    // Emulate input event for editors like Notion or Google Docs
    el.dispatchEvent(new Event('input', { bubbles: true }));
  }

  /**
   * Sets value bypassing React's value setter hijacking
   */
  private static setNativeValue(element: HTMLInputElement | HTMLTextAreaElement, value: string) {
    const valueSetter = Object.getOwnPropertyDescriptor(element, 'value')?.set;
    const prototype = Object.getPrototypeOf(element);
    const prototypeValueSetter = Object.getOwnPropertyDescriptor(prototype, 'value')?.set;
    
    if (valueSetter && valueSetter !== prototypeValueSetter) {
      prototypeValueSetter?.call(element, value);
    } else if (valueSetter) {
      valueSetter.call(element, value);
    } else {
      element.value = value;
    }
  }

  private static stripHtml(html: string): string {
    const tmp = document.createElement('div');
    tmp.innerHTML = html;
    return tmp.textContent || tmp.innerText || '';
  }
}
