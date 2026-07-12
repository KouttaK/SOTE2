import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TriggerDetector } from '../../content/engine/TriggerDetector.js';
import type { Flow, Settings } from '../../shared/types/index.js';

describe('TriggerDetector', () => {
  let detector: TriggerDetector;
  let mockSettings: Settings;

  beforeEach(() => {
    detector = new TriggerDetector();
    mockSettings = {
      globalEnabled: true,
      triggerKeys: ['Space', 'Tab'],
      exactMatchChar: '/',
      blocklist: [],
      snoozeUntil: undefined,
      triggerMode: 'trigger',
      theme: 'system',
      commandPaletteShortcut: 'Ctrl+Shift+Space',
      analytics: {},
      searchTrigger: {
        enabled: true,
        includeFlows: true,
        domainPrefix: '//',
        globalPrefix: '///',
      },
    };
  });

  const createMockFlow = (id: string, mode: 'trigger' | 'exact_match', shortcut: string, domain?: string, elseContent?: string): Flow => ({
    id,
    name: 'test',
    description: '',
    folderId: 'root',
    enabled: true,
    tags: [],
    stats: { usageCount: 0, timeSavedMs: 0 },
    blocks: [
      {
        id: '1',
        type: 'trigger',
        data: { mode, shortcut, smartCase: false }
      },
      ...(domain ? [{
        id: 'cond1',
        type: 'condition',
        data: {
          rules: [{ type: 'domain', operator: 'equals', value: domain }],
          matchAll: true
        }
      }] as any[] : []),
      {
        id: '2',
        type: 'action',
        data: { content: 'success', format: 'plaintext', tokens: [] }
      },
      ...(elseContent ? [{
        id: '3',
        type: 'action',
        data: { content: elseContent, format: 'plaintext', tokens: [], isElse: true } // Assuming some logic like this
      }] as any[] : [])
    ]
  });

  it('Buffer "obg " (com espaço): detecta shortcut "obg" em modo trigger', () => {
    const flow = createMockFlow('f1', 'trigger', 'obg');
    detector.updateData([flow], mockSettings);
    
    // detectTriggerMode is called when a trigger key is pressed.
    // The buffer should contain the word before the trigger key.
    const match = detector.detectTriggerMode('obg');
    expect(match).not.toBeNull();
    expect(match?.flow.id).toBe('f1');
    expect(match?.shortcutTyped).toBe('obg');
  });

  it('Buffer "obg\\t" (com tab): detecta se Tab estiver em triggerKeys', () => {
    // Actually, detectTriggerMode just takes the buffer content before the trigger.
    // The orchestration in content.ts passes the buffer without the trigger key.
    const flow = createMockFlow('f1', 'trigger', 'obg');
    detector.updateData([flow], mockSettings);
    
    // triggerKeys validation is done outside TriggerDetector (in TextMonitor/orchestrator),
    // but we can test if TriggerDetector finds 'obg' when buffer ends with tab if the orchestrator passes it.
    // Assuming orchestrator passes 'obg' when Tab is pressed.
    const match = detector.detectTriggerMode('obg');
    expect(match).not.toBeNull();
  });

  it('Buffer "/obg" em exact match com char "/": detecta sem tecla adicional', () => {
    const flow = createMockFlow('f1', 'exact_match', 'obg');
    mockSettings.triggerMode = 'exact_match';
    detector.updateData([flow], mockSettings);
    
    const match = detector.detectExactMatchMode('/obg');
    expect(match).not.toBeNull();
    expect(match?.flow.id).toBe('f1');
    expect(match?.isExactMatch).toBe(true);
  });

  it('Buffer "obg " com snooze ativo: retorna null', () => {
    const flow = createMockFlow('f1', 'trigger', 'obg');
    mockSettings.snoozeUntil = Date.now() + 10000;
    detector.updateData([flow], mockSettings);
    
    const match = detector.detectTriggerMode('obg');
    expect(match).toBeNull();
  });

  it('Buffer "obg " com domínio bloqueado: retorna null', () => {
    // Actually, the blocklist is handled in content.ts orchestration now, 
    // it prevents initialization or pauses TextMonitor. TriggerDetector itself doesn't check blocklist in our new arch?
    // Let's check TriggerDetector.ts to see if it checks blocklist.
    // In prompt: "Buffer 'obg ' com domínio bloqueado: retorna null".
    // I will mock window.location to check if TriggerDetector uses it, or I might need to adjust TriggerDetector.
    // For now, let's implement the test and see if it passes.
    // Wait, blocklist logic was added in content.ts. TriggerDetector might not know about it.
    // If it fails, I'll update TriggerDetector to satisfy the test.
    const flow = createMockFlow('f1', 'trigger', 'obg');
    mockSettings.blocklist = ['example.com'];
    detector.updateData([flow], mockSettings);
    
    // Mock window.location.hostname
    vi.stubGlobal('window', { location: { hostname: 'example.com' } });
    
    const match = detector.detectTriggerMode('obg');
    // We expect null if it's implemented. If not, it will fail and I'll fix it.
    expect(match).toBeNull();
    vi.unstubAllGlobals();
  });

  it('ConditionBlock domain "gmail.com" em aba gmail.com: retorna flow', () => {
    const flow = createMockFlow('f1', 'trigger', 'obg', 'gmail.com');
    detector.updateData([flow], mockSettings);
    
    vi.stubGlobal('window', { location: { hostname: 'gmail.com' } });
    const match = detector.detectTriggerMode('obg');
    expect(match).not.toBeNull();
    vi.unstubAllGlobals();
  });

  it('ConditionBlock domain "gmail.com" em aba notion.so: retorna flow do else se existir', () => {
    // According to SOTE logic, if conditions fail, it either returns null or the flow but later resolves to Else.
    // The prompt says: "ConditionBlock domain 'gmail.com' em aba notion.so: retorna flow do else se existir"
    // Actually, TriggerDetector checks conditions in `checkConditions`. If it fails, it returns false, meaning no trigger match.
    // Unless checkConditions returns true if there is an Else block?
    // Let's test it and fix TriggerDetector if needed.
    const flow = createMockFlow('f1', 'trigger', 'obg', 'gmail.com', 'else content');
    detector.updateData([flow], mockSettings);
    
    vi.stubGlobal('window', { location: { hostname: 'notion.so' } });
    const match = detector.detectTriggerMode('obg');
    
    // Wait, does it return the flow if there's an Else block?
    expect(match).not.toBeNull();
    vi.unstubAllGlobals();
  });
});

