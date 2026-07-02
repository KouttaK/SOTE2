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

  it("Token CLIPBOARD index 1: com histórico presente, retorna o item mais recente (posição 0)", async () => {
    const token: Token = { id: 't5a', type: 'clipboard', config: { index: 1 } };
    const ctx: ExpansionContext = { ...context, clipboardHistory: ['mais recente', 'segundo mais recente', 'terceiro'] };
    const result = await expandToken(token, ctx);
    expect(result).toBe('mais recente');
  });

  it("Token CLIPBOARD index 2: retorna o segundo item do histórico, não o mais recente", async () => {
    const token: Token = { id: 't5b', type: 'clipboard', config: { index: 2 } };
    const ctx: ExpansionContext = { ...context, clipboardHistory: ['mais recente', 'segundo mais recente', 'terceiro'] };
    const result = await expandToken(token, ctx);
    expect(result).toBe('segundo mais recente');
  });

  it("Token CLIPBOARD com dois tokens de índices diferentes: cada um resolve para um valor distinto", async () => {
    const tokenNewest: Token = { id: 't5c', type: 'clipboard', config: { index: 1 } };
    const tokenOldest: Token = { id: 't5d', type: 'clipboard', config: { index: 2 } };
    const ctx: ExpansionContext = { ...context, clipboardHistory: ['novo', 'antigo'] };

    const [resultNewest, resultOldest] = await Promise.all([
      expandToken(tokenNewest, ctx),
      expandToken(tokenOldest, ctx),
    ]);

    expect(resultNewest).toBe('novo');
    expect(resultOldest).toBe('antigo');
    expect(resultNewest).not.toBe(resultOldest);
  });

  it("Token CLIPBOARD index além do tamanho do histórico: retorna string vazia", async () => {
    const token: Token = { id: 't5e', type: 'clipboard', config: { index: 5 } };
    const ctx: ExpansionContext = { ...context, clipboardHistory: ['único item'] };
    const result = await expandToken(token, ctx);
    expect(result).toBe('');
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
