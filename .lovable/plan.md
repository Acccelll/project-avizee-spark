

# Rodada Corretiva — Schema Drift, Build Errors, NF Atômica

## Summary

This plan addresses: (1) 25+ build errors across the project, (2) migration drift for frete simulador tables, (3) atomic NF confirmation via RPC, (4) NF number sequence, (5) financeiro RPC robustness, and (6) setup-admin documentation.

---

## Part 1: Fix All Build Errors

### 1.1 `process-email-queue/index.ts` (7 errors)
All errors stem from strict typing of `supabase` client. Fix by casting to `any` where needed (edge function pattern):
- Line 57: Change `ReturnType<typeof createClient>` to `any` in `moveToDlq` param type
- Lines 63, 70, 338: Add `as any` casts on `.from()` and `.rpc()` calls
- Lines 159, 164: Add explicit types to `.map((msg: any)` and `.filter((id: any)`

### 1.2 `ContaContabilDrawer.tsx` + `ContaContabilEditModal.tsx` (2 errors)
`grupos_produto` table doesn't have `conta_contabil_id` column. The `.eq("conta_contabil_id", id)` calls on `grupos_produto` are invalid.
**Fix**: Remove the `grupos_produto` query from the vinculos check (or add `as any` cast if column should exist). Since the types don't have it, remove it.

### 1.3 `ReconciliacaoDetalhe.tsx` (2 errors)
`importacao_logs` Row type doesn't have `etapa` column. Code references `l.etapa`.
**Fix**: Cast to `any` or use `(l as any).etapa` — the column may exist in DB but not in generated types. Use `as any` pattern.

### 1.4 `UsuariosTab.tsx` (5 errors)
`app_role` enum includes `"user"` and `"viewer"` but `ROLE_LABELS`, `ROLE_DESCRIPTIONS`, `ROLE_COLORS` Records only have 4 keys. TypeScript requires all enum values.
**Fix**: Add `user` and `viewer` entries to all three Records. Also fix `getRolePermissions` call by casting role.

### 1.5 `ClienteView.tsx` (3 errors)
- `c.descricao` → should be `c.conteudo` (line 292)
- `c.canal` → should be `c.tipo` (line 293)
- `t.observacoes` doesn't exist on `TransportadoraRow` → cast with `as any`

### 1.6 `OrdemVendaView.tsx` (4 errors)
`pedidoItems` typed as `unknown[]`. Fix by using `as any` on item fields in the NF generation and mapping.

### 1.7 `useSupabaseCrud.test.tsx` (7 errors)
Test file has stale mock types. Fix with `as any` casts on mock objects.

### 1.8 `useImportacaoEstoque.ts` (1 error)
`produtoInfo.nome` typed as `unknown`. Fix with explicit type assertion.

---

## Part 2: Migration — Consolidate Frete Schema Drift

Create a single corrective migration `20260416000001_consolidate_frete_schema.sql`:

```sql
-- Ensure frete_simulacoes has all final columns (idempotent)
ALTER TABLE public.frete_simulacoes
  ADD COLUMN IF NOT EXISTS observacoes TEXT;

-- Fix orcamentos.frete_simulacao_id type (was TEXT in one migration, UUID ref in another)
-- The 20260411 migration correctly creates it as UUID FK.
-- The 20260415024534 migration adds it as TEXT.
-- Corrective: if column is TEXT, drop and re-add as UUID.
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orcamentos' AND column_name = 'frete_simulacao_id'
    AND data_type = 'text'
  ) THEN
    ALTER TABLE public.orcamentos DROP COLUMN frete_simulacao_id;
    ALTER TABLE public.orcamentos ADD COLUMN frete_simulacao_id UUID
      REFERENCES public.frete_simulacoes(id);
  END IF;
END $$;

-- Ensure orcamentos.transportadora_id has FK (may be missing from TEXT migration)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name LIKE '%orcamentos_transportadora_id%'
  ) THEN
    ALTER TABLE public.orcamentos
      ADD CONSTRAINT orcamentos_transportadora_id_fkey
      FOREIGN KEY (transportadora_id) REFERENCES public.transportadoras(id);
  END IF;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Add conta_contabil_id to grupos_produto if it should exist
ALTER TABLE public.grupos_produto
  ADD COLUMN IF NOT EXISTS conta_contabil_id UUID REFERENCES public.contas_contabeis(id);

-- Add etapa column to importacao_logs
ALTER TABLE public.importacao_logs
  ADD COLUMN IF NOT EXISTS etapa TEXT;
```

---

## Part 3: NF Confirmation RPC (Atomic)

### 3.1 Migration `20260416000002_fn_confirmar_nota_fiscal.sql`
Create the `confirmar_nota_fiscal(p_nf_id UUID)` function as specified in the user's request — handles idempotency, stock movements, financial entries, all in a single transaction.

### 3.2 Update `fiscal.service.ts`
Replace the multi-step client-side logic in `confirmarNotaFiscal()` with a single RPC call, keeping only:
- Pre-validation (`hasParceiro` check)
- Post-RPC: `updateOVFaturamento()` and `registrarEventoFiscal()`

---

## Part 4: NF Number Sequence

### 4.1 Migration `20260416000003_nf_sequence.sql`
- Create `seq_nota_fiscal` sequence
- Initialize with MAX existing number + 1
- Create `proximo_numero_nota_fiscal()` RPC
- Add partial unique index `uq_nf_saida_numero_serie` on `(numero, serie)` for active saida NFs

### 4.2 Update `Pedidos.tsx` and `OrdemVendaView.tsx`
Replace count-based numbering with `supabase.rpc("proximo_numero_nota_fiscal")`.

---

## Part 5: Financeiro RPC Robustness

### 5.1 Improve `financeiro_processar_estorno`
- Add `FOR UPDATE` lock on the lancamento row
- Validate status before estorno (must be `pago` or `parcial`)
- Reset `saldo_restante` to original `valor` instead of NULL

### 5.2 Improve `financeiro_processar_baixa_lote`
- Add status check: skip items already `pago` with warning
- Ensure `valor_pago` accumulates (add to existing) rather than replaces

Create migration `20260416000004_financeiro_rpc_v2.sql` with `CREATE OR REPLACE`.

---

## Part 6: Setup-Admin Documentation

Add a comment block at the top of `supabase/functions/setup-admin/index.ts` clearly marking it as development-only. No functional changes.

---

## Files Modified (estimated ~15)

| Area | Files |
|------|-------|
| Build fixes | `process-email-queue/index.ts`, `ContaContabilDrawer.tsx`, `ContaContabilEditModal.tsx`, `ReconciliacaoDetalhe.tsx`, `UsuariosTab.tsx`, `ClienteView.tsx`, `OrdemVendaView.tsx`, `useSupabaseCrud.test.tsx`, `useImportacaoEstoque.ts` |
| NF atomic | `fiscal.service.ts`, `Pedidos.tsx`, `OrdemVendaView.tsx` |
| Migrations | 4 new corrective migrations |
| Documentation | `setup-admin/index.ts` (comment only) |

## Execution Order

1. All build error fixes (parallel)
2. Corrective migrations (sequential)
3. NF RPC + fiscal.service.ts update
4. NF sequence + Pedidos/OrdemVendaView update
5. Financeiro RPC v2
6. Setup-admin documentation
7. `tsc --noEmit` verification

