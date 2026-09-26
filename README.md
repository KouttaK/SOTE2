# SOTE 2 — Smart Output & Text Expansion

**SOTE 2** é uma extensão de navegador de alto desempenho para **Google Chrome** e **Mozilla Firefox** (baseada em Manifest V3) projetada para automação de digitação, expansão dinâmica de snippets de texto, preenchimento inteligente de formulários, controle lógico de fluxo e macros de produtividade.

---

## 🚀 Principais Recursos

### ⚡ Motor de Gatilhos e Expansão Inteligente
* **Gatilhos Instantâneos:** Substituição em tempo real no momento da digitação por palavras-chave com ou sem prefixo configurável.
* **Gatilhos de Busca Rápida:** Atalho no campo de digitação que abre um pop-up de busca rápida para localizar e injetar templates sob demanda.
* **Smart Case e Force Capitalize:** Preserva automaticamente a caixa do texto digitado (minúsculas, Primeira Maiúscula ou TODAS MAIÚSCULAS) ou força maiúsculas conforme a regra do fluxo.
* **Modo Snooze e Bloqueio por Domínio:** Pause a expansão temporariamente ou configure listas de domínios restritos onde a automação não deve intervir (ex: sites bancários ou senhas).
* **Paleta de Comandos (`Ctrl+Shift+P` / `Cmd+Shift+P`):** Interface de busca e disparo ágil para executar qualquer fluxo ou macro a partir do teclado.

### 🧩 Editor Visual de Fluxos em Blocos
Interface gráfica moderna e modular para construção de rotinas simples ou ramificações complexas:
* **TriggerBlock:** Define o atalho, termo de ativação e comportamento do fluxo.
* **ConditionBlock:** Controle de fluxo lógico poderoso (SE / SENÃO SE / SENÃO) avaliando datas, variáveis globais, dia da semana ou conteúdo de campos web.
* **RandomBlock:** Ramificações probabilísticas que selecionam automaticamente caminhos com pesos percentuais ponderados.
* **RepeatBlock:** Executa sequências de ações em loop com quantidade de repetições configurável.
* **ActionBlock:** Editor WYSIWYG rico com pills dinâmicas e **derivação estrita em tempo real** (eliminação completa de tokens órfãos e reatividade nativa a comandos de Undo/Redo).

### 🏷️ Tokens Dinâmicos
Insira elementos interativos e contextuais em qualquer texto:
* **Contador (`token.counter`):** Números sequenciais incrementais com valor inicial, passo e preenchimento de zeros (`001`, `002`).
* **Matemática (`token.math`):** Avaliação de expressões aritméticas seguras (`+`, `-`, `*`, `/`, parênteses) em tempo de execução.
* **Data e Hora (`token.date`):** Formatações flexíveis de data atual ou cálculo de datas relativas (ex: +3 dias, próximo dia útil).
* **Aleatório (`token.random`):** Escolha aleatória de palavras ou frases pré-configuradas com pesos de chance.
* **Entrada Interativa (`token.input`):** Pausa a expansão e exibe um modal para o usuário digitar informações complementares.
* **Múltipla Escolha (`token.choice`):** Pop-up com opções clicáveis para seleção rápida antes da injeção do texto.
* **Área de Transferência (`token.clipboard`):** Captura e cola dinamicamente o conteúdo atual da área de transferência.
* **Posicionamento do Cursor (`token.cursor`):** Posiciona o cursor do teclado no ponto exato desejado após a expansão.
* **Contexto da Página (`token.url` e `token.title`):** Lê dinamicamente a URL e o título da aba atual do navegador.
* **Referência de Fluxo (`token.flow_ref`):** Composição e encadeamento modular de outros fluxos existentes.

### 🌐 Variáveis Globais com Sistema de Fallback
* Cadastre valores reutilizáveis globalmente entre diferentes fluxos (ex: nomes, assinaturas, links, chaves).
* **Sintaxe de Fallback:** Suporte nativo a `{variavel|valor_padrao}`, permitindo valores padrão caso uma variável não esteja preenchida.
* **Alerta de Variáveis Ausentes:** Verificação automática ao importar fluxos para alertar sobre dependências não cadastradas.

### 📋 Macros e Automação de Formulários
* Módulo dedicado para automação de páginas e formulários web (`/formularios`), permitindo preencher dezenas de campos com um único comando.

### 📊 Analytics 100% Local e Privado
* Painel de métricas que computa localmente o volume de expansões, caracteres gerados e estimativa de tempo economizado, sem telemetria externa e sem compartilhamento de dados.

