import { describe, it, expect } from 'vitest';
import { generateId, normalizeHostLike, matchesDomainPattern, domainMatchesAny } from '../../shared/storage/helpers.js';

// ---------------------------------------------------------------------------
// generateId
// ---------------------------------------------------------------------------
describe('generateId', () => {
  it('100 chamadas produzem 100 valores únicos', () => {
    const ids = new Set<string>();
    for (let i = 0; i < 100; i++) ids.add(generateId());
    expect(ids.size).toBe(100);
  });
});

// ---------------------------------------------------------------------------
// normalizeHostLike
// ---------------------------------------------------------------------------
describe('normalizeHostLike', () => {
  it('trim + lowercase', () => {
    expect(normalizeHostLike('  GOOGLE.COM  ')).toBe('google.com');
  });

  it('remove protocolo http', () => {
    expect(normalizeHostLike('http://google.com')).toBe('google.com');
  });

  it('remove protocolo https', () => {
    expect(normalizeHostLike('https://www.google.com')).toBe('www.google.com');
  });

  it('remove protocolo ftp', () => {
    expect(normalizeHostLike('ftp://files.example.com')).toBe('files.example.com');
  });

  it('remove userinfo', () => {
    expect(normalizeHostLike('user:pass@example.com')).toBe('example.com');
  });

  it('remove path', () => {
    expect(normalizeHostLike('https://www.mail.google.com/u/0/')).toBe('www.mail.google.com');
  });

  it('remove query string', () => {
    expect(normalizeHostLike('example.com?q=test')).toBe('example.com');
  });

  it('remove hash', () => {
    expect(normalizeHostLike('example.com#section')).toBe('example.com');
  });

  it('remove porta', () => {
    expect(normalizeHostLike('site.com:8080')).toBe('site.com');
  });

  it('remove trailing dot FQDN', () => {
    expect(normalizeHostLike('google.com.')).toBe('google.com');
  });

  it('vazio retorna vazio', () => {
    expect(normalizeHostLike('')).toBe('');
    expect(normalizeHostLike('   ')).toBe('');
  });

  it('preserva wildcards', () => {
    expect(normalizeHostLike('*.google.com')).toBe('*.google.com');
    expect(normalizeHostLike('*google*')).toBe('*google*');
  });
});

