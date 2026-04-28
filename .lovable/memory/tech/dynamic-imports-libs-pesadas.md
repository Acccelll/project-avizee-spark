---
name: Dynamic imports para libs pesadas (Office)
description: ExcelJS e pptxgenjs sempre carregados via dynamic import; nunca import estático no topo de módulo
type: preference
---

Libs Office pesadas (`exceljs`, `pptxgenjs`) **não devem** ser importadas estaticamente em
módulos que entram no grafo do bundle inicial.

**Padrão correto** — entry points de service:

```ts
async function loadGenerateWorkbook() {
  const mod = await import('@/lib/workbook/generateWorkbook');
  return mod.generateWorkbook;
}

export async function gerarWorkbook(params) {
  const generateWorkbook = await loadGenerateWorkbook();
  return generateWorkbook(params);
}
```

**Padrão correto** — wrapper interno (xlsx-compat):

```ts
import type ExcelJSNs from "exceljs";
let excelJsPromise: Promise<typeof ExcelJSNs> | null = null;
async function loadExcelJS() {
  if (!excelJsPromise) excelJsPromise = import("exceljs").then(m => m.default ?? m);
  return excelJsPromise;
}
```

**Why:** ExcelJS (~400KB) + pptxgenjs (~250KB) somam ~650KB que só são usados em fluxos
explícitos do usuário (gerar workbook, gerar apresentação, importar planilha). Manter
estático bloqueia o LCP de toda a aplicação.

**How to apply:**
- `import type` é permitido (apaga em compile-time, custo zero).
- Tipos públicos da lib (ex: `PresentationBranding`, `WorkSheet`) podem ser re-exportados
  por `import type`.
- Se um arquivo da árvore `src/lib/workbook/*` ou `src/lib/apresentacao/*` precisa de
  ExcelJS/pptxgenjs, pode importar estático — desde que o entry point que o consome no
  service layer seja dynamic. Vite faz code-splitting da árvore inteira.
- Verificar antes de adotar: rodar `rg "from ['\"]exceljs['\"]|from ['\"]pptxgenjs['\"]"` —
  os únicos `import` estáticos permitidos são dentro de `src/lib/workbook/*` e
  `src/lib/apresentacao/*` (que ficam em chunks separados).
