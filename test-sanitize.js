const DOMPurify = require('dompurify');
const { JSDOM } = require('jsdom');
const window = new JSDOM('').window;
const purify = DOMPurify(window);

function sanitizeHtml(dirty) {
  return purify.sanitize(dirty, {
    ALLOWED_TAGS: [
      'b', 'i', 'u', 'span', 'br', 'a', 'img', 'div', 'p', 'strong', 'em', 'ol', 'ul', 'li', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote', 'code', 'pre'
    ],
    ALLOWED_ATTR: [
      'href', 'src', 'alt', 'title', 'class', 'style', 'target', 'rel'
    ],
    ALLOW_DATA_ATTR: false,
    FORBID_TAGS: ['script', 'iframe', 'object', 'embed', 'form'],
    FORBID_ATTR: ['onerror', 'onclick', 'onload', 'onmouseover', 'onkeydown', 'onkeypress', 'onkeyup', 'onfocus', 'onblur'],
    ALLOW_UNKNOWN_PROTOCOLS: false,
  });
}

console.log("--- TEST 1: <img src=x onerror=\"alert(1)\"> ---");
console.log(sanitizeHtml('<img src=x onerror="alert(1)">'));

console.log("\n--- TEST 2: <script>alert(1)</script> ---");
console.log(sanitizeHtml('<script>alert(1)</script>'));

console.log("\n--- TEST 3: <a href=\"javascript:alert(1)\">click</a> ---");
console.log(sanitizeHtml('<a href="javascript:alert(1)">click</a>'));

console.log("\n--- TEST 4: Normal Flow ---");
console.log(sanitizeHtml('<p><b>Bold</b> and <a href="https://example.com">link</a><br></p>'));
