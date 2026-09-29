/**
 * SensitiveFieldGuard.ts
 *
 * Central security module that identifies sensitive and confidential input fields
 * (passwords, credit card numbers, CVV/CVC, OTP/2FA codes).
 *
 * Security Invariants:
 * 1. Hard, non-configurable blocking:
 *    - type="password"
 *    - autocomplete containing cc-*, current-password, new-password, one-time-code.
 * 2. Narrow heuristics:
 *    - name, id, aria-label, placeholder matching cvv/cvc, card number, otp, password.
 *    - Deliberately does NOT block cid (customer id, category id), client_id, category-id.
 *    - Deliberately does NOT block based on inputmode alone.
 * 3. Persistence:
 *    - Once an element is identified as protected, it remains protected in a WeakSet
 *      even if its type attribute is dynamically changed from "password" to "text"
 *      (e.g. by a "show password" eye toggle button).
 * 4. Shadow DOM awareness:
 *    - Supports open Shadow DOM via composedPath and recursive deep active element lookup.
 */

const protectedElements = new WeakSet<Element>();

// Patterns for narrow heuristics
const CVV_REGEX = /(?:^|[-_ ])(cvv\d?|cvc\d?)(?:[-_ ]|$)/i;
const CVV_DESC_REGEX = /(?:c[oó]d(?:igo)?(?:\.|\s+|[-_]|(?:\s*(?:de|do)\s*))+seguran[cç]a)/i;

const CARD_NUMBER_REGEX = /(?:credit[-_ ]?card|card[-_ ]?number|n[uú]m(?:ero)?(?:\.|\s+|[-_]|(?:\s*(?:de|do)\s*))+cart[aã]o)/i;

const OTP_REGEX = /(?:^|[-_ ])(?:otp|2fa|mfa|auth[-_ ]?code|one[-_ ]?time[-_ ]?(?:code|pass(?:word)?)|(?:auth|access|security|2fa|mfa|otp|verification)[-_ ]?token|token[-_ ]?code|token[-_ ]?(?:(?:de|do)[-_ ]+)?(?:acesso|autentica[cç][aã]o|verifica[cç][aã]o|seguran[cç]a))(?:[-_ ]|$)/i;
const OTP_DESC_REGEX = /(?:c[oó]d(?:igo)?(?:\.|\s+|[-_]|(?:\s*(?:de|do)\s*))+(?:autentica[cç][aã]o|verifica[cç][aã]o))/i;

const PASSWORD_REGEX = /(?:^|[-_ ])(senha|password|passwd|pwd)(?:[-_ ]|$)/i;

/**
 * Checks whether an element is a sensitive field that must be protected.
 * If protected, automatically remembers it in the persistent WeakSet.
 */
export function isProtected(element: Element | null | undefined): boolean {
  if (!element || !(element instanceof HTMLElement)) return false;

  // 1. Persistent protection check (e.g. was password, now toggled to text)
  if (protectedElements.has(element)) {
    return true;
  }

  // 2. Normative / Hard check: type="password"
  if (element instanceof HTMLInputElement && element.type.toLowerCase() === 'password') {
    protectedElements.add(element);
    return true;
  }

  // 3. Normative / Hard check: autocomplete attribute
  const autocomplete = (element.getAttribute('autocomplete') || '').toLowerCase().trim();
  if (autocomplete) {
    const tokens = autocomplete.split(/\s+/);
    for (const token of tokens) {
      if (
        token.startsWith('cc-') ||
        token === 'current-password' ||
        token === 'new-password' ||
        token === 'one-time-code'
      ) {
        protectedElements.add(element);
        return true;
      }
    }
  }

  // 4. Narrow heuristics (name, id, aria-label, placeholder)
  const name = element.getAttribute('name') || '';
  const id = element.getAttribute('id') || '';
  const ariaLabel = element.getAttribute('aria-label') || '';
  const placeholder = element.getAttribute('placeholder') || '';

  const targetAttributes = [name, id, ariaLabel, placeholder];

  for (const attr of targetAttributes) {
    if (!attr) continue;

    // Check CVV / CVC (Note: cid and cvn are deliberately excluded to avoid false positives)
    if (CVV_REGEX.test(attr) || CVV_DESC_REGEX.test(attr)) {
      protectedElements.add(element);
      return true;
    }

    // Check Card Number
    if (CARD_NUMBER_REGEX.test(attr)) {
      protectedElements.add(element);
      return true;
    }

    // Check OTP / 2FA / MFA
    if (OTP_REGEX.test(attr) || OTP_DESC_REGEX.test(attr)) {
      protectedElements.add(element);
      return true;
    }

    // Check Password in plain text input
    if (PASSWORD_REGEX.test(attr)) {
      protectedElements.add(element);
      return true;
    }
  }

  return false;
}

/**
 * Returns the target element from an event, taking into account open Shadow DOM boundaries
 * via event.composedPath().
 */
export function getTargetFromEvent(e: Event): Element | null {
  if (typeof e.composedPath === 'function') {
    const path = e.composedPath();
    if (path.length > 0 && path[0] instanceof Element) {
      return path[0];
    }
  }
  return (e.target as Element) || null;
}

/**
 * Finds the currently active (focused) element, piercing through open Shadow DOM if present.
 */
export function getDeepActiveElement(root: Document | ShadowRoot = document): Element | null {
  let active = root.activeElement;
  while (active && active.shadowRoot && active.shadowRoot.activeElement) {
    active = active.shadowRoot.activeElement;
  }
  return active;
}
