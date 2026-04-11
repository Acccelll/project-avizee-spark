

# Plano: Corrigir build errors + Preparar migração para os arquivos reais

## Escopo

Dois blocos de trabalho: (1) corrigir todos os build errors existentes, (2) ajustar aliases e validators para aceitar os formatos exatos dos 8 arquivos XLSX fornecidos, e limpar os dados mock.

## 1. Corrigir Build Errors (6 arquivos)

### 1.1 `src/hooks/useDashboardLayout.ts` + `src/pages/Index.tsx`
- O tipo `Layout` do `react-grid-layout` mudou entre versões. `DEFAULT_LAYOUT` precisa ser tipado como `Layout[]` explicitamente e os itens do array contêm `i`, `x`, `y`, `w`, `h` que o TS não reconhece.
- Solução: adicionar `as const satisfies Layout[]` ou simplesmente usar type assertion. Em `Index.tsx`, corrigir o tipo passado para `GridLayout` e o `onLayoutChange`.

### 1.2 `src/services/admin/sessoes.service.ts`
- A tabela `user_sessions` não existe no schema do Supabase (não aparece nos types gerados). O serviço tenta usar `.from("user_sessions")` que não é reconhecido.
- Solução: adicionar `// @ts-ignore` nos `.from()` e `as any` nos retornos, ou criar uma migration para a tabela `user_sessions`.  Como o serviço já existe e funciona via `@ts-nocheck` pattern usado em outros hooks, a abordagem pragmática é adicionar type assertions.

### 1.3 `src/pages/estoque/services/estoque.service.ts`
- A view `vw_estoque_posicao` não está nos types gerados. Já tem `// @ts-ignore` no `.from()` mas o `as EstoquePosicaoRow[]` falha.
- Solução: usar `as unknown as EstoquePosicaoRow[]`.

### 1.4 `src/pages/relatorios/components/Graficos/RelatorioChart.tsx`
- O `activeDot` com `onClick` customizado não é compatível com o tipo de recharts.
- Solução: fazer type assertion no objeto `activeDot`.

### 1.5 `supabase/functions/admin-users/index.ts`
- Múltiplos erros de tipo com o Supabase client Deno. Os `roleRow.user_id`, `roleRow.role`, `permission.user_id` são `unknown`.
- Solução: tipar explicitamente os resultados das queries com interfaces e ajustar as chamadas de função para aceitar `any` no client.

## 2. Ajustar aliases e validators para os formatos dos arquivos

### Formatos identificados nos 8 arquivos:

| Arquivo | Headers |
|---|---|
| 01_produtos | CÓDIGO, DESCRIÇÃO, PREÇO, CUSTO, UNIDADE, NCM, GTIN |
| 02_clientes | RAZÃO SOCIAL, CPF/CNPJ, EMAIL, TELEFONE, CIDADE, UF |
| 03_fornecedores | RAZÃO SOCIAL, CPF/CNPJ, EMAIL, TELEFONE, CIDADE, UF |
| 04_estoque | CÓDIGO, QTD, UNIDADE |
| 04b_estoque | CÓDIGO, QTD, UNIDADE |
| 05_financeiro | TIPO, HISTÓRICO, VENCIMENTO, VALOR, STATUS, CPF/CNPJ, OBSERVAÇÕES |
| 05b_financeiro | TIPO, HISTÓRICO, VENCIMENTO, VALOR, STATUS, CPF/CNPJ, OBSERVAÇÕES |
| 06_faturamento | NOTA, DATA, TOTAL, CLIENTE |

### 2.1 `src/lib/importacao/aliases.ts`
Adicionar aliases que faltam para mapear corretamente:
- `'DESCRIÇÃO'` → `'nome'` (produtos usam DESCRIÇÃO, não NOME)
- `'PREÇO'` → `'preco_venda'`
- `'TIPO'` → `'tipo'`
- `'PAGAR_RECEBER'` → `'tipo'`
- `'HISTÓRICO'` → `'descricao'`
- `'VENCIMENTO'` → `'data_vencimento'`
- `'STATUS'` → `'status'`
- `'SITUACAO'` → `'status'`
- `'OBSERVAÇÕES'` → `'observacoes'`
- `'NOTA'` → `'numero_nota'`
- `'DATA'` → `'data'`
- `'TOTAL'` → `'valor'`
- `'CLIENTE'` → `'cliente'`

Muitos já existem no `FIELD_ALIASES`. Verificar e preencher os que faltam.

### 2.2 `src/lib/importacao/validators.ts`
- `validateFinanceiroImport`: os campos do arquivo são `TIPO`, `HISTÓRICO`, `VENCIMENTO`, `VALOR`, `STATUS`, `CPF/CNPJ`, `OBSERVAÇÕES`. O validator já busca `data.HISTORICO` e `data.HISTÓRICO` — OK. Precisa suportar `data.observacoes` → salvar no campo `observacoes` do normalizedData.
- `validateFaturamentoImport`: headers são `NOTA`, `DATA`, `TOTAL`, `CLIENTE`. O validator já busca `data.NOTA`, `data.DATA`, `data.TOTAL`, `data.CLIENTE` — OK.
- `validateEstoqueInicialImport`: headers são `CÓDIGO`, `QTD`, `UNIDADE`. O validator busca `data.CÓDIGO` e `data.QTD` — OK.

### 2.3 `src/components/importacao/MapeamentoColunasForm.tsx`
- Adicionar campo `observacoes` ao financeiro se necessário (atualmente o tipo `financeiro` não está na lista de `fieldsByImportType` — precisa ser adicionado como tipo ou tratado via a aba de financeiro que usa seu próprio flow).

## 3. Limpar dados de exemplo

### 3.1 `src/mocks/erpMockData.ts`
- O arquivo não é importado em nenhum lugar do código. Pode ser esvaziado ou mantido com arrays vazios para não quebrar nada caso exista referência dinâmica.

### 3.2 Dados no banco
- Limpar dados de exemplo existentes nas tabelas (produtos, clientes, fornecedores, estoque_movimentos, financeiro_lancamentos, notas_fiscais) via migration SQL com `TRUNCATE` ou `DELETE`.

## Arquivos afetados

- `src/hooks/useDashboardLayout.ts` — fix type
- `src/pages/Index.tsx` — fix layout type
- `src/services/admin/sessoes.service.ts` — add ts-ignore/any
- `src/pages/estoque/services/estoque.service.ts` — fix cast
- `src/pages/relatorios/components/Graficos/RelatorioChart.tsx` — fix activeDot type
- `supabase/functions/admin-users/index.ts` — fix Deno types
- `src/lib/importacao/aliases.ts` — add missing aliases
- `src/lib/importacao/validators.ts` — add observacoes field
- `src/mocks/erpMockData.ts` — empty arrays
- Migration SQL — truncate example data

