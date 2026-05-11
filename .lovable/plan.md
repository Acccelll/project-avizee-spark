## Objetivo

Eliminar `as any` por falta de tipagem nos arquivos abaixo, criando interfaces de domínio mínimas. Sem alterar lógica de negócio.

## Mudanças por arquivo

### 1. `src/hooks/importacao/useImportacaoEstoque.ts`
Adicionar interface local `ProdutoLookup`:
```ts
interface ProdutoLookup {
  id: string;
  nome: string;
  estoque_atual: number | null;
  preco_custo: number | null;
}
```
Tipar `prodByLegado`, `prodByInterno`, `prodBySku` como `Map<string, ProdutoLookup>` (no ponto de criação dos maps). Substituir as 5 ocorrências `(produtoInfo as any).campo` → `produtoInfo.campo`.

### 2. `src/hooks/useFluxoCaixaData.ts`
Adicionar `interface BaixaJoinRow` (id, lancamento_id, data_baixa, valor_pago: number|string, conta_bancaria_id: string|null, financeiro_lancamentos: { tipo: "receber"|"pagar" } | null) dentro do arquivo. Substituir `(baixasRaw as any[])` por `(baixasRaw as BaixaJoinRow[] | null)` e remover o `eslint-disable` adjacente.

### 3. `src/components/views/ClienteView.tsx` — **divergência do prompt**
A coluna `observacoes` **não existe** em `cliente_transportadoras` (verificado no banco; colunas: id, cliente_id, transportadora_id, prioridade, modalidade, prazo_medio, ativo, created_at). O `(t as any).observacoes` é dead code (sempre `undefined`).

**Ação:** remover o JSX `{(t as any).observacoes && <p>...</p>}` na linha 536 em vez de inventar um campo no tipo. Sem perda funcional. Se preferirem manter o campo (e adicioná-lo no banco depois), peço confirmação — mas o caminho correto agora é remover.

### 4. `src/pages/MigracaoDados.tsx`
A interface proposta no prompt (`IImportacaoHook` com file/setFile/mapping/setMapping/...) **não cobre** os campos realmente desestruturados em L99-114: `sheets, currentSheet, headers, importType, previewData, isProcessing, onFileChange, onSheetChange`. Vou estender a interface para refletir o uso real:

```ts
interface IImportacaoHook {
  file: File | null;
  sheets: string[];
  currentSheet: string | null;
  headers: string[];
  mapping: Record<string, string>;
  importType: string;
  previewData: unknown[];
  isProcessing: boolean;
  onFileChange: (f: File | null) => void;
  onSheetChange: (s: string) => void;
  setMapping: (m: Record<string, string>) => void;
  setImportType: (t: string) => void;
  generatePreview: () => Promise<void>;
  processImport: () => Promise<void>;
  finalizeImport: () => Promise<void>;
  lotes: ImportacaoLote[];
}
```
Tipar `activeHook` como `IImportacaoHook` (cast `as unknown as IImportacaoHook` na atribuição se a união dos hooks divergir em assinaturas). Remover o `eslint-disable` e o `as any`.

### 5. `src/pages/ApresentacaoGerencial.tsx`
Adicionar `interface SlidesJsonAtivos { ativos: SlideCodigo[] }`. Substituir `(selectedGeracao?.slides_json as any)?.ativos ?? []` por `(selectedGeracao?.slides_json as SlidesJsonAtivos | null)?.ativos ?? []`.

### 6. `src/hooks/useMetas.ts`
Importar `import type { Json } from "@/integrations/supabase/types"`. Trocar `valor: metas as any` por `valor: metas as unknown as Json` (precisa do `unknown` intermediário porque `metas` é o tipo `Metas` do domínio; `Json` é estrutural).

### 7. `tsconfig.strict-core.json`
Acrescentar ao `include`:
```
"src/pages/MigracaoDados.tsx",
"src/pages/ApresentacaoGerencial.tsx",
"src/hooks/useFluxoCaixaData.ts",
"src/hooks/useMetas.ts"
```
(`useImportacaoEstoque.ts` e `ClienteView.tsx` já estão cobertos por padrões existentes ou continuam fora — o prompt não pediu para incluir.)

## Validação

`npm run typecheck:core` deve passar. Erros pré-existentes em `fiscal/` e `apresentacao/` que já vinham aparecendo em iterações anteriores ficam intactos (fora do escopo).

## Dúvida de scope (1)

**ClienteView.observacoes**: confirmar se posso remover o trecho condicional dead-code em vez de "inventar" o campo no tipo. Se a intenção for adicionar a coluna no banco, isso vira outra issue (migration + form). Vou seguir com a remoção.
