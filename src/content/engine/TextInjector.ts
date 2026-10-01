/**
 * src/content/engine/TextInjector.ts
 */
import { sanitizeHtml } from '../../shared/utils/sanitizeHtml.js';

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

    return document.execCommand('insertText', false, SHORTCUT_ANCHOR_MARKER);
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
  ): { shortcutStart: number; injectedLength: number } | null {
    if (this.isInputOrTextarea(element)) {
      return this.injectIntoInput(element as HTMLInputElement | HTMLTextAreaElement, shortcutTyped, expansionHtml, cursorOffset);
    } else if (element.isContentEditable) {
      return this.injectIntoContentEditable(element, shortcutTyped, expansionHtml, isRichText, cursorOffset);
    }
    return null;
  }

  public static undo(
    element: HTMLElement,
    shortcutTyped: string,
    expansionHtml: string,
    isRichText: boolean,
    shortcutStartPos?: number
  ): boolean {
    if (this.isInputOrTextarea(element)) {
      return this.undoInput(element as HTMLInputElement | HTMLTextAreaElement, shortcutTyped, expansionHtml, shortcutStartPos);
    } else if (element.isContentEditable || element.getAttribute('contenteditable') === 'true' || (element as any).contentEditable === 'true') {
      return this.undoContentEditable(element, shortcutTyped, expansionHtml, isRichText);
    }
    return false;
  }

  private static isInputOrTextarea(el: HTMLElement): boolean {
    return el.tagName === 'INPUT' || el.tagName === 'TEXTAREA';
  }

  private static isInputElement(el: HTMLElement): el is HTMLInputElement {
    return el.tagName.toUpperCase() === 'INPUT' || el instanceof HTMLInputElement;
  }

  private static injectIntoInput(
    el: HTMLInputElement | HTMLTextAreaElement,
    shortcut: string,
    text: string,
    cursorOffset: number | null
  ): { shortcutStart: number; injectedLength: number } | null {
    // Strip HTML if we are injecting into plain text field
    let plainText = this.stripHtml(text);

    // Any <input> element (text, search, email, url, tel, etc.) sanitizes away \r and \n per WHATWG HTML
    if (this.isInputElement(el)) {
      plainText = plainText.replace(/[\r\n]+/g, '');
    }

    // Same restriction as TextMonitor's own read of these — only
    // "text-based" <input> types (plus textarea) support selection at
    // all; type="number"/"range"/"color"/"date" etc. throw a
    // DOMException the instant selectionStart/selectionEnd/
    // setSelectionRange are touched, which was silently aborting the
    // whole injection (the value never even got updated) in those
    // fields.
    let start: number;
    let end: number;
    try {
      start = el.selectionStart ?? 0;
      end = el.selectionEnd ?? 0;
    } catch {
      start = el.value.length;
      end = el.value.length;
    }

    const currentValue = el.value;
    
    // Calculate where the shortcut starts
    const shortcutStart = start - shortcut.length;
    if (shortcutStart < 0) return null; // Something is wrong

    const newValue = currentValue.substring(0, shortcutStart) + plainText + currentValue.substring(end);
    
    // Use native setter for React/Vue compatibility
    this.setNativeValue(el, newValue);

    // Dispatch events
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));

    // Reposition cursor: honor an explicit Cursor token position if one was
    // resolved (clamped to the inserted text's length, just in case),
    // otherwise fall back to the end of the injected text as before.
    // Wrapped the same way: setSelectionRange throws on the same field
    // types selectionStart does, and there's no meaningful text caret to
    // reposition there anyway (the value itself is already correct).
    const offset = cursorOffset !== null ? Math.min(Math.max(cursorOffset, 0), plainText.length) : plainText.length;
    const newCursorPos = shortcutStart + offset;
    try {
      el.setSelectionRange(newCursorPos, newCursorPos);
    } catch {
      // Field type doesn't support a text caret (number/range/color/...) — nothing to do.
    }

    return { shortcutStart, injectedLength: plainText.length };
  }

  private static undoInput(
    el: HTMLInputElement | HTMLTextAreaElement,
    shortcut: string,
    expansionText: string,
    shortcutStart?: number
  ): boolean {
    let plainText = this.stripHtml(expansionText);

    // WHATWG HTML sanitization algorithm for any <input> control strips all \r and \n characters.
    // We normalize plainText so multi-line templates/repeats match the actual DOM value.
    if (this.isInputElement(el)) {
      plainText = plainText.replace(/[\r\n]+/g, '');
    }

    const currentValue = el.value;

    let pos = typeof shortcutStart === 'number' ? shortcutStart : -1;
    if (pos === -1 || currentValue.substring(pos, pos + plainText.length) !== plainText) {
      pos = currentValue.lastIndexOf(plainText);
    }

    if (pos === -1) {
      const normCurrent = currentValue.replace(/\u00a0/g, ' ').replace(/\r\n/g, '\n');
      const normPlain = plainText.replace(/\u00a0/g, ' ').replace(/\r\n/g, '\n');
      if (typeof shortcutStart === 'number' && normCurrent.substring(shortcutStart, shortcutStart + normPlain.length) === normPlain) {
        pos = shortcutStart;
      } else {
        pos = normCurrent.lastIndexOf(normPlain);
      }
    }

    if (pos === -1) {
      return false;
    }

    const newValue = currentValue.substring(0, pos) + shortcut + currentValue.substring(pos + plainText.length);
    this.setNativeValue(el, newValue);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));

    const newCursor = pos + shortcut.length;
    try {
      el.setSelectionRange(newCursor, newCursor);
    } catch {}

    return true;
  }

  private static findTextRange(root: HTMLElement, text: string): Range | null {
    if (!text) return null;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const nodes: { node: Text; start: number; end: number }[] = [];
    let fullText = '';
    let curr: Text | null;

    while ((curr = walker.nextNode() as Text | null)) {
      const len = curr.data.length;
      nodes.push({ node: curr, start: fullText.length, end: fullText.length + len });
      fullText += curr.data;
    }

    let idx = fullText.lastIndexOf(text);
    if (idx === -1) {
      const normFull = fullText.replace(/\u00a0/g, ' ');
      const normText = text.replace(/\u00a0/g, ' ');
      idx = normFull.lastIndexOf(normText);
    }
    if (idx === -1) return null;

    const endIdx = idx + text.length;

    let startNode: Text | null = null;
    let startOffset = 0;
    let endNode: Text | null = null;
    let endOffset = 0;

    for (const item of nodes) {
      if (!startNode && idx >= item.start && idx <= item.end) {
        startNode = item.node;
        startOffset = idx - item.start;
      }
      if (endIdx >= item.start && endIdx <= item.end) {
        endNode = item.node;
        endOffset = endIdx - item.start;
        break;
      }
    }

    if (startNode && endNode) {
      const range = document.createRange();
      range.setStart(startNode, startOffset);
      range.setEnd(endNode, endOffset);
      return range;
    }

    return null;
  }

  private static undoContentEditable(
    el: HTMLElement,
    shortcut: string,
    expandedText: string,
    isRichText: boolean
  ): boolean {
    try {
      el.focus();
    } catch {}
    const plainText = this.stripHtml(expandedText);
    const range = this.findTextRange(el, plainText);

    if (range) {
      try {
        const sel = window.getSelection();
        if (sel) {
          sel.removeAllRanges();
          sel.addRange(range);
        }
      } catch {}

      try {
        const inserted = document.execCommand('insertText', false, shortcut);
        if (inserted) {
          el.dispatchEvent(new Event('input', { bubbles: true }));
          return true;
        }
      } catch {}

      // Fallback: direct Range DOM replacement
      try {
        range.deleteContents();
        const textNode = document.createTextNode(shortcut);
        range.insertNode(textNode);
        try {
          const sel = window.getSelection();
          if (sel) {
            const afterRange = document.createRange();
            afterRange.setStartAfter(textNode);
            afterRange.collapse(true);
            sel.removeAllRanges();
            sel.addRange(afterRange);
          }
        } catch {}
        el.dispatchEvent(new Event('input', { bubbles: true }));
        return true;
      } catch {}
    }

    try {
      const res = document.execCommand('undo', false);
      if (res) {
        el.dispatchEvent(new Event('input', { bubbles: true }));
        return res;
      }
    } catch {}

    return false;
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
      document.execCommand('insertHTML', false, sanitizeHtml(this.unwrapSingleBlockWrapper(html)));
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

  /**
   * The Action editor's contenteditable always serializes even a single
   * one-line action wrapped in a block element — `this.editorEl.innerHTML`
   * in ActionBlock.ts literally defaults an empty action to `<p><br></p>`,
   * and a real single-line action ends up as `<p>texto em <b>negrito</b></p>`
   * the same way. That block wrapper carries no real meaning for a
   * one-liner (it's just how contentEditable happens to store even a
   * single line) — but inserting it as-is via `execCommand('insertHTML')`
   * hands the *host* editor a whole extra paragraph element to make sense
   * of, and some rich editors (Gmail's compose box in particular) react
   * to that by splitting it into its own paragraph — producing a stray
   * line break that was never actually in the Action's content, and never
   * happens for a plain <input>/<textarea> (which never sees this HTML at
   * all — see injectIntoInput's stripHtml).
   *
   * If `html` is *exactly* one top-level block element (optionally with
   * surrounding whitespace) and nothing else beside it, this returns just
   * that element's inner HTML instead — safe precisely because there's
   * only one wrapper and nothing else at the top level to reorder/lose.
   * A genuinely multi-paragraph action (multiple <p>/<div> siblings, real
   * line breaks the person actually typed) is left completely untouched,
   * since unwrapping would then discard real, intentional structure.
   */
  private static unwrapSingleBlockWrapper(html: string): string {
    const trimmed = html.trim();
    if (!trimmed) return html;

    const tmp = document.createElement('div');
    tmp.innerHTML = sanitizeHtml(trimmed);

    const children = Array.from(tmp.childNodes).filter((node) => {
      // Ignore whitespace-only text nodes when deciding "is this the only
      // top-level thing here" — real content never sits directly beside
      // the wrapper in what the editor produces.
      return !(node.nodeType === Node.TEXT_NODE && !node.textContent?.trim());
    });

    if (children.length !== 1) return html;

    const only = children[0];
    if (only.nodeType !== Node.ELEMENT_NODE) return html;

    const tag = (only as Element).tagName;
    if (tag !== 'P' && tag !== 'DIV') return html;

    return (only as Element).innerHTML;
  }

  private static stripHtml(html: string): string {
    const tmp = document.createElement('div');
    tmp.innerHTML = sanitizeHtml(html);
    return (tmp.textContent || tmp.innerText || '').replace(/\u00a0/g, ' ');
  }
}
