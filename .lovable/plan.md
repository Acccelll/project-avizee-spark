## Phase 2 — Decompose Fiscal.tsx form state

### Goal
Move the ~700 lines of inline form/items/parcelas/fiscal-data state from `src/pages/Fiscal.tsx` into a dedicated hook so the orchestrator drops from ~2.016 → ~1.200 lines, and so the create/edit modal stops duplicating logic that already exists in `useFiscalNotaForm` (used by the `/fiscal/novo` page).

### Why not reuse `useFiscalNotaForm` directly
`useFiscalNotaForm` is page-mode (one fixed `notaId`, navigates on save). The modal in `Fiscal.tsx` switches between create/edit/anexar-XML at runtime, drives the Tradução XML drawer, owns quick-add flows, and must reset on close. Forcing it into the page-hook would break the modal lifecycle. Instead, extract a sibling hook tailored to the modal — sharing the same `FiscalFormState`/`NfItemFiscalData` types and the same `buildItemsPayload` helper.

### Scope (one new hook + light orchestrator surgery)

1. **Create `src/pages/fiscal/hooks/useFiscalModalForm.ts`** — owns:
   - `form`/`setForm`, `items`/`setItems`
   - `itemContaContabil`, `itemFiscalData`
   - `parcelas`, `primeiroVencimento`, `intervaloDias`, `parcelasPlano`
   - `mode` ("create" | "edit"), `selected` (NotaFiscal | null)
   - `modalOpen`, `saving`
   - lookups: `ordensVenda`, `contasContabeis`, `cartoes` (moved from inline `useEffect`)
   - derived `valorProdutos`, `totalImpostos`, `totalNF`
   - actions: `openCreate()`, `openEdit(nf)`, `closeModal()`, `resetForXml(baseForm, items, fiscalMap)`, `buildItemsPayload(nfId)`, `submit()`
   - The `submit()` body is the current `handleSubmit` (lines 966–1.06x) lifted verbatim, parameterized by `onSavedRefresh` (callback for `refresh()` + invalidations) and `onClose` (closeModal + URL cleanup).

2. **Reuse shared types**: import `FiscalFormState`, `NfItemFiscalData`, `emptyFiscalForm` from `useFiscalNotaForm.ts` instead of redeclaring `FiscalForm`/`emptyForm` in `Fiscal.tsx`. Delete the duplicated local declarations (lines 88–126).

3. **Wire `Fiscal.tsx`**:
   - Replace the ~20 `useState`/`useEffect` lines (190–214 region + lookups effect) with a single `const modalForm = useFiscalModalForm({ refresh, ... })`.
   - Update every reference (`form` → `modalForm.form`, etc.) — pure rename, no behaviour change.
   - Keep XML import (`useNFeXmlImport` integration), tradução drawer, quick-add modals, and lifecycle handlers (`handleConfirmar`/`handleEstornar`/etc.) in `Fiscal.tsx`. The hook exposes `setForm`/`setItems`/`setItemFiscalData` so those existing handlers keep working unchanged.
   - Drop now-unused imports (`upsertNotaFiscalComItens`, `listOrdensVendaParaFiscal`, `listContasContabeisLancaveis`, `listNotaFiscalItensCompletos`, `calcularTotalNF`, `criarRecorrenciaParaNfe`, etc.) that migrate to the hook.

4. **Do NOT touch in this session**:
   - JSX in lines 1.700–2.016 (form body, modal, drawers) — they will simply consume the renamed props.
   - `useNFeXmlImport`, `useFiscalVencimentosLoader`, `FiscalTableColumns`, lifecycle hooks (already extracted in Phase 1).
   - `useFiscalNotaForm` page hook stays as-is.
   - No SQL, no migrations.

### Expected outcome
- `Fiscal.tsx`: 2.016 → ~1.250 lines.
- New `useFiscalModalForm.ts`: ~480 lines (extracted, not new logic).
- Duplicated `FiscalForm`/`emptyForm` declarations removed (single source of truth in `useFiscalNotaForm.ts`).
- Behaviour unchanged: same create/edit/anexar-XML/recorrência/parcelas flows.

### Verification
- Open `/fiscal`, create new NF (entrada + saída), edit existing, import XML (with and without tradução pendente), anexar XML to existing NF, NF recorrente, NF a_prazo com parcelas customizadas. No regressions in console/network.

### Risks
- The current `handleSubmit` references several closures from `Fiscal.tsx` (`refresh`, `setSearchParams`, `setModalOpen`, `setSelected`, `setMode`, invalidation hooks). Solution: pass these as a single `deps` object to the hook factory. No magic.
- `setForm` is called from XML import paths and quick-add modals — kept exposed by the hook so those paths still work.

Proceed?
