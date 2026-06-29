import { describe, it, expect } from 'vitest';
import { applyCasing } from '../../content/engine/SmartCase.js';

describe('SmartCase', () => {
  it('lowercase + lowercase -> lowercase', () => {
    expect(applyCasing('obg', 'obrigado')).toBe('obrigado');
  });

  it('Titlecase + lowercase -> Titlecase', () => {
    expect(applyCasing('Obg', 'obrigado')).toBe('Obrigado');
  });

  it('UPPERCASE + lowercase -> UPPERCASE', () => {
    expect(applyCasing('OBG', 'obrigado')).toBe('OBRIGADO');
  });

  it('UPPERCASE + texto com MAIÚSCULO -> UPPERCASE', () => {
    expect(applyCasing('OBG', 'texto com MAIÚSCULO')).toBe('TEXTO COM MAIÚSCULO');
  });

  it('forceCapitalize: lowercase -> Titlecase', () => {
    expect(applyCasing('obg', 'obrigado', true)).toBe('Obrigado');
  });

  it('forceCapitalize + SmartCase UPPERCASE: forceCapitalize vence apenas o primeiro char', () => {
    // If the user types 'OBG' but forceCapitalize is true, what happens?
    // According to SmartCase.ts, forceCapitalize overrides the full uppercase logic? Let's check how it behaves.
    // If it's expected to only capitalize first char and leave the rest original if forceCapitalize is true:
    // Wait, the test description says: "forceCapitalize vence apenas o primeiro char", which means "Obrigado" not "OBRIGADO"?
    // Let's implement the expected output based on the description, and we might have to fix SmartCase.ts later if it fails.
    expect(applyCasing('OBG', 'obrigado', true)).toBe('Obrigado');
  });
});
