import { describe, it, expect, beforeEach } from 'vitest';
import { SessionService } from './SessionService.js';

describe('SessionService (Background Multi-tab Ephemeral Storage)', () => {
  let sessionService: SessionService;

  beforeEach(() => {
    sessionService = SessionService.getInstance();
    sessionService.resetAll();
  });

  it('stores and retrieves session data for a specific tabId', () => {
    sessionService.setSessionValue(101, 'protocol', 'PROT-1234');
    sessionService.setSessionValue(101, 'userId', 42);

    const session = sessionService.getSession(101);
    expect(session).toEqual({
      protocol: 'PROT-1234',
      userId: 42,
    });
  });

  it('ensures strict isolation between different tabs', () => {
    // Tab 1 sets its own customer and status
    sessionService.setSessionValue(1, 'customer', 'Acme Corp');
    sessionService.setSessionValue(1, 'status', 'active');

    // Tab 2 sets same keys with different values
    sessionService.setSessionValue(2, 'customer', 'Globex Ltd');
    sessionService.setSessionValue(2, 'status', 'pending');

    // Tab 1 data is preserved without pollution
    expect(sessionService.getSession(1)).toEqual({
      customer: 'Acme Corp',
      status: 'active',
    });

    // Tab 2 data is preserved without pollution
    expect(sessionService.getSession(2)).toEqual({
      customer: 'Globex Ltd',
      status: 'pending',
    });
  });

  it('removes a specific key without clearing other keys in the same tab', () => {
    sessionService.setSessionValue(10, 'keyA', 'valA');
    sessionService.setSessionValue(10, 'keyB', 'valB');

    sessionService.removeSessionValue(10, 'keyA');

    const session = sessionService.getSession(10);
    expect(session.keyA).toBeUndefined();
    expect(session.keyB).toBe('valB');
  });

  it('clears session for a specific tab without affecting other tabs', () => {
    sessionService.setSessionValue(10, 'temp', '123');
    sessionService.setSessionValue(20, 'temp', '456');

    sessionService.clearSession(10);

    expect(sessionService.hasSession(10)).toBe(false);
    expect(sessionService.getSession(10)).toEqual({});
    expect(sessionService.getSession(20)).toEqual({ temp: '456' });
  });

  it('cleans up session data when a tab is closed via handleTabRemoved', () => {
    sessionService.setSessionValue(500, 'draft', 'Important draft text');
    sessionService.setSessionValue(600, 'draft', 'Another draft');

    expect(sessionService.hasSession(500)).toBe(true);
    expect(sessionService.hasSession(600)).toBe(true);

    // Simulate tab 500 closed (e.g. browser.tabs.onRemoved)
    sessionService.handleTabRemoved(500);

    // Tab 500 was cleaned up from memory
    expect(sessionService.hasSession(500)).toBe(false);
    expect(sessionService.getSession(500)).toEqual({});

    // Tab 600 remains intact
    expect(sessionService.hasSession(600)).toBe(true);
    expect(sessionService.getSession(600)).toEqual({ draft: 'Another draft' });
  });

  it('manages global session variables across all tabs until cleared or reset', () => {
    sessionService.setGlobalValue('global_var:empresa', { value: 'TechCorp', savedAt: Date.now() });

    const val = sessionService.getGlobalValue<{ value: string }>('global_var:empresa');
    expect(val?.value).toBe('TechCorp');

    sessionService.removeGlobalValue('global_var:empresa');
    expect(sessionService.getGlobalValue('global_var:empresa')).toBeUndefined();
  });

  it('lazily expires session variables when ttlHours has elapsed', () => {
    const twoHoursAgo = Date.now() - 2 * 3600 * 1000 - 1000;
    
    // Tab session expired
    sessionService.setSessionValue(10, 'expired_key', {
      value: 'Old data',
      savedAt: twoHoursAgo,
      ttlHours: 1, // expired 1 hour ago
    });
    sessionService.setSessionValue(10, 'valid_key', {
      value: 'Fresh data',
      savedAt: Date.now(),
      ttlHours: 1, // valid
    });

    const session = sessionService.getSession(10);
    expect(session.expired_key).toBeUndefined();
    expect((session.valid_key as any).value).toBe('Fresh data');

    // Global session expired
    sessionService.setGlobalValue('global_expired', {
      value: 'Old global',
      savedAt: twoHoursAgo,
      ttlHours: 1,
    });
    expect(sessionService.getGlobalValue('global_expired')).toBeUndefined();
  });
});
