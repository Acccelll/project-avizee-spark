

# Rodada Corretiva e Evolutiva — ERP AviZee

## Summary

This plan addresses 12 distinct areas across Dashboard, Produtos, Clientes, Fornecedores, Orçamentos, Compras, Logística, and Financeiro. Due to the breadth, implementation will proceed in 4 sequential batches.

---

## Batch 1: Clientes, Produtos, Fornecedores

### 1. Clientes — Comunicações (save fails)

**Root cause**: The `handleSaveComunicacao` inserts columns `responsavel_nome`, `retorno_previsto`, `status`, `data_hora` that do NOT exist on `cliente_registros_comunicacao`. The table only has: `id, cliente_id, tipo, assunto, conteudo, data_registro, responsavel_id, created_at`.

**Fix**:
- Migration: add columns `responsavel_nome TEXT`, `retorno_previsto DATE`, `status TEXT DEFAULT 'registrado'`, `data_hora TIMESTAMPTZ` to `cliente_registros_comunicacao`.
- No code changes needed — the insert payload already matches.

### 2. Clientes — Endereços Alternativos (save fails)

**Root cause**: The `clientes_enderecos_entrega` table exists (migration found), but it's not in the Supabase types because it was added via raw SQL. The code uses `(supabase as any)` to work around this, so the CRUD should work if the table migration ran.

**Action**: Verify table exists via query; if save still fails, the issue may be RLS. The current RLS policy uses `auth.role() = 'authenticated'` which differs from the typical `TO authenticated` pattern. Will confirm and fix if needed.

### 3. Produtos — Component search UX

**Current**: Component selection uses a raw `<Select>` dropdown which is hard to search through when many products exist.

**Fix**: Replace the component product `<Select>` with the existing `AutocompleteSearch` component (already used in CotacoesCompra), filtering `produtosDisponiveis` with search-as-you-type. Follow the same pattern as `FiscalAutocomplete`.

### 4. Produtos — CNPJ/CPF duplicate warning on edit

**Root cause**: `useDocumentoUnico` fires immediately when the document value is populated (on edit open), showing "already registered" warning for the record being edited. The hook does pass `excludeId` correctly, but it checks BOTH `clientes` AND `fornecedores` tables. On the Fornecedores page, `excludeId` is passed to filter `clientes.neq("id", excludeId)` but the ID belongs to `fornecedores` table — so it won't match and the check returns `isUnique=false`.

**Fix**: Add a `table` parameter to `useDocumentoUnico` so it knows which table to exclude from:
- When called from Clientes: exclude from `clientes` by ID
- When called from Fornecedores: exclude from `fornecedores` by ID
- Cross-table check should not exclude the current record

### 5. Fornecedores — Manual product linkage

**Current**: The "Compras" tab only shows auto-detected `produtos_fornecedores` entries (read-only). No way to manually add a product relationship.

**Fix**: Add an "Add Product" section below the existing context block, with:
- Product autocomplete (from `produtosCrud.data`)
- Price, lead time, unit fields
- Save button that inserts into `produtos_fornecedores`
- Delete button on existing entries

---

## Batch 2: Dashboard, Orçamentos

### 6. Dashboard — Date filters not working

**Root cause**: `DashboardPeriodContext` computes `range` correctly, and `loadData` in Index.tsx uses `globalRange.dateFrom`/`dateTo`. However, the queries apply `dateFrom` inconsistently — some use `.gte()` but not `.lte()` for `dateTo`. Also, `buildFinTotalQuery` only applies `dateTo` but not `dateFrom`, so "Today" and "This Week" periods show all-time financial data.

**Fix**:
- In `buildFinTotalQuery`: add `.gte("data_vencimento", dateFrom)` alongside the existing `.lte()`.
- In all other queries: ensure both `dateFrom` and `dateTo` bounds are applied consistently.
- Verify `orcamentos`, `pedidos_compra`, `notas_fiscais`, and `financeiro_lancamentos` queries all use both bounds.

### 7. Orçamentos — Field/schema alignment

**Current status**: Recent migrations added `desconto`, `imposto_st`, `imposto_ipi`, `outras_despesas` columns. The `salvar_orcamento` RPC was updated with date casts. Need to verify all form fields in `OrcamentoForm.tsx` map correctly to schema.

**Action**: Audit `OrcamentoForm.tsx` handleSave payload against `salvar_orcamento` RPC and `orcamentos` table columns. Fix any remaining mismatches. Test the full create → edit → convert-to-order flow.

---

## Batch 3: Compras (Cotações), Logística

### 8. Compras — Purchase quote flow end-to-end