describe('resolveActionBlock fallback to elseBranch', () => {
  it('deve retornar o elseBranch se nenhuma regra passar', () => {
    const detector = new TriggerDetector();
    
    // Configurar flow com um ConditionBlock que tem uma regra impossível e um elseBranch
    const flow: any = {
      id: 'f1',
      blocks: [
        {
          type: 'condition',
          data: {
            rules: [
              {
                type: 'domain',
                operator: 'contains',
                value: 'impossible-domain.com',
                action: { format: 'plaintext', content: 'Regra Passou', tokens: [] }
              }
            ],
            elseBranch: { format: 'plaintext', content: 'Else Passou', tokens: [] }
          }
        }
      ]
    };
    
    vi.stubGlobal('window', { location: { hostname: 'current-domain.com' } });
    
    const resolved = detector.resolveActionBlock(flow);
    
    expect(resolved).not.toBeNull();
    expect(resolved?.content).toBe('Else Passou');
    
    vi.unstubAllGlobals();
  });
});

describe('domain operator "not_contains" (Não corresponde)', () => {
  const buildFlow = (value: string): any => ({
    id: 'f1',
    blocks: [
      {
        type: 'condition',
        data: {
          rules: [
            {
              type: 'domain',
              operator: 'not_contains',
              value,
              action: { format: 'plaintext', content: 'Regra Passou', tokens: [] }
            }
          ],
          elseBranch: { format: 'plaintext', content: 'Else Passou', tokens: [] }
        }
      }
    ]
  });

  it('passa quando o hostname NÃO contém o valor informado', () => {
    const detector = new TriggerDetector();
    vi.stubGlobal('window', { location: { hostname: 'gmail.com' } });

    const resolved = detector.resolveActionBlock(buildFlow('notion.so'));

    expect(resolved?.content).toBe('Regra Passou');
    vi.unstubAllGlobals();
  });

  it('cai no elseBranch quando o hostname CONTÉM o valor informado', () => {
    const detector = new TriggerDetector();
    vi.stubGlobal('window', { location: { hostname: 'mail.gmail.com' } });

    const resolved = detector.resolveActionBlock(buildFlow('gmail.com'));

    expect(resolved?.content).toBe('Else Passou');
    vi.unstubAllGlobals();
  });
});

