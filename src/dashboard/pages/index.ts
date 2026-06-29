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

export async function loadPage(pattern: string): Promise<Page> {
  let module;
  switch (pattern) {
    case '/flows':
      module = await import('./flows.js'); break;
    case '/editor/:id':
      module = await import('./editor.js'); break;
    case '/variables':
      module = await import('./variables.js'); break;
    case '/templates':
      module = await import('./templates.js'); break;
    case '/settings':
      module = await import('./settings.js'); break;
    case '/analytics':
      module = await import('./analytics.js'); break;
    default:
      module = await import('./flows.js'); break;
  }
  
  const PageClass = module.default;
  return new PageClass();
}
