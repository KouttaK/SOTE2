// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { CommandPalette } from './CommandPalette.js';
import type { Settings } from '../../shared/types/index.js';

describe('CommandPalette (Blocklist Integration)', () => {
  it('aborts open() if the site is blocked', () => {
    const palette = new CommandPalette();
    const settings: Settings = {
      globalEnabled: true,
      blocklist: ['blocked-site.com'],
    };

    palette.updateContext('blocked-site.com', true);

    const onSelect = vi.fn();
    const onClose = vi.fn();

    // Tenta abrir a paleta
    palette.open(settings, onSelect, onClose);

    // Confirma que a paleta não foi injetada no DOM (abortou)
    const host = document.querySelector('.sote-palette-host');
    expect(host).toBeNull();
  });

  it('opens successfully if the site is not blocked', () => {
    const palette = new CommandPalette();
    const settings: Settings = {
      globalEnabled: true,
      blocklist: ['blocked-site.com'],
    };

    palette.updateContext('allowed-site.com', true);

    const onSelect = vi.fn();
    const onClose = vi.fn();

    palette.open(settings, onSelect, onClose);

    // Confirma que a paleta foi injetada no DOM
    const host = document.querySelector('.sote-palette-host');
    expect(host).not.toBeNull();
    
    palette.close();
  });
});
