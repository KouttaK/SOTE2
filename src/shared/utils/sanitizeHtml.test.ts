// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { sanitizeHtml, SAFE_STYLE_PROPERTIES } from './sanitizeHtml.js';

describe('sanitizeHtml', () => {
  it('neutralizes basic script injections', () => {
    expect(sanitizeHtml('<script>alert(1)</script>')).toBe('');
  });

  it('neutralizes inline event handlers', () => {
    expect(sanitizeHtml('<img src="x" onerror="alert(1)">')).toBe('<img src="x">');
    expect(sanitizeHtml('<div onclick="malicious()">click me</div>')).toBe('<div>click me</div>');
  });

  it('blocks javascript: and data: URIs in links', () => {
    expect(sanitizeHtml('<a href="javascript:alert(1)">click</a>')).toBe('<a>click</a>');
  });

  it('blocks data: URIs in images containing scripts', () => {
    expect(sanitizeHtml('<img src="data:text/html,<script>alert(1)</script>">')).toBe('<img>');
  });

  it('preserves valid formatting and safe links', () => {
    const input = '<p><b>Bold</b> and <a href="https://example.com">link</a><br></p>';
    expect(sanitizeHtml(input)).toBe(input);
  });

  it('strips unsafe SVG and MathML completely', () => {
    expect(sanitizeHtml('<svg onload="alert(1)"><animate onbegin="alert(1)"/></svg>')).toBe('');
    expect(sanitizeHtml('<math><mi>x</mi></math>')).toBe('');
  });

  it('adds rel="noopener noreferrer" to target="_blank" links automatically', () => {
    expect(sanitizeHtml('<a target="_blank" href="https://evil.com">link</a>')).toBe('<a target="_blank" href="https://evil.com" rel="noopener noreferrer">link</a>');
  });

  it('strips dangerous CSS properties and functions in style attributes', () => {
    expect(sanitizeHtml('<div style="background-color:url(javascript:alert(1))">x</div>')).toBe('<div>x</div>');
    expect(sanitizeHtml('<span style="color:red; text-decoration:expression(alert(1));">safe</span>')).toBe('<span style="color:red">safe</span>');
  });

  it('allows safe CSS properties in style attributes', () => {
    const safeStyle = '<span style="color: red; font-weight: bold; text-align: center">safe</span>';
    // Note: DOMPurify's internal CSS parser may add extra spaces
    expect(sanitizeHtml(safeStyle)).toBe('<span style="color: red;  font-weight: bold;  text-align: center">safe</span>');
  });

  it('blocks style bypasses with encoded characters, comments, and mixed cases on allowed properties', () => {
    // 1. Newline (encoded) inside protocol
    expect(sanitizeHtml('<div style="color: url(java&#10;script:alert(1))">x</div>')).toBe('<div>x</div>');
    // 2. CSS comment inside url()
    expect(sanitizeHtml('<div style="background-color: ur/**/l(javascript:alert(1))">x</div>')).toBe('<div>x</div>');
    // 3. Mixed case
    expect(sanitizeHtml('<div style="COLOR: URL(JAVASCRIPT:alert(1))">x</div>')).toBe('<div>x</div>');
    
    // 4. Double obfuscation (both keywords broken by different methods simultaneously)
    expect(sanitizeHtml('<div style="color: u&#10;rl(java&#10;script:alert(1))">x</div>')).toBe('<div>x</div>');
    expect(sanitizeHtml('<div style="background-color: ur/**/l(java/**/script:alert(1))">x</div>')).toBe('<div>x</div>');
    expect(sanitizeHtml('<div style="color: U&#10;RL(JAVA/**/SCRIPT:alert(1))">x</div>')).toBe('<div>x</div>');

    // 5. CSS Unicode Hex Escaping
    // \75 is 'u' in CSS hex escapes. 
    // This tests if DOMPurify's native CSS parser or our regex catches it.
    // LIMITATION: CSS hex escapes bypass BOTH our regex (because it looks for "url") 
    // and DOMPurify's native parser. We accept this risk because:
    // 1. We strictly allowlist properties (like 'color', 'background-color') that do NOT accept url() or expression() in standard CSS anyway.
    // 2. Full CSS escape decoding is too heavy for a simple regex without a real CSS parser.
    const escapedPayload = '<div style="color: \\75 rl(\\6a \\61 v\\61 script:alert(1))">x</div>';
    expect(sanitizeHtml(escapedPayload)).toBe(escapedPayload); // SURVIVES!

    // 6. Multiple declarations (drops malicious allowed prop, keeps safe allowed props)
    const mixed = sanitizeHtml('<div style="color:red; background-color:url(javascript:alert(1)); font-weight:bold">x</div>');
    expect(mixed).toContain('color:red');
    expect(mixed).toContain('font-weight:bold');
    expect(mixed).not.toContain('background-color');
    expect(mixed).not.toContain('javascript');
  });

  it('guard-rail: ensures dangerous properties are never added to SAFE_STYLE_PROPERTIES', () => {
    // These properties natively support url() or expression() and MUST NOT be added to the allowlist
    // without first replacing the regex with a full AST CSS parser to prevent Unicode hex escape bypasses.
    const dangerousProps = [
      'background', 'background-image', 'cursor', 'list-style', 'list-style-image', 
      'content', 'behavior', '-moz-binding', 'filter'
    ];
    
    dangerousProps.forEach(prop => {
      expect(SAFE_STYLE_PROPERTIES).not.toContain(prop);
    });
  });

  it('strips backslash characters before regex checks to block escape obfuscations', () => {
    // 1. Backslash splitting url() keyword: u\rl(...)
    expect(sanitizeHtml('<div style="background-color: u\\rl(javascript:alert(1))">x</div>')).toBe('<div>x</div>');

    // 2. Backslash inside javascript: protocol: j\avascript:
    expect(sanitizeHtml('<div style="color: url(j\\avascript:alert(1))">x</div>')).toBe('<div>x</div>');

    // 3. Backslash inside expression(): e\xpression(alert(1))
    expect(sanitizeHtml('<span style="color:red; text-decoration:e\\xpression(alert(1));">safe</span>')).toBe('<span style="color:red">safe</span>');

    // 4. Multiple backslashes across keyword: \u\r\l
    expect(sanitizeHtml('<div style="background-color: \\u\\r\\l(javascript:alert(1))">x</div>')).toBe('<div>x</div>');
  });

  it('preserves token pill data attributes (data-token-id, data-token-config, data-type, contenteditable)', () => {
    const pill = '<span class="token-pill" data-token-id="1" data-token-config="{}" data-type="math" contenteditable="false"></span>';
    expect(sanitizeHtml(pill)).toBe(pill);
    expect(sanitizeHtml('<span data-other="bad"></span>')).toBe('<span></span>');
  });
});
