# Atualizações automáticas via GitHub Pages (self-hosted, fora da AMO)

Baseado no manifesto de atualização da Mozilla:
https://extensionworkshop.com/documentation/manage/updating-your-extension/

## O que já está configurado no projeto

`wxt.config.ts` já tem `browser_specific_settings.gecko` com `id`, `update_url` (apontando pro padrão de URL do GitHub Pages) e `strict_min_version`.

⚠️ **Falta só você trocar os placeholders** em `wxt.config.ts` e em `updates.template.json`:
- `sote2@example.com` → um id único e definitivo seu (`nome@seudominio.com` ou `{uuid-v4}`). Depois de escolher, **nunca mude** — pro Firefox, um id diferente é um add-on diferente (perde histórico/instalação dos usuários).
- `SEU-USUARIO` e `SEU-REPO` → seu usuário e o nome do repositório no GitHub.

## 1. Criar o repositório no GitHub

1. Crie um repositório **público** no GitHub (tem que ser público pro GitHub Pages gratuito funcionar sem custo) — pode ser um repo novo só pra isso, ex: `sote2-updates`, ou usar o mesmo repo do código-fonte.
2. Vá em **Settings → Pages**.
3. Em "Build and deployment" → **Source**, escolha **Deploy from a branch**.
4. Branch: `main`, pasta: `/ (root)` (ou `/docs`, se preferir manter os arquivos de update separados do resto). Salve.
5. O GitHub mostra a URL publicada, algo como:
   `https://SEU-USUARIO.github.io/SEU-REPO/`
   (pode levar 1–2 minutos pra ficar no ar na primeira vez).

## 2. Gerar o pacote da extensão

```bash
npm run build:firefox
```

Isso gera o build do Firefox dentro de `.output/` (ou pasta equivalente do WXT). Você precisa empacotar isso como `.xpi` — se for distribuir fora da loja, o Firefox exige que o `.xpi` esteja assinado (veja [self-distribution / signing da Mozilla](https://extensionworkshop.com/documentation/publish/self-distribution/)). Sem assinatura, o usuário só consegue instalar manualmente em builds Developer/Nightly com uma flag específica — pra update automático "de verdade" em usuários comuns, a assinatura é necessária.

## 3. Calcular o hash do `.xpi`

```bash
shasum -a 256 sote2-1.0.0.xpi
```

Copie o hash gerado.

## 4. Preencher o `updates.json`

Copie `updates.template.json` → `updates.json` e preencha:
- o mesmo `id` que está em `wxt.config.ts`,
- `version` = a versão do `package.json`/manifest,
- `update_link` = `https://SEU-USUARIO.github.io/SEU-REPO/sote2-1.0.0.xpi`,
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

Depois do push, o GitHub Pages leva alguns minutos pra republicar. Confirme abrindo `https://SEU-USUARIO.github.io/SEU-REPO/updates.json` direto no navegador — tem que carregar o JSON puro (o GitHub Pages serve `.json` com o content-type certo automaticamente, sem configuração extra).

## 6. A cada nova versão

Repita os passos 2–5: build → gerar/assinar `.xpi` → hash → adicionar uma nova entrada em `updates.json` (pode manter as versões antigas na lista, ou deixar só a mais recente) → commit e push.

## Testando o auto-update

No Firefox: `about:config` → `extensions.update.interval` → `120` (mínimo suportado, checa a cada 2 min) e confirme que `extensions.update.enabled` está `true`. Reinicie o Firefox.

Se não atualizar: **Ferramentas do navegador → Console do navegador**, filtre pelo nome da extensão ou pela URL de update, e veja os erros. Um erro de hash divergente logo depois de publicar geralmente é o GitHub Pages/CDN ainda servindo uma versão em cache do `.xpi` — espere alguns minutos e teste de novo.
