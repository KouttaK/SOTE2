import { describe, it, expect } from 'vitest';
import { resolveVariablesInText } from './variableResolver.js';
import type { Variable } from '../types/index.js';

describe('variableResolver', () => {
  const dummyVariables: Variable[] = [
    { id: '1', key: 'NAME', value: 'Lucas', updatedAt: Date.now() },
    { id: '2', key: 'EMPTY_VAR', value: '', updatedAt: Date.now() },
    { id: '3', key: 'SPECIAL_CHARS', value: 'Tom & <Jerry>', updatedAt: Date.now() },
  ];

  it('replaces existing variables without fallback', () => {
    const text = 'Hello, {{NAME}}!';
    const result = resolveVariablesInText(text, false, dummyVariables);
    expect(result).toBe('Hello, Lucas!');
  });

  it('leaves unknown variables untouched when no fallback is provided', () => {
    const text = 'Hello, {{UNKNOWN}}!';
    const result = resolveVariablesInText(text, false, dummyVariables);
    expect(result).toBe('Hello, {{UNKNOWN}}!');
  });

  it('uses fallback when variable does not exist', () => {
    const text = 'Hello, {{UNKNOWN|Friend}}!';
    const result = resolveVariablesInText(text, false, dummyVariables);
    expect(result).toBe('Hello, Friend!');
  });

  it('uses fallback when variable exists but is empty string', () => {
    const text = 'Notice: {{EMPTY_VAR|Default Content}}';
    const result = resolveVariablesInText(text, false, dummyVariables);
    expect(result).toBe('Notice: Default Content');
  });

  it('ignores fallback when variable exists with non-empty value', () => {
    const text = 'Hello, {{NAME|Anonymous}}!';
    const result = resolveVariablesInText(text, false, dummyVariables);
    expect(result).toBe('Hello, Lucas!');
  });

  it('resolves empty string when variable exists as empty string and no fallback is given', () => {
    const text = 'Value: [{{EMPTY_VAR}}]';
    const result = resolveVariablesInText(text, false, dummyVariables);
    expect(result).toBe('Value: []');
  });

  it('handles empty fallback value {{KEY|}}', () => {
    const text = 'Value: [{{UNKNOWN|}}]';
    const result = resolveVariablesInText(text, false, dummyVariables);
    expect(result).toBe('Value: []');
  });

  it('handles spaces around keys and pipes', () => {
    const text = 'Hello, {{  UNKNOWN  |  Default Guest  }}!';
    const result = resolveVariablesInText(text, false, dummyVariables);
    expect(result).toBe('Hello, Default Guest!');
  });

  it('escapes HTML when escapeHtml is true', () => {
    const text = 'Chars: {{SPECIAL_CHARS}}';
    const result = resolveVariablesInText(text, true, dummyVariables);
    expect(result).toBe('Chars: Tom &amp; &lt;Jerry&gt;');
  });

  it('escapes fallback HTML when escapeHtml is true', () => {
    const text = 'Chars: {{MISSING|<Fallback & Co>}}';
    const result = resolveVariablesInText(text, true, dummyVariables);
    expect(result).toBe('Chars: &lt;Fallback &amp; Co&gt;');
  });

  it('resolves multiple mixed variables in the same text', () => {
    const text = 'User {{NAME|Guest}} from {{COMPANY|Acme Corp}} has status {{EMPTY_VAR|active}}. Code: {{CODE}}';
    const result = resolveVariablesInText(text, false, dummyVariables);
    expect(result).toBe('User Lucas from Acme Corp has status active. Code: {{CODE}}');
  });

  it('handles text without variables or empty variables array safely', () => {
    expect(resolveVariablesInText('No variables here', false, [])).toBe('No variables here');
    expect(resolveVariablesInText('Fallback only: {{UNKNOWN|Test}}', false, [])).toBe('Fallback only: Test');
    expect(resolveVariablesInText('Fallback only: {{UNKNOWN|Test}}', false, undefined)).toBe('Fallback only: Test');
  });
});