// ---------------------------------------------------------------------------
// matchesDomainPattern
// ---------------------------------------------------------------------------
describe('matchesDomainPattern', () => {
  // --- Exact match ---
  it('match exato: www.mail.google.com', () => {
    expect(matchesDomainPattern('www.mail.google.com', 'www.mail.google.com')).toBe(true);
  });

  it('match exato: não casa parcial (google.com ≠ notgoogle.com)', () => {
    expect(matchesDomainPattern('notgoogle.com', 'google.com')).toBe(false);
  });

  // --- Protocol stripping ---
  it('protocolo no padrão: https://www.mail.google.com', () => {
    expect(matchesDomainPattern('www.mail.google.com', 'https://www.mail.google.com')).toBe(true);
  });

  // --- Path stripping ---
  it('path no padrão: https://www.mail.google.com/u/0/', () => {
    expect(matchesDomainPattern('www.mail.google.com', 'https://www.mail.google.com/u/0/')).toBe(true);
  });

  // --- Wildcard prefix: *.google.com ---
  it('*.google.com casa com www.google.com', () => {
    expect(matchesDomainPattern('www.google.com', '*.google.com')).toBe(true);
  });

  it('*.google.com casa com mail.google.com', () => {
    expect(matchesDomainPattern('mail.google.com', '*.google.com')).toBe(true);
  });

  it('*.google.com NÃO casa com google.com (exige algo antes do ponto)', () => {
    expect(matchesDomainPattern('google.com', '*.google.com')).toBe(false);
  });

  // --- Wildcard prefix without dot: *google.com ---
  it('*google.com casa com google.com (* = vazio)', () => {
    expect(matchesDomainPattern('google.com', '*google.com')).toBe(true);
  });

  it('*google.com casa com www.google.com', () => {
    expect(matchesDomainPattern('www.google.com', '*google.com')).toBe(true);
  });

  // --- Wildcard suffix: mail.google.* ---
  it('mail.google.* casa com mail.google.com.br', () => {
    expect(matchesDomainPattern('mail.google.com.br', 'mail.google.*')).toBe(true);
  });

  it('mail.google.* casa com mail.google.com', () => {
    expect(matchesDomainPattern('mail.google.com', 'mail.google.*')).toBe(true);
  });

  // --- Wildcard both sides: *mail.google.* ---
  it('*mail.google.* casa com www.mail.google.co.uk', () => {
    expect(matchesDomainPattern('www.mail.google.co.uk', '*mail.google.*')).toBe(true);
  });

  // --- Free-form wildcard: *google* ---
  it('*google* casa com www.google.com', () => {
    expect(matchesDomainPattern('www.google.com', '*google*')).toBe(true);
  });

  it('*google* casa com notgoogle.evil.com (intencional — wildcard livre)', () => {
    expect(matchesDomainPattern('notgoogle.evil.com', '*google*')).toBe(true);
  });

  // --- Catch-all * ---
  it('* casa com qualquer hostname', () => {
    expect(matchesDomainPattern('anything.example.com', '*')).toBe(true);
  });

  // --- Consecutive asterisks collapsed ---
  it('**google** (asteriscos duplicados) casa com google.com', () => {
    expect(matchesDomainPattern('google.com', '**google**')).toBe(true);
  });

  // --- Case insensitive ---
  it('case insensitive: GOOGLE.COM no padrão, google.com no host', () => {
    expect(matchesDomainPattern('google.com', 'GOOGLE.COM')).toBe(true);
  });

  it('case insensitive: google.com no padrão, GOOGLE.COM no host', () => {
    expect(matchesDomainPattern('GOOGLE.COM', 'google.com')).toBe(true);
  });

  // --- FQDN trailing dot ---
  it('google.com. (FQDN) casa com google.com', () => {
    expect(matchesDomainPattern('google.com', 'google.com.')).toBe(true);
  });

  // --- Port stripping ---
  it('site.com:8080 no padrão casa com site.com', () => {
    expect(matchesDomainPattern('site.com', 'site.com:8080')).toBe(true);
  });

  // --- Empty pattern / hostname = never matches ---
  it('padrão vazio nunca casa', () => {
    expect(matchesDomainPattern('anything.com', '')).toBe(false);
  });

  it('hostname vazio nunca casa', () => {
    expect(matchesDomainPattern('', 'google.com')).toBe(false);
  });

  it('ambos vazios nunca casam', () => {
    expect(matchesDomainPattern('', '')).toBe(false);
  });

  // --- ? wildcard (single character, only active when * is also present) ---
  // ? is only treated as a glob wildcard when the pattern also contains *,
  // because bare ? is ambiguous with the URL query-string separator.
  it('*b?c.* casa com a.bXc.com (? = 1 char wildcard when * present)', () => {
    expect(matchesDomainPattern('a.bXc.com', '*b?c.*')).toBe(true);
  });

  it('*b?c.* NÃO casa com a.bc.com (? exige exatamente 1 char)', () => {
    expect(matchesDomainPattern('a.bc.com', '*b?c.*')).toBe(false);
  });

  it('*b?c.* NÃO casa com a.bXXc.com (? = apenas 1 char)', () => {
    expect(matchesDomainPattern('a.bXXc.com', '*b?c.*')).toBe(false);
  });

  // --- Dot is literal, not regex "any char" ---
  it('. no padrão é literal (google.com não casa com googleXcom)', () => {
    expect(matchesDomainPattern('googleXcom', 'google.com')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// domainMatchesAny (array wrapper)
// ---------------------------------------------------------------------------
describe('domainMatchesAny', () => {
  it('match contra múltiplos padrões', () => {
    const patterns = ['example.com', '*.banco.com', '*google*'];
    expect(domainMatchesAny('app.banco.com', patterns)).toBe(true);
    expect(domainMatchesAny('google.com', patterns)).toBe(true);
    expect(domainMatchesAny('example.com', patterns)).toBe(true);
    expect(domainMatchesAny('yahoo.com', patterns)).toBe(false);
  });

  it('array vazio nunca casa', () => {
    expect(domainMatchesAny('google.com', [])).toBe(false);
  });

  it('isBlocklisted legacy: *.banco.com casa com app.banco.com', () => {
    expect(domainMatchesAny('app.banco.com', ['*.banco.com'])).toBe(true);
  });

  it('isBlocklisted legacy: *.banco.com NÃO casa com banco.com', () => {
    expect(domainMatchesAny('banco.com', ['*.banco.com'])).toBe(false);
  });

  it('isBlocklisted legacy: match exato gmail.com', () => {
    expect(domainMatchesAny('gmail.com', ['gmail.com'])).toBe(true);
  });
});
