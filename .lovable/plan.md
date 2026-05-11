## Fase A — Squash plan housekeeping

Quatro mudanças sem risco de regressão e sem migration de DB.

### Passo 1 — Corrigir `src/services/admin/sessoes.service.ts`

Substituir o acesso direto a `user_sessions` (tabela inexistente) por chamadas à Edge Function `admin-sessions`, padrão já usado por `adminSessions.service.ts` e `useSessoes.ts`.

- Remover `supabaseUntyped` e o cast.
- `listarSessoes(opts)` → `supabase.functions.invoke('admin-sessions', { body: { action: 'list' } })`, depois aplicar `apenasAtivas` / `userId` em memória sobre o array retornado.
- `revogarSessao(sessionId)` → a Edge Function revoga por `userId`. Como a interface pública atual recebe `sessionId` mas nenhum consumidor importa este módulo (verificado: `rg` retornou 0 hits), renomear o parâmetro para `userId` e invocar `{ action: 'revoke', userId }`. Manter o nome da função.
- Manter `UserSession` e `ListarSessoesOptions` como tipos exportados; mapear o payload da Edge (`SessaoAtiva`) para `UserSession` preenchendo: `id`, `user_id`, `created_at`, `last_active_at` ← `last_sign_in_at ?? created_at`, `ip_address` ← `ip`, `user_agent`, `is_active: true`.
- Atualizar o JSDoc do topo do arquivo (não mais "tabela `user_sessions`").

### Passo 2 — `scripts/check-schema-drift.mjs`

Antes do loop de impressão de `unknownTables` (linha ~323), adicionar:

```js
// Exceções conhecidas — não são tabelas do banco:
//  - dbavizee, email-assets: nomes de buckets de Storage (.storage.from)
//  - x: placeholder usado em comentário JSDoc de fromUntyped.ts
const KNOWN_EXCEPTIONS = new Set(['dbavizee', 'email-assets', 'x']);
```

E filtrar:
```js
for (const [t, n] of [...unknownTables.entries()]
  .filter(([t]) => !KNOWN_EXCEPTIONS.has(t))
  .sort()) { ... }
```

Ajustar também a checagem `if (unknownTables.size > 0)` para considerar o tamanho pós-filtro (não imprimir o cabeçalho se vazio).

### Passo 3 — Criar `docs/fase-a-schema-inventory.md`

Novo documento com o conteúdo fornecido pelo usuário (inventário de objetos críticos, sequences, buckets, cron jobs, SECURITY DEFINER functions, tabelas de maior churn, instruções de pg_dump manual e tabela de status).

### Passo 4 — Criar `scripts/schema-inventory.sql`

Novo arquivo com as 7 queries fornecidas (sequences, tabelas+tamanho, SECURITY DEFINER, RLS policies, triggers, cron.job, índices compostos) para o desenvolvedor executar no Supabase Dashboard → SQL Editor.

### Passo 5 — Atualizar `docs/migrations-squash-plan.md`

- Cabeçalho: trocar "Status: plano" por "Status: **Fase A em andamento** (2026-05-11). Inventário: 254 migrations (de 20260409 até 20260508). +66 desde a versão anterior. CI: schema-drift check rodando em ci.yml — item concluído."
- Adicionar nota na seção "Recomendação atual" (ou criar a seção se não existir) advertindo que Fase C deve aguardar até velocidade ≤2 migrations/dia por ≥3 dias consecutivos.

## Validação

- `node scripts/check-schema-drift.mjs` → não deve listar `dbavizee`, `x`, `email-assets`.
- `tsc -p tsconfig.strict-core.json --noEmit` cobrindo `src/services/admin/sessoes.service.ts` (sem o cast `any`, deve compilar limpo).
- Sem migration de DB nesta onda.