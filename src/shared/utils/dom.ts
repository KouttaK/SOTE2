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
