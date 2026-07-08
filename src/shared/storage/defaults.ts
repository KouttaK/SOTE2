import type { Settings, Form } from '../types/index.js';

export const DEFAULT_SETTINGS: Settings = {
  triggerMode: 'trigger',
  triggerKeys: ['Space', 'Tab', 'Enter'],
  exactMatchChar: '/',
  exactMatchDelay: 0,
  globalEnabled: true,
  snoozeUntil: undefined,
  blocklist: [],
  commandPaletteShortcut: 'Ctrl+Shift+Space',
  analytics: {},
  clipboardHistoryMax: 10,
  searchTrigger: {
    enabled: true,
    includeFlows: true,
    domainPrefix: '//',
    globalPrefix: '///',
  },
};

/**
 * Pre-installed Forms shown on first run (empty-state / onboarding), so the
 * "Formulários" page never opens completely blank. Covers the two most
 * likely usage patterns: a personal, high-frequency form ("Envio de
 * Currículo") and a support/ticketing form ("Abertura de Protocolo").
 *
 * A factory (not a static constant) so every seed gets fresh, real
 * timestamps instead of the module's import time.
 */
export function buildDefaultForms(): Form[] {
  const now = Date.now();

  return [
    {
      id: 'example-form-envio-curriculo',
      name: 'Envio de Currículo',
      sites: ['mail.google.com', 'outlook.live.com', 'outlook.office.com'],
      fields: [
        {
          id: 'example-field-assunto-curriculo',
          name: 'Assunto',
          type: 'text',
          value: {
            format: 'plaintext',
            content: 'Candidatura para vaga de {{CARGO}}',
            tokens: [],
          },
        },
        {
          id: 'example-field-destinatario-curriculo',
          name: 'Destinatário',
          type: 'email',
          value: {
            format: 'plaintext',
            content: 'rh@empresa.com',
            tokens: [],
          },
        },
        {
          id: 'example-field-descricao-curriculo',
          name: 'Descrição',
          type: 'richtext',
          value: {
            format: 'richtext',
            content:
              '<p>Prezados,</p><p>Segue meu currículo em anexo para a vaga de {{CARGO}}.</p>' +
              '<p>Fico à disposição para uma conversa.</p><p>Atenciosamente,<br>{{NOME}}</p>',
            tokens: [],
          },
        },
      ],
      createdAt: now,
      updatedAt: now,
      stats: { usageCount: 0 },
    },
    {
      id: 'example-form-abertura-protocolo',
      name: 'Abertura de Protocolo',
      // No domain restriction yet: reachable via the global search prefix
      // (///) or the Palette until the user adds the sites where they file
      // tickets. Empty on purpose — see FormField.sites doc comment.
      sites: [],
      fields: [
        {
          id: 'example-field-assunto-protocolo',
          name: 'Assunto',
          type: 'text',
          value: {
            format: 'plaintext',
            content: 'Abertura de chamado técnico - {{TIPO_SERVICO}}',
            tokens: [],
          },
        },
        {
          id: 'example-field-categoria-protocolo',
          name: 'Categoria',
          type: 'text',
          value: {
            format: 'plaintext',
            content: 'Fibra',
            tokens: [],
          },
        },
        {
          id: 'example-field-descricao-protocolo',
          name: 'Descrição do problema',
          type: 'text',
          value: {
            format: 'plaintext',
            content:
              'Cliente relata instabilidade na conexão desde {{DATA}}. ' +
              'Testes realizados: reinício do roteador e verificação de cabos.',
            tokens: [],
          },
        },
      ],
      createdAt: now,
      updatedAt: now,
      stats: { usageCount: 0 },
    },
  ];
}

/**
 * Storage key that persists the user's choice to use sync vs local.
 * Stored in local so it survives sync being disabled.
 */
export const SYNC_ENABLED_KEY = '__sote_sync_enabled__';

/**
 * Maximum bytes per browser.storage.sync item (8 KB).
 * We leave a small buffer for key overhead.
 */
export const SYNC_ITEM_MAX_BYTES = 7800;

/** Default number of clipboard items kept in history. */
export const DEFAULT_CLIPBOARD_HISTORY_MAX = 10;

/** Hard ceiling for the configurable clipboard history size (settings UI). */
export const MAX_CLIPBOARD_HISTORY_LIMIT = 50;
