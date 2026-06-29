/**
 * src/content/engine/TextInjector.ts
 */

export class TextInjector {
  /**
   * Main entry point to inject text and handle cursor positioning.
   * @param element The active element
   * @param shortcutTyped The exact string the user typed (to be erased)
   * @param expansionHtml The expanded HTML (or plaintext)
   * @param isRichText Whether the source action block was richtext
   * @param hasTriggerKey If a trigger key like Space/Tab was pressed, it usually needs to be erased too if the browser already inputted it. 
   *                      (We will assume preventDefault was called, so the trigger key was NOT inputted into the field).
   */
  public static inject(
    element: HTMLElement,
    shortcutTyped: string,
    expansionHtml: string,
    isRichText: boolean
  ) {
    if (this.isInputOrTextarea(element)) {
      this.injectIntoInput(element as HTMLInputElement | HTMLTextAreaElement, shortcutTyped, expansionHtml);
    } else if (element.isContentEditable) {
      this.injectIntoContentEditable(element, shortcutTyped, expansionHtml, isRichText);
    }
  }

  private static isInputOrTextarea(el: HTMLElement): boolean {
    return el.tagName === 'INPUT' || el.tagName === 'TEXTAREA';
  }

  private static injectIntoInput(el: HTMLInputElement | HTMLTextAreaElement, shortcut: string, text: string) {
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

    // Reposition cursor
    // Handle $cursor$ logic: if plainText contains multiple cursors, we'll just go to the first one
    // But since tokens are already resolved (and $cursor$ was replaced by an empty string or placeholder by Expander),
    // wait, we need a way to know where to put the cursor!
    // Let's assume the expander left a hidden marker, e.g., \u200B (zero width space) or a specific string.
    // For now, put cursor at the end of the injected text.
    const newCursorPos = shortcutStart + plainText.length;
    el.setSelectionRange(newCursorPos, newCursorPos);
  }

  private static injectIntoContentEditable(el: HTMLElement, shortcut: string, html: string, isRichText: boolean) {
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
