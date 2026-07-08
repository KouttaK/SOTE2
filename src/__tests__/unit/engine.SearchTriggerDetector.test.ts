import { describe, it, expect } from 'vitest';
import { detectSearchTrigger, buildSearchResults, shortcutConflictsWithSearchTrigger } from '../../content/engine/SearchTriggerDetector.js';
import type { Settings, Form, Flow } from '../../shared/types/index.js';
import { DEFAULT_SETTINGS } from '../../shared/storage/defaults.js';

function makeSettings(overrides: Partial<Settings['searchTrigger']> = {}): Settings {
  return {
    ...DEFAULT_SETTINGS,
    searchTrigger: { ...DEFAULT_SETTINGS.searchTrigger, ...overrides },
  };
}

describe('detectSearchTrigger', () => {
  it('returns null when the feature is disabled', () => {
    const settings = makeSettings({ enabled: false });
    expect(detectSearchTrigger('hello //foo', settings)).toBeNull();
  });

  it('returns null when the buffer has no prefix at all', () => {
    expect(detectSearchTrigger('just typing normally', makeSettings())).toBeNull();
  });

  it('detects the domain-scope prefix ("//") with an empty query right after typing it', () => {
    const result = detectSearchTrigger('hello //', makeSettings());
    expect(result).toEqual({ scope: 'domain', query: '', typed: '//' });
  });

  it('detects the domain-scope prefix with a growing query', () => {
    const result = detectSearchTrigger('hello //assunto curr', makeSettings());
    expect(result).toEqual({ scope: 'domain', query: 'assunto curr', typed: '//assunto curr' });
  });

  it('detects the global-scope prefix ("///") even though it also ends with "//"', () => {
    const result = detectSearchTrigger('hello ///assunto', makeSettings());
    expect(result).toEqual({ scope: 'global', query: 'assunto', typed: '///assunto' });
  });

  it('detects the global prefix with an empty query', () => {
    const result = detectSearchTrigger('///', makeSettings());
    expect(result).toEqual({ scope: 'global', query: '', typed: '///' });
  });

  it("does not treat a URL's \"://\" as a prefix (boundary check)", () => {
    // "https://example.com" ends with "//example.com" mid-word; "/" right
    // before it is preceded by ":", not a boundary character.
    expect(detectSearchTrigger('check https://example.com', makeSettings())).toBeNull();
  });

  it('allows the prefix right at the very start of the field', () => {
    const result = detectSearchTrigger('//oi', makeSettings());
    expect(result).toEqual({ scope: 'domain', query: 'oi', typed: '//oi' });
  });

  it('allows the prefix after common opening punctuation', () => {
    const result = detectSearchTrigger('(//oi', makeSettings());
    expect(result?.scope).toBe('domain');
  });

  it('abandons the session once the query gets implausibly long', () => {
    const longQuery = 'a'.repeat(61);
    expect(detectSearchTrigger(`//${longQuery}`, makeSettings())).toBeNull();
  });

  it('abandons the session if the query contains a newline', () => {
    expect(detectSearchTrigger('//foo\nbar', makeSettings())).toBeNull();
  });

  it('ends the session once the user deletes back past the prefix', () => {
    // Simulates: buffer no longer contains "//" at all after backspacing.
    expect(detectSearchTrigger('hello ', makeSettings())).toBeNull();
  });

  it('respects custom configured prefixes', () => {
    const settings = makeSettings({ domainPrefix: '@@', globalPrefix: '@@@' });
    expect(detectSearchTrigger('oi @@busca', settings)).toEqual({ scope: 'domain', query: 'busca', typed: '@@busca' });
    expect(detectSearchTrigger('oi @@@busca', settings)).toEqual({ scope: 'global', query: 'busca', typed: '@@@busca' });
  });

  it('returns null if prefixes are equal or empty (defensive; Settings UI should prevent this)', () => {
    expect(detectSearchTrigger('//x', makeSettings({ domainPrefix: '//', globalPrefix: '//' }))).toBeNull();
    expect(detectSearchTrigger('//x', makeSettings({ domainPrefix: '', globalPrefix: '///' }))).toBeNull();
  });
});

// ── buildSearchResults ──────────────────────────────────────────────────────

