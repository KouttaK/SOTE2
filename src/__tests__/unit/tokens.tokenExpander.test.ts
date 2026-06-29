import { describe, it, expect, vi } from 'vitest';
import { expandToken, ExpansionContext } from '../../content/engine/tokenExpander.js';
import type { Token } from '../../shared/types/index.js';

describe('tokenExpander', () => {
  const context: ExpansionContext = {
    tabUrl: 'https://example.com',
    tabTitle: 'Example Title'
  };

  it("Token DATE format 'DD/MM/YYYY': retorna data de hoje no formato correto", async () => {
    const token: Token = { id: 't1', type: 'date', config: { format: 'DD/MM/YYYY' } };
    const result = await expandToken(token, context);
    const today = new Date();
    const expected = `${String(today.getDate()).padStart(2, '0')}/${String(today.getMonth() + 1).padStart(2, '0')}/${today.getFullYear()}`;
    expect(result).toBe(expected);
  });

  it("Token DATE format 'HH:mm': retorna hora atual", async () => {
    const token: Token = { id: 't2', type: 'date', config: { format: 'HH:mm' } };
    const result = await expandToken(token, context);
    const today = new Date();
    const expected = `${String(today.getHours()).padStart(2, '0')}:${String(today.getMinutes()).padStart(2, '0')}`;
    expect(result).toBe(expected);
  });

  it("Token URL: retorna context.tabUrl", async () => {
    const token: Token = { id: 't3', type: 'url', config: {} };
    const result = await expandToken(token, context);
    expect(result).toBe('https://example.com');
  });

  it("Token TITLE: retorna context.tabTitle", async () => {
    const token: Token = { id: 't4', type: 'title', config: {} };
    const result = await expandToken(token, context);
    expect(result).toBe('Example Title');
  });

  it("Token CLIPBOARD index 1: retorna primeiro item do histórico (mock)", async () => {
    const token: Token = { id: 't5', type: 'clipboard', config: { index: 1 } };
    
    // Mock navigator.clipboard.readText
    Object.assign(navigator, {
      clipboard: {
        readText: vi.fn().mockResolvedValue('Clipboard Content')
      }
    });

    const result = await expandToken(token, context);
    expect(result).toBe('Clipboard Content'); // Current implementation might just read current clipboard for index 1
  });

  it("Token CHOICE: retorna null (aguarda input do usuário)", async () => {
    const token: Token = { id: 't6', type: 'choice', config: { options: ['A', 'B'] } };
    const result = await expandToken(token, context);
    expect(result).toBeNull();
  });

  it("Token INPUT: retorna null (aguarda input do usuário)", async () => {
    const token: Token = { id: 't7', type: 'input', config: { label: 'Name' } };
    const result = await expandToken(token, context);
    expect(result).toBeNull();
  });
});
