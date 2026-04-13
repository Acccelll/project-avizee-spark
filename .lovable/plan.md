

# Plan: Fix Build Errors + Review Workbook/Apresentação/MigracaoDados/Clientes

## Summary of Issues Found

There are **3 groups** of build errors plus a UX concern about the Clientes contacts tab.

---

## 1. Edge Function Build Errors (`process-email-queue/index.ts`)

**Root cause**: The `createClient` from `@supabase/supabase-js@2` infers strict table types. Since this edge function doesn't have access to the project's generated types, `supabase.from('email_send_log').insert(...)` resolves the row type to `never`.

**Fix**: Change `createClient` call to use explicit `any` generic: `createClient<any>(supabaseUrl, supabaseServiceKey)`. This also fixes the `moveToDlq` parameter type mismatch and the `msg`/`id` implicit `any` errors.

Also add explicit types to the `.map()` callbacks:
- `(msg: any)` on line 159
- `(id: any)` on line 164

---

## 2. Apresentação Build Errors

### 2a. `fetchPresentationData.ts` (lines 93-96)
**Root cause**: `competenciaByFechamentoId` is inferred as `Map<string, string>` but within the generic function `byComp`, the `comp` variable ends up typed as `unknown` due to how TypeScript resolves the Map `.get()` return when the key comes from a generic type.

**Fix**: Add explicit type annotation: `const comp: string = ...` or cast `comp as string` in the Map operations.

### 2b. `generatePresentation.test.ts` (line 14)
**Root cause**: `ApresentacaoDataBundle.slides` expects `Record<SlideCodigo, Record<string, unknown>>` which requires ALL 27 `SlideCodigo` keys, but the test only provides 12.

**Fix**: Change the `slides` type in `ApresentacaoDataBundle` to `Partial<Record<SlideCodigo, Record<string, unknown>>>`, OR cast in the test with `as any` / `as Record<SlideCodigo, ...>`.

**Preferred**: Use `Partial` in the type definition since not all slides need data, or use `as any` in test.

---

## 3. Page Build Errors

### 3a. `Clientes.tsx` (line 1327)
**Root cause**: Lucide React's `Star` component doesn't accept `title` as a prop in newer versions.

**Fix**: Remove `title="Principal"` from the `<Star>` component, or wrap it in a `<span title="Principal">`.

### 3b. `UnidadesMedida.tsx` (lines 177, 182, 212)
- Lines 177/182: `StatCard.value` expects `string` but receives `number` (`kpis.total`, `kpis.ativas`).
- Line 212: `DataTable` doesn't have `onRefresh` prop.

**Fix**: 
- Wrap values with `String(kpis.total)` and `String(kpis.ativas)`
- Remove the `onRefresh={fetchData}` prop from `DataTable`

---

## 4. Clientes Contacts Tab — "Incluir" Button

The "Incluir" button for contact history **already exists** (line 919-928). It appears only in edit mode (`mode === "edit"`). If the user cannot see it, they may be in create mode. No code change needed unless the user clarifies the issue further.

---

## 5. Migração de Dados

The page uses `@ts-nocheck` so it has no build errors. The module is functionally aligned with the real schema per previous work. No changes needed here for this fix round.

---

## 6. Workbook Gerencial

The workbook module code is structurally sound (generateWorkbook, fillRawSheets, buildVisualSheets, fetchWorkbookData, workbookService). No build errors. The views may or may not exist in the DB — if they don't, the queries will return empty arrays gracefully. No code changes needed for build fixes.

---

## Files to Edit

| File | Change |
|------|--------|
| `supabase/functions/process-email-queue/index.ts` | `createClient<any>(...)`, add `any` types to map callbacks |
| `src/lib/apresentacao/fetchPresentationData.ts` | Explicit `string` type for `comp` variable |
| `src/lib/apresentacao/generatePresentation.test.ts` | Cast `slides` as `any` or use `Partial` |
| `src/pages/Clientes.tsx` | Wrap `<Star>` in `<span title="Principal">` |
| `src/pages/UnidadesMedida.tsx` | `String()` for StatCard values, remove `onRefresh` |

