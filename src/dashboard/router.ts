/**
 * src/dashboard/router.ts — SOTE Dashboard Client-Side Router
 *
 * Hash-based routing: #/flows, #/editor/abc123, #/settings, etc.
 * No external dependencies — vanilla TypeScript only.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface RouteParams {
  [key: string]: string;
}

export interface ResolvedRoute {
  /** The matched pattern, e.g. "/editor/:id" */
  pattern: string;
  /** Extracted params, e.g. { id: "abc123" } */
  params: RouteParams;
  /** Raw path after #, e.g. "/editor/abc123" */
  path: string;
}

type RouteChangeCallback = (route: ResolvedRoute) => void;

// ---------------------------------------------------------------------------
// Registered route patterns (order matters — first match wins)
// ---------------------------------------------------------------------------

const ROUTE_PATTERNS: string[] = [
  '/flows',
  '/editor/:id',
  '/variables',
  '/formularios',
  '/settings',
  '/analytics',
];

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Converts a hash string into a clean path.
 * "#/flows" → "/flows", "" → "/flows" (default)
 */
function hashToPath(hash: string): string {
  const path = hash.startsWith('#') ? hash.slice(1) : hash;
  return path || '/flows';
}

/**
 * Matches `path` against a route `pattern`.
 * Returns extracted params if matched, or null if no match.
 *
 * Pattern segments starting with ":" are parameter slots.
 * Example: pattern="/editor/:id", path="/editor/abc" → { id: "abc" }
 */
function matchPattern(pattern: string, path: string): RouteParams | null {
  const patternParts = pattern.split('/').filter(Boolean);
  const pathParts    = path.split('/').filter(Boolean);

  if (patternParts.length !== pathParts.length) return null;

  const params: RouteParams = {};

  for (let i = 0; i < patternParts.length; i++) {
    const pp = patternParts[i];
    const cp = pathParts[i];

    if (pp.startsWith(':')) {
      params[pp.slice(1)] = decodeURIComponent(cp);
    } else if (pp !== cp) {
      return null;
    }
  }

  return params;
}

/**
 * Resolves the current path against all registered patterns.
 * Falls back to /flows if nothing matches.
 */
function resolve(path: string): ResolvedRoute {
  for (const pattern of ROUTE_PATTERNS) {
    const params = matchPattern(pattern, path);
    if (params !== null) {
      return { pattern, params, path };
    }
  }

  // Fallback: treat unmatched paths as /flows (no 404 page in this shell)
  return { pattern: '/flows', params: {}, path: '/flows' };
}

// ---------------------------------------------------------------------------
// Router singleton
// ---------------------------------------------------------------------------

class Router {
  private listeners: RouteChangeCallback[] = [];
  private _current: ResolvedRoute;

  constructor() {
    this._current = resolve(hashToPath(window.location.hash));

    // React to browser back/forward and manual hash changes.
    window.addEventListener('hashchange', () => {
      this._current = resolve(hashToPath(window.location.hash));
      this._notify();
    });
  }

  // ── Public API ────────────────────────────────────────────────────────────

  /** Current resolved route. */
  get current(): ResolvedRoute {
    return this._current;
  }

  /**
   * Navigates to `path` by updating the hash.
   * Pushes a new history entry so the Back button works.
   *
   * If `path` resolves to the exact same hash we're already on, the browser
   * won't fire a `hashchange` event, so nothing would normally happen. That
   * broke "Create New Flow": after saving a brand-new flow the URL stays at
   * "#/editor/new" (its route param never changes), so clicking the button
   * again looked like a no-op. To handle that, we detect the no-op case and
   * force a manual re-resolve + notify so the page always reloads.
   */
  navigate(path: string): void {
    // Normalise: ensure leading slash.
    const clean = path.startsWith('/') ? path : `/${path}`;
    const targetHash = `#${clean}`;

    if (window.location.hash === targetHash) {
      // Same hash as current — hashchange won't fire, so force the reload ourselves.
      this._current = resolve(hashToPath(targetHash));
      this._notify();
      return;
    }

    window.location.hash = clean;
    // hashchange event fires automatically → no need to call notify manually.
  }

  /**
   * Silently syncs the URL hash to `path` without triggering a route
   * notification (no remount). Used after saving a brand-new flow so the
   * address bar reflects its real id instead of staying on "new" —
   * without resetting the editor the user is currently looking at.
   */
  replace(path: string): void {
    const clean = path.startsWith('/') ? path : `/${path}`;
    const targetHash = `#${clean}`;
    history.replaceState(null, '', targetHash);
    this._current = resolve(hashToPath(targetHash));
  }

  /**
   * Returns the current route path (after the #).
   */
  getCurrentRoute(): string {
    return this._current.path;
  }

  /**
   * Registers a callback invoked on every route change.
   * Returns an unsubscribe function.
   */
  onRouteChange(callback: RouteChangeCallback): () => void {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== callback);
    };
  }

  // ── Private ───────────────────────────────────────────────────────────────

  private _notify(): void {
    for (const cb of this.listeners) {
      try {
        cb(this._current);
      } catch (err) {
        console.error('[SOTE Router] Listener error:', err);
      }
    }
  }
}

export const router = new Router();
