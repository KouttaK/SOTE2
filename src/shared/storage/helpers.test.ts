import { describe, it, expect } from 'vitest';
import { isExtensionActive } from './helpers.js';
import type { Settings } from '../types/index.js';

describe('isExtensionActive (Entry Point Guard)', () => {
  const baseSettings: Settings = {
    globalEnabled: true,
    snoozeUntil: undefined,
    blocklist: ['blocked-site.com'],
    triggerKeys: ['Space'],
  };

  it('allows expansion when site is not on blocklist', () => {
    expect(isExtensionActive(baseSettings, 'allowed-site.com')).toBe(true);
  });

  describe('Point of Entry 1: TextMonitor/trigger', () => {
    it('blocks trigger expansion when site is on blocklist', () => {
      expect(isExtensionActive(baseSettings, 'blocked-site.com')).toBe(false);
    });
  });

  describe('Point of Entry 2: SearchPopup (///)', () => {
    it('blocks search popup when site is on blocklist', () => {
      expect(isExtensionActive(baseSettings, 'blocked-site.com')).toBe(false);
    });
  });

  describe('Point of Entry 3: CommandPalette', () => {
    it('blocks command palette when site is on blocklist', () => {
      expect(isExtensionActive(baseSettings, 'blocked-site.com')).toBe(false);
    });
  });

  describe('Other conditions', () => {
    it('blocks when globalEnabled is false regardless of blocklist', () => {
      const disabledSettings: Settings = { ...baseSettings, globalEnabled: false };
      expect(isExtensionActive(disabledSettings, 'allowed-site.com')).toBe(false);
      expect(isExtensionActive(disabledSettings, 'blocked-site.com')).toBe(false);
    });

    it('blocks when snooze is active regardless of blocklist', () => {
      const snoozedSettings: Settings = { ...baseSettings, snoozeUntil: Date.now() + 10000 };
      expect(isExtensionActive(snoozedSettings, 'allowed-site.com')).toBe(false);
      expect(isExtensionActive(snoozedSettings, 'blocked-site.com')).toBe(false);
    });
  });
});
