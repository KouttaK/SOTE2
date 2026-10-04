/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { resolveActionBlockContent } from './ActionContentResolver.js';
import { SessionStore } from './SessionStore.js';
import { TokenPill } from '../../dashboard/components/tokens/TokenPill.js';
import type { ActionBlock, Token, Flow, FormField } from '../../shared/types/index.js';

describe('Subtarefa 3.2: Formulário de Entrada (Agrupamento de Inputs em Popup Único)', () => {
  let store: SessionStore;
  let dummyElement: HTMLElement;

  beforeEach(() => {
    store = SessionStore.getInstance();
    store.reset();
    dummyElement = document.createElement('div');
    document.body.appendChild(dummyElement);
  });

  afterEach(() => {
    document.body.innerHTML = '';
    vi.clearAllMocks();
  });

  it('Cenário 1: groupInputs: true agrupa múltiplos inputs em um único popup via showForm', async () => {
    const choicePopupMock = {
      showForToken: vi.fn(),
      showForm: vi.fn(),
    } as any;

    const token1: Token = {
      id: 'tok_nome',
      type: 'input',
      config: {
        label: 'Nome',
        placeholder: 'Primeiro nome',
      },
    };

    const token2: Token = {
      id: 'tok_sobrenome',
      type: 'input',
      config: {
        label: 'Sobrenome',
        placeholder: 'Último nome',
      },
    };

    const pill1Html = TokenPill.createHTML(token1);
    const pill2Html = TokenPill.createHTML(token2);

    const actionBlock: ActionBlock = {
      format: 'plaintext',
      content: `Olá ${pill1Html} ${pill2Html}, seja bem-vindo!`,
      tokens: [token1, token2],
    };

    const flow: Flow = {
      id: 'flow_group_1',
      name: '/boasvindas',
      blocks: [
        {
          id: 'b_trigger',
          type: 'trigger',
          data: {
            shortcut: 'bv',
            smartCase: true,
            forceCapitalize: false,
            groupInputs: true,
          },
        },
      ],
      tags: [],
      enabled: true,
      groupInputs: true,
      createdAt: 1,
      updatedAt: 1,
      stats: { usageCount: 0, keysSaved: 0 },
    };

    choicePopupMock.showForm.mockResolvedValue({
      tok_nome: 'Carlos',
      tok_sobrenome: 'Silva',
    });

    const result = await resolveActionBlockContent(actionBlock, dummyElement, {
      choicePopup: choicePopupMock,
      variables: [],
      context: { counterReservations: [] },
      flow,
    });

    expect(choicePopupMock.showForm).toHaveBeenCalledTimes(1);
    expect(choicePopupMock.showForToken).not.toHaveBeenCalled();

    const passedFields: FormField[] = choicePopupMock.showForm.mock.calls[0][0];
    expect(passedFields.length).toBe(2);
    expect(passedFields[0].key).toBe('tok_nome');
    expect(passedFields[0].label).toBe('Nome');
    expect(passedFields[1].key).toBe('tok_sobrenome');
    expect(passedFields[1].label).toBe('Sobrenome');

    expect(result).not.toBeNull();
    expect(result!.content).toBe('Olá Carlos Silva, seja bem-vindo!');
  });

  it('Cenário 2: Deduplicação por sessionVarName - múltiplos tokens com o mesmo sessionVarName geram 1 único campo no form', async () => {
    const choicePopupMock = {
      showForToken: vi.fn(),
      showForm: vi.fn(),
    } as any;

    // Dois tokens distintos compartilhando o mesmo sessionVarName: 'cliente'
    const tokenCliente1: Token = {
      id: 'tok_cli_1',
      type: 'input',
      config: {
        label: 'Nome do Cliente',
        rememberValue: true,
        sessionVarName: 'cliente',
        scope: 'tab',
      },
    };

    const tokenPedido: Token = {
      id: 'tok_ped',
      type: 'input',
      config: {
        label: 'Número do Pedido',
        rememberValue: true,
        sessionVarName: 'pedido',
        scope: 'tab',
      },
    };

    const tokenCliente2: Token = {
      id: 'tok_cli_2',
      type: 'input',
      config: {
        label: 'Nome do Cliente (Confirmação)',
        rememberValue: true,
        sessionVarName: 'cliente',
        scope: 'tab',
      },
    };

    const pill1 = TokenPill.createHTML(tokenCliente1);
    const pillPed = TokenPill.createHTML(tokenPedido);
    const pill2 = TokenPill.createHTML(tokenCliente2);

    const actionBlock: ActionBlock = {
      format: 'plaintext',
      content: `Cliente: ${pill1} | Pedido: ${pillPed} | Assinado por: ${pill2}`,
      tokens: [tokenCliente1, tokenPedido, tokenCliente2],
    };

    const flow: Flow = {
      id: 'flow_dedupe',
      name: '/pedido',
      blocks: [
        {
          id: 'b_trigger',
          type: 'trigger',
          data: {
            shortcut: 'ped',
            smartCase: true,
            forceCapitalize: false,
            groupInputs: true,
          },
        },
      ],
      tags: [],
      enabled: true,
      groupInputs: true,
      createdAt: 1,
      updatedAt: 1,
      stats: { usageCount: 0, keysSaved: 0 },
    };

    choicePopupMock.showForm.mockResolvedValue({
      cliente: 'Mariana Costa',
      pedido: 'PED-7788',
    });

    const result = await resolveActionBlockContent(actionBlock, dummyElement, {
      choicePopup: choicePopupMock,
      variables: [],
      context: { counterReservations: [] },
      flow,
    });

    expect(choicePopupMock.showForm).toHaveBeenCalledTimes(1);
    const passedFields: FormField[] = choicePopupMock.showForm.mock.calls[0][0];

    // Exatamente 2 campos (deduplicou os 2 tokens de 'cliente' em 1 único campo)
    expect(passedFields.length).toBe(2);
    expect(passedFields[0].key).toBe('cliente');
    expect(passedFields[1].key).toBe('pedido');

    // Ambos os locais de token 'cliente' foram substituídos por 'Mariana Costa'
    expect(result).not.toBeNull();
    expect(result!.content).toBe('Cliente: Mariana Costa | Pedido: PED-7788 | Assinado por: Mariana Costa');

    // Valores foram persistidos no SessionStore
    const valCli = await store.getSessionVariable('cliente', 'tab');
    const valPed = await store.getSessionVariable('pedido', 'tab');
    expect(valCli).toBe('Mariana Costa');
    expect(valPed).toBe('PED-7788');
  });

  it('Cenário 3: Integração com SessionStore - valores já existentes vêm pré-preenchidos no form', async () => {
    const choicePopupMock = {
      showForToken: vi.fn(),
      showForm: vi.fn(),
    } as any;

    // Pré-grava um valor na sessão para a variável 'protocolo'
    await store.setSessionVariable('protocolo', '2026/001-A', 'tab');

    const tokenProt: Token = {
      id: 'tok_p',
      type: 'input',
      config: {
        label: 'Protocolo',
        rememberValue: true,
        sessionVarName: 'protocolo',
        autoApply: false,
      },
    };

    const tokenAssunto: Token = {
      id: 'tok_a',
      type: 'input',
      config: {
        label: 'Assunto',
        rememberValue: true,
        sessionVarName: 'assunto',
      },
    };

    const actionBlock: ActionBlock = {
      format: 'plaintext',
      content: `Prot: ${TokenPill.createHTML(tokenProt)} - Assunto: ${TokenPill.createHTML(tokenAssunto)}`,
      tokens: [tokenProt, tokenAssunto],
    };

    const flow: Flow = {
      id: 'flow_prefill',
      name: '/atend',
      blocks: [],
      tags: [],
      enabled: true,
      groupInputs: true,
      createdAt: 1,
      updatedAt: 1,
      stats: { usageCount: 0, keysSaved: 0 },
    };

    choicePopupMock.showForm.mockResolvedValue({
      protocolo: '2026/001-A',
      assunto: 'Dúvida sobre faturamento',
    });

    const result = await resolveActionBlockContent(actionBlock, dummyElement, {
      choicePopup: choicePopupMock,
      variables: [],
      context: { counterReservations: [] },
      flow,
    });

    expect(choicePopupMock.showForm).toHaveBeenCalledTimes(1);
    const passedFields: FormField[] = choicePopupMock.showForm.mock.calls[0][0];

    // Campo protocolo veio pré-preenchido
    expect(passedFields[0].key).toBe('protocolo');
    expect(passedFields[0].value).toBe('2026/001-A');
    expect(passedFields[0].prefilled).toBe(true);

    // Campo assunto veio vazio
    expect(passedFields[1].key).toBe('assunto');
    expect(passedFields[1].value).toBe('');
    expect(passedFields[1].prefilled).toBe(false);

    expect(result!.content).toBe('Prot: 2026/001-A - Assunto: Dúvida sobre faturamento');
  });

  it('Cenário 4: Token com autoApply: true e valor existente na sessão é resolvido sem entrar no form', async () => {
    const choicePopupMock = {
      showForToken: vi.fn(),
      showForm: vi.fn(),
    } as any;

    // Já existe valor gravado para 'proc_num'
    await store.setSessionVariable('proc_num', '998877/2026', 'tab');

    // Token 1 tem autoApply: true (já possui valor)
    const token1: Token = {
      id: 'tok_auto',
      type: 'input',
      config: {
        label: 'Processo',
        rememberValue: true,
        sessionVarName: 'proc_num',
        autoApply: true,
      },
    };

    // Token 2 não tem valor e precisa de popup
    const token2: Token = {
      id: 'tok_obs',
      type: 'input',
      config: {
        label: 'Observações',
      },
    };

    const actionBlock: ActionBlock = {
      format: 'plaintext',
      content: `Proc: ${TokenPill.createHTML(token1)} | Obs: ${TokenPill.createHTML(token2)}`,
      tokens: [token1, token2],
    };

    const flow: Flow = {
      id: 'flow_auto',
      name: '/proc_obs',
      blocks: [],
      tags: [],
      enabled: true,
      groupInputs: true,
      createdAt: 1,
      updatedAt: 1,
      stats: { usageCount: 0, keysSaved: 0 },
    };

    choicePopupMock.showForm.mockResolvedValue({
      tok_obs: 'Concluído com sucesso',
    });

    const result = await resolveActionBlockContent(actionBlock, dummyElement, {
      choicePopup: choicePopupMock,
      variables: [],
      context: { counterReservations: [] },
      flow,
    });

    // Form foi chamado contendo APENAS tok_obs (proc_num foi auto-aplicado diretamente)
    expect(choicePopupMock.showForm).toHaveBeenCalledTimes(1);
    const passedFields: FormField[] = choicePopupMock.showForm.mock.calls[0][0];
    expect(passedFields.length).toBe(1);
    expect(passedFields[0].key).toBe('tok_obs');

    expect(result!.content).toBe('Proc: 998877/2026 | Obs: Concluído com sucesso');
  });

  it('Cenário 5: Usuário cancela o formulário (showForm retorna null) -> aborta expansão inteira', async () => {
    const choicePopupMock = {
      showForToken: vi.fn(),
      showForm: vi.fn().mockResolvedValue(null), // Usuário apertou Esc
    } as any;

    const token1: Token = { id: 't1', type: 'input', config: { label: 'Campo 1' } };
    const token2: Token = { id: 't2', type: 'input', config: { label: 'Campo 2' } };

    const actionBlock: ActionBlock = {
      format: 'plaintext',
      content: `${TokenPill.createHTML(token1)} - ${TokenPill.createHTML(token2)}`,
      tokens: [token1, token2],
    };

    const flow: Flow = {
      id: 'flow_cancel',
      name: '/cancel',
      blocks: [],
      tags: [],
      enabled: true,
      groupInputs: true,
      createdAt: 1,
      updatedAt: 1,
      stats: { usageCount: 0, keysSaved: 0 },
    };

    const result = await resolveActionBlockContent(actionBlock, dummyElement, {
      choicePopup: choicePopupMock,
      variables: [],
      context: { counterReservations: [] },
      flow,
    });

    expect(choicePopupMock.showForm).toHaveBeenCalledTimes(1);
    expect(result).toBeNull();
  });

  it('Cenário 6: groupInputs: false (padrão) abre popups sequenciais sem agrupamento', async () => {
    const choicePopupMock = {
      showForToken: vi.fn()
        .mockResolvedValueOnce('Primeiro')
        .mockResolvedValueOnce('Segundo'),
      showForm: vi.fn(),
    } as any;

    const token1: Token = { id: 't1', type: 'input', config: { label: 'Campo 1' } };
    const token2: Token = { id: 't2', type: 'input', config: { label: 'Campo 2' } };

    const actionBlock: ActionBlock = {
      format: 'plaintext',
      content: `${TokenPill.createHTML(token1)} ${TokenPill.createHTML(token2)}`,
      tokens: [token1, token2],
    };

    const flow: Flow = {
      id: 'flow_seq',
      name: '/seq',
      blocks: [],
      tags: [],
      enabled: true,
      groupInputs: false, // Desativado
      createdAt: 1,
      updatedAt: 1,
      stats: { usageCount: 0, keysSaved: 0 },
    };

    const result = await resolveActionBlockContent(actionBlock, dummyElement, {
      choicePopup: choicePopupMock,
      variables: [],
      context: { counterReservations: [] },
      flow,
    });

    // showForm NÃO deve ter sido chamado
    expect(choicePopupMock.showForm).not.toHaveBeenCalled();
    // showForToken deve ter sido chamado 2 vezes sequencialmente
    expect(choicePopupMock.showForToken).toHaveBeenCalledTimes(2);
    expect(result!.content).toBe('Primeiro Segundo');
  });
});
