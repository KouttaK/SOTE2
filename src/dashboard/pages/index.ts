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

  /**
   * Optional: returns true if the page has unsaved changes. Implemented by
   * pages (e.g. the flow editor) that want the shell to confirm before
   * navigating away, such as when the "Create New Flow" button is clicked.
   */
  isDirty?(): boolean;

  /**
   * Optional: persists the page's current changes. Returns true if the
   * save actually completed (false if e.g. validation failed), so the
   * shell knows whether it's safe to continue navigating.
   */
  saveFlow?(): Promise<boolean>;

  /**
   * Optional: called when the shared header's "Create" CTA is clicked
   * while this page is mounted. Lets a page (e.g. Variables) override the
   * shell's default "Create New Flow" navigation with its own action
   * (e.g. opening the create-variable modal).
   */
  onCreateClick?(): void;
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
    case '/formularios':
      module = await import('./forms.js'); break;
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