### 👁️ Preview Interativo Lado a Lado (`PreviewModal`)
* Visualizador em 2 colunas com a **Árvore de Blocos** interativa à esquerda e a **Simulação Renderizada** fiel à direita, facilitando testes antes do uso em produção.

### 🎨 Design Acessível e Seguro para Daltonismo
* Paleta cromática canônica com contraste estrito e distância perceptual (Delta-E > 15) segura contra confusões visuais em casos de protanopia e deuteranopia, com Fonte Única da Verdade (SSOT) em código e variáveis CSS.

---

## 📦 Instalação

### Mozilla Firefox (Atualização Automática Self-Hosted)

A extensão para Firefox é distribuída via canal self-hosted assinado pela Mozilla com hospedagem no GitHub Pages:

1. **Download do Instalador (.xpi):**
   * Baixe diretamente a versão mais recente assinada: **[sote-1.0.18-firefox.xpi](https://kouttak.github.io/SOTE2/sote-1.0.18-firefox.xpi)**.
   * Abra o arquivo no Firefox ou arraste para dentro do navegador para confirmar a instalação.
2. **Mecanismo de Atualização Automática:**
   * O manifesto de auto-update está publicado em: `https://kouttak.github.io/SOTE2/updates.json`.
   * Para assegurar a checagem automática:
     * Acesse `about:config` no Firefox.
     * Certifique-se de que `extensions.update.enabled` está definido como `true`.
     * *(Opcional para testes imediatos)* Configure `extensions.update.interval` para `120` (segundos).

### Google Chrome / Navegadores Chromium

1. Baixe ou clone o código-fonte do repositório.
2. Compile a versão de produção com `npm run build:chrome`.
3. Abra `chrome://extensions/` no navegador.
4. Ative a opção **Modo do desenvolvedor** (canto superior direito).
5. Clique em **Carregar sem compactação** e selecione a pasta gerada `.output/chrome-mv3`.

---

## 💻 Desenvolvimento Local

Este projeto utiliza [WXT](https://wxt.dev/) com [Vite](https://vitejs.dev/) e TypeScript para geração rápida e tipada dos bundles das extensões.

### Pré-requisitos
* [Node.js](https://nodejs.org/) versão 18 ou superior
* Gerenciador de pacotes `npm`

### Instalação das Dependências
```bash
npm install
```

### Servidor de Desenvolvimento (Live Reload / HMR)
```bash
npm run dev
```

### Executar a Suíte de Testes
O projeto conta com mais de 280 testes unitários automatizados cobrindo motores de expansão, sanitização, persistência e componentes visuais via [Vitest](https://vitest.dev/):
```bash
npm test
```

### Compilar para Produção
* **Chrome (Manifest V3):**
  ```bash
  npm run build:chrome
  ```
  *Saída gerada em `.output/chrome-mv3/`*
* **Firefox (Manifest V3):**
  ```bash
  npm run build:firefox
  ```
  *Saída gerada em `.output/firefox-mv3/`*
* **Gerar Arquivo Empacotado do Firefox (.zip / .xpi):**
  ```bash
  npm run zip:firefox
  ```

---

## 📁 Estrutura do Projeto

```text
├── src/
│   ├── background/         # Service worker, hub de mensagens e analytics
│   ├── content/            # Injetor, detectores de gatilho e popups
│   │   ├── engine/         # Resolvers condicionais, tokens e sanitização
│   │   ├── palette/        # CommandPalette global
│   │   └── search/         # Pop-up de busca rápida de gatilhos
│   ├── dashboard/          # Interface SPA do painel (editor de fluxos, variáveis, analytics)
│   │   ├── components/     # Blocos visuais (Action, Condition, Repeat, etc.) e modais
│   │   └── pages/          # Rotas do dashboard
│   ├── popup/              # Interface do pop-up da extensão na barra de ferramentas
│   └── shared/             # Utilitários, storage, i18n, constantes e tipos compartilhados
├── updates.json            # Manifesto de auto-update self-hosted do Firefox
├── sote-1.0.18-firefox.xpi # Binário assinado do release atual
├── CHANGELOG.md            # Histórico detalhado de alterações por versão
└── wxt.config.ts           # Configuração de build multi-browser WXT
```

---

## 📜 Histórico de Versões

Consulte o arquivo **[CHANGELOG.md](./CHANGELOG.md)** para visualizar o registro detalhado de todas as alterações, correções e novidades introduzidas desde o início do projeto.

---

## 📄 Licença

Distribuído sob licença ISC. Consulte os arquivos do projeto para mais informações.