

# Rodada Corretiva — Erros Ativos + Melhorias

## Issues Found

### 1. Orçamento: `transportadora_id` column missing
The `salvar_orcamento` RPC references columns that don't exist on the `orcamentos` table: `transportadora_id`, `frete_simulacao_id`, `origem_frete`, `servico_frete`, `prazo_entrega_dias`, `volumes`, `altura_cm`, `largura_cm`, `comprimento_cm`. The RPC was updated but the table migration was never applied.

**Fix**: Migration to add all 9 missing columns to `orcamentos`.

### 2. Clientes: `clientes_enderecos_entrega` table doesn't exist
The table was never created despite being referenced in `Clientes.tsx`.

**Fix**: Migration to create `clientes_enderecos_entrega` with columns matching the code's usage (id, cliente_id, descricao, logradouro, numero, complemento, bairro, cidade, uf, cep, principal, ativo, created_at), plus RLS policies.

### 3. Preços Especiais: column name mismatch
Code sends `vigencia_inicio`, `vigencia_fim`, `observacao` but the actual columns are `data_inicio`, `data_fim`, `observacoes`.

**Fix**: Update `PrecosEspeciaisTab.tsx` to use the correct column names.

### 4. Pedidos Compra: CHECK constraint blocks "aprovado" status
The `chk_pedidos_compra_status` only allows `'rascunho','enviado','parcial','recebido','cancelado'`. The code tries to insert with `status: "aprovado"`.

**Fix**: Migration to drop and recreate the constraint adding `'aprovado'` to the allowed values.

### 5. Tab switching causes reload
`refetchOnWindowFocus: false` is already set globally, so React Query isn't the culprit. The `AuthContext` fires `setSession`/`setUser` on `TOKEN_REFRESHED` events (triggered by Supabase GoTrue on tab return), which causes re-renders. Pages that use `useEffect` depending on auth state may re-fetch data, but this shouldn't cause form data loss. The real data loss risk is on pages using `window.location.reload()` after mutations (Financeiro). The tab-switch issue likely relates to `TOKEN_REFRESHED` triggering unnecessary profile/permissions re-fetches which cascade to child components.

**Fix**: In `AuthContext.tsx`, skip `setSession`/`setUser` on `TOKEN_REFRESHED` if the user ID hasn't changed (avoid unnecessary re-renders).

### 6. Financeiro: No warning on already-paid baixa + FluxoCaixa not reflecting saldo_restante
The `canBaixa` check hides the button for `pago` status, but the `BaixaParcialDialog` doesn't block submission if status changed between render and click. FluxoCaixa uses `l.valor` instead of `saldo_restante` for the realized calculation.

**Fix**:
- Add server-side check in `BaixaParcialDialog.handleSubmit` — re-fetch status before processing.
- In `FluxoCaixa.tsx`, use `saldo_restante` for partial payment tracking in the realized column.
- Replace `window.location.reload()` with `queryClient.invalidateQueries` in Financeiro.

### 7. Logística review
Deferred to a separate plan as the user asked for suggestions. Current assessment: the module needs a `tipo_remessa` column (already added in previous migration), but the UI doesn't expose it. The "Atualizar Rastreios" bulk button was added but the Entregas/Recebimentos tabs don't pull from `remessas`.

**Fix**: Update Logistica.tsx form to expose `tipo_remessa` selector and wire the Entregas/Recebimentos hooks to read from `remessas` by type.

---

## Execution Plan

### Migration 1: Orcamentos missing columns
```sql
ALTER TABLE public.orcamentos
  ADD COLUMN IF NOT EXISTS transportadora_id UUID,
  ADD COLUMN IF NOT EXISTS frete_simulacao_id TEXT,
  ADD COLUMN IF NOT EXISTS origem_frete TEXT,
  ADD COLUMN IF NOT EXISTS servico_frete TEXT,
  ADD COLUMN IF NOT EXISTS prazo_entrega_dias INTEGER,
  ADD COLUMN IF NOT EXISTS volumes INTEGER,
  ADD COLUMN IF NOT EXISTS altura_cm NUMERIC,
  ADD COLUMN IF NOT EXISTS largura_cm NUMERIC,
  ADD COLUMN IF NOT EXISTS comprimento_cm NUMERIC;
```

### Migration 2: clientes_enderecos_entrega
```sql
CREATE TABLE IF NOT EXISTS public.clientes_enderecos_entrega (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  -- actually references clientes
  descricao TEXT,
  logradouro TEXT, numero TEXT, complemento TEXT,
  bairro TEXT, cidade TEXT, uf TEXT, cep TEXT,
  principal BOOLEAN DEFAULT false,
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.clientes_enderecos_entrega ENABLE ROW LEVEL SECURITY;
-- RLS policies for authenticated users
```

### Migration 3: Fix pedidos_compra CHECK constraint
```sql
ALTER TABLE public.pedidos_compra DROP CONSTRAINT chk_pedidos_compra_status;
ALTER TABLE public.pedidos_compra ADD CONSTRAINT chk_pedidos_compra_status
  CHECK (status IN ('rascunho','enviado','parcial','recebido','cancelado','aprovado'));
```

### Code Changes

| File | Change |
|------|--------|
| `src/components/precos/PrecosEspeciaisTab.tsx` | Rename form fields: `vigencia_inicio`→`data_inicio`, `vigencia_fim`→`data_fim`, `observacao`→`observacoes` |
| `src/contexts/AuthContext.tsx` | Skip `setSession`/`setUser` on `TOKEN_REFRESHED` if user ID unchanged |
| `src/pages/Financeiro.tsx` | Replace 3x `window.location.reload()` with `crud.refetch()` or `queryClient.invalidateQueries` |
| `src/components/financeiro/BaixaParcialDialog.tsx` | Add status re-check before submission |
| `src/pages/FluxoCaixa.tsx` | Use `saldo_restante` in realized calculation |
| `src/pages/Logistica.tsx` | Expose `tipo_remessa` in form; wire Entregas/Recebimentos to remessas |

### Estimated files touched: ~8 files + 3 migrations

