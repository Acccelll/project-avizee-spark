

# Plano: Corrigir build errors + Alinhar módulo de importação ao schema real

## Contexto

O módulo de migração de dados já está majoritariamente alinhado ao schema real (lotes, logs, hooks). Os problemas remanescentes são:

1. **Build errors** em 4 arquivos não relacionados à importação
2. **Aliases duplicados** em `aliases.ts` causando TS1117
3. **Faturamento** tenta filtrar por `origem = 'importacao_historica'` que não existe na tabela `notas_fiscais` (campo `origem` existe no schema)
4. **Cadastros** inserem diretamente nas tabelas finais (sem staging) — funcional mas sem staging tables `stg_produtos/clientes/fornecedores`

O código dos hooks de importação (cadastros, estoque, financeiro, faturamento, XML) já usa os campos corretos do schema (`tipo`, `total_registros`, `registros_sucesso`, `registros_erro`, `usuario_id`, `lote_id` em logs). A `ReconciliacaoDetalhe` e `ReconciliacaoIndicadores` também já usam os campos reais. O fluxo ponta-a-ponta está funcional — os problemas são pontuais.

## Correções

### 1. `src/lib/importacao/aliases.ts` — Remover chaves duplicadas (TS1117)

Linhas 149-150 redefinem `DESCRICAO` e `DESCRIÇÃO` (já definidas em 92-93). Solução: remover as duplicatas do bloco financeiro, pois o mapeamento `DESCRICAO → nome` (produtos) já é feito pelo bloco de produtos, e o financeiro já resolve via validator direto.

### 2. `src/pages/WorkbookGerencial.tsx` — Remover prop `icon` inexistente

`ModulePage` não aceita `icon`. Remover a prop. Além disso, `onGerar` espera `Promise<void>` mas `mutateAsync` retorna `Promise<string>`. Fazer wrap.

### 3. `src/services/workbookService.ts` — Adicionar `as any` nos `.from()` de tabelas ausentes

As tabelas `workbook_templates`, `workbook_geracoes`, `fechamentos_mensais` não existem nos types gerados. Adicionar type assertions nos `.from()` e resultados, mesmo padrão já usado em `sessoes.service.ts`.

### 4. `src/services/freteSimulacao.service.ts` — Corrigir tipos incompatíveis

- Linha 290: `payload_raw` usa `Record<string, unknown>` que não é compatível com `Json`. Cast para `Json`.
- Linha 423: `update` com `Record<string, unknown>` — cast para `any`.

### 5. `src/components/importacao/ImportacaoTimeline.tsx` — Campo `etapa` não existe em `importacao_logs`

O componente exibe `log.etapa` mas a tabela real só tem `lote_id`, `nivel`, `mensagem`, `created_at`. O `ReconciliacaoDetalhe` já consulta sem `etapa`. Solução: remover `etapa` da interface `ImportLog` e do render, extraindo uma etapa simulada do início da mensagem se desejado.

### 6. Verificar `ReconciliacaoDetalhe.tsx` — já corrigido anteriormente

O componente já usa `lote_id` e `created_at` — sem alteração necessária.

### 7. Cadastros sem staging — manter como está

O hook `useImportacaoCadastros` já funciona fazendo import direto (lookup + insert/update). Criar staging tables `stg_produtos/clientes/fornecedores` é opcional e não é necessário para o fluxo funcionar. Manter o padrão atual sem staging para cadastros.

## Arquivos a alterar

| Arquivo | Alteração |
|---|---|
| `src/lib/importacao/aliases.ts` | Remover linhas 149-150 (duplicatas `DESCRICAO`/`DESCRIÇÃO`) |
| `src/pages/WorkbookGerencial.tsx` | Remover prop `icon`, wrap `mutateAsync` para `Promise<void>` |
| `src/services/workbookService.ts` | Adicionar `as any` nos `.from()` de tabelas não mapeadas |
| `src/services/freteSimulacao.service.ts` | Cast `payload_raw` para `Json`, cast update payload |
| `src/components/importacao/ImportacaoTimeline.tsx` | Remover `etapa` da interface e render |

## Sem migrations necessárias

Nenhuma alteração de schema é necessária. O módulo de importação já funciona com o schema real.

