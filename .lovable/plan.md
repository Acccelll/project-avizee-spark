

# Plan: P0-P3 Implementation (20 Prompts)

This is a large cross-cutting implementation spanning Edge Functions, migrations, security hardening, and code quality. Due to scope, I'll execute in batches.

---

## Batch 1: P0 — Functional (Prompts 1-6)

### Prompt 1 — Edge Function `sefaz-proxy`
Create `supabase/functions/sefaz-proxy/index.ts`:
- Import `node-forge` from esm.sh
- Handle `action: "assinar-e-enviar"`: parse PFX, extract private key + cert, compute SHA-1 digest of `<infNFe>`, sign with RSA-SHA1, inject `<Signature>` (xmldsig), wrap in SOAP envelope, send to SEFAZ URL
- Handle `action: "parse-certificado"`: extract CNPJ from subject serialNumber, razaoSocial from CN, validity dates from cert
- JWT auth via Supabase, CORS via `ALLOWED_ORIGIN`

### Prompt 2 — Rewrite `httpClient.service.ts`
Replace direct `fetch()` to SEFAZ with `supabase.functions.invoke('sefaz-proxy', { body: { action: 'assinar-e-enviar', ... } })`. Keep `SefazResponse`, `SefazRequestOptions`, `enviarParaSefaz()` public interface. Add `certificado_base64` and `certificado_senha` as new required params.

### Prompt 3 — Simplify `assinaturaDigital.service.ts`
Keep only types `CertificadoDigital` and `AssinaturaResult`. Remove `assinarXML()` function. Add comment explaining signing happens in sefaz-proxy.

Update `autorizacao.service.ts` to pass certificado through to `enviarParaSefaz()` instead of calling `assinarXML()` separately.

### Prompt 4 — Edge Function `admin-sessions`
Create `supabase/functions/admin-sessions/index.ts`:
- Verify JWT, check admin role via `user_roles` table using service_role client
- `action: "list"`: `supabase.auth.admin.listUsers()`, map to `SessaoAtiva` interface
- `action: "revoke"`: `supabase.auth.admin.signOut(userId, 'global')`
- CORS with `ALLOWED_ORIGIN`, strict 500 if not set (like admin-users)

### Prompt 5 — Numeração atômica (migration)
Create `supabase/migrations/20260415000003_numeracao_atomica.sql`:
- Create sequences `seq_orcamento`, `seq_ordem_venda`, `seq_pedido_compra`, `seq_cotacao_compra`, `seq_nota_fiscal`
- Initialize each with `setval(seq, COALESCE(MAX(numero_int), 0) + 1)` based on existing data
- Create SECURITY DEFINER functions: `proximo_numero_orcamento()` → `'COT' || LPAD(nextval(...)::text, 6, '0')`, etc.
- Add UNIQUE constraints with `DO $$ EXCEPTION WHEN duplicate_object` guard
- Update `OrcamentoForm.tsx`: replace `COUNT(*)+1` with `supabase.rpc('proximo_numero_orcamento')` in both create and duplicate flows

### Prompt 6 — Atomic save via stored procedure
Create `supabase/migrations/20260415000004_fn_salvar_orcamento.sql`:
- `salvar_orcamento(p_id UUID, p_payload JSONB, p_itens JSONB)` — transactional upsert + delete-and-reinsert items
- Update `handleSave` and `handleDuplicate` in `OrcamentoForm.tsx` to use `supabase.rpc('salvar_orcamento', ...)`

### Prompt 7 — Email: keep Lovable Email (NOT Resend)
**Important deviation**: The project already uses `@lovable.dev/email-js` which is the built-in Lovable Email system. Per platform guidelines, I should NOT replace it with Resend. The existing `process-email-queue` is working correctly. I will skip this prompt or only document that the current implementation is correct.

### Prompt 8 — Certificate service rewrite
Rewrite `lerCertificadoA1()` in `certificado.service.ts` to call `supabase.functions.invoke('sefaz-proxy', { body: { action: 'parse-certificado', ... } })` instead of returning fake data.

---

## Batch 2: P1 — Security (Prompts 7-10)