The `useCotacoesCompra` hook already handles the full flow: create → add proposals → select → approve → generate order. Issues to fix:
- `gerarPedido` uses `Date.now().slice(-6)` for numbering — replace with `proximo_numero_pedido_compra()` RPC.
- Add the missing `status` value `"convertida"` to the `cotacoes_compra` CHECK constraint (if not already there).
- Verify `pedidos_compra_itens` insert payload matches schema.

### 9. Logística improvements

Multiple sub-items:

**a) Remessa type (Entrega vs Recebimento)**: Add a `tipo_remessa` column (`entrega` | `recebimento`) to `remessas` table. Update the form modal to show a type selector. Filter remessas into Entregas/Recebimentos tabs based on this field + linked `ordem_venda_id`/`pedido_compra_id`.

**b) "Atualizar Rastreios" button**: Add a button next to "Nova Remessa" in the header that calls `handleRastrear` for all remessas with `codigo_rastreio` and non-terminal status.

**c) Remessas feeding Entregas/Recebimentos**: Update `useEntregas` and `useRecebimentos` hooks to also query remessas linked via `ordem_venda_id` and `pedido_compra_id` respectively, merging tracking data.

**d) Estoque Posição Atual manual adjustment**: Improve the adjust dialog in `Estoque.tsx` to show current stock, target value, and reason field.

---

## Batch 4: Financeiro

### 10. Block baixa on already-paid items

**Current**: The "Baixar" button already checks `canBaixa = es !== "pago" && es !== "cancelado"` and hides the button. But the `BaixaParcialDialog` doesn't validate on open.

**Fix**:
- Add validation in `BaixaParcialDialog.handleSubmit`: if `lancamento.status === 'pago'` or `saldo_restante <= 0`, show error toast and return.
- In `BaixaLoteModal`: filter out already-paid items from selection with a warning message.

### 11. Estorno with mandatory reason

**Current**: `processarEstorno` in `financeiro.service.ts` does not require a reason. The `ConfirmDialog` doesn't have a text field.

**Fix**:
- Add `motivo_estorno` parameter to `processarEstorno`.
- Store the reason in a new `motivo_estorno TEXT` column on `financeiro_lancamentos`.
- Update the estorno `ConfirmDialog` in `Financeiro.tsx` to include a required `<Textarea>` for the reason. Disable confirm button until filled.
- After successful estorno, status returns to `aberto` and the item becomes available for baixa again (already works).

### 12. Fluxo de Caixa fed by Contas a Pagar/Receber

**Current**: `FluxoCaixa.tsx` already queries `financeiro_lancamentos` and groups by `data_vencimento`, showing previsto vs realizado. This is fundamentally correct.

**Improvements**:
- Include `saldo_restante` in the realizado calculation for partial payments.
- Add bank account initial balance from `contas_bancarias.saldo_atual` to the cumulative chart.
- Show tooltip with breakdowns (previsão a receber, previsão a pagar, realizado).

---

## Database Migrations Required

1. `cliente_registros_comunicacao`: ADD `responsavel_nome`, `retorno_previsto`, `status`, `data_hora`
2. `remessas`: ADD `tipo_remessa TEXT DEFAULT 'entrega'`
3. `financeiro_lancamentos`: ADD `motivo_estorno TEXT`
4. `cotacoes_compra` CHECK constraint: add `'convertida'` if missing

## Files Modified (estimated)

| Area | Files |
|------|-------|
| Clientes | Migration SQL, no code changes needed |
| Produtos | `src/pages/Produtos.tsx` (component search) |
| CNPJ check | `src/hooks/useDocumentoUnico.ts`, `Clientes.tsx`, `Fornecedores.tsx` |
| Fornecedores | `src/pages/Fornecedores.tsx` (product linkage) |
| Dashboard | `src/pages/Index.tsx` (date filter queries) |
| Orçamentos | `src/pages/OrcamentoForm.tsx` (field audit) |
| Cotações | `src/hooks/useCotacoesCompra.ts` (numbering, constraint) |
| Logística | `src/pages/Logistica.tsx`, `useEntregas.ts`, `useRecebimentos.ts`, Migration |
| Financeiro | `src/pages/Financeiro.tsx`, `src/services/financeiro.service.ts`, `BaixaParcialDialog.tsx`, Migration |
| Fluxo Caixa | `src/pages/FluxoCaixa.tsx` |

## Execution Order

Batch 1 first (quick DB fixes + UI), then Batch 2 (Dashboard + Orçamentos audit), then Batch 3 (Logística), then Batch 4 (Financeiro). Each batch will be verified with `tsc --noEmit` before proceeding.

