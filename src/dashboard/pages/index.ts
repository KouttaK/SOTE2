/**
 * src/dashboard/pages/index.ts — Page interface contract + placeholder registry
 *
 * Every dashboard page module must export a default object implementing Page.
 * The shell calls render() → DOM insert → mount(), and unmount() before swap.
 */

// ---------------------------------------------------------------------------
// Page interface — every page module must implement this
// ---------------------------------------------------------------------------

export interface Page {
  /**
   * Returns the root HTMLElement of the page.
   * Called once per navigation, before the element is attached to the DOM.
   */
  render(): HTMLElement;

  /**
   * Called immediately after the page element has been inserted into the DOM.
   * Set up event listeners, start data loading, etc. here.
   */
  mount(): void;

  /**
   * Called just before the page element is removed from the DOM.
   * Must remove all event listeners added in mount() to prevent memory leaks.
   */
  unmount(): void;
}

// ---------------------------------------------------------------------------
// Page loader — dynamic import map keyed by route pattern
// ---------------------------------------------------------------------------

/**
 * Dynamically imports the correct page module for a given route pattern.
 * Each page module must export a `page` named export of type Page.
 */
export async function loadPage(pattern: string): Promise<Page> {
  switch (pattern) {
    case '/flows':
      return (await import('./flows.js')).page;

    case '/editor/:id':
      return (await import('./editor.js')).page;

    case '/variables':
      return (await import('./variables.js')).page;

    case '/templates':
      return (await import('./templates.js')).page;

    case '/settings':
      return (await import('./settings.js')).page;

    case '/analytics':
      return (await import('./analytics.js')).page;

    default:
      return (await import('./flows.js')).page;
  }
}
