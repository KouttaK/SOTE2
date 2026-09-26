/**
 * src/shared/utils/sanitizeHtml.ts
 *
 * Centralized utility to sanitize HTML using DOMPurify.
 * Configured with an allowlist of tags and attributes to prevent XSS.
 */

import dompurify from 'dompurify';

// In browser environments (WXT build), `dompurify` is already an initialized instance.
// In Node.js/Vitest (with jsdom), it is a factory function that requires `window`.
const DOMPurify = typeof window !== 'undefined' && typeof dompurify === 'function' 
  ? dompurify(window as any) 
  : dompurify;

// WARNING: NEVER add properties that accept url() as a value (e.g., background, 
// cursor, list-style-image, content, behavior, -moz-binding, etc.) without first 
// reviewing the CSS Unicode escape bypass limitation documented in the hook below.
export const SAFE_STYLE_PROPERTIES = [
  'color', 'background-color', 'font-weight', 'font-style', 'text-decoration', 'text-align'
];

// Hook to strictly sanitize the 'style' attribute (allowlist only safe properties and block dangerous values)
DOMPurify.addHook('uponSanitizeAttribute', (node: Element, data: any) => {
  if (data.attrName === 'style') {
    const rules = data.attrValue.split(';');
    const safeRules = rules.filter(rule => {
      const parts = rule.split(':');
      if (parts.length < 2) return false;
      const prop = parts[0].trim().toLowerCase();
      const val = parts.slice(1).join(':').toLowerCase();
      
      if (!SAFE_STYLE_PROPERTIES.includes(prop)) return false;
      
      // Strip CSS comments, backslashes (\), and all whitespace/control chars to defeat bypasses.
      // Backslash characters (\) are explicitly removed from the style value before the regex check,
      // preventing CSS escaping bypasses (such as u\rl, j\avascript, or Unicode escapes like \75 rl).
      const unescapedVal = val.replace(/\\/g, '');
      const compactVal = unescapedVal.replace(/\/\*[\s\S]*?\*\//g, '').replace(/[\s\n\r\t\0\x0B]/g, '');
      if (/url\(|expression\(|javascript:|data:/i.test(compactVal)) return false;
      
      return true;
    });
    
    if (safeRules.length > 0) {
      data.attrValue = safeRules.join('; ');
    } else {
      data.keepAttr = false;
    }
  }
});

// Hook to automatically add rel="noopener noreferrer" to external links
DOMPurify.addHook('afterSanitizeAttributes', (node: Element) => {
  if (node.tagName === 'A' && node.getAttribute('target') === '_blank') {
    node.setAttribute('rel', 'noopener noreferrer');
  }
});

export function sanitizeHtml(dirty: string): string {
  return DOMPurify.sanitize(dirty, {
    ALLOWED_TAGS: [
      // SVG, MathML, foreignObject are NOT in this list. Any payloads using <svg>, <math>, etc., are completely stripped.
      'b', 'i', 'u', 'span', 'br', 'a', 'img', 'div', 'p', 'strong', 'em', 'ol', 'ul', 'li', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote', 'code', 'pre'
    ],
    ALLOWED_ATTR: [
      'href', 'src', 'alt', 'title', 'class', 'style', 'target', 'rel',
      'data-token-id', 'data-token-config', 'data-type', 'contenteditable'
    ],
    ALLOW_DATA_ATTR: false,
    FORBID_TAGS: ['script', 'iframe', 'object', 'embed', 'form'],
    FORBID_ATTR: ['onerror', 'onclick', 'onload', 'onmouseover', 'onkeydown', 'onkeypress', 'onkeyup', 'onfocus', 'onblur'],
    ALLOW_UNKNOWN_PROTOCOLS: false,
  });
}
