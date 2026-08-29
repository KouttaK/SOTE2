/**
 * dom.ts — SOTE DOM helper utilities
 *
 * Helpers para criação e animação de elementos HTML.
 * As classes de animação correspondem às definidas em animations.css.
 * showElement / hideElement usam as classes .sote-hidden / .sote-visible
 * definidas em base.css.
 */

// ---------------------------------------------------------------------------
// createElement
// ---------------------------------------------------------------------------

/**
 * Creates an HTMLElement of the given tag, applies CSS classes and
 * optional attributes, then returns it.
 *
 * @example
 * const btn = createElement('button', ['flex', 'items-center', 'gap-2'], {
 *   id: 'create-btn',
 *   type: 'button',
 * });
 */
export function createElement<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  classes: string[] = [],
  attrs: Record<string, string> = {},
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);

  if (classes.length > 0) {
    el.classList.add(...classes);
  }

  for (const [key, value] of Object.entries(attrs)) {
    el.setAttribute(key, value);
  }

  return el;
}

// ---------------------------------------------------------------------------
// showElement / hideElement
// ---------------------------------------------------------------------------

/**
 * Makes an element visible by removing the `.sote-hidden` class and
 * adding `.sote-visible`.
 */
export function showElement(el: HTMLElement): void {
  el.classList.remove('sote-hidden');
  el.classList.add('sote-visible');
}

/**
 * Hides an element by adding the `.sote-hidden` class and removing
 * `.sote-visible`.
 */
export function hideElement(el: HTMLElement): void {
  el.classList.remove('sote-visible');
  el.classList.add('sote-hidden');
}

// ---------------------------------------------------------------------------
// animateIn / animateOut
// ---------------------------------------------------------------------------

/**
 * Applies `animationClass` to `el`, waits for the `animationend` event,
 * then removes the class.
 *
 * The element must already be visible in the DOM before calling this.
 *
 * @example
 * showElement(palette);
 * await animateIn(palette, 'sote-anim-slide-up-in');
 */
export function animateIn(el: HTMLElement, animationClass: string): Promise<void> {
  return new Promise((resolve) => {
    el.classList.add(animationClass);

    function onEnd() {
      el.classList.remove(animationClass);
      el.removeEventListener('animationend', onEnd);
      resolve();
    }

    el.addEventListener('animationend', onEnd, { once: true });
  });
}

/**
 * Applies `animationClass` to `el`, waits for the `animationend` event,
 * hides the element, then removes the class.
 *
 * Useful for exit animations: the element is hidden automatically once
 * the animation completes.
 *
 * @example
 * await animateOut(palette, 'sote-anim-fade-out');
 * // palette is now hidden
 */
export function animateOut(el: HTMLElement, animationClass: string): Promise<void> {
  return new Promise((resolve) => {
    el.classList.add(animationClass);

    function onEnd() {
      el.classList.remove(animationClass);
      hideElement(el);
      el.removeEventListener('animationend', onEnd);
      resolve();
    }

    el.addEventListener('animationend', onEnd, { once: true });
  });
}

// ---------------------------------------------------------------------------
// escapeHtml — single shared implementation
// ---------------------------------------------------------------------------

/**
 * Escapes `&`, `<`, `>`, `"` and `'` so a string can be safely interpolated
 * into HTML — both as element text content *and* inside a double- or
 * single-quoted attribute value (e.g. `data-key="${escapeHtml(v.key)}"`).
 *
 * This used to be reimplemented locally (with inconsistent coverage —
 * some variants didn't escape quotes at all) across ~18 files. Import this
 * one instead of adding another local copy.
 */
export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Converts rich HTML (e.g. "<p>Hello</p><p>World</p>") produced by a
 * contenteditable action editor into a single line of plain text, for use
 * in one-line previews (recent-snippet list, mini-action collapsed view,
 * etc). textContent alone concatenates block elements with no separator
 * ("<p>Hello</p><p>World</p>" -> "HelloWorld"), so a space is inserted at
 * each block boundary/line-break before reading the text back out.
 * Previously duplicated as `htmlToPreviewText`/`htmlToPlainText` in
 * dashboard/pages/flows.ts and popup/index.ts.
 */
export function htmlToPreviewText(html: string): string {
  const withBreaks = (html || '').replace(/<\/(p|div|li|h[1-6])>|<br\s*\/?>/gi, ' $&');
  const div = document.createElement('div');
  div.innerHTML = withBreaks;
  return (div.textContent || div.innerText || '').replace(/\s+/g, ' ').trim();
}

// ---------------------------------------------------------------------------
// Field introspection — used by the "field_type" / "field_content" condition
// criteria (see ConditionCriterion in shared/types) to inspect the field the
// user is currently focused in/typing into.
// ---------------------------------------------------------------------------

/** The set of field categories the "Tipo de Campo" (field_type) condition
 * criterion can match against. Native <input type="..."> values that aren't
 * explicitly one of the "interesting" ones below (email/password/tel/
 * number/url/search) all collapse into the generic 'text' bucket, same as
 * a plain <input> with no type attribute. */
export type FieldTypeCategory =
  | 'email' | 'password' | 'tel' | 'number' | 'url' | 'search'
  | 'textarea' | 'contenteditable' | 'text';

const RECOGNIZED_INPUT_TYPES: ReadonlySet<string> = new Set([
  'email', 'password', 'tel', 'number', 'url', 'search',
]);

/**
 * Categorizes the currently focused field for the field_type condition
 * criterion. Mirrors the same INPUT/TEXTAREA/contentEditable distinction
 * TextInjector.inject() uses to decide *how* to write into a field, but
 * goes one step further for <input> and also looks at its `type` attribute
 * so a flow can react to "this is an email field" vs. a generic text one.
 */
export function getFieldTypeCategory(element: HTMLElement | null | undefined): FieldTypeCategory {
  if (!element) return 'text';
  if (element.tagName === 'TEXTAREA') return 'textarea';
  if (element.tagName === 'INPUT') {
    const inputType = (element as HTMLInputElement).type?.toLowerCase();
    return RECOGNIZED_INPUT_TYPES.has(inputType) ? (inputType as FieldTypeCategory) : 'text';
  }
  if (element.isContentEditable) return 'contenteditable';
  return 'text';
}

/**
 * Returns the current text content of the focused field, used by the
 * "Conteúdo do Campo" (field_content) condition criterion — e.g. to skip a
 * greeting the field already contains. Reads `.value` for native form
 * controls (same as TextInjector) and `.textContent` for contentEditable
 * nodes, which don't keep a meaningful `.value`.
 */
export function getFieldContent(element: HTMLElement | null | undefined, excludeShortcutSuffix?: string): string {
  if (!element) return '';
  let content = '';
  if (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA') {
    content = (element as HTMLInputElement | HTMLTextAreaElement).value || '';
  } else if (element.isContentEditable) {
    content = element.textContent || '';
  }
  // At the moment a condition is evaluated, the just-typed shortcut is
  // still sitting in the field (TextInjector only deletes/replaces it
  // *after* the whole Flow/Condition/Token pipeline resolves) — so
  // without this, "Conteúdo do Campo = X" could never match: the field
  // actually contains "X" + whatever shortcut triggered this check (e.g.
  // "lucas;;teste1", not "lucas"), and "contém"/"não contém" only looked
  // right by accident (the extra suffix doesn't stop a substring match).
  if (excludeShortcutSuffix && content.endsWith(excludeShortcutSuffix)) {
    content = content.slice(0, -excludeShortcutSuffix.length);
  }
  return content;
}
