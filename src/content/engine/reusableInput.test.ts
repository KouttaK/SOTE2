/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { resolveActionBlockContent } from './ActionContentResolver.js';
import { SessionStore } from './SessionStore.js';
import { SessionService } from '../../background/SessionService.js';
import { TokenPill } from '../../dashboard/components/tokens/TokenPill.js';
import type { ActionBlock, Token } from '../../shared/types/index.js';

describe('Subtarefa 3.1: Reusable Input Tokens (Session Variables) Integration Tests', () => {
  let store: SessionStore;
  let sessionService: SessionService;
  let dummyElement: HTMLElement;

  beforeEach(() => {
    store = SessionStore.getInstance();
    store.reset();
    sessionService = SessionService.getInstance();
    sessionService.resetAll();

    dummyElement = document.createElement('div');
    document.body.appendChild(dummyElement);
  });

  afterEach(() => {
    document.body.innerHTML = '';
    vi.clearAllMocks();
  });

  it('Cenário 1 & 2: Fluxo A salva valor na sessão -> Fluxo B na mesma aba reutiliza com confirmação (pré-preenchido)', async () => {
    const choicePopupMock = {
      showForToken: vi.fn(),
    } as any;

    // Token do Fluxo A: Input com "Lembrar valor nesta sessão"
    const tokenA: Token = {
      id: 'tok_a',
      type: 'input',
      config: {
        label: 'Nome do Cliente',
        rememberValue: true,
        sessionVarName: 'nome_cliente',
        scope: 'tab',
      },
    };

    const actionA: ActionBlock = {
      format: 'plain',
      content: `Olá, ${TokenPill.createHTML(tokenA)}! Como posso ajudar?`,
      tokens: [tokenA],
    };

    // 1. Executa Fluxo A: Popup solicita ao usuário -> usuário digita "Lucas Silva"
    choicePopupMock.showForToken.mockResolvedValueOnce('Lucas Silva');

    const resultA = await resolveActionBlockContent(actionA, dummyElement, {
      choicePopup: choicePopupMock,
      variables: [],
      context: { tabUrl: 'https://crm.local/ticket/1', tabTitle: 'Atendimento' },
    });

    expect(resultA).not.toBeNull();
    expect(resultA!.content).toBe('Olá, Lucas Silva! Como posso ajudar?');
    expect(choicePopupMock.showForToken).toHaveBeenCalledTimes(1);

    // Confirma que o valor foi salvo no SessionStore
    const savedInStore = await store.getSessionVariable('nome_cliente', 'tab');
    expect(savedInStore).toBe('Lucas Silva');

    // Token do Fluxo B: Usa a mesma variável "nome_cliente" com padrão "Sempre confirmar" (autoApply: false)
    const tokenB: Token = {
      id: 'tok_b',
      type: 'input',
      config: {
        label: 'Cliente',
        rememberValue: true,
        sessionVarName: 'nome_cliente',
        scope: 'tab',
        autoApply: false,
      },
    };

    const actionB: ActionBlock = {
      format: 'plain',
      content: `Até logo, ${TokenPill.createHTML(tokenB)}! Tenha um ótimo dia.`,
      tokens: [tokenB],
    };

    // 2. Executa Fluxo B: Popup abre JÁ PRÉ-PREENCHIDO com "Lucas Silva"
    choicePopupMock.showForToken.mockImplementation(async (_token: any, _el: any, _vars: any, prefill: string) => {
      // Usuário apenas bateu Enter para confirmar o valor pré-preenchido
      return prefill;
    });

    const resultB = await resolveActionBlockContent(actionB, dummyElement, {
      choicePopup: choicePopupMock,
      variables: [],
      context: { tabUrl: 'https://crm.local/ticket/1', tabTitle: 'Atendimento' },
    });

    expect(resultB).not.toBeNull();
    expect(resultB!.content).toBe('Até logo, Lucas Silva! Tenha um ótimo dia.');
    // Verifica que o 4º argumento de showForToken foi "Lucas Silva" (pré-preenchimento)
    expect(choicePopupMock.showForToken).toHaveBeenLastCalledWith(
      expect.anything(),
      expect.anything(),
      expect.anything(),
      'Lucas Silva'
    );
  });

  it('Cenário 3: Fluxo com autoApply=true aplica valor diretamente SEM abrir popup', async () => {
    // Salva previamente na sessão
    await store.setSessionVariable('nome_cliente', 'Ana Costa', 'tab');

    const choicePopupMock = {
      showForToken: vi.fn(),
    } as any;

    const tokenDirect: Token = {
      id: 'tok_direct',
      type: 'input',
      config: {
        label: 'Nome',
        rememberValue: true,
        sessionVarName: 'nome_cliente',
        scope: 'tab',
        autoApply: true,
      },
    };

    const actionDirect: ActionBlock = {
      format: 'plain',
      content: `Assinado por ${TokenPill.createHTML(tokenDirect)}.`,
      tokens: [tokenDirect],
    };

    const result = await resolveActionBlockContent(actionDirect, dummyElement, {
      choicePopup: choicePopupMock,
      variables: [],
      context: { tabUrl: 'https://site.com', tabTitle: 'Doc' },
    });

    expect(result).not.toBeNull();
    expect(result!.content).toBe('Assinado por Ana Costa.');
    // Zero chamadas ao popup — velocidade máxima!
    expect(choicePopupMock.showForToken).not.toHaveBeenCalled();
  });

  it('Cenário 4: Múltiplos tokens com a MESMA variável de sessão no MESMO fluxo perguntam apenas uma vez', async () => {
    const choicePopupMock = {
      showForToken: vi.fn(),
    } as any;

    const token1: Token = {
      id: 'tok_rep_1',
      type: 'input',
      config: {
        label: 'Nome do Solicitante',
        rememberValue: true,
        sessionVarName: 'solicitante',
        scope: 'tab',
      },
    };

    const token2: Token = {
      id: 'tok_rep_2',
      type: 'input',
      config: {
        label: 'Nome do Solicitante',
        rememberValue: true,
        sessionVarName: 'solicitante',
        scope: 'tab',
      },
    };

    const actionMulti: ActionBlock = {
      format: 'plain',
      content: `De: ${TokenPill.createHTML(token1)} | Para o registro de: ${TokenPill.createHTML(token2)}`,
      tokens: [token1, token2],
    };

    choicePopupMock.showForToken.mockResolvedValueOnce('Carlos Mendes');

    const result = await resolveActionBlockContent(actionMulti, dummyElement, {
      choicePopup: choicePopupMock,
      variables: [],
      context: { tabUrl: 'https://crm.local', tabTitle: 'Atendimento' },
    });

    expect(result).not.toBeNull();
    expect(result!.content).toBe('De: Carlos Mendes | Para o registro de: Carlos Mendes');
    // Perguntou exatamente UMA vez no popup, mesmo havendo 2 tokens no snippet!
    expect(choicePopupMock.showForToken).toHaveBeenCalledTimes(1);
  });

  it('Cenário 5: Isolamento multi-aba — valor da Aba 1 NÃO vaza para a Aba 2', async () => {
    // Simula Background SessionService atendendo duas abas reais (Tab 1 e Tab 2)
    sessionService.setSessionValue(1, SessionStore.buildKey('cliente', 'tab'), {
      value: 'Cliente da Aba 1',
      savedAt: Date.now(),
    });

    // Aba 2 consulta seus dados
    const tab2Session = sessionService.getSession(2);
    expect(tab2Session[SessionStore.buildKey('cliente', 'tab')]).toBeUndefined();

    // Quando a Aba 2 executa um fluxo com o mesmo nome, o popup abre vazio (não vazou nada da Aba 1)
    const choicePopupMock = {
      showForToken: vi.fn().mockResolvedValue('Cliente da Aba 2'),
    } as any;

    const tokenTab2: Token = {
      id: 'tok_tab2',
      type: 'input',
      config: {
        label: 'Cliente',
        rememberValue: true,
        sessionVarName: 'cliente',
        scope: 'tab',
      },
    };

    const actionTab2: ActionBlock = {
      format: 'plain',
      content: `Atendimento: ${TokenPill.createHTML(tokenTab2)}`,
      tokens: [tokenTab2],
    };

    const result = await resolveActionBlockContent(actionTab2, dummyElement, {
      choicePopup: choicePopupMock,
      variables: [],
      context: { tabUrl: 'https://crm.local', tabTitle: 'Ticket 2' },
    });

    expect(result!.content).toBe('Atendimento: Cliente da Aba 2');
    // Abriu sem prefill
    expect(choicePopupMock.showForToken).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      expect.anything(),
      undefined
    );
  });

  it('Cenário 6: Fechar a aba encerra a sessão e nova aba não reutiliza dados da anterior', async () => {
    // 1. Tab 100 define valor
    sessionService.setSessionValue(100, SessionStore.buildKey('pedido', 'tab'), {
      value: 'PED-999',
      savedAt: Date.now(),
    });
    expect(sessionService.getSession(100)[SessionStore.buildKey('pedido', 'tab')]).toBeDefined();

    // 2. Tab 100 é fechada
    sessionService.handleTabRemoved(100);
    expect(sessionService.getSession(100)).toEqual({});

    // 3. Nova Tab 200 é aberta
    const sessionNovaTab = sessionService.getSession(200);
    expect(sessionNovaTab[SessionStore.buildKey('pedido', 'tab')]).toBeUndefined();
  });

  it('Cenário 7: Expiração lazy por TTL — valor expira após X horas e popup solicita novo valor', async () => {
    const twoHoursAgo = Date.now() - 2 * 3600 * 1000 - 5000;

    // Injeta valor expirado (TTL de 1 hora) no store
    (store as any).memory[SessionStore.buildKey('token_temporario', 'tab')] = {
      value: 'Valor Velho',
      savedAt: twoHoursAgo,
      ttlHours: 1,
    };

    const choicePopupMock = {
      showForToken: vi.fn().mockResolvedValue('Valor Novo'),
    } as any;

    const tokenExp: Token = {
      id: 'tok_exp',
      type: 'input',
      config: {
        label: 'Código',
        rememberValue: true,
        sessionVarName: 'token_temporario',
        scope: 'tab',
        ttlHours: 1,
      },
    };

    const actionExp: ActionBlock = {
      format: 'plain',
      content: `Token: ${TokenPill.createHTML(tokenExp)}`,
      tokens: [tokenExp],
    };

    const result = await resolveActionBlockContent(actionExp, dummyElement, {
      choicePopup: choicePopupMock,
      variables: [],
      context: { tabUrl: 'https://site.com', tabTitle: 'App' },
    });

    expect(result!.content).toBe('Token: Valor Novo');
    // Abriu popup sem prefill porque o valor anterior expirou!
    expect(choicePopupMock.showForToken).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      expect.anything(),
      undefined
    );

    // Novo valor foi salvo com timestamp fresco
    const novoValor = await store.getSessionVariable('token_temporario', 'tab');
    expect(novoValor).toBe('Valor Novo');
  });

  it('Cenário 8: Cancelamento pelo usuário (Esc) aborta expansão e não salva nada', async () => {
    const choicePopupMock = {
      showForToken: vi.fn().mockResolvedValue(null), // Usuário teclou Esc
    } as any;

    const tokenCancel: Token = {
      id: 'tok_cancel',
      type: 'input',
      config: {
        label: 'Senha de Acesso',
        rememberValue: true,
        sessionVarName: 'senha_temp',
        scope: 'tab',
      },
    };

    const actionCancel: ActionBlock = {
      format: 'plain',
      content: `Chave: ${TokenPill.createHTML(tokenCancel)}`,
      tokens: [tokenCancel],
    };

    const result = await resolveActionBlockContent(actionCancel, dummyElement, {
      choicePopup: choicePopupMock,
      variables: [],
      context: { tabUrl: 'https://site.com', tabTitle: 'App' },
    });

    // Retorna null (expansão abortada)
    expect(result).toBeNull();
    // Nada foi gravado no SessionStore
    expect(await store.getSessionVariable('senha_temp', 'tab')).toBeUndefined();
  });

  it('Cenário 9 (Regressão Bug 2): Fluxo A (autoApply false) salva valor -> Fluxo B (autoApply true, mesma variável, usado pela PRIMEIRA vez) aplica direto sem popup na primeira chamada', async () => {
    const choicePopupMock = {
      showForToken: vi.fn(),
    } as any;

    // 1. Fluxo A: autoApply false, solicita ao usuário e salva "12345/2026" na variável "num_proc"
    const tokenA: Token = {
      id: 'tok_flow_a',
      type: 'input',
      config: {
        label: 'Número do Processo',
        rememberValue: true,
        sessionVarName: 'num_proc',
        scope: 'tab',
        autoApply: false,
      },
    };

    const actionA: ActionBlock = {
      format: 'plain',
      content: `Autos nº ${TokenPill.createHTML(tokenA)}`,
      tokens: [tokenA],
    };

    choicePopupMock.showForToken.mockResolvedValueOnce('12345/2026');

    const resultA = await resolveActionBlockContent(actionA, dummyElement, {
      choicePopup: choicePopupMock,
      variables: [],
      context: { tabUrl: 'https://tribunal.jus.br/processo', tabTitle: 'Consulta Processual' },
    });

    expect(resultA).not.toBeNull();
    expect(resultA!.content).toBe('Autos nº 12345/2026');
    expect(choicePopupMock.showForToken).toHaveBeenCalledTimes(1);

    // Confirma que a variável está no SessionStore
    const saved = await store.getSessionVariable('num_proc', 'tab');
    expect(saved).toBe('12345/2026');

    // 2. Fluxo B: autoApply true, MESMA variável "num_proc", usado pela PRIMEIRA vez
    const tokenB: Token = {
      id: 'tok_flow_b',
      type: 'input',
      config: {
        label: 'Processo',
        rememberValue: true,
        sessionVarName: 'num_proc',
        scope: 'tab',
        autoApply: true,
      },
    };

    const actionB: ActionBlock = {
      format: 'plain',
      content: `Intimação referente ao processo ${TokenPill.createHTML(tokenB)}.`,
      tokens: [tokenB],
    };

    // Executa Fluxo B pela primeira vez na mesma aba
    const resultB = await resolveActionBlockContent(actionB, dummyElement, {
      choicePopup: choicePopupMock,
      variables: [],
      context: { tabUrl: 'https://tribunal.jus.br/processo', tabTitle: 'Consulta Processual' },
    });

    expect(resultB).not.toBeNull();
    expect(resultB!.content).toBe('Intimação referente ao processo 12345/2026.');
    // ZERO novas chamadas ao popup — aplicou direto já na PRIMEIRA chamada de Fluxo B!
    expect(choicePopupMock.showForToken).toHaveBeenCalledTimes(1);
  });
});

