# Atualizações automáticas via GitHub Pages (self-hosted, fora da AMO)

Baseado no manifesto de atualização da Mozilla:
https://extensionworkshop.com/documentation/manage/updating-your-extension/

## O que já está configurado no projeto

`wxt.config.ts` já tem `browser_specific_settings.gecko` com `id`, `update_url` (apontando pro padrão de URL do GitHub Pages) e `strict_min_version`.

Já preenchi com seus dados reais (repo `KouttaK/SOTE2`):
- `update_url` / `update_link` apontando para `https://kouttak.github.io/SOTE2/...`
- `id`: `sote2@kouttak.github.io` (é só uma string única, não precisa ser um domínio que você realmente possua — mas **depois de escolher, nunca mude**, ou o Firefox trata como um add-on diferente e os usuários perdem o histórico de instalação/update). Se quiser outro id antes do primeiro release, é só trocar em `wxt.config.ts` e `updates.template.json`.

## 1. Criar o repositório no GitHub

1. Crie um repositório **público** no GitHub (tem que ser público pro GitHub Pages gratuito funcionar sem custo) — pode ser um repo novo só pra isso, ex: `sote2-updates`, ou usar o mesmo repo do código-fonte.
2. Vá em **Settings → Pages**.
3. Em "Build and deployment" → **Source**, escolha **Deploy from a branch**.
4. Branch: `main`, pasta: `/ (root)` (ou `/docs`, se preferir manter os arquivos de update separados do resto). Salve.
5. O GitHub mostra a URL publicada, algo como:
   `https://kouttak.github.io/SOTE2/`
   (pode levar 1–2 minutos pra ficar no ar na primeira vez).

## 2. Gerar o pacote da extensão

`npm run build:firefox` só gera os arquivos soltos dentro de `.output/firefox-mv3/` — isso **não é** o `.xpi`. Pra empacotar corretamente (com a estrutura de zip que o Firefox espera), use o comando do próprio WXT em vez de zipar a pasta manualmente:

```powershell
npm run zip:firefox
```

Isso gera algo como `.output\sote-1.0.0-firefox.zip`. Só renomeie a extensão de `.zip` pra `.xpi` (é o mesmo formato, muda só o nome):

```powershell
Rename-Item .output\sote-1.0.0-firefox.zip sote2-1.0.0.xpi
```

Se for distribuir fora da loja pra usuários comuns (não só builds Developer/Nightly com flag especial), o Firefox exige que esse `.xpi` esteja **assinado** — veja [self-distribution / signing da Mozilla](https://extensionworkshop.com/documentation/publish/self-distribution/).

## 3. Calcular o hash do `.xpi`

Você está no PowerShell (Windows), então `shasum` não existe — o equivalente nativo é `Get-FileHash`:

```powershell
Get-FileHash .\sote2-1.0.0.xpi -Algorithm SHA256
```

Copie o valor da coluna `Hash` (vem em maiúsculas — pode deixar em maiúsculas ou minúsculas, tanto faz, mas mantenha o prefixo `sha256:` em minúsculo no `updates.json`, é só o prefixo do formato que a Mozilla exige).

## 4. Preencher o `updates.json`

Copie `updates.template.json` → `updates.json` e preencha:
- o mesmo `id` que está em `wxt.config.ts`,
- `version` = a versão do `package.json`/manifest,
- `update_link` = `https://kouttak.github.io/SOTE2/sote2-1.0.0.xpi`,
- `update_hash` = `sha256:` + hash calculado no passo 3.

## 5. Subir os arquivos pro GitHub

Coloque na raiz do repo (ou em `/docs`, se foi essa a pasta escolhida no Pages):
- `updates.json`
- o arquivo `.xpi` (ex: `sote2-1.0.0.xpi`)

```bash
git add updates.json sote2-1.0.0.xpi
git commit -m "release 1.0.0"
git push
```

Depois do push, o GitHub Pages leva alguns minutos pra republicar. Confirme abrindo `https://kouttak.github.io/SOTE2/updates.json` direto no navegador — tem que carregar o JSON puro (o GitHub Pages serve `.json` com o content-type certo automaticamente, sem configuração extra).

## 6. A cada nova versão

Repita os passos 2–5: build → gerar/assinar `.xpi` → hash → adicionar uma nova entrada em `updates.json` (pode manter as versões antigas na lista, ou deixar só a mais recente) → commit e push.

## Testando o auto-update

No Firefox: `about:config` → `extensions.update.interval` → `120` (mínimo suportado, checa a cada 2 min) e confirme que `extensions.update.enabled` está `true`. Reinicie o Firefox.

Se não atualizar: **Ferramentas do navegador → Console do navegador**, filtre pelo nome da extensão ou pela URL de update, e veja os erros. Um erro de hash divergente logo depois de publicar geralmente é o GitHub Pages/CDN ainda servindo uma versão em cache do `.xpi` — espere alguns minutos e teste de novo.
