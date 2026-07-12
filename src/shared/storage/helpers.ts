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
 * Normalises a hostname-like string: strips protocol, userinfo, path,
 * query/hash, port, FQDN trailing dot, trims whitespace, and lowercases.
 * Accepts raw hostnames (`www.google.com`), full URLs
 * (`https://www.google.com/u/0/`), and anything in between — so both the
 * real `window.location.hostname` and user-typed blocklist / Form `sites`
 * patterns can be fed in directly without pre-processing.
 */
export function normalizeHostLike(raw: string): string {
  let s = raw.trim().toLowerCase();
  if (!s) return '';
  // Protocol (http://, https://, ftp://, etc.)
  s = s.replace(/^[a-z][a-z0-9+.-]*:\/\//i, '');
  // Userinfo (usuario:senha@) — only strip if no wildcards in the userinfo
  // portion (a bare `*@` could be a valid wildcard pattern, though unlikely).
  if (!s.includes('*')) {
    s = s.replace(/^[^/?#@]*@/, '');
  }
  // Path / query / hash (everything after the first /, ? or #).
  // When the input contains glob wildcards (*), the ? character must NOT
  // be treated as a query-string separator — it may be a single-char
  // wildcard, so only / and # are used as delimiters in that case.
  // (? without * is treated as a normal URL query separator, which is the
  // common case — wildcard-only ? patterns are vanishingly rare.)
  const isGlobPattern = s.includes('*');
  s = s.split(isGlobPattern ? /[/#]/ : /[/?#]/)[0];
  // Port — with special care for IPv6 bracket notation ([::1]:8080)
  if (s.startsWith('[')) {
    const end = s.indexOf(']');
    if (end !== -1) s = s.slice(0, end + 1);
  } else {
    s = s.split(':')[0];
  }
  // FQDN trailing dot (google.com. → google.com)
  s = s.replace(/\.$/, '');
  return s;
}

/**
 * Escapes all regex-significant characters **except** glob wildcards
 * (`*` and `?`), which are handled separately by the caller.  This is
 * critical because `.` in a domain must become the literal `\.` in the
 * regex, not the regex "any character" metacharacter.
 */
function escapeRegexExceptWildcards(str: string): string {
  return str.replace(/[.+^${}()|[\]\\]/g, '\\$&');
}

/**
 * Converts a glob-style wildcard pattern (already normalised) into an
 * anchored RegExp:
 *   - Consecutive `*` are collapsed (`**` → `*`)
 *   - `*` → `.*`  (any sequence of characters, including empty)
 *   - `?` → `.`   (exactly one character)
 *   - Everything else is regex-escaped (especially `.`)
 *   - The result is anchored (`^…$`) so `google.com` never accidentally
 *     matches `notgoogle.com.evil.com`.
 */
function wildcardPatternToRegex(pattern: string): RegExp {
  const collapsed = pattern.replace(/\*+/g, '*');
  const escaped = escapeRegexExceptWildcards(collapsed);
  const body = escaped.replace(/\*/g, '.*').replace(/\?/g, '.');
  return new RegExp(`^${body}$`);
}

/**
 * Returns `true` when `hostnameOrUrl` matches `pattern`.
 *
 * Both arguments are normalised (protocol, port, path stripped, etc.)
 * before comparison, so any of the following work as patterns:
 *
 *   - `www.mail.google.com`           — exact match
 *   - `https://www.mail.google.com`   — protocol stripped
 *   - `*.google.com`                  — wildcard prefix
 *   - `*google.com`                   — `*` matches empty too
 *   - `mail.google.*`                 — wildcard suffix
 *   - `*mail.google.*`               — wildcards anywhere
 *   - `*google*`                      — free-form wildcard
 *   - `a.b?c.com`                     — `?` = exactly one character
 *
 * Empty pattern or hostname (after normalisation) never matches (fail-safe).
 */
export function matchesDomainPattern(hostnameOrUrl: string, pattern: string): boolean {
  const host = normalizeHostLike(hostnameOrUrl);
  const pat  = normalizeHostLike(pattern);
  if (!host || !pat) return false;
  // Fast path: no wildcards → exact comparison (common case)
  if (!pat.includes('*') && !pat.includes('?')) return host === pat;
  return wildcardPatternToRegex(pat).test(host);
}

/**
 * Returns true when `domain` matches **any** pattern in `patterns`.
 *
 * Unified matcher used by:
 *   - Settings.blocklist (Blocklist)
 *   - Form.sites (Formulários per-site matching)
 *   - Condition rules (Flow condition "domain" type)
 *   - Any future feature comparing hostnames against user-defined patterns
 */
export function domainMatchesAny(domain: string, patterns: string[]): boolean {
  for (const pattern of patterns) {
    if (matchesDomainPattern(domain, pattern)) return true;
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
