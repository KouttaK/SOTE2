# Changelog

Todas as alterações notáveis neste projeto serão documentadas neste arquivo.

O formato segue o padrão [Keep a Changelog](https://keepachangelog.com/pt-BR/1.0.0/) e este projeto adere ao [Versionamento Semântico](https://semver.org/lang/pt-BR/).

---

## [1.0.19] - 2026-09-28

### Adicionado
- **Motor de Proteção em Campos Sensíveis (`SensitiveFieldGuard`):** Bloqueio rígido, seguro e não desativável contra gravação de buffer, expansão de snippets e injeção de texto em inputs confidenciais.
- **Bloqueio Normativo e Heurística Estrita:** Detecção estrita de `type="password"`, `autocomplete` sensíveis (`current-password`, `new-password`, `one-time-code`, `cc-*`) e identificadores de cartão, código de segurança (`cvv`, `cvc`) e senhas/tokens via `name`, `id`, `aria-label` e `placeholder`, com regras estritas contra falsos positivos (ex: `cid`, `client_id`, `category-id` e `inputmode="numeric"` não são bloqueados).
- **Persistência de Proteção via `WeakSet`:** O campo permanece protegido no ciclo de vida da página mesmo se o tipo for alternado de `password` para `text` pelo botão de "mostrar senha".
- **Suporte a Shadow DOM Aberto:** Resolução precisa de elementos ativos e eventos mesmo encapsulados em Shadow Roots (`composedPath()`, `getDeepActiveElement()`).
- **Defesa em Profundidade no Content Script:** Bloqueio da Paleta de Comandos, gatilho de busca inline, menus de contexto, Captura Rápida (`GET_SELECTION` rejeitado) e exclusão de eventos de copiar/recortar do histórico da área de transferência quando originados em campos sensíveis.
- **Sinalização de Estado por Frame e Indicador no Popup:** Comunicação entre frames e background (`FRAME_PROTECTED_STATUS_CHANGED`) e exibição de alerta discreto no popup ("Campo protegido") notificando que a injeção está desativada por segurança no campo focado.

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
