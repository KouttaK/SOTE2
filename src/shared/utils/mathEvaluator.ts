/**
 * src/shared/utils/mathEvaluator.ts
 *
 * Safe mathematical expression parser and evaluator.
 * Evaluates basic arithmetic operations (+, -, *, /, %, parentheses, unary +/-)
 * WITHOUT using eval() or new Function().
 */

type TokenType = 'NUMBER' | '+' | '-' | '*' | '/' | '%' | '(' | ')';

interface MathToken {
  type: TokenType;
  value: number;
}

function tokenize(expression: string): MathToken[] {
  const tokens: MathToken[] = [];
  let i = 0;
  const s = expression.trim();

  while (i < s.length) {
    const ch = s[i];

    if (/\s/.test(ch)) {
      i++;
      continue;
    }

    if (ch === '+' || ch === '-' || ch === '*' || ch === '/' || ch === '%' || ch === '(' || ch === ')') {
      tokens.push({ type: ch, value: 0 });
      i++;
      continue;
    }

    // Number (integer or float)
    if (/\d/.test(ch) || (ch === '.' && i + 1 < s.length && /\d/.test(s[i + 1]))) {
      let numStr = '';
      let hasDot = false;
      while (i < s.length && (/\d/.test(s[i]) || (s[i] === '.' && !hasDot))) {
        if (s[i] === '.') hasDot = true;
        numStr += s[i];
        i++;
      }
      const val = parseFloat(numStr);
      if (Number.isNaN(val)) {
        throw new Error(`Invalid number: ${numStr}`);
      }
      tokens.push({ type: 'NUMBER', value: val });
      continue;
    }

    throw new Error(`Unexpected character in expression: '${ch}'`);
  }

  return tokens;
}

/**
 * Parses and evaluates an expression using recursive descent:
 *
 * Expression -> Term (('+' | '-') Term)*
 * Term       -> Factor (('*' | '/' | '%') Factor)*
 * Factor     -> ('+' | '-')? Primary
 * Primary    -> NUMBER | '(' Expression ')'
 */
export function evaluateMath(expression: string): number {
  const tokens = tokenize(expression);
  if (tokens.length === 0) {
    throw new Error('Empty expression');
  }

  let index = 0;

  function peek(): MathToken | undefined {
    return tokens[index];
  }

  function consume(): MathToken {
    return tokens[index++];
  }

  function parseExpression(): number {
    let left = parseTerm();
    while (index < tokens.length) {
      const tok = peek();
      if (tok && (tok.type === '+' || tok.type === '-')) {
        consume();
        const right = parseTerm();
        left = tok.type === '+' ? left + right : left - right;
      } else {
        break;
      }
    }
    return left;
  }

  function parseTerm(): number {
    let left = parseFactor();
    while (index < tokens.length) {
      const tok = peek();
      if (tok && (tok.type === '*' || tok.type === '/' || tok.type === '%')) {
        consume();
        const right = parseFactor();
        if (tok.type === '*') {
          left = left * right;
        } else if (tok.type === '/') {
          if (right === 0) {
            throw new Error('Division by zero');
          }
          left = left / right;
        } else if (tok.type === '%') {
          if (right === 0) {
            throw new Error('Modulo by zero');
          }
          left = left % right;
        }
      } else {
        break;
      }
    }
    return left;
  }

  function parseFactor(): number {
    const tok = peek();
    if (!tok) {
      throw new Error('Unexpected end of expression');
    }
    if (tok.type === '+') {
      consume();
      return parseFactor();
    }
    if (tok.type === '-') {
      consume();
      return -parseFactor();
    }
    return parsePrimary();
  }

  function parsePrimary(): number {
    const tok = peek();
    if (!tok) {
      throw new Error('Unexpected end of expression');
    }
    if (tok.type === 'NUMBER') {
      consume();
      return tok.value;
    }
    if (tok.type === '(') {
      consume();
      const val = parseExpression();
      const closing = peek();
      if (!closing || closing.type !== ')') {
        throw new Error('Mismatched parentheses: missing closing parenthesis');
      }
      consume();
      return val;
    }
    throw new Error(`Unexpected token: ${tok.type}`);
  }

  const result = parseExpression();
  if (index < tokens.length) {
    throw new Error(`Unexpected token after expression: ${tokens[index].type}`);
  }
  if (!Number.isFinite(result)) {
    throw new Error('Result is not a finite number');
  }

  return result;
}
