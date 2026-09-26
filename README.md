# SOTE 2 — Smart Output & Text Expansion

Extensão de navegador (Manifest V3) para Google Chrome e Mozilla Firefox focada em expansão contextual de texto, preenchimento automatizado de formulários e controle de fluxo por blocos lógicos.

Diferente de expansores de texto estáticos baseados apenas em substituição simples de strings, o SOTE 2 foi projetado como um motor de execução estruturado: ele combina gatilhos de digitação com uma árvore de blocos (condicionais, repetições, sorteios aleatórios ponderados e ações de texto rico) e tokens dinâmicos que avaliam contexto, operações matemáticas e dados do navegador em tempo de execução.

---

## Como funciona na prática

Um exemplo de fluxo criado no editor visual:

1. **Gatilho (`TriggerBlock`):** Ativado ao digitar `/proposta` em qualquer campo de texto.
2. **Condição (`ConditionBlock`):**
   * *SE* o dia da semana for sexta-feira, injeta um aviso de que a proposta é válida até o próximo dia útil.
   * *SENÃO*, define prazo padrão de 48 horas úteis.
3. **Ação (`ActionBlock`):**
   * Injeta o modelo de e-mail estruturado contendo:
     * O nome do cliente via token interativo (`{input: Nome do Cliente}`).
     * Data formatada (`{date: DD/MM/YYYY}`).
     * Valor com desconto calculado dinamicamente via token matemático (`{math: {var:valor_base} * 0.9}`).
     * Seleção de pacote via menu popup `{choice: Básico | Profissional | Premium}`.
     * O cursor do teclado é posicionado automaticamente no campo de observações via `{cursor}`.

---

## Arquitetura e Recursos

### Motor de Gatilhos e Injeção
* **Detecção inline:** Monitora eventos de digitação e substitui o texto instantaneamente assim que o padrão é atingido.
* **Smart Case e Capitalização:** Detecta se o gatilho foi digitado em minúsculas (`/msg`), com a primeira letra maiúscula (`/Msg`) ou em caixa alta (`/MSG`) e replica o padrão na expansão gerada.
* **Busca assistida (`SearchTrigger`):** Ao digitar o prefixo de busca rápida ou pressionar `Ctrl+Shift+P` (Command Palette), abre um menu flutuante para localizar qualquer fluxo sem necessidade de memorizar todos os atalhos.
* **Controle por domínio:** Permite suspender temporariamente a extensão (modo Snooze) ou cadastrar listas de domínios bloqueados (ex: formulários de autenticação ou home broker).

### Editor de Fluxos em Blocos
O editor organiza a lógica do fluxo visualmente em uma sequência ou hierarquia de blocos:
* **TriggerBlock:** Configura o atalho de disparo, tipo de correspondência e opções de expansão global.
* **ConditionBlock:** Ramificações condicionais encadeadas (SE / SENÃO SE / SENÃO) avaliando variáveis globais, datas, dia da semana ou conteúdo já presente no campo em foco.
* **RandomBlock:** Sorteio de ramificações baseado em pesos percentuais configuráveis (ex: teste A/B de abordagens de suporte).
* **RepeatBlock:** Laço de repetição que itera sobre blocos filhos, útil para gerar tabelas, linhas repetidas ou sequências estruturadas.
* **ActionBlock:** Editor de texto formatado com suporte a tokens inline. A seção "Tokens Usados" é derivada em tempo real do DOM do editor via `syncTokensFromDOM()`: tokens deletados são removidos imediatamente da lista e o sistema responde aos eventos nativos de Undo e Redo (`Ctrl+Z` / `Ctrl+Y`).

### Tokens Dinâmicos Suportados
* `token.counter`: Contadores sequenciais com controle de valor inicial, incremento (passo) e preenchimento de dígitos (`001`, `002`).
* `token.math`: Avaliador aritmético nativo e seguro (`mathEvaluator.ts`) com suporte a operadores básicos (`+`, `-`, `*`, `/`) e parênteses, com tratamento defensivo de divisões por zero.
* `token.date`: Formatações de data e hora atuais ou relativas (dias futuros, dias úteis, subtrações).
* `token.random`: Seleção aleatória entre múltiplas opções com probabilidades relativas.
* `token.input`: Abre um modal interativo em tempo de execução para preenchimento de dados pontuais.
* `token.choice`: Exibe um menu de opções para seleção antes de prosseguir com a expansão.
* `token.clipboard`: Lê o conteúdo atual da área de transferência e o insere na posição correspondente.
* `token.cursor`: Define a posição final onde o cursor de texto deve permanecer após a injeção.
* `token.url` e `token.title`: Captura a URL e o título da aba ativa no momento do disparo.
* `token.flow_ref`: Permite encadear e reaproveitar outro fluxo existente como sub-rotina.

### Variáveis Globais e Sistema de Fallback
* Banco de variáveis compartilhadas entre todos os fluxos cadastrados.
* Suporte nativo à sintaxe de fallback `{variavel|valor_padrao}`: caso a variável não exista no storage local, o valor padrão é injetado sem quebrar o fluxo.
* Verificação automática na importação de templates para acusar variáveis ausentes no ambiente (`MissingVariablesModal`).

### Macros de Formulários Web (`/formularios`)
* Módulo especializado para mapear e preencher formulários complexos de sistemas internos ou sites corporativos com múltiplos inputs em uma única execução.