function makeForm(overrides: Partial<Form> = {}): Form {
  return {
    id: 'form-1',
    name: 'Envio de Currículo',
    sites: ['mail.google.com'],
    fields: [
      { id: 'f1', name: 'Assunto', type: 'text', value: { format: 'plaintext', content: 'Candidatura para {{CARGO}}', tokens: [] } },
      { id: 'f2', name: 'Destinatário', type: 'email', value: { format: 'plaintext', content: 'rh@empresa.com', tokens: [] } },
    ],
    createdAt: 0,
    updatedAt: 0,
    stats: { usageCount: 0 },
    ...overrides,
  };
}

function makeFlow(overrides: Partial<Flow> = {}): Flow {
  return {
    id: 'flow-1',
    name: 'Saudação',
    blocks: [
      { id: 'b1', type: 'trigger', data: { shortcut: 'oi', smartCase: true, forceCapitalize: false } },
      { id: 'b2', type: 'action', data: { format: 'plaintext', content: 'Bom dia!', tokens: [] } },
    ],
    tags: [],
    enabled: true,
    createdAt: 0,
    updatedAt: 0,
    stats: { usageCount: 0, keysSaved: 0 },
    ...overrides,
  };
}

describe('buildSearchResults', () => {
  it('browse mode (empty query) returns one row per Form and per enabled Flow', () => {
    const { results } = buildSearchResults({
      query: '',
      scope: 'domain',
      hostname: 'mail.google.com',
      forms: [makeForm()],
      flows: [makeFlow()],
      includeFlows: true,
    });
    expect(results).toHaveLength(2);
    expect(results.find((r) => r.kind === 'form')).toBeTruthy();
    expect(results.find((r) => r.kind === 'flow')).toBeTruthy();
  });

  it('domain scope excludes Forms whose sites do not match the current host', () => {
    const { results, noFormResultsForSite } = buildSearchResults({
      query: '',
      scope: 'domain',
      hostname: 'outlook.com',
      forms: [makeForm()], // sites: ['mail.google.com']
      flows: [],
      includeFlows: true,
    });
    expect(results).toHaveLength(0);
    expect(noFormResultsForSite).toBe(true);
  });

  it('domain scope excludes Forms with no sites configured at all', () => {
    const { results } = buildSearchResults({
      query: '',
      scope: 'domain',
      hostname: 'mail.google.com',
      forms: [makeForm({ sites: [] })],
      flows: [],
      includeFlows: true,
    });
    expect(results).toHaveLength(0);
  });

  it('global scope includes Forms regardless of site, including ones with empty sites', () => {
    const { results } = buildSearchResults({
      query: '',
      scope: 'global',
      hostname: 'anything.example.com',
      forms: [makeForm({ sites: [] }), makeForm({ id: 'form-2', sites: ['other.com'] })],
      flows: [],
      includeFlows: true,
    });
    expect(results).toHaveLength(2);
  });

  it('a query matching a specific field name returns a form-field result, not a form result', () => {
    const { results } = buildSearchResults({
      query: 'assunto',
      scope: 'domain',
      hostname: 'mail.google.com',
      forms: [makeForm()],
      flows: [],
      includeFlows: true,
    });
    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({ kind: 'form-field', matchLevel: 1, matchedIn: 'name' });
  });

  it('a query matching only the Form name (no field matches) returns a form (submenu) result', () => {
    const { results } = buildSearchResults({
      query: 'currículo',
      scope: 'domain',
      hostname: 'mail.google.com',
      forms: [makeForm()],
      flows: [],
      includeFlows: true,
    });
    expect(results).toHaveLength(1);
    expect(results[0].kind).toBe('form');
  });

  it('a query matching field content (not name) returns a form-field result with matchLevel 3 and a snippet', () => {
    const { results } = buildSearchResults({
      query: 'cargo',
      scope: 'domain',
      hostname: 'mail.google.com',
      forms: [makeForm()],
      flows: [],
      includeFlows: true,
    });
    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({ kind: 'form-field', matchLevel: 3, matchedIn: 'content' });
  });

  it('ranks exact match above partial match above content match', () => {
    const forms: Form[] = [
      makeForm({
        id: 'exact',
        name: 'Relatorio',
        fields: [{ id: 'e1', name: 'relatorio', value: { format: 'plaintext', content: 'x', tokens: [] } }],
      }),
      makeForm({
        id: 'partial',
        name: 'Relatorio Mensal',
        fields: [{ id: 'p1', name: 'meu relatorio semanal', value: { format: 'plaintext', content: 'y', tokens: [] } }],
      }),
      makeForm({
        id: 'content',
        name: 'Outro',
        fields: [{ id: 'c1', name: 'campo', value: { format: 'plaintext', content: 'fala sobre relatorio aqui', tokens: [] } }],
      }),
    ];
    const { results } = buildSearchResults({
      query: 'relatorio',
      scope: 'global',
      hostname: 'x.com',
      forms,
      flows: [],
      includeFlows: true,
    });
    expect(results.map((r) => (r as any).form.id)).toEqual(['exact', 'partial', 'content']);
  });

  it('breaks ties within the same match level by usageCount (desc)', () => {
    const forms: Form[] = [
      makeForm({ id: 'low-usage', name: 'Protocolo', stats: { usageCount: 1 } }),
      makeForm({ id: 'high-usage', name: 'Protocolo', stats: { usageCount: 9 } }),
    ];
    const { results } = buildSearchResults({
      query: 'protocolo',
      scope: 'global',
      hostname: 'x.com',
      forms,
      flows: [],
      includeFlows: true,
    });
    expect(results.map((r) => (r as any).form.id)).toEqual(['high-usage', 'low-usage']);
  });

  it('Flows are always eligible regardless of scope (no domain restriction)', () => {
    const { results } = buildSearchResults({
      query: '',
      scope: 'domain',
      hostname: 'totally-unrelated.com',
      forms: [],
      flows: [makeFlow()],
      includeFlows: true,
    });
    expect(results).toHaveLength(1);
    expect(results[0].kind).toBe('flow');
  });

  it('disabled Flows never appear', () => {
    const { results } = buildSearchResults({
      query: '',
      scope: 'domain',
      hostname: 'x.com',
      forms: [],
      flows: [makeFlow({ enabled: false })],
      includeFlows: true,
    });
    expect(results).toHaveLength(0);
  });

  it('includeFlows=false excludes every Flow from results', () => {
    const { results } = buildSearchResults({
      query: '',
      scope: 'domain',
      hostname: 'x.com',
      forms: [],
      flows: [makeFlow()],
      includeFlows: false,
    });
    expect(results).toHaveLength(0);
  });

  it('matches a Flow by its trigger shortcut as well as its name', () => {
    const { results } = buildSearchResults({
      query: 'oi',
      scope: 'domain',
      hostname: 'x.com',
      forms: [],
      flows: [makeFlow()],
      includeFlows: true,
    });
    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({ kind: 'flow', matchLevel: 1, matchedIn: 'shortcut' });
  });

  it('matches a Flow by its action content', () => {
    const { results } = buildSearchResults({
      query: 'bom dia',
      scope: 'domain',
      hostname: 'x.com',
      forms: [],
      flows: [makeFlow()],
      includeFlows: true,
    });
    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({ kind: 'flow', matchLevel: 3, matchedIn: 'content' });
  });

  it('caps results at 30', () => {
    const forms = Array.from({ length: 40 }, (_, i) => makeForm({ id: `f${i}`, name: `Form ${i}`, sites: [] }));
    const { results } = buildSearchResults({
      query: '',
      scope: 'global',
      hostname: 'x.com',
      forms,
      flows: [],
      includeFlows: true,
    });
    expect(results.length).toBe(30);
  });
});

describe('shortcutConflictsWithSearchTrigger (spec §6 — reserved prefixes)', () => {
  const cfg = { enabled: true, includeFlows: true, domainPrefix: '//', globalPrefix: '///' };

  it('flags a shortcut that starts with the domain prefix', () => {
    expect(shortcutConflictsWithSearchTrigger('//relatorio', cfg)).toBe(true);
  });

  it('flags a shortcut that starts with the global prefix', () => {
    expect(shortcutConflictsWithSearchTrigger('///relatorio', cfg)).toBe(true);
  });

  it('does not flag an ordinary shortcut', () => {
    expect(shortcutConflictsWithSearchTrigger('relatorio', cfg)).toBe(false);
  });

  it('never flags anything while the search trigger is disabled', () => {
    expect(shortcutConflictsWithSearchTrigger('//relatorio', { ...cfg, enabled: false })).toBe(false);
  });

  it('handles a missing/undefined config defensively', () => {
    expect(shortcutConflictsWithSearchTrigger('//relatorio', undefined)).toBe(false);
  });

  it('does not flag an empty shortcut', () => {
    expect(shortcutConflictsWithSearchTrigger('', cfg)).toBe(false);
  });
});
