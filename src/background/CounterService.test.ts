import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  CounterService,
  checkCounterNeedsReset,
  isSameCivilDay,
  isSameCivilMonth,
  isSameCivilYear,
} from './CounterService.js';
import type { Counter } from '../shared/types/index.js';

vi.mock('wxt/browser', () => {
  let storageState: Record<string, any> = {};
  return {
    browser: {
      storage: {
        local: {
          get: vi.fn(async (key: string) => {
            return { [key]: storageState[key] ? JSON.parse(JSON.stringify(storageState[key])) : [] };
          }),
          set: vi.fn(async (obj: Record<string, any>) => {
            for (const [k, v] of Object.entries(obj)) {
              storageState[k] = JSON.parse(JSON.stringify(v));
            }
          }),
        },
      },
    },
    __resetStorage: (state: Record<string, any> = {}) => {
      storageState = JSON.parse(JSON.stringify(state));
    },
  };
});

describe('CounterService - checkCounterNeedsReset (Civil Date Components & Direction)', () => {
  describe('Regra Diária (resetRule === "day")', () => {
    it('mesmo dia civil com horários diferentes: NÃO reseta', () => {
      const morning = new Date(2026, 9, 2, 8, 30, 0); // 02/10/2026 08:30
      const afternoon = new Date(2026, 9, 2, 16, 45, 0); // 02/10/2026 16:45

      expect(isSameCivilDay(afternoon, morning)).toBe(true);
      expect(checkCounterNeedsReset('day', morning.getTime(), afternoon)).toBe(false);
    });

    it('avançar exatamente 1 dia civil: DEVE resetar', () => {
      const day1 = new Date(2026, 9, 2, 10, 0, 0); // 02/10/2026
      const day2 = new Date(2026, 9, 3, 10, 0, 0); // 03/10/2026

      expect(isSameCivilDay(day2, day1)).toBe(false);
      expect(checkCounterNeedsReset('day', day1.getTime(), day2)).toBe(true);
    });

    it('avançar múltiplos dias civis: DEVE resetar', () => {
      const day1 = new Date(2026, 9, 2, 10, 0, 0); // 02/10/2026
      const day5 = new Date(2026, 9, 7, 11, 0, 0); // 07/10/2026

      expect(checkCounterNeedsReset('day', day1.getTime(), day5)).toBe(true);
    });

    it('transição de fim de mês: 31 de Outubro para 01 de Novembro DEVE resetar', () => {
      const endOfMonth = new Date(2026, 9, 31, 23, 50, 0); // 31/10/2026
      const nextMonth = new Date(2026, 10, 1, 0, 10, 0); // 01/11/2026

      expect(checkCounterNeedsReset('day', endOfMonth.getTime(), nextMonth)).toBe(true);
    });

    it('transição de fim de ano: 31 de Dezembro para 01 de Janeiro DEVE resetar', () => {
      const endOfYear = new Date(2026, 11, 31, 23, 59, 0); // 31/12/2026
      const newYear = new Date(2027, 0, 1, 0, 1, 0); // 01/01/2027

      expect(checkCounterNeedsReset('day', endOfYear.getTime(), newYear)).toBe(true);
    });

    it('DIREÇÃO: voltar a data para um dia anterior (retroceder relógio): NÃO DEVE resetar', () => {
      const advancedDay = new Date(2026, 9, 3, 10, 0, 0); // 03/10/2026
      const returnedDay = new Date(2026, 9, 2, 10, 0, 0); // 02/10/2026

      // now < lastUsed: o relógio retrocedeu, não é um novo dia cronológico
      expect(checkCounterNeedsReset('day', advancedDay.getTime(), returnedDay)).toBe(false);
    });

    it('DIREÇÃO: voltar o relógio para horário anterior dentro do mesmo dia: NÃO reseta', () => {
      const laterToday = new Date(2026, 9, 2, 15, 0, 0);
      const earlierToday = new Date(2026, 9, 2, 11, 0, 0);

      expect(checkCounterNeedsReset('day', laterToday.getTime(), earlierToday)).toBe(false);
    });
  });

  describe('Regra Mensal (resetRule === "month")', () => {
    it('mesmo mês com dias diferentes: NÃO reseta', () => {
      const day1 = new Date(2026, 9, 5, 10, 0, 0);
      const day25 = new Date(2026, 9, 25, 12, 0, 0);

      expect(isSameCivilMonth(day25, day1)).toBe(true);
      expect(checkCounterNeedsReset('month', day1.getTime(), day25)).toBe(false);
    });

    it('avançar para o próximo mês: DEVE resetar', () => {
      const oct = new Date(2026, 9, 30, 10, 0, 0);
      const nov = new Date(2026, 10, 1, 10, 0, 0);

      expect(isSameCivilMonth(nov, oct)).toBe(false);
      expect(checkCounterNeedsReset('month', oct.getTime(), nov)).toBe(true);
    });

    it('mesmo índice de mês no ano seguinte: DEVE resetar', () => {
      const oct2026 = new Date(2026, 9, 15, 10, 0, 0);
      const oct2027 = new Date(2027, 9, 15, 10, 0, 0);

      expect(isSameCivilMonth(oct2027, oct2026)).toBe(false);
      expect(checkCounterNeedsReset('month', oct2026.getTime(), oct2027)).toBe(true);
    });

    it('DIREÇÃO: retroceder para mês anterior: NÃO DEVE resetar', () => {
      const nov = new Date(2026, 10, 5, 10, 0, 0);
      const oct = new Date(2026, 9, 25, 10, 0, 0);

      expect(checkCounterNeedsReset('month', nov.getTime(), oct)).toBe(false);
    });
  });

  describe('Regra Anual (resetRule === "year")', () => {
    it('mesmo ano civil: NÃO reseta', () => {
      const startOfYear = new Date(2026, 0, 15, 10, 0, 0);
      const endOfYear = new Date(2026, 11, 20, 10, 0, 0);

      expect(isSameCivilYear(endOfYear, startOfYear)).toBe(true);
      expect(checkCounterNeedsReset('year', startOfYear.getTime(), endOfYear)).toBe(false);
    });

    it('avançar para o próximo ano: DEVE resetar', () => {
      const year2026 = new Date(2026, 11, 31, 23, 0, 0);
      const year2027 = new Date(2027, 0, 1, 9, 0, 0);

      expect(isSameCivilYear(year2027, year2026)).toBe(false);
      expect(checkCounterNeedsReset('year', year2026.getTime(), year2027)).toBe(true);
    });

    it('DIREÇÃO: retroceder para ano anterior: NÃO DEVE resetar', () => {
      const year2027 = new Date(2027, 5, 1, 10, 0, 0);
      const year2026 = new Date(2026, 5, 1, 10, 0, 0);

      expect(checkCounterNeedsReset('year', year2027.getTime(), year2026)).toBe(false);
    });
  });

  describe('Casos de Borda e "never"', () => {
    it('resetRule === "never": nunca reseta mesmo após anos', () => {
      const past = new Date(2020, 0, 1, 0, 0, 0);
      const future = new Date(2026, 9, 2, 10, 0, 0);

      expect(checkCounterNeedsReset('never', past.getTime(), future)).toBe(false);
    });

    it('lastUsedAt ausente (undefined): retorna false', () => {
      expect(checkCounterNeedsReset('day', undefined, new Date())).toBe(false);
      expect(checkCounterNeedsReset('month', undefined, new Date())).toBe(false);
      expect(checkCounterNeedsReset('year', undefined, new Date())).toBe(false);
    });
  });
});