### Preview Lado a Lado (`PreviewModal`)
* Modal de visualização estruturado em duas colunas: à esquerda, os cards da árvore hierárquica de blocos; à direita, a simulação do texto final renderizado em tempo real com resolução idêntica à do motor de injeção.

### Acessibilidade Visual
* Sistema de cores canônico com Fonte Única da Verdade (`tokenColors.ts`) e variáveis CSS centralizadas. A paleta foi revisada para atribuir famílias cromáticas distintas a cada tipo de token e bloco, garantindo contraste adequado e diferenciação visual clara, inclusive sob formas comuns de daltonismo (protanopia e deuteranopia).

### Analytics Local
* Registro local de expansões, volume de caracteres gerados e estimativa de tempo economizado. Os dados nunca saem do navegador e não utilizam serviços externos de rastreamento.

---

## Instalação

### Firefox (Canal Self-Hosted com Auto-Update)
A extensão para Firefox é distribuída diretamente via canal assinado pela Mozilla hospedado no GitHub Pages:

1. Baixe o pacote assinado: **[sote-1.0.18-firefox.xpi](https://kouttak.github.io/SOTE2/releases/sote-1.0.18-firefox.xpi)**.
2. Arraste o arquivo `.xpi` para dentro de qualquer janela do Firefox e confirme a instalação.
3. O manifesto de atualização automática está configurado em: `https://kouttak.github.io/SOTE2/updates.json`.
   * Para conferir se a checagem automática de extensões está ativa, abra `about:config` no Firefox e valide se `extensions.update.enabled` está `true`.

### Google Chrome / Chromium
1. Clone ou baixe o código-fonte deste repositório.
2. Gere o pacote de produção com `npm run build:chrome`.
3. Acesse `chrome://extensions/` e ative o **Modo do desenvolvedor** no canto superior direito.
4. Clique em **Carregar sem compactação** e selecione o diretório `.output/chrome-mv3`.

---

## Desenvolvimento Local e Testes

O projeto utiliza o toolkit [WXT](https://wxt.dev/) integrado com [Vite](https://vitejs.dev/) e TypeScript.

### Requisitos
* Node.js 18 ou superior
* npm

### Instalação
```bash
npm install
```

### Ambiente de Desenvolvimento
Inicia o modo de desenvolvimento com hot module reloading (HMR):
```bash
npm run dev
```

### Suíte de Testes Automatizados
O projeto conta com 280 testes unitários organizados em 32 arquivos utilizando [Vitest](https://vitest.dev/). A suíte cobre resolução de condições, avaliação matemática, sanitização contra XSS, persistência, reatividade do DOM e componentes da interface:
```bash
npm test
```

### Builds de Produção
```bash
# Compilar versão Chrome MV3 (saída em .output/chrome-mv3)
npm run build:chrome

# Compilar versão Firefox MV3 (saída em .output/firefox-mv3)
npm run build:firefox

# Empacotar zip para o Firefox (saída em .output/sote-X.X.X-firefox.zip)
npm run zip:firefox
```

---

## Estrutura do Repositório

```text
├── src/
│   ├── background/         # Service worker, hub de mensagens e motor de analytics local
│   ├── content/            # Injeção em inputs, monitor de digitação e detecção de gatilhos
│   │   ├── engine/         # Resolvers lógicos (ConditionResolver, ActionContentResolver, tokenExpander)
│   │   ├── palette/        # CommandPalette global (Ctrl+Shift+P)
│   │   └── search/         # Pop-up de busca de templates
│   ├── dashboard/          # Painel SPA (editor visual de fluxos, variáveis, formulários, estatísticas)
│   │   ├── components/     # Componentes modulares (PreviewModal, modais de tokens, blocos do editor)
│   │   └── pages/          # Páginas e rotas da interface de gerenciamento
│   ├── popup/              # Menu popup acionado no ícone da barra de navegação
│   └── shared/             # StorageService, sanitização HTML, tipos, i18n e constantes de cores
├── releases/               # Binários .xpi assinados para auto-update self-hosted
├── docs/                   # Guias técnicos de desenvolvimento e publicação
├── updates.json            # Manifesto de atualização contínua para Firefox no GitHub Pages
├── CHANGELOG.md            # Histórico de versões e alterações detalhadas
└── wxt.config.ts           # Configuração de compilação multi-browser
```

---

## Sobre o Desenvolvimento e Uso de IA

Partes significativas deste projeto — incluindo diagnóstico e resolução de bugs complexos de estado do DOM, implementação de novos blocos e tokens dinâmicos, refatoração de componentes visuais (como o PreviewModal em 2 colunas e a paleta de cores acessível), automação do processo de publicação e geração de documentação técnica (como o CHANGELOG.md e este README) — foram desenvolvidas com o apoio de ferramentas de inteligência artificial (agentes autônomos de desenvolvimento assistido), sob especificação, supervisão contínua e validação técnica do mantenedor.

Todo o código-fonte gerado ou refatorado é submetido à suíte de testes automatizados da extensão (atualmente com 280 testes em 32 arquivos cobrindo regressões, parsing e regras de negócio) e passa por builds completos de produção para os dois motores de navegador suportados antes de cada publicação.

---

## Histórico de Alterações

Para consultar o registro de alterações por versão, acesse o [CHANGELOG.md](./CHANGELOG.md).