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
// Additional helpers
// ---------------------------------------------------------------------------

/**
 * Removes all child nodes from an element.
 */
export function clearElement(el: HTMLElement): void {
  while (el.firstChild) {
    el.removeChild(el.firstChild);
  }
}

/**
 * Returns the first element matching `selector` inside `root` (or
 * `document` if omitted), typed to `T`.  Throws if not found.
 */
export function qs<T extends HTMLElement>(
  selector: string,
  root: ParentNode = document,
): T {
  const el = root.querySelector<T>(selector);
  if (!el) throw new Error(`[SOTE] Element not found: "${selector}"`);
  return el;
}

/**
 * Returns all elements matching `selector` inside `root` as an Array.
 */
export function qsAll<T extends HTMLElement>(
  selector: string,
  root: ParentNode = document,
): T[] {
  return Array.from(root.querySelectorAll<T>(selector));
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
export function getFieldContent(element: HTMLElement | null | undefined): string {
  if (!element) return '';
  if (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA') {
    return (element as HTMLInputElement | HTMLTextAreaElement).value || '';
  }
  if (element.isContentEditable) {
    return element.textContent || '';
  }
  return '';
}