describe('CounterService - Integração reserveCounter com regras de reinício', () => {
  const service = CounterService.getInstance();
  const counterId = 'cnt_test_daily';

  const createInitialCounter = (lastUsedDate?: Date): Counter => ({
    id: counterId,
    name: 'Protocolo Diário',
    format: 'PROT-{contador}',
    startValue: 1,
    currentValue: 1,
    step: 1,
    resetRule: 'day',
    scope: 'global',
    padLength: 4,
    lastUsedAt: lastUsedDate ? lastUsedDate.getTime() : undefined,
  });

  beforeEach(() => {
    vi.useRealTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('cenário reportado pelo usuário: avançar 1 dia reseta; voltar data para dia já usado NÃO reseta de novo', async () => {
    const { browser, __resetStorage } = (await import('wxt/browser')) as any;

    // Dia 1: 02/10/2026
    const day1Date = new Date(2026, 9, 2, 10, 0, 0);
    vi.setSystemTime(day1Date);

    // Inicializa storage com contador criado hoje
    const initial = createInitialCounter(day1Date);
    __resetStorage({ counters: [initial] });

    // 1ª expansão no Dia 1: deve emitir startValue (1) e avançar para 2
    const res1 = await service.reserveCounter(counterId, 'always', 'visible');
    expect(res1.reservedValue).toBe(1);

    // 2ª expansão no Dia 1: mesmo dia, não reseta, emite 2 e avança para 3
    const res2 = await service.reserveCounter(counterId, 'always', 'visible');
    expect(res2.reservedValue).toBe(2);

    // PASSO DE TESTE: Avançar o relógio exatamente 1 dia para 03/10/2026
    const day2Date = new Date(2026, 9, 3, 10, 0, 0);
    vi.setSystemTime(day2Date);

    // 3ª expansão no Dia 2: novo dia civil detectado -> DEVE RESETAR para startValue (1)
    const res3 = await service.reserveCounter(counterId, 'always', 'visible');
    expect(res3.reservedValue).toBe(1);

    // 4ª expansão no Dia 2: mesmo dia 2, não reseta, emite 2 e avança para 3
    const res4 = await service.reserveCounter(counterId, 'always', 'visible');
    expect(res4.reservedValue).toBe(2);

    // PASSO DE TESTE: Voltar o relógio para o Dia 1 (02/10/2026)
    vi.setSystemTime(day1Date);

    // 5ª expansão com relógio voltado: o relógio retrocedeu no tempo -> NÃO DEVE RESETAR inesperadamente!
    // Continua de onde o contador estava (3)
    const res5 = await service.reserveCounter(counterId, 'always', 'visible');
    expect(res5.reservedValue).toBe(3);
  });
});
