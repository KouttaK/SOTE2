/**
 * src/content/engine/TextInjector.ts
 */

/**
 * Invisible marker temporarily inserted at the live caret position inside
 * a contentEditable field right before something (the Input/Choice token
 * ChoicePopup) steals focus away from it for a while.
 *
 * `injectIntoContentEditable` normally trusts `window.getSelection()` to
 * still point at "right after the typed shortcut" once the field regains
 * focus — true for plain contenteditable in most browsers, but NOT for
 * sites whose compose box is a custom rich-text editor (TipTap/
 * ProseMirror, Slate, Draft.js, Quill...) that manages its own selection
 * state and may reset the caret to the very start of the document on
 * refocus instead of restoring it. When that happens, the "delete the
 * typed shortcut" step silently deletes nothing (there's nothing before
 * position 0), while the new content still gets inserted — the exact bug
 * reported on a TipTap-based chat widget: the expansion appeared, but the
 * shortcut itself ("at1") was left behind, pushed to the end.
 *
 * Anchoring to this literal marker text — found by searching the actual
 * DOM content, not by trusting the live Selection API — means the
 * deletion/insertion below works regardless of what the editor resets the
 * caret to after refocusing.
 */
const SHORTCUT_ANCHOR_MARKER = '\u2063\u2063SOTE_ANCHOR\u2063\u2063';

export class TextInjector {
  /**
   * Call right before doing anything that might steal focus away from a
   * contentEditable field for a while (e.g. opening the ChoicePopup for an
   * Input/Choice token). Inserts `SHORTCUT_ANCHOR_MARKER` at the current
   * caret position via the native input pipeline (so rich-text editors
   * that listen for real input events, like TipTap/ProseMirror, register
   * it as part of their own document model instead of it being invisible
   * to them). No-op for plain <input>/<textarea> (their selectionStart/
   * selectionEnd survive a focus/blur cycle just fine) or if the element
   * doesn't currently have a live selection inside it.
   *
   * Returns whether the marker was actually placed.
   */
  public static placeContentEditableAnchor(element: HTMLElement): boolean {
    if (this.isInputOrTextarea(element) || !element.isContentEditable) return false;

    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return false;
    if (!element.contains(selection.getRangeAt(0).startContainer)) return false;

    document.execCommand('insertText', false, SHORTCUT_ANCHOR_MARKER);
    return true;
  }

  /**
   * Removes a marker placed by `placeContentEditableAnchor` without
   * injecting anything in its place — used when the user cancels the
   * Input/Choice popup (Esc / click outside), so the marker doesn't
   * linger as leftover (invisible, but real) characters in the field.
   */
  public static removeContentEditableAnchor(element: HTMLElement): void {
    const anchor = this.locateAnchor(element);
    if (!anchor) return;
    const range = document.createRange();
    range.setStart(anchor.node, anchor.offset);
    range.setEnd(anchor.node, anchor.offset + SHORTCUT_ANCHOR_MARKER.length);
    range.deleteContents();
  }

  /** Finds the marker text node + offset inside `element`, if present. */
  private static locateAnchor(element: HTMLElement): { node: Text; offset: number } | null {
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
    let node: Text | null;
    while ((node = walker.nextNode() as Text | null)) {
      const idx = node.data.indexOf(SHORTCUT_ANCHOR_MARKER);
      if (idx !== -1) return { node, offset: idx };
    }
    return null;
  }

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
    if (!selection) return;

    const anchor = this.locateAnchor(el);
    if (anchor) {
      // Reliable path: select the marker itself and delete it — this
      // collapses the caret exactly where the marker started, i.e. exactly
      // where the typed shortcut ended, regardless of whatever the editor
      // reset the live selection to while it didn't have focus.
      const anchorRange = document.createRange();
      anchorRange.setStart(anchor.node, anchor.offset);
      anchorRange.setEnd(anchor.node, anchor.offset + SHORTCUT_ANCHOR_MARKER.length);
      selection.removeAllRanges();
      selection.addRange(anchorRange);
      document.execCommand('delete', false);
    } else if (selection.rangeCount === 0) {
      return;
    }

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
        // Explicitly re-sync the live selection to this now-collapsed range
        // rather than assuming the browser keeps it tracking a Range object
        // we mutated by reference — insertHTML/insertText below operate on
        // whatever the live selection is, not on this local `range` var.
        range.collapse(true);
        selection.removeAllRanges();
        selection.addRange(range);
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
