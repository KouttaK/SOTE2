# Changelog

Todas as alterações notáveis neste projeto serão documentadas neste arquivo.

O formato segue o padrão [Keep a Changelog](https://keepachangelog.com/pt-BR/1.0.0/) e este projeto adere ao [Versionamento Semântico](https://semver.org/lang/pt-BR/).

---

## [1.0.19] - Não publicado (em desenvolvimento acumulado)

### Adicionado
- **Fase 2.4 — Desfazer Expansão (Undo) e Envio Diferido de Estatísticas:**
  - Desfazer expansão inteligente acionado via tecla `Backspace` ou atalho `Ctrl+Z` dentro de uma janela temporizada configurável (padrão de 5s, ajustável de 0 a 10s).
  - Restauração precisa do atalho original digitado no elemento focado (`input`, `textarea` e `contenteditable`), removendo o texto injetado.
  - Devolução condicional de reservas de contadores ao `CounterService` caso nenhum número posterior tenha sido emitido (preservando lacuna se o contador já avançou).
  - Envio diferido de estatísticas de uso (`FLOW_USED`, `VARIABLES_USED`): cancelamento do envio caso o usuário desfaça a expansão, e disparo automático imediato ao expirar a janela ou nos eventos de ciclo de vida `visibilitychange` e `pagehide`.
  - Restauração graciosa do atalho em fluxos que pausaram por inputs ou escolhas interativas quando cancelados pelo usuário.
  - Novo card de configuração dedicado no Dashboard ("Desfazer Expansão") com controle de ativação, duração da janela e seleção de tecla de gatilho (`Backspace`, `Ctrl+Z` ou ambos) totalmente internacionalizado (pt-BR e en).
- **Fase 2.3 — Armazenamento Efêmero de Sessão por Aba (`SessionStore`):**
  - Armazenamento em memória no Content Script (`SessionStore`) para variáveis dinâmicas de sessão com escopo "lembrar nesta aba", com isolamento por aba e limpeza automática ao fechar a guia.
  - Fallback defensivo e tolerante a falhas no Background Script (`SessionService`) para preservação de estado da sessão em recargas de frames ou ciclo de vida de abas.
- **Fase 2.2 — Contadores Persistentes e Nomeados:**
  - Centralização no Background Script com fila e Mutex baseado em Promises para alocação sequencial estrita e livre de condições de corrida entre múltiplas abas (`ALLOCATE_COUNTER`).
  - Modelo transacional de dois estágios: reserva temporária (`RESERVE_COUNTER`) na resolução do snippet e confirmação pós-injeção (`CONFIRM_COUNTER`) ou liberação (`RELEASE_COUNTER`).
  - Política de lacuna permanente (permanent gap) preservada caso reservas sejam canceladas após novos números subsequentes terem sido emitidos.
  - Página completa de gerenciamento de Contadores no Dashboard com criação, edição de valor inicial, passo e formatação com preenchimento de zeros (padding).
  - Modal informativo de contadores ausentes (`MissingCounterModal`) acionado durante a importação de fluxos legados ou de terceiros.
  - Modo simulação seguro em `PreviewModal` e no editor para visualização prévia sem afetar os valores reais persistidos no storage.
- **Fase 2.1 — Migração de Schema v1 para v2 e Entidade Counter:**
  - Migração atômica de dados via `MigrationService` com versionamento de schema (`schemaVersion: 2`).
  - Rotina com verificação preventiva de cota de armazenamento e criação de backup pré-migração (`backup_schema_v1`).
  - Extração de contadores inline existentes nos fluxos para entidades independentes de primeiro nível (`Counter`) com deduplicação semântica baseada em escopo e parâmetros.
  - Procedimento testado e documentado de reversão (`rollbackToV1()`), limpeza de chaves órfãs e documentação técnica completa em `docs/migrations.md`.
- **Auto-Scroll no Canvas do Editor durante Arraste:** Deslocamento automático e suave do canvas (auto-pan / edge scrolling) nas 4 direções e diagonais quando o cursor se aproxima das bordas visíveis durante o arraste ativo de blocos, chips do dock ou nós flutuantes (`.floating-node`), com velocidade proporcional à proximidade da borda, parada imediata ao soltar ou retornar ao centro e compensação geométrica em tempo real para manter nós flutuantes alinhados ao cursor.
- **Fase 1B — Limite de Palavra (Word Boundary):** Opção configurável por atalho (`wordBoundary`) no bloco de gatilho (`TriggerBlock`) e globalmente nas configurações (`wordBoundaryDefault`), impedindo que atalhos em modo exato expandam no meio de palavras e URLs (ex: digitar `site.com/ab` não dispara `/ab`, e `crab` não dispara `ab`).
- **Fase 1B — Espera Inteligente de Prefixo (Prefix Wait Delay):** Quando um atalho digitado for prefixo estrito de outro atalho maior existente (ex: `/d` vs `/data`), o motor de expansão aguarda dinamicamente um tempo de segurança (`prefixWaitMs`, padrão 500ms) para permitir a continuidade da digitação sem expansão prematura.
- **Fase 1B — Migração de Compatibilidade de Delay (`applyDelayToAllShortcuts`):** Nova configuração e rotina de migração em `StorageService` preservando o atraso em todos os atalhos para perfis que já utilizavam `exactMatchDelay > 0` antes da atualização.
- **Fase 1B — Central de Conflitos de Atalhos com Redesenho Amigável:** Modal intuitivo com terminologia compreensível ("Atalhos com início igual"), cartão interativo de simulação explicando o comportamento de espera de digitação e ações agrupadas para editar ou desativar cada fluxo conflitante.
- **Fase 1B — Isolamento por Domínio na Análise de Conflitos:** Atalhos idênticos ou com prefixos sobrepostos associados a domínios disjuntos via `ConditionBlock` não geram falsos positivos de conflito, considerando padrões com curingas (`*.site.com`).
- **Fase 1B — Aviso Educativo no Dashboard com Navegação Direta:** Banner informativo na tela de fluxos com persistência de confirmação (`seenWordBoundaryNotice`) e atalho que navega para as configurações com rolagem suave e destaque visual.
- **Fase 1A — Motor de Proteção em Campos Sensíveis (`SensitiveFieldGuard`):** Bloqueio rígido, seguro e não desativável contra gravação de buffer, expansão de snippets e injeção de texto em inputs confidenciais.
- **Fase 1A — Bloqueio Normativo e Heurística Estrita:** Detecção estrita de `type="password"`, `autocomplete` sensíveis (`current-password`, `new-password`, `one-time-code`, `cc-*`) e identificadores de cartão, código de segurança (`cvv`, `cvc`) e senhas/tokens via `name`, `id`, `aria-label` e `placeholder`, com regras estritas contra falsos positivos (ex: `cid`, `client_id`, `category-id` e `inputmode="numeric"` não são bloqueados).
- **Fase 1A — Persistência de Proteção via `WeakSet`:** O campo permanece protegido no ciclo de vida da página mesmo se o tipo for alternado de `password` para `text` pelo botão de "mostrar senha".
- **Fase 1A — Suporte a Shadow DOM Aberto:** Resolução precisa de elementos ativos e eventos mesmo encapsulados em Shadow Roots (`composedPath()`, `getDeepActiveElement()`).
- **Fase 1A — Defesa em Profundidade no Content Script:** Bloqueio da Paleta de Comandos, gatilho de busca inline, menus de contexto, Captura Rápida (`GET_SELECTION` rejeitado) e exclusão de eventos de copiar/recortar do histórico da área de transferência quando originados em campos sensíveis.
- **Fase 1A — Sinalização de Estado por Frame e Indicador no Popup:** Comunicação entre frames e background (`FRAME_PROTECTED_STATUS_CHANGED`) e exibição de alerta discreto no popup ("Campo protegido") notificando que a injeção está desativada por segurança no campo focado.

### Corrigido
- **Avaliação de Domínio na Expansão Real (Pós-Merge 1B):** Ranqueamento e avaliação normativa de especificidade de condições no `TriggerDetector` (`getFlowConditionMatchScore`), garantindo que fluxos com regras de domínio aplicáveis no site atual tenham precedência sobre fluxos genéricos irrestritos ou com condições que não batem no contexto.
- **Intercepção de Pan/Arrasto no Editor (Pós-Merge 1B):** Correção do listener em fase de captura no canvas do editor para permitir arrastar nós flutuantes (`.floating-node`), reordenar ramos com `.branch-tag` / `[draggable="true"]`, clicar em conectores de saída/fluxo (`.connector`, `.connector-dot`) e conectar saídas (`.branch-leaf-anchor`) sem arrastar o canvas indevidamente.
- **Preservação de Proteção em Senhas e Popups (Pós-Merge 1B):** Correção do `focusout` em campos protegidos quando a janela perde foco para a barra de ferramentas da extensão, e inclusão de guardas normativas em `ChoicePopup` e `SearchPopup` rejeitando abertura sobre campos sensíveis.
- **Controles de Switch nas Configurações (Pós-Merge 1B):** Padronização visual dos toggles de `applyDelayToAllShortcuts` e do limite de palavra padrão com o seletor `.settings-toggle` e knob animado.
- **Ícone e Navegação do Banner Informativo (Pós-Merge 1B):** Correção da referência `${ICONS_LOCAL.sparkle}` e foco automático com animação de highlight na opção correspondente nas configurações.
- **Alinhamento na Tabela de Fluxos (Pós-Merge 1B):** Uso de `minmax(0, 1fr)` e `min-width: 0` na coluna de prévia de fluxos, garantindo truncamento com reticências sem quebra das colunas seguintes.
- **Padronização Visual no ConditionBlock (Pós-Merge 1B):** Eliminação de estilos inline na dica de avaliação de condições, adotando a classe `.condition-evaluation-hint` e as variáveis do tema.

---

## [1.0.18] - 2026-09-26

### Adicionado
- **Derivação Dinâmica Estrita de Tokens no ActionBlock:** Implementação do método `syncTokensFromDOM()`, reconciliando fisicamente em tempo real as pills do editor com a lista "Tokens Usados", reagindo a digitação, deleção, colagem, recorte e comandos de desfazer/refazer (`historyUndo` / `historyRedo`).
- **Suíte de Testes para Reconciliação e Desfazer/Refazer:** Adicionados testes unitários específicos em `ActionBlock.test.ts` cobrindo eliminação de órfãos ao inicializar, limpeza reativa da lista ao esvaziar o editor, isolamento total em blocos duplicados e reatividade imediata a eventos nativos de Undo e Redo.
- **Nova Cor Canônica para `token.date`:** Substituição do tom neutro (#525252) pela cor Coral / Rose vibrante (`#f43f5e`), eliminando ambiguidades visuais com botões ou elementos desabilitados.

### Corrigido
- **Eliminação Definitiva do Bug de Tokens Órfãos:** Corrigido o problema onde tokens como "Data / Hora" e "Área de Transferência" continuavam listados na seção "Tokens Usados" em ramificações condicionais vazias, tornando o clique inerte. Agora a seção é dinamicamente oculta caso nenhuma pill exista no editor.
- **Unificação de Cor do Token `token.math`:** Corrigida a divergência onde a pill inline no editor de rich-text utilizava a cor azul enquanto a lista de "Tokens Usados" e o menu utilizavam rosa. O token agora utiliza consistentemente o Magenta/Pink oficial (`#ec4899`) em todos os componentes.
- **Duplicação Segura de Blocos no Editor:** O comando de duplicação do editor agora consolida o estado atual do DOM antes de clonar via `structuredClone()`, gerando novos identificadores únicos (UUIDs) para blocos e pills filhas de forma totalmente independente.

### Alterado
- **Paleta de Cores Revisada para Acessibilidade:** Reestruturação da paleta canônica com Fonte Única da Verdade (SSOT) em `tokenColors.ts` e variáveis CSS centralizadas, selecionando famílias cromáticas distintas para melhorar o contraste e a diferenciação visual entre todos os 11 tipos de tokens e os 5 tipos de blocos estruturais, inclusive sob formas comuns de daltonismo (protanopia e deuteranopia).
- **Atualização do Manifest e Auto-Update Self-Hosted:** Atualizado `updates.json` com a nova versão assinada `sote-1.0.18-firefox.xpi` hospedada no GitHub Pages para Firefox Gecko 140.0+.

---

## [1.0.17] - 2026-09-23

### Adicionado
- **Redesign do PreviewModal com Layout em 2 Colunas:** Interface lado a lado exibindo a Árvore de Blocos interativa à esquerda e a Pré-visualização Renderizada ao vivo à direita.
- **Sintaxe de Fallback para Variáveis Globais:** Suporte à sintaxe `{variavel|valor_padrao}` em blocos e ações, permitindo definir valores padrão para variáveis não configuradas.
- **Modal de Variáveis Ausentes (`MissingVariablesModal`):** Alerta ao usuário durante a importação de fluxos sobre variáveis requeridas que não estejam cadastradas no ambiente.
- **Sanitização de HTML via DOMPurify:** Proteção contra injeção maliciosa em expansões de rich-text e templates de terceiros (`sanitizeHtml.ts`).
- **Tratamento de Contexto Desconectado em Service Worker:** Camada defensiva (`serviceWorkerSafety.ts`) que intercepta exceções silenciosas de recarga ou invalidação do contexto da extensão no navegador.

### Alterado
- **Internacionalização Dinâmica Reativa (i18n):** O seletor de idioma agora atualiza instantaneamente todos os componentes abertos, modais e telas do painel (incluindo macros de sites) sem recarregar a página.

---

## [1.0.16] - 2026-09-10

### Adicionado
- **Bloco de Repetição (`RepeatBlock`):** Execução de sequências de blocos com repetição de iterações configurável.
- **Token Numérico de Contador (`token.counter`):** Incremento sequencial com configuração de valor inicial, incremento/passo e preenchimento de zeros (padding).
- **Token de Expressão Matemática (`token.math`):** Avaliador aritmético nativo e seguro (`mathEvaluator.ts`) suportando adição, subtração, multiplicação, divisão e parênteses.
- **Modais de Configuração:** Modais dedicados `CounterModal` e `MathModal` para customização amigável de contadores e equações.

### Corrigido
- Tratamento resiliente em tempo de execução para divisões por zero ou equações inválidas em tempo de expansão de texto.

---

## [1.0.15] - 2026-08-10

### Alterado
- Ajustada a versão mínima estrita do motor Gecko no `updates.json` (`strict_min_version: 140.0`).
- Atualização das dependências de compilação e empacotamento do pacote `.xpi`.

---

## [1.0.14] - 2026-08-04

### Corrigido
- Resolução de conflitos de empacotamento entre o framework WXT e o Vite no bundle de produção.
- Correção de persistência no `StorageService` para migração retrocompatível de fluxos legados.

---

## [1.0.13] - 2026-08-10

### Alterado
- Novo pacote de distribuição assinado para Firefox publicado no canal self-hosted.

---

## [1.0.11] - 2026-07-20

### Adicionado
- **Token de Referência a Fluxos (`token.flow_ref`):** Possibilidade de chamar a expansão de outros fluxos dentro de uma ação.
- **Token Aleatório Ponderado (`token.random`):** Escolha aleatória de textos com definição percentual de probabilidade de cada opção (`randomWeights.ts`).
- **Condições Aninhadas:** Suporte para múltiplos níveis de regras no `ConditionBlock` com avaliação avançada no `ConditionResolver`.
- **Sandbox Segura de Execução (`ScriptSandbox`):** Isolamento de ambiente para execução de scripts de validação de fluxo.
- **Menu Rápido de Blocos (`BlockMenu`):** Atalho para inserção instantânea de blocos no canvas do editor.

---

## [1.0.10] - 2026-07-18

### Corrigido
- Correção na sintaxe do manifesto de auto-update `updates.json` para Firefox.

---

## [1.0.9] - 2026-07-16

### Adicionado
- **Analytics Local e Privado:** Rastreamento local de quantidade de expansões, caracteres gerados e estimativa de tempo economizado, com dashboard visual.
- **Injeção de Texto Avançada:** Motor `TextInjector` com suporte a preenchimento simulado em inputs customizados, Web Components e textareas.
- **Configurações de Privacidade e Histórico:** Gerenciamento do histórico da área de transferência e modo Snooze temporário por domínio.

---

## [1.0.8] - 2026-07-13

### Alterado
- Ajustes de compatibilidade com o motor Gecko e otimização dos chunks de JavaScript no build final.

---

## [1.0.7] - 2026-07-12

### Adicionado
- **Bloco Condicional (`ConditionBlock`):** Suporte a branches condicionais (SE / SENÃO SE / SENÃO) avaliando datas, variáveis e conteúdo de campos.
- **Paleta de Comandos (`CommandPalette`):** Abertura via atalho global para busca e execução rápida de fluxos e ações.
- **Busca Rápida de Gatilhos (`SearchTriggerDetector` e `SearchPopup`):** Disparo de atalho para seleção assistida de templates em campos de digitação.
- **Tokens de Interação com o Usuário:** Lançamento de `ChoiceModal` (múltipla escolha) e `InputModal` (entrada de texto livre em tempo de execução).

---

## [1.0.6] - 2026-07-10

### Alterado
- Otimização de desempenho no `TextMonitor` para reduzir consumo de memória e latência de escuta em páginas ricas em inputs.

---

## [1.0.5] - 2026-07-09

### Alterado
- Padronização das rotas internas no dashboard SPA e estruturação do mecanismo de auto-update.

---

## [1.0.4] - 2026-07-09

### Corrigido
- Correções de estilos CSS no popup da extensão e alinhamento de componentes em telas pequenas.

---

## [1.0.3] - 2026-07-08

### Corrigido
- Prevenção de disparos acidentais de gatilho durante o uso de teclas modificadoras (Shift, Alt, Ctrl).

---

## [1.0.2] - 2026-07-08

### Alterado
- Atualização e restrição de permissões no manifesto Manifest V3 para máxima segurança do usuário.

---

## [1.0.1] - 2026-07-08

### Adicionado
- Versão inicial do SOTE 2 baseada em Manifest V3.
- Suporte a gatilhos simples de texto, expansor básico, editor visual e injeção com preservação de caixa (`SmartCase`).
