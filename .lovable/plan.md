## Objetivo

Reverter a abordagem do cadastro separado de **Serviços** e tratar **Serviço** como mais uma classificação de item dentro de **Produtos**, ao lado de **Produto** e **Insumo** (`tipo_item`). Toda seleção de serviço para NFS-e/CT-e passa a vir da própria tabela `produtos`.

## Banco (migração nova, idempotente)

1. **`produtos.tipo_item`** — substituir o CHECK para aceitar `('produto','insumo','servico')`. Atualizar a função `proximo_codigo_interno` para gerar prefixo **`SRV`** com nova sequence `seq_codigo_interno_servico`. Atualizar `RAISE EXCEPTION` da função para aceitar o novo tipo.
2. **`produtos`** — adicionar colunas opcionais usadas só quando `tipo_item='servico'`:
   - `codigo_servico_lc116 text`
   - `codigo_tributacao_municipio text`
   - `aliquota_iss numeric(5,4)`
   - `retencao_iss boolean default false`
   - `tipo_tributacao_iss integer` (1–6, com check)
3. **`notas_fiscais_itens`** — remover FK e coluna `servico_id` (passa a usar `produto_id`). Manter `categoria`, `codigo_servico_lc116`, `aliquota_iss`, `valor_iss` (já existem) — agora populados a partir do `produto` quando `tipo_documento='nfse'`.
4. **`public.servicos`** — `DROP TABLE IF EXISTS public.servicos CASCADE` (remove índices, policies, triggers e a FK de `servico_id`).

RPCs `confirmar_nfse` e `confirmar_cte` permanecem (operam em colunas de `notas_fiscais`, não dependem da tabela removida).

## Frontend — remoções

- Apagar `src/pages/Servicos.tsx`.
- Apagar `src/services/servicos.service.ts`.
- Remover rota `/servicos` em `src/routes/cadastros.routes.tsx`.
- Remover item “Serviços” em `src/lib/navigation.ts`.
- Remover entrada `"servicos"` em `src/services/genericLookup.service.ts` e em `src/hooks/useEditDeepLink.ts`.
- Remover `Servico` e tipos correlatos de `src/types/domain.ts` (manter apenas `TipoDocumentoFiscal` e `ModalTransporteCte`).

## Frontend — Produtos como cadastro único

`src/pages/Produtos.tsx`:
- `TipoItem = "produto" | "insumo" | "servico"`.
- Adicionar opção **Serviço** ao MultiSelect de classificação e ao `StatusBadge`.
- Adicionar **SummaryCard “Serviços”** com `useTableCount("produtos", { tipo_item: "servico" })` e atalho de filtro.
- No formulário de produto, quando `tipo_item='servico'`:
  - Esconder seções de estoque, peso, NCM, GTIN, variações, eh_composto.
  - Mostrar nova seção **Tributação ISS** com: Item LC 116, Código tributação municipal, Alíquota ISS, ISS retido (switch), Tipo de tributação (select 1–6).
- Código interno passa a usar prefixo `SRV` automaticamente via trigger existente.

## Frontend — Fiscal

`src/components/fiscal/NfseFieldsSection.tsx`:
- Trocar o seletor de “serviço (tabela `servicos`)” por **busca em `produtos` filtrada por `tipo_item='servico'`** (reutilizar `GenericLookupCombobox` apontando para `produtos`). Ao selecionar, copiar `codigo_servico_lc116`, `aliquota_iss`, `retencao_iss` para os campos `nfse_*` da nota.

`src/components/fiscal/CteFieldsSection.tsx`:
- Sem mudanças funcionais (CT-e já usa colunas `cte_*` em `notas_fiscais`; itens com `categoria='frete'` continuam vinculados a um produto comum representando o frete, ou opcionalmente a um produto `tipo_item='servico'`).

`src/pages/Fiscal.tsx` / `buildNfItemsPayload`:
- Manter `categoria` derivada de `tipo_documento` (já implementado).
- Quando `tipo_documento='nfse'` e o item for um produto `tipo_item='servico'`, copiar `codigo_servico_lc116` e `aliquota_iss` do produto para o item.

## Tipos gerados

Após aprovar a migração, `src/integrations/supabase/types.ts` é regenerado automaticamente — vai remover `servicos` e `servico_id` e adicionar as novas colunas em `produtos`. Ajustar `src/types/domain.ts` em sequência.

## Critérios de aceite

- `/servicos` não existe mais (rota, sidebar, lookup, deep-link).
- Em **Produtos**, é possível criar/editar/excluir um item com `tipo_item='servico'`, com formulário enxuto + campos de ISS.
- KPI e filtro **Serviço** funcionam em Produtos.
- No formulário de NFS-e, a busca de serviço retorna produtos cuja classificação é **Serviço** e auto-preenche LC 116 / alíquota ISS.
- Confirmar NFS-e/CT-e continua gerando os lançamentos financeiros corretamente.
- `bunx tsc --noEmit` sem erros.
