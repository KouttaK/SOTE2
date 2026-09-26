# Guia de Publicação e Atualizações Automáticas (Firefox Self-Hosted)

Este documento descreve o fluxo operacional para empacotamento, assinatura e publicação de novas versões da extensão SOTE 2 fora da Mozilla Add-ons (AMO), utilizando o GitHub Pages como servidor de auto-update contínuo.

---

## Estrutura Configurada

* **Manifesto Gecko (`wxt.config.ts`):**
  * `id`: `sote2@kouttak.github.io` *(imutável para preservar histórico do add-on no navegador)*
  * `update_url`: `https://kouttak.github.io/SOTE2/updates.json`
  * `strict_min_version`: `140.0`
* **Hospedagem:**
  * GitHub Pages ativado no repositório `KouttaK/SOTE2` a partir da branch `main` na raiz (`/`).
  * URL base: `https://kouttak.github.io/SOTE2/`
  * Subpasta de pacotes: `/releases/`

---

## Passo a Passo para Novas Versões

### 1. Incrementar a Versão
Atualize o campo `"version"` no arquivo `package.json` (ex: `1.0.19`).

### 2. Gerar os Pacotes de Produção
Compile e gere o pacote do Firefox com o WXT:
```powershell
npm run build:firefox
npm run zip:firefox
```
O comando `zip:firefox` gera o arquivo compactado em `.output\sote-<versão>-firefox.zip`.

### 3. Assinatura do Add-on
Para que o Firefox padrão permita a instalação e auto-update, o arquivo `.xpi` precisa ser assinado pela Mozilla (canal *unlisted* / self-distribution):
1. Submeta o `.zip` no Developer Hub da Mozilla ou via script de API utilizando as credenciais salvas em `.env.submit`.
2. Baixe o `.xpi` assinado retornado pela Mozilla.
3. Salve o arquivo na pasta `releases/` seguindo a convenção:
   `releases/sote-<versão>-firefox.xpi`

### 4. Calcular o Hash SHA256 do Binário
No PowerShell, obtenha o hash SHA256 exato do binário assinado:
```powershell
Get-FileHash .\releases\sote-<versão>-firefox.xpi -Algorithm SHA256
```

### 5. Atualizar o `updates.json`
Adicione o novo bloco de versão no topo da lista `"updates"` em `updates.json`:
```json
{
  "version": "<versão>",
  "update_link": "https://kouttak.github.io/SOTE2/releases/sote-<versão>-firefox.xpi",
  "update_hash": "sha256:<HASH_EM_MINUSCULAS_OU_MAIUSCULAS>",
  "applications": {
    "gecko": { "strict_min_version": "140.0" }
  }
}
```

### 6. Publicar no GitHub
Adicione os arquivos, commite e envie para o branch principal:
```powershell
git add updates.json releases/sote-<versão>-firefox.xpi CHANGELOG.md
git commit -m "release: v<versão> - Firefox self-hosted update"
git push origin main
```

---

## Validação e Testes do Auto-Update

### No Navegador Firefox
1. Abra `about:config` na barra de endereços.
2. Certifique-se de que `extensions.update.enabled` está definido como `true`.
3. Para forçar a verificação a cada 2 minutos (em vez do intervalo padrão de 24 horas), ajuste temporariamente:
   `extensions.update.interval` = `120`
4. Reinicie o navegador ou abra `about:addons`, clique no ícone de engrenagem e selecione **Verificar atualizações**.

### Diagnóstico de Erros
Se a atualização não for detectada ou falhar:
* Abra o **Console do Navegador** (`Ctrl+Shift+J`).
* Filtre por `sote` ou `update`.
* Erros comuns:
  * **Hash divergente:** CDN/GitHub Pages ainda servindo cache do `.xpi` antigo. Aguarde alguns minutos.
  * **Versão estrita (strict_min_version):** Verifique se a versão instalada do Firefox atende ao valor declarado no manifesto.
