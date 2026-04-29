---
name: Cadastro Rápido
description: QuickAddProductModal/ClientModal/SupplierModal acionados via onCreateNew do autocomplete e botão "Cadastrar este produto" no TraducaoXmlDrawer
type: feature
---
- 3 modais: `QuickAddProductModal`, `QuickAddClientModal`, `QuickAddSupplierModal`.
- `QuickAddProductModal` aceita `defaultNome`; mostra Grupo + botão Wand2 que chama `proximoSkuDoGrupo`.
- `QuickAddSupplierModal` aceita `defaults` (nome, CNPJ, email, telefone) — usado para pré-preencher fornecedor a partir do `nfe.emitente` quando o XML é importado e o emitente não está cadastrado.
- `Fiscal.tsx#handleXmlImport` detecta fornecedor não cadastrado e abre o modal antes de seguir; após criar, retoma `pendingXmlImport` com novo `fornecedorId`.
- `TraducaoXmlDrawer` recebe `onCreateProduto(linhaIndex, sugestaoNome)`.
- `ItemsGrid` recebe `onCreateProduto?: () => void` propagado ao `AutocompleteSearch.onCreateNew`.
- Após cadastro: `produtosCrud.fetchData()` + atualização da linha (com `salvarDePara=true`) ou anexa ao grid manual.