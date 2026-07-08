import type { Settings } from '../types/index.js';

/**
 * Generates a UUID v4 using the Web Crypto API (no external deps).
 */
export function generateId(): string {
  return crypto.randomUUID();
}

/**
 * Returns true when the snooze period is currently active.
 */
export function isSnoozeActive(settings: Settings): boolean {
  if (settings.snoozeUntil === undefined) return false;
  return Date.now() < settings.snoozeUntil;
}

/**
 * Returns true when `domain` matches any pattern in `patterns`.
 *
 * Supported pattern formats:
 *   - Exact: "banco.com" → matches only "banco.com"
 *   - Wildcard prefix: "*.banco.com" → matches "app.banco.com",
 *     "sub.banco.com", etc., but NOT "banco.com" itself or
 *     "banco.com.br".
 *
 * Shared matcher: used both by the Blocklist (Settings) and by Forms'
 * `sites` field (see Form type) — same syntax, same validation, one
 * implementation.
 */
export function domainMatchesAny(domain: string, patterns: string[]): boolean {
  const normalised = domain.toLowerCase();

  for (const pattern of patterns) {
    if (pattern.startsWith('*.')) {
      // Wildcard: the suffix after "*" must match exactly the end of the domain.
      // e.g. "*.banco.com" becomes suffix ".banco.com"
      const suffix = pattern.slice(1); // ".banco.com"
      if (normalised.endsWith(suffix)) {
        // Ensure there is at least one subdomain label (not just "banco.com")
        const prefix = normalised.slice(0, normalised.length - suffix.length);
        if (prefix.length > 0 && !prefix.includes('.')) {
          return true;
        }
        if (prefix.length > 0) {
          return true;
        }
      }
    } else {
      if (normalised === pattern.toLowerCase()) {
        return true;
      }
    }
  }

  return false;
}

/** @deprecated Use `domainMatchesAny` — kept as an alias for existing call sites/imports. */
export function isBlocklisted(domain: string, blocklist: string[]): boolean {
  return domainMatchesAny(domain, blocklist);
}

/**
 * Extracts the hostname from a full URL, stripping port if present.
 * Returns an empty string for invalid/unsupported URLs.
 */
export function getActiveDomain(url: string): string {
  try {
    const parsed = new URL(url);
    return parsed.hostname;
  } catch {
    return '';
  }
}
