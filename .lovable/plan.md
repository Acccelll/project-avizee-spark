## Objetivo

Eliminar `as any` desnecessários em services/hooks onde a tabela/view/RPC já está em `Database['public']`. Usar `invokeRpc` (de `@/types/rpc`) para RPCs e o cliente tipado direto para tabelas/views. Não alterar lógica.

## Verificação prévia (tipos gerados)

| Símbolo | Em `types.ts`? |
|---|---|
| `apresentacao_cadencia`, `_templates`, `_geracoes`, `_slide_telemetria` | ✅ Tables |
| `vw_conciliacao_eventos_financeiros` | ✅ Views |
| `financeiro_extrato_importacoes` | ✅ Tables |
| `vw_recebimentos_consolidado`, `vw_entregas_consolidadas` | ✅ Views |
| `pedidos_compra_itens` | ✅ Tables |
| `recebimentos_compra`, `recebimentos_compra_itens` | ✅ Tables (o prompt cita "logistica_recebimentos", que **não existe**; o uso real em `recebimentos.service.ts` é `recebimentos_compra` — tratar esse) |
| `budgets_mensais` | ✅ Tables |
| `registrar_recebimento_compra`, `ajustar_estoque_manual` | ✅ Functions |
| `ConsolidacaoRpc` (8 literais) | ✅ Functions (todos são `RpcName`) |

## Mudanças por arquivo

### 1. `src/services/apresentacaoService.ts`
Trocar os 9 ocorrências de `(supabase as any).from('apresentacao_*')` (linhas 58, 397, 418, 428, 439, 467, 481, 508, 521) por `supabase.from('apresentacao_*')`. Manter as conversões de retorno existentes (`data as ApresentacaoCadencia`, etc.) onde já existem. Deixar **intactos** os `fromUntyped(...)` de `apresentacao_comentarios`, `apresentacao_preferencias`, `app_configuracoes`, `empresa_config` (escopo deste prompt = só os `as any`).

### 2. `src/services/financeiro/conciliacaoQueries.ts`
Linha 15: remover `as any` do nome da view.

### 3. `src/services/financeiro/extratoImportacoes.service.ts`
Linhas 45, 65, 82, 92: remover `as any` do nome da tabela.

### 4. `src/pages/logistica/hooks/useRecebimentos.ts`
Linha 9: `(supabase as any).from("vw_recebimentos_consolidado")` → `supabase.from("vw_recebimentos_consolidado")`.

### 5. `src/pages/logistica/hooks/useEntregas.ts`
Linha 9: idem para `vw_entregas_consolidadas`.

### 6. `src/services/logistica/recebimentos.service.ts`
- L16 (`(supabase.rpc as any)("registrar_recebimento_compra", args)`) → `import { invokeRpc } from "@/types/rpc";` + `const data = await invokeRpc("registrar_recebimento_compra", { ...args });` (mantém `return data as string`).
- L29 e L41: o nome real da tabela é **`recebimentos_compra`** (não `logistica_recebimentos`). Está em `Tables` → remover `as any`. Idem para o join `recebimentos_compra_itens(*)` (já tipado).
- O outro caso `pedidos_compra_itens` mencionado no prompt **não aparece neste arquivo** — é uma referência incorreta; nada a fazer aqui.

### 7. `src/services/estoque.service.ts`
L136: usar `invokeRpc("ajustar_estoque_manual", args)` em vez de `(supabase.rpc as any)(...)`. Manter shape de retorno atual.

### 8. `src/services/importacao.service.ts`
L253: o `rpc` é dinâmico mas tipado como `ConsolidacaoRpc` (todos são `RpcName`). Trocar `(supabase.rpc as any)(rpc, params)` por `supabase.rpc(rpc, params as never)` (sem `as any`; o `as never` é necessário porque o union de Args difere por RPC). Remover o `eslint-disable` adjacente.

### 9. `src/services/budget.service.ts`
- L27: `const tbl = () => supabase.from("budgets_mensais");` (sem cast e com literal inline para preservar o tipo).
- Comentário "ainda não está nos tipos gerados" obsoleto — remover.
- Onde possível, trocar `(data ?? []) as BudgetMensal[]` por uso de `Tables<"budgets_mensais">` (importar `Tables` de `@/integrations/supabase/types`) **somente onde o shape coincidir 1:1**; caso a coluna `categoria` no banco seja `text` mas no service esteja restringida ao union `BudgetCategoria`, manter o cast atual para preservar a tipagem mais forte do domínio.

### 10. `tsconfig.strict-core.json`
Acrescentar ao array `include`:
```
"src/services/apresentacaoService.ts",
"src/services/logistica/**/*",
"src/services/estoque.service.ts",
"src/services/budget.service.ts",
"src/pages/logistica/**/*",
"src/services/financeiro/conciliacaoQueries.ts",
"src/services/financeiro/extratoImportacoes.service.ts"
```

## Validação

`npx tsc -p tsconfig.strict-core.json --noEmit` deve passar limpo. Se algum arquivo expor erros estritos pré-existentes (não relacionados aos casts removidos), reportar e — sem alterar lógica — aplicar narrow/cast mínimo apenas para destravar.

## Fora de escopo

- Migrar `fromUntyped(...)` para o cliente tipado (apresentacao_comentarios, app_configuracoes, etc.).
- Refatorar shape/lógica dos retornos.
- Tipar `ConsolidacaoRpc` por RPC (Args variam — exigiria overloads).
