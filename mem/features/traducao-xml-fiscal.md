---
name: Tradução XML Fiscal
description: Doutrina da etapa de tradução XML→cadastro na importação de NF-e (drawer obrigatório com pendência, opcional via banner em 100% OK)
type: feature
---
## Importação de XML — tradução explícita

- **XML é verdade fiscal e imutável.** Campos `*_origem` em `notas_fiscais_itens` (`codigo_produto_origem`, `descricao_produto_origem`, `unidade_origem`, `quantidade_origem`, `valor_unitario_origem`, `valor_total_origem`) guardam o XML cru.
- **Tradução afeta SOMENTE campos internos** (`produto_id`, `quantidade`, `valor_unitario`, `unidade`) usados por estoque e custo.
- **Drawer `TraducaoXmlDrawer`**:
  - **Obrigatório** quando há QUALQUER pendência (item sem `produto_id` OU unidade XML divergente da unidade interna sem `fator_conversao` memorizado). Bloqueia abertura do form até confirmar.
  - **Opcional** (somente leitura via banner "Ver/editar tradução") quando todos os itens estão OK.
- **Convenção do fator**: `qtd_interna = qCom × fator_conversao`. Ex.: 25 KG × 0,25 = 6,25 MT.
- **Custo**: `vUn_interno = vProd / qtd_interna` — preserva o total fiscal (`vProd`).
- **De-para persistido** em `produtos_fornecedores` (chave natural `produto_id + fornecedor_id`) com `fator_conversao` (default 1, > 0). Upsert via checkbox "Salvar tradução para este fornecedor".

## Variação no autocomplete de produtos (regra global)

Em TODA busca de produto (TraducaoXmlDrawer, ItemsGrid, ProductAutocomplete, OrcamentoItemsGrid, etc.) o `label` deve concatenar a variação após o nome via `formatVariacoesSuffix()` e a variação deve entrar nos `searchTerms` via `parseVariacoes()` (helpers em `src/utils/cadastros.ts`). Única forma de distinguir produtos homônimos como "AGULHA DESCARTAVEL - 100 UN" que diferem apenas por `produtos.variacoes` ("13 X 45", "25 X 10").
- **`match_status`** em `notas_fiscais_itens`: `auto` (memorizado), `direto` (uCom == unidade interna), `manual` (usuário ajustou).
- **NFs antigas**: sem backfill — só novas importações usam o novo fluxo.
- Cadastro do produto (Produtos.tsx, aba Compras): coluna "Fator de Conversão" no bloco Fornecedores permite cadastrar a tradução antes do primeiro XML.

Arquivos-chave: `src/pages/fiscal/hooks/useNFeXmlImport.ts` (classifica OK/pendente), `src/pages/fiscal/components/TraducaoXmlDrawer.tsx` (UI), `src/pages/Fiscal.tsx` (`handleXmlImport`, `aplicarImportacaoXml`, `salvarDeParaFornecedor`, banner).