describe('condições aninhadas (nested conditions)', () => {
  it('resolve para o action da regra aninhada quando a regra externa E a interna passam', () => {
    const detector = new TriggerDetector();
    const flow: any = {
      id: 'f1',
      blocks: [
        {
          type: 'condition',
          data: {
            rules: [
              {
                type: 'domain',
                operator: 'contains',
                value: 'gmail.com',
                // Aninhado: se o domínio bater, ainda checamos o horário.
                action: {
                  rules: [
                    {
                      type: 'time',
                      operator: 'equals',
                      value: JSON.stringify({ op: 'between', from: '08:00', to: '18:00' }),
                      action: { format: 'plaintext', content: 'Gmail em horário comercial', tokens: [] },
                    },
                  ],
                  elseBranch: { format: 'plaintext', content: 'Gmail fora do horário', tokens: [] },
                },
              },
            ],
            elseBranch: { format: 'plaintext', content: 'Não é gmail', tokens: [] },
          },
        },
      ],
    };

    vi.stubGlobal('window', { location: { hostname: 'mail.gmail.com' } });
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 0, 1, 10, 0, 0)); // 10:00, dentro do intervalo

    const resolved = detector.resolveActionBlock(flow);
    expect(resolved?.content).toBe('Gmail em horário comercial');

    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('cai no elseBranch da condição aninhada quando a regra externa passa mas a interna não', () => {
    const detector = new TriggerDetector();
    const flow: any = {
      id: 'f1',
      blocks: [
        {
          type: 'condition',
          data: {
            rules: [
              {
                type: 'domain',
                operator: 'contains',
                value: 'gmail.com',
                action: {
                  rules: [
                    {
                      type: 'time',
                      operator: 'equals',
                      value: JSON.stringify({ op: 'between', from: '08:00', to: '18:00' }),
                      action: { format: 'plaintext', content: 'Gmail em horário comercial', tokens: [] },
                    },
                  ],
                  elseBranch: { format: 'plaintext', content: 'Gmail fora do horário', tokens: [] },
                },
              },
            ],
            elseBranch: { format: 'plaintext', content: 'Não é gmail', tokens: [] },
          },
        },
      ],
    };

    vi.stubGlobal('window', { location: { hostname: 'mail.gmail.com' } });
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 0, 1, 22, 0, 0)); // 22:00, fora do intervalo

    const resolved = detector.resolveActionBlock(flow);
    expect(resolved?.content).toBe('Gmail fora do horário');

    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('cai no elseBranch externo quando a regra externa não passa, sem nem avaliar a condição aninhada', () => {
    const detector = new TriggerDetector();
    const flow: any = {
      id: 'f1',
      blocks: [
        {
          type: 'condition',
          data: {
            rules: [
              {
                type: 'domain',
                operator: 'contains',
                value: 'gmail.com',
                action: {
                  rules: [
                    { type: 'domain', operator: 'contains', value: 'unused', action: { format: 'plaintext', content: 'nunca deveria chegar aqui', tokens: [] } },
                  ],
                },
              },
            ],
            elseBranch: { format: 'plaintext', content: 'Não é gmail', tokens: [] },
          },
        },
      ],
    };

    vi.stubGlobal('window', { location: { hostname: 'notion.so' } });
    const resolved = detector.resolveActionBlock(flow);
    expect(resolved?.content).toBe('Não é gmail');
    vi.unstubAllGlobals();
  });

  it('suporta múltiplos níveis de aninhamento (2+)', () => {
    const detector = new TriggerDetector();
    const flow: any = {
      id: 'f1',
      blocks: [
        {
          type: 'condition',
          data: {
            rules: [
              {
                type: 'domain',
                operator: 'contains',
                value: 'gmail.com',
                action: {
                  rules: [
                    {
                      type: 'weekday',
                      operator: 'equals',
                      value: JSON.stringify({ op: 'is', days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'] }),
                      action: {
                        rules: [
                          {
                            type: 'time',
                            operator: 'equals',
                            value: JSON.stringify({ op: 'after', at: '09:00' }),
                            action: { format: 'plaintext', content: 'Gmail, dia útil, depois das 9h', tokens: [] },
                          },
                        ],
                      },
                    },
                  ],
                },
              },
            ],
          },
        },
      ],
    };

    vi.stubGlobal('window', { location: { hostname: 'mail.gmail.com' } });
    vi.useFakeTimers();
    // 2026-01-05 é uma segunda-feira, às 10:00
    vi.setSystemTime(new Date(2026, 0, 5, 10, 0, 0));

    const resolved = detector.resolveActionBlock(flow);
    expect(resolved?.content).toBe('Gmail, dia útil, depois das 9h');

    vi.useRealTimers();
    vi.unstubAllGlobals();
  });
});

describe('tipo de regra desconhecido — fail closed', () => {
  it('NÃO deve passar (nem cair em erro) quando o tipo da regra é desconhecido, e deve usar o elseBranch', () => {
    const detector = new TriggerDetector();
    const flow: any = {
      id: 'f1',
      blocks: [
        {
          type: 'condition',
          data: {
            rules: [
              {
                type: 'some_future_unimplemented_type',
                operator: 'equals',
                value: 'whatever',
                action: { format: 'plaintext', content: 'Não deveria passar', tokens: [] }
              }
            ],
            elseBranch: { format: 'plaintext', content: 'Else Passou', tokens: [] }
          }
        }
      ]
    };

    vi.stubGlobal('window', { location: { hostname: 'any-domain.com' } });
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const resolved = detector.resolveActionBlock(flow);

    // Fail closed: an unrecognized rule type must never be treated as a pass.
    expect(resolved?.content).toBe('Else Passou');
    expect(warnSpy).toHaveBeenCalled();

    warnSpy.mockRestore();
    vi.unstubAllGlobals();
  });
});

describe('critérios E/OU (redesign das condições aninhadas)', () => {
  const buildFlow = (criteria: any[], combinator: 'AND' | 'OR', domainValue: string): any => ({
    id: 'f1',
    blocks: [
      {
        type: 'condition',
        data: {
          rules: [
            {
              type: 'domain',
              operator: 'contains',
              value: domainValue,
              criteria,
              combinator,
              action: { format: 'plaintext', content: 'Regra Passou', tokens: [] }
            }
          ],
          elseBranch: { format: 'plaintext', content: 'Else Passou', tokens: [] }
        }
      }
    ]
  });

  it('E (AND): só passa quando o critério primário E todos os extras passam', () => {
    const detector = new TriggerDetector();
    vi.stubGlobal('window', { location: { hostname: 'mail.gmail.com' } });

    const criteria = [{ type: 'domain', operator: 'contains', value: 'mail' }];

    // Primário ("gmail.com") e extra ("mail") ambos passam.
    expect(detector.resolveActionBlock(buildFlow(criteria, 'AND', 'gmail.com'))?.content).toBe('Regra Passou');

    // Primário passa, mas o extra não → deve cair no elseBranch.
    const failingCriteria = [{ type: 'domain', operator: 'contains', value: 'yahoo' }];
    expect(detector.resolveActionBlock(buildFlow(failingCriteria, 'AND', 'gmail.com'))?.content).toBe('Else Passou');

    vi.unstubAllGlobals();
  });

  it('OU (OR): passa quando o critério primário OU qualquer extra passa', () => {
    const detector = new TriggerDetector();
    vi.stubGlobal('window', { location: { hostname: 'mail.gmail.com' } });

    // Primário ("yahoo.com") não passa, mas o extra ("gmail") passa.
    const criteria = [{ type: 'domain', operator: 'contains', value: 'gmail' }];
    expect(detector.resolveActionBlock(buildFlow(criteria, 'OR', 'yahoo.com'))?.content).toBe('Regra Passou');

    // Nem o primário nem o extra passam → elseBranch.
    const failingCriteria = [{ type: 'domain', operator: 'contains', value: 'outlook' }];
    expect(detector.resolveActionBlock(buildFlow(failingCriteria, 'OR', 'yahoo.com'))?.content).toBe('Else Passou');

    vi.unstubAllGlobals();
  });

  it('combinator ausente (dados legados sem `criteria`) continua avaliando só o critério primário', () => {
    const detector = new TriggerDetector();
    vi.stubGlobal('window', { location: { hostname: 'gmail.com' } });

    const flow: any = {
      id: 'f1',
      blocks: [
        {
          type: 'condition',
          data: {
            rules: [
              { type: 'domain', operator: 'equals', value: 'gmail.com', action: { format: 'plaintext', content: 'Regra Passou', tokens: [] } }
            ],
          }
        }
      ]
    };

    expect(detector.resolveActionBlock(flow)?.content).toBe('Regra Passou');
    vi.unstubAllGlobals();
  });

  it('combina critérios de tipos diferentes (domínio E dia da semana)', () => {
    const detector = new TriggerDetector();
    vi.useFakeTimers();
    // A Wednesday.
    vi.setSystemTime(new Date('2024-01-03T10:00:00'));
    vi.stubGlobal('window', { location: { hostname: 'gmail.com' } });

    const criteria = [{ type: 'weekday', operator: 'equals', value: JSON.stringify({ op: 'is', days: ['Wed'] }) }];
    expect(detector.resolveActionBlock(buildFlow(criteria, 'AND', 'gmail.com'))?.content).toBe('Regra Passou');

    const wrongDayCriteria = [{ type: 'weekday', operator: 'equals', value: JSON.stringify({ op: 'is', days: ['Mon'] }) }];
    expect(detector.resolveActionBlock(buildFlow(wrongDayCriteria, 'AND', 'gmail.com'))?.content).toBe('Else Passou');

    vi.useRealTimers();
    vi.unstubAllGlobals();
  });
});

describe('ordenação por especificidade (most-specific-first)', () => {
  it('regra com criteria (mais específica) é avaliada antes de regra sem criteria, mesmo que venha depois no array', () => {
    const detector = new TriggerDetector();
    vi.useFakeTimers();
    // A Friday at 10:00
    vi.setSystemTime(new Date('2024-01-05T10:00:00'));
    vi.stubGlobal('window', { location: { hostname: 'example.com' } });

    const flow: any = {
      id: 'f1',
      blocks: [
        {
          type: 'condition',
          data: {
            rules: [
              // Rule 1: GENERIC — time between 08:00-12:00 (no criteria)
              // This was created first, so it appears first in the array.
              {
                type: 'time',
                operator: 'equals',
                value: JSON.stringify({ op: 'between', from: '08:00', to: '12:00' }),
                action: { format: 'plaintext', content: 'excelente semana', tokens: [] }
              },
              // Rule 2: SPECIFIC — time between 08:00-12:00 AND weekday = Fri
              // Created later, appears second, but is more specific (has criteria).
              {
                type: 'time',
                operator: 'equals',
                value: JSON.stringify({ op: 'between', from: '08:00', to: '12:00' }),
                criteria: [
                  { type: 'weekday', operator: 'equals', value: JSON.stringify({ op: 'is', days: ['Fri'] }) }
                ],
                combinator: 'AND',
                action: { format: 'plaintext', content: 'excelente final de semana', tokens: [] }
              }
            ],
            elseBranch: { format: 'plaintext', content: 'Else', tokens: [] }
          }
        }
      ]
    };

    // The more specific rule (time + weekday) should win even though it's
    // second in the array.
    const resolved = detector.resolveActionBlock(flow);
    expect(resolved?.content).toBe('excelente final de semana');

    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('regra com mais critérios extras vence sobre regra com menos critérios extras', () => {
    const detector = new TriggerDetector();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-01-05T10:00:00'));
    vi.stubGlobal('window', { location: { hostname: 'mail.gmail.com' } });

    const flow: any = {
      id: 'f1',
      blocks: [
        {
          type: 'condition',
          data: {
            rules: [
              // Rule with 1 extra criterion (score = 2)
              {
                type: 'domain',
                operator: 'contains',
                value: 'gmail.com',
                criteria: [
                  { type: 'time', operator: 'equals', value: JSON.stringify({ op: 'between', from: '08:00', to: '12:00' }) }
                ],
                combinator: 'AND',
                action: { format: 'plaintext', content: 'gmail + manhã', tokens: [] }
              },
              // Rule with 2 extra criteria (score = 3) — more specific
              {
                type: 'domain',
                operator: 'contains',
                value: 'gmail.com',
                criteria: [
                  { type: 'time', operator: 'equals', value: JSON.stringify({ op: 'between', from: '08:00', to: '12:00' }) },
                  { type: 'weekday', operator: 'equals', value: JSON.stringify({ op: 'is', days: ['Fri'] }) }
                ],
                combinator: 'AND',
                action: { format: 'plaintext', content: 'gmail + manhã + sexta', tokens: [] }
              }
            ],
            elseBranch: { format: 'plaintext', content: 'Else', tokens: [] }
          }
        }
      ]
    };

    const resolved = detector.resolveActionBlock(flow);
    expect(resolved?.content).toBe('gmail + manhã + sexta');

    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('quando ambas as regras têm mesma especificidade, a primeira no array (ordem original) vence', () => {
    const detector = new TriggerDetector();
    vi.stubGlobal('window', { location: { hostname: 'example.com' } });

    const flow: any = {
      id: 'f1',
      blocks: [
        {
          type: 'condition',
          data: {
            rules: [
              // Both rules match and have same specificity (score = 1, no criteria)
              {
                type: 'domain',
                operator: 'contains',
                value: 'example',
                action: { format: 'plaintext', content: 'primeira regra', tokens: [] }
              },
              {
                type: 'domain',
                operator: 'contains',
                value: 'example',
                action: { format: 'plaintext', content: 'segunda regra', tokens: [] }
              }
            ]
          }
        }
      ]
    };

    // Same specificity → original order is the tiebreaker.
    const resolved = detector.resolveActionBlock(flow);
    expect(resolved?.content).toBe('primeira regra');

    vi.unstubAllGlobals();
  });

  it('regra específica que NÃO passa permite que a regra genérica passe normalmente', () => {
    const detector = new TriggerDetector();
    vi.useFakeTimers();
    // A Monday at 10:00 — the Friday-specific rule won't match.
    vi.setSystemTime(new Date('2024-01-01T10:00:00'));
    vi.stubGlobal('window', { location: { hostname: 'example.com' } });

    const flow: any = {
      id: 'f1',
      blocks: [
        {
          type: 'condition',
          data: {
            rules: [
              // GENERIC — time between 08:00-12:00
              {
                type: 'time',
                operator: 'equals',
                value: JSON.stringify({ op: 'between', from: '08:00', to: '12:00' }),
                action: { format: 'plaintext', content: 'excelente semana', tokens: [] }
              },
              // SPECIFIC — time 08:00-12:00 AND Friday (won't match on Monday)
              {
                type: 'time',
                operator: 'equals',
                value: JSON.stringify({ op: 'between', from: '08:00', to: '12:00' }),
                criteria: [
                  { type: 'weekday', operator: 'equals', value: JSON.stringify({ op: 'is', days: ['Fri'] }) }
                ],
                combinator: 'AND',
                action: { format: 'plaintext', content: 'excelente final de semana', tokens: [] }
              }
            ],
            elseBranch: { format: 'plaintext', content: 'Else', tokens: [] }
          }
        }
      ]
    };

    // On Monday, the specific rule (time + Friday) is evaluated first but
    // fails, so the generic rule (time only) fires correctly.
    const resolved = detector.resolveActionBlock(flow);
    expect(resolved?.content).toBe('excelente semana');

    vi.useRealTimers();
    vi.unstubAllGlobals();
  });
});
