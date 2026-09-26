// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { TextMonitor } from './TextMonitor.js';
import type { Settings } from '../../shared/types/index.js';

describe('TextMonitor (Blocklist Integration)', () => {
  let monitor: TextMonitor;
  let settings: Settings;
  let onCharTyped: any;
  let onTriggerKeyPressed: any;

  beforeEach(() => {
    settings = {
      globalEnabled: true,
      blocklist: ['blocked-site.com'],
      triggerKeys: ['Space'],
    };

    onCharTyped = vi.fn();
    onTriggerKeyPressed = vi.fn();

    // Mock window.location.hostname
    Object.defineProperty(window, 'location', {
      value: { hostname: 'allowed-site.com' },
      writable: true
    });

    monitor = new TextMonitor(
      () => settings,
      onCharTyped,
      onTriggerKeyPressed
    );
    monitor.start();
  });

  afterEach(() => {
    monitor.stop();
    vi.restoreAllMocks();
  });

  it('allows event processing when site is NOT blocked', () => {
    window.location.hostname = 'allowed-site.com';
    
    const input = document.createElement('input');
    document.body.appendChild(input);
    input.focus();
    
    // Simulate typing
    input.dispatchEvent(new Event('input', { bubbles: true }));
    expect(onCharTyped).toHaveBeenCalled();

    // Simulate trigger key
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Space', code: 'Space', bubbles: true }));
    expect(onTriggerKeyPressed).toHaveBeenCalled();

    document.body.removeChild(input);
  });

  it('aborts and blocks event processing when site IS blocked', () => {
    window.location.hostname = 'blocked-site.com';
    
    const input = document.createElement('input');
    document.body.appendChild(input);
    input.focus();
    
    // Simulate typing
    input.dispatchEvent(new Event('input', { bubbles: true }));
    // Deve ignorar (early return)
    expect(onCharTyped).not.toHaveBeenCalled();

    // Simulate trigger key
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Space', code: 'Space', bubbles: true }));
    // Deve ignorar (early return)
    expect(onTriggerKeyPressed).not.toHaveBeenCalled();

    document.body.removeChild(input);
  });
});
