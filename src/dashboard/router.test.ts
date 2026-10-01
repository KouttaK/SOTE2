/**
 * @vitest-environment jsdom
 */
import { describe, it, expect } from 'vitest';
import { resolve, ROUTE_PATTERNS } from './router.js';

describe('Router', () => {
  it('includes /counters in ROUTE_PATTERNS', () => {
    expect(ROUTE_PATTERNS).toContain('/counters');
  });

  it('resolves /counters path correctly', () => {
    const route = resolve('/counters');
    expect(route.pattern).toBe('/counters');
    expect(route.path).toBe('/counters');
  });

  it('resolves /flows, /variables, /settings, /analytics', () => {
    expect(resolve('/flows').pattern).toBe('/flows');
    expect(resolve('/variables').pattern).toBe('/variables');
    expect(resolve('/settings').pattern).toBe('/settings');
    expect(resolve('/analytics').pattern).toBe('/analytics');
  });

  it('resolves /editor/:id with params', () => {
    const route = resolve('/editor/xyz123');
    expect(route.pattern).toBe('/editor/:id');
    expect(route.params.id).toBe('xyz123');
  });
});
