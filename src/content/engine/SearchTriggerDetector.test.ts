import { describe, it, expect } from 'vitest';
import { buildSearchResults } from './SearchTriggerDetector.js';

describe('SearchTriggerDetector buildSearchResults', () => {
  it('should match Forms with empty sites in domain scope (global fallback)', () => {
    const result = buildSearchResults({
      query: 'support',
      scope: 'domain',
      hostname: 'randomsite.com',
      forms: [
        { id: '1', name: 'Support', sites: [], fields: [], createdAt: 0, updatedAt: 0, stats: { usageCount: 0 } },
        { id: '2', name: 'Restricted', sites: ['other.com'], fields: [], createdAt: 0, updatedAt: 0, stats: { usageCount: 0 } }
      ],
      flows: [],
      includeFlows: false,
    });

    expect(result.results).toHaveLength(1);
    expect(result.results[0].kind).toBe('form');
    // @ts-ignore
    expect(result.results[0].form.name).toBe('Support');
  });

  it('should NOT match Forms if hostname is not in the sites list (restricted scope)', () => {
    const result = buildSearchResults({
      query: 'secret',
      scope: 'domain',
      hostname: 'unlisted-site.com',
      forms: [
        { id: '3', name: 'Secret Form', sites: ['restricted-site.com'], fields: [], createdAt: 0, updatedAt: 0, stats: { usageCount: 0 } }
      ],
      flows: [],
      includeFlows: false,
    });

    expect(result.results).toHaveLength(0);
  });
});

import { detectSearchTrigger } from './SearchTriggerDetector.js';
import type { Settings } from '../../shared/types/index.js';

describe('SearchTriggerDetector detectSearchTrigger (Blocklist Integration)', () => {
  it('aborts and returns null if the site is on the blocklist', () => {
    const settings: Settings = {
      globalEnabled: true,
      blocklist: ['blocked-site.com'],
      searchTrigger: {
        enabled: true,
        domainPrefix: '//',
        globalPrefix: '///'
      }
    };
    
    // Simula buffer como se o usuário tivesse acabado de digitar "//"
    const buffer = 'ola //';
    
    // Site bloqueado -> retorna null
    expect(detectSearchTrigger(buffer, settings, 'blocked-site.com')).toBeNull();
    
    // Site permitido -> retorna estado do trigger
    expect(detectSearchTrigger(buffer, settings, 'allowed-site.com')).not.toBeNull();
    expect(detectSearchTrigger(buffer, settings, 'allowed-site.com')?.query).toBe('');
  });
});