### Prompt 9 — RLS restrictions (migration)
Create migration to:
- Restrict INSERT/UPDATE on `app_configuracoes`, `empresa_config` to admin only
- Restrict DELETE on `financeiro_lancamentos`, `financeiro_baixas`, `notas_fiscais`, `notas_fiscais_itens` to admin
- Drop DELETE policy on `auditoria_logs` (immutable)
- Add conditional UPDATE on `notas_fiscais` for authorized/cancelled status

### Prompt 10 — Vault for credentials
Create migration with `upsert_secret()` and `get_secret()` SECURITY DEFINER functions wrapping `vault.create_secret`/`vault.decrypted_secrets`.
Update `configuracoes.service.ts` to store sensitive fields via vault RPC.

### Prompt 11 — CORS strict in all Edge Functions
Update `social-sync`, `setup-admin`, `correios-api` to use `""` instead of `"*"` as CORS fallback. Ensure `admin-users` pattern (500 if not set) is documented.

### Prompt 12 — RLS read restrictions (migration)
Restrict SELECT on financial/audit tables to admin/financeiro roles.

---

## Batch 3: P2 — Database (Prompts 11-14)

### Prompt 13 — FK indexes (migration)
`CREATE INDEX CONCURRENTLY IF NOT EXISTS` for all FK columns and common filter columns across ~15 tables.

### Prompt 14 — CHECK constraints (migration)
Add CHECK constraints for status/tipo fields on all transactional tables using `DO $$ EXCEPTION` guard.

### Prompt 15 — Estoque trigger + UNIQUE docs (migration)
Create trigger `trg_estoque_movimentos_sync` and partial unique indexes on `cpf_cnpj` for clientes/fornecedores.

### Prompt 16 — Indexes for new modules (migration)
Indexes for `apresentacao_geracoes`, `workbook_geracoes`, `email_send_log`, `remessas`.

---

## Batch 4: P3 — Code Quality (Prompts 15-20)
These are large refactoring tasks. Due to scope constraints, I'll prioritize:
- Removing `@ts-nocheck` from OrcamentoForm (already being modified)
- Integration tests for fiscal and financial flows

Lower priority items (decomposing Clientes.tsx/Produtos.tsx, virtualizing DataTable, typing useSupabaseCrud) will be noted for follow-up.

---

## Files Created/Modified

| File | Action |
|------|--------|
| `supabase/functions/sefaz-proxy/index.ts` | Create |
| `supabase/functions/admin-sessions/index.ts` | Create |
| `supabase/migrations/20260415000003_*.sql` | Create (sequences + functions) |
| `supabase/migrations/20260415000004_*.sql` | Create (salvar_orcamento) |
| `supabase/migrations/20260415000007_*.sql` | Create (RLS restrictions) |
| `supabase/migrations/20260415000008_*.sql` | Create (vault functions) |
| `supabase/migrations/20260415000010_*.sql` | Create (RLS read) |
| `supabase/migrations/20260415000011_*.sql` | Create (FK indexes) |
| `supabase/migrations/20260415000012_*.sql` | Create (CHECK constraints) |
| `supabase/migrations/20260415000013_*.sql` | Create (estoque trigger + unique) |
| `supabase/migrations/20260415000014_*.sql` | Create (new module indexes) |
| `src/services/fiscal/sefaz/httpClient.service.ts` | Rewrite |
| `src/services/fiscal/sefaz/assinaturaDigital.service.ts` | Simplify |
| `src/services/fiscal/sefaz/autorizacao.service.ts` | Update |
| `src/services/fiscal/certificado.service.ts` | Rewrite |
| `src/pages/OrcamentoForm.tsx` | Update (RPC calls, remove @ts-nocheck) |
| `src/pages/configuracoes/services/configuracoes.service.ts` | Update (vault) |
| `supabase/functions/social-sync/index.ts` | CORS fix |
| `supabase/functions/setup-admin/index.ts` | CORS fix |
| `supabase/functions/correios-api/index.ts` | CORS fix |
| `src/tests/integration/fluxo-fiscal.test.ts` | Create |

## Key Decision: Email
The `process-email-queue` uses `@lovable.dev/email-js` which is the built-in Lovable Email system. Per platform policy, this should NOT be replaced with Resend. The current implementation is correct and functional.

## Risks
- `node-forge` via esm.sh in Deno Edge Functions may have compatibility issues — needs testing after deploy
- Vault functions require the `vault` extension to be enabled
- CORS strict mode requires `ALLOWED_ORIGIN` secret to be set before Edge Functions work

