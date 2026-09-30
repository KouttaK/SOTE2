# Migrations & Rollbacks

O SOTE 2 adota um sistema de schema persistente gerenciado pelo `MigrationService`. As migrações são estruturadas de forma atômica e idempotente.

## Ciclo de Vida da Migração

1. Ao abrir o aplicativo, `StorageService.initialise()` carrega o estado do banco.
2. O `MigrationService.checkAndMigrate` entra em cena verificando a versão em `schemaVersion`.
3. Se estiver desatualizado, um backup da raiz (ex: `backup_schema_v1`) é salvo atomicamente usando a cota local do `browser.storage.local`.
4. A transposição dos dados (extração, remapeamento) ocorre e a nova versão é salva no disco.

## Segurança e Cota Estourada (Soft Lock)

Se a extensão tentar fazer o backup e esbarrar no limite de armazenamento do Firefox (`QuotaExceededError`), a migração **é abortada** de forma segura. A extensão continuará rodando com os dados da versão antiga sem quebrar. Uma flag interna é acionada (`isMigrationPending`) orientando a interface a solicitar uma exportação manual do JSON pelo usuário. Após o usuário exportar, o método `StorageService.forceMigrate()` é invocado, ignorando a etapa de backup local e forçando a subida de versão.

## Executando um Rollback de Emergência (Reversão de Schema)

Para reverter um upgrade malsucedido, não basta gravar o backup sobre o estado atual via `set()`, porque a API do WebExtensions efetua uma *mesclagem (merge)*, mantendo chaves orfãs de versões futuras (como listas adicionadas na V2) e causando corrupção híbrida.

A extensão possui um método canônico projetado para desfazer a migração atomicamente: **`MigrationService.rollbackToV1()`**. 

Ele faz o seguinte:
1. Carrega o backup contido na chave `backup_schema_v1`.
2. Lê todas as chaves correntes da raiz do banco e **deleta permanentemente** qualquer chave que não existia na V1 (incluindo o próprio `schemaVersion`).
3. Sobrescreve as chaves válidas com o dado extraído do backup.

### Como acionar manualmente via DevTools
Se por acaso você atualizar a extensão de desenvolvimento e um novo schema quebrar sua UI, você pode usar o console da página de Dashboard/Background (Service Worker) para aplicar a reversão de emergência, já que o método está anexado internamente na camada da aplicação:

1. Abra o Dashboard (opções) e acesse o `Inspect` (F12).
2. Como os módulos ESM podem estar encapsulados, injete no console:
   ```javascript
   (async () => {
     const { MigrationService } = await import(chrome.runtime.getURL('chunks/MigrationService.js'));
     await MigrationService.rollbackToV1();
     console.log("Banco revertido com sucesso! Pressione F5.");
   })();
   ```
*(Nota: O caminho `chunks/MigrationService.js` pode variar de acordo com o bundler do Vite, mas na fase de desenvolvimento a função pode ser exposta no escopo global para facilitar. Para simplificar no fluxo normal de dev, execute `await browser.storage.local.clear()` e reimporte seu JSON original se não quiser usar o script acima).*
