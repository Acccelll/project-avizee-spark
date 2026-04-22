

# Revisão Técnica e Funcional — Módulo Cadastros

Revisão baseada no estado real dos arquivos (`src/pages/{Produtos,Clientes,Fornecedores,Transportadoras,Funcionarios,FormasPagamento,GruposEconomicos,UnidadesMedida}.tsx`, `src/components/views/{Cliente,Fornecedor,Produto,Transportadora,Funcionario,FormaPagamento,GrupoEconomico}View.tsx`, `src/pages/clientes/components/*`, `src/components/fornecedores/AddProdutoFornecedor.tsx`, `src/hooks/{useDocumentoUnico,useEditDeepLink,useDrawerData,useSupabaseCrud}.ts`, `src/components/{DataTable,FormModal,FormModalFooter}.tsx`).

---

## 1. Visão geral do módulo

O módulo Cadastros agrupa 8 entidades, todas servidas pelo mesmo padrão `ModulePage + AdvancedFilterBar + DataTable + FormModal` e drawer de detalhe via `pushView` / `useDetailFetch`:

| Entidade | Página | View (drawer) | DeepLink? | Atalho `?new=1` | Excluir |
|---|---|---|---|---|---|
| Clientes | `Clientes.tsx` | `ClienteView` | sim | sim | soft |
| Fornecedores | `Fornecedores.tsx` | `FornecedorView` | sim | — | soft |
| Produtos | `Produtos.tsx` | `ProdutoView` | sim | sim | soft |
| Transportadoras | `Transportadoras.tsx` | `TransportadoraView` | **não** | — | soft + confirm |
| Funcionários | `Funcionarios.tsx` | `FuncionarioView` | **não** | — | soft |
| Formas de Pagamento | `FormasPagamento.tsx` | `FormaPagamentoView` | **não** | — | soft + confirm |
| Grupos Econômicos | `GruposEconomicos.tsx` | `GrupoEconomicoView` | **não** | — | soft |
| Unidades de Medida | `UnidadesMedida.tsx` | (sem view) | **não** | — | soft |

Características comuns:
- Persistência via `useSupabaseCrud` com `filterAtivo: false` (mostra ativos+inativos por padrão; o usuário filtra via chip).
- Soft delete: `useSupabaseCrud.remove(id, soft=true)` faz `update {ativo:false}` quando a tabela tem `ativo`.
- Validação de documentos (CPF/CNPJ) por `useDocumentoUnico` que cruza Clientes, Fornecedores e Funcionários.
- `useEditDeepLink` (param `?editId=…`) implementado em apenas 3 das 8 entidades.
- Drawers seguem o padrão `usePublishDrawerSlots` + `useDetailFetch` + `RecordIdentityCard` + `DrawerSummaryGrid`.

---

## 2. Pontos fortes

- **Padrão visual consistente nas páginas-grid**: todas usam `ModulePage` + `SummaryCard/StatCard` + `AdvancedFilterBar` + `DataTable` com chips removíveis.
- **Soft delete unificado**: `useSupabaseCrud` decide automaticamente entre `update ativo=false` e `delete` baseado em `softDelete ?? hasAtivo`. O `DataTable` já mostra texto coerente ("Inativar registro" vs "Excluir registro") via `deleteBehavior`.
- **`useDocumentoUnico` cobre 3 entidades simultaneamente**: ao tipar um CPF/CNPJ, verifica Clientes + Fornecedores + Funcionários antes de salvar — evita duplicidade cruzada.
- **Drawers padronizados**: 7 das 8 entidades publicam header (`RecordIdentityCard`), KPIs (`DrawerSummaryGrid`) e ações (Editar/Excluir) por `usePublishDrawerSlots`. `useDetailFetch` resolve race conditions e cancelamento.
- **`useDrawerData` e `useEditDirtyForm`** abstraem race conditions e detecção de dirty (`Funcionarios`, `Produtos`, `FormasPagamento`, `UnidadesMedida` adotaram).
- **RPCs transacionais para sub-entidades de Produto** (`save_produto_composicao`, `save_produto_fornecedores`) — alinhado à memória `tech/padroes-de-persistencia-transacional`.
- **Tipagem centralizada em `src/types/cadastros.ts`** (HistoricoNfItemRow, ComposicaoItemRow, etc.) usada pelas Views.
- **Auto-fill ViaCEP / CNPJ** em Clientes, Fornecedores e Transportadoras.
- **Doc legado tratado**: `formas_pagamento` separa `tipo` (categoria) de `descricao` (condição comercial), com `clientes.forma_pagamento_padrao` marcada como DEPRECATED e backfill via `cadastros_pendencias_migracao` (ver `docs/cadastros-formas-pagamento.md`).

---

## 3. Problemas encontrados

### A. Inconsistência entre as 8 entidades

1. **`useEditDeepLink` adotado em só 3 de 8** (Clientes, Fornecedores, Produtos). Funcionários, Transportadoras, FormasPagamento, GruposEconomicos e UnidadesMedida não suportam `?editId=…`. Como as Views fazem `navigate("/funcionarios?editId=…")` ao clicar em "Editar" no drawer, o param chega na página mas é ignorado — clicar em "Editar" no drawer de Funcionário só fecha o stack e não abre o modal.
2. **Atalho `?new=1` só existe em Clientes, Produtos e Fornecedores** (parcialmente). Botões "Adicionar" do dashboard / quick actions referenciam todas as entidades — Funcionários, Transportadoras e Formas de Pagamento não têm o shortcut.
3. **Confirmação de exclusão em 2 padrões diferentes**:
   - `Clientes`, `Fornecedores`, `Produtos`, `Funcionários`, `GruposEconomicos`, `UnidadesMedida`: `onDelete={(x) => remove(x.id)}` — confirmação **dentro** do `DataTable` (genérica).
   - `Transportadoras`, `FormasPagamento`: `onDelete={(x) => { setSelected(x); setDeleteConfirmOpen(true); }}` — `<ConfirmDialog>` próprio com aviso enriquecido ("Considere inativar..."). Usuário vê interfaces diferentes para a mesma ação.
4. **Hooks de form/dirty divergem**:
   - `useEditDirtyForm`: Produtos, FormasPagamento, UnidadesMedida.
   - `useState + useState(baselineForm) + JSON.stringify`: Funcionários.
   - `useState + setIsDirty(true) manual`: Clientes, Fornecedores, Transportadoras.
   - `useState + initialForm + useMemo`: GruposEconomicos.
   Quatro padrões para o mesmo problema.
5. **`useSubmitLock` em 4, `useState(saving)` em 4**. Cliente/Fornecedor/Grupos/Transportadoras (parcial) usam manual; Produtos/Funcionários/Formas/Unidades usam o hook. Comportamento de bloqueio de duplo-submit é diferente.

### B. Semântica de excluir vs inativar

6. **O DataTable nomeia "Inativar registro"** (correto) **mas a coluna de ação ainda é o ícone de lixeira vermelho** — usuário lê visualmente como "deletar". Reforça percepção destrutiva onde a operação é reversível.
7. **Não há ação "Reativar" na tabela** quando o filtro de status mostra inativos. Para reativar, é preciso abrir Edit → Switch ativo → Salvar (Clientes, Fornecedores) — em outras (Transportadoras, Funcionários) o switch está dentro do form mas em local diferente.
8. **Em `Funcionários`, o switch ativo está dentro de um `<Select>` ("ativo"/"inativo")** em vez de um Switch como nas demais — quebra de padrão UI.
9. **`UnidadesMedida.remove`** desativa silenciosamente. Se a unidade está vinculada a produtos por **texto** (ver §C), inativá-la não impede uso futuro nem alerta sobre produtos órfãos.

### C. Relacionamentos tratados como texto vs ID

10. **`produtos.unidade_medida` é armazenado como string (`"UN"`, `"KG"`)** em vez de FK para `unidades_medida.id`. Consequências reais:
    - Se uma unidade é renomeada (`UN` → `UND`) na tabela mestra, os produtos antigos continuam apontando para `"UN"` órfão.
    - O `Select` carrega `unidades_medida` via efeito **e** mantém um array `UNIDADES_FALLBACK` hardcoded — o produto pode acabar com um código que nem está no mestre.
    - O `ProdutoView` exibe `selected.unidade_medida` cru sem lookup (não há junção com `unidades_medida` para mostrar descrição).
11. **`clientes.forma_pagamento_padrao` (texto, DEPRECATED) ainda existe na tabela**. O código atual envia `null` consistentemente, mas o campo permanece — risco de drift se alguma página/edge function legada gravar nele.
12. **`transportadoras.modalidade` e `prazo_medio` são strings livres** sem CHECK constraint visível no schema (modalidade: rodoviario/aereo/maritimo/ferroviario/multimodal). Filtros e labels só funcionam para os 5 valores conhecidos; qualquer outro vira chip "—".
13. **`funcionarios.tipo_contrato` é texto livre** com 4 labels conhecidos (`clt/pj/estagio/temporario`). Sem FK nem enum — risco de typo bagunçar filtros.
14. **`formas_pagamento.intervalos_dias` é `number[]`** mas o input não valida (aceita 0, negativos, duplicados, e o `parcelas` é redefinido como `intervalos.length` mas o usuário pode salvar `parcelas=5` com `intervalos=[]`).

### D. Validação e duplicidade

15. **`useDocumentoUnico` tem race silencioso**: o hook é executado a cada keystroke (debounce só do search da grid, não do CPF/CNPJ). Para CPF/CNPJ válidos (11/14 dígitos) o React Query deduplica via `queryKey`, mas durante a digitação o usuário vê o documento "OK" antes de a verificação rodar — `handleSubmit` permite salvar enquanto `docChecking=true` (lê `!docChecking && docUnico === false`).
16. **A unicidade não cobre `Transportadoras` na busca cruzada**. `useDocumentoUnico` valida só clientes+fornecedores+funcionários — uma transportadora com mesmo CNPJ de um fornecedor passa.
17. **`Funcionários.handleSubmit` valida CPF localmente (`isValidCpf`)** com DV próprio, mas Cliente/Fornecedor delegam ao Zod (`clienteFornecedorSchema`). Duas implementações de DV CPF coexistem.
18. **`clienteFornecedorSchema` é compartilhado** entre clientes e fornecedores, **mas Fornecedor não tem `prazo_padrao` nullable** no schema, e Cliente tem campos extras (`grupo_economico_id`, `tipo_relacao_grupo`). Schema "una-tudo" fica frouxo.

### E. Drawer / View

19. **`UnidadesMedida` não tem View** — usuário não consegue ver "produtos vinculados a esta unidade". Outras 7 entidades têm. Quebra do paradigma.
20. **`FuncionarioView` e `FormaPagamentoView` têm `setDeleteOpen` declarado mas nunca renderizam o `<ConfirmDialog>`** (`const [, setDeleteOpen] = useState(false);`). O botão "Excluir" abre... nada. Bug funcional real.
21. **`TransportadoraView` também usa `setDeleteOpen` sem dialog renderizado** (linha 85). Mesmo bug.
22. **`GrupoEconomicoView`** idem (linha 72). Quatro views com botão "Excluir" quebrado.
23. **`ProdutoView` e `ClienteView` e `FornecedorView`** renderizam o `<ConfirmDialog>` corretamente. Inconsistência clara.
24. **Drawer "Editar" navega via `navigate("/x?editId=…") + clearStack()`** — em entidades sem `useEditDeepLink` (§A.1), a página abre, descarta o `editId` da URL via React Router (não, na verdade não descarta) e o param fica sujando a URL sem efeito.
25. **`ClienteView`** lista até 30 notas e 10 ordens de venda, mas **não filtra `ativo=true`** em `ordens_venda` (`notas_fiscais` também sem filtro). Pode mostrar registros logicamente excluídos.
26. **Tab "Comunicações"** em ClienteView: count vem do drawer; já o modal de edição (`ClienteComunicacoesTab`) carrega independentemente com seu próprio fetch — duplicação.

### F. Filtros / Grid

27. **`Clientes`, `Fornecedores`, `Funcionários`, `Transportadoras`** declaram `filteredData` com `.filter()` LOCAL **após** já receberem o resultado paginado do servidor. O search é server-side (`useSupabaseCrud.searchTerm`), mas os filtros de status/tipo/grupo são client-side — em listas grandes, ativar "Inativos" pode ser inconsistente porque a página atual pode só ter "Ativos".
28. **`AdvancedFilterBar.activeFilters`** tem assinatura `value: string[] | string`. Em `Transportadoras` e outros, o código passa `value: [f]` (array); em `FormasPagamento` passa `value: f` (string). Funciona pelo cast, mas a inconsistência é potencial bug se a remoção depender do shape.
29. **`Produtos` filtros**: 5 filtros locais (ativos/tipo/tipoItem/estoque/grupo) + paginação server-side = mesma inconsistência de paginação parcial. Adicionalmente, `getSituacaoEstoque` é calculado client-side; o filtro "Sem estoque" só funciona dentro do que está paginado.
30. **`UnidadesMedida` não tem chip "Inativo" nem KPI de "uso"** — usuário não consegue saber quais unidades estão sendo usadas por produtos.

### G. UI / formulário

31. **Tabs do `ClienteForm` mostram badge de count em "Entregas" e "Comunicações"** com `enderecosCount`/`comunicacoesCount`, mas esses estados são inicializados com 0 no `openEdit` e só são preenchidos quando o usuário **abre** a tab (callback `onCountChange`). Editar um cliente recém-aberto sempre mostra "0" mesmo havendo 5 endereços, até clicar na aba.
32. **`FormasPagamento.tipoIcon` mapeia 6 tipos**, mas o CHECK do banco lista 6 (`pix, boleto, cartao, dinheiro, transferencia, outro`) — o mapa de ícones usa `transferencia`→ausente e `outro`→ausente, e adiciona `cheque`/`deposito` que não constam no doc oficial. `Select` no form oferece `dinheiro/boleto/cartao/pix/cheque/deposito` — desalinhado com o backend.
33. **`Funcionarios` tem o switch de ativo via `<Select>`** (Ativo/Inativo) — único caso. Outras entidades têm `<Switch>` no header do FormModal (Clientes, Fornecedores, Transportadoras). Inconsistência visual e de interação.
34. **`Produtos` tem 5 tabs no form** mas a tab "Compras" mistura **fornecedores vinculados** com **composição (BOM)** — semanticamente diferentes (compras vs produção). Já o `ProdutoView` separa em "Compras" e tem composição na tab "Geral".
35. **`AddProdutoFornecedor`** carrega TODOS os produtos ativos sem paginação (linha 22 do summary) — se houver milhares de produtos vai quebrar.
36. **`Transportadoras.handleCloseModal`** depende de `hasChanges` declarado **depois** do uso (linha 244 referencia, linha 258 declara). Em strict mode funciona pelo hoisting, mas é frágil — é leitura via closure, não TDZ porque `useMemo` retorna novo valor a cada render.
37. **Saudação de "saveAndNew"**: implementado em Fornecedores e Produtos via `dispatchEvent` manual. Cliente e demais não têm. UX inconsistente.

### H. Integração com outros módulos

38. **`Produtos.unidade_medida`** (string) é lida por Estoque, Compras, Vendas e NF — qualquer renomeação ou exclusão na tela de Unidades quebra silenciosamente.
39. **`Fornecedores`** referenciados por `compras`, `pedidos_compra`, `notas_fiscais (entrada)`, `produtos_fornecedores`, `financeiro_lancamentos`. `FornecedorView.deleteDescription` só conta compras/financeiro/produtos — **não conta notas fiscais** (que existem com `fornecedor_id`). Aviso enganoso.
40. **`Clientes`** lista vendas + notas saída no drawer (bom), mas a página de Clientes não mostra contagem nenhuma na grid (nem "qtd vendas" nem "saldo"). Drill-down só pelo drawer.
41. **`GruposEconomicos.handleSubmit`** atualiza `nome` e `empresa_matriz_id` mas não toca em `clientes.tipo_relacao_grupo` ou em `clientes.grupo_economico_id` para sincronizar a matriz definida — usuário define matriz no grupo mas o cliente continua com `tipo_relacao_grupo='independente'`.
42. **`Transportadoras.modalidade` no cadastro** é o "default" da transportadora; mas `cliente_transportadoras.modalidade` permite override por cliente. Não há tela mostrando essas overrides agregadas.

---

## 4. Problemas prioritários

Ordem por risco × esforço:

1. **#20–22 (Bug de exclusão silencioso)**: 4 Views (`FuncionarioView`, `FormaPagamentoView`, `TransportadoraView`, `GrupoEconomicoView`) declaram `setDeleteOpen` mas **não renderizam `<ConfirmDialog>`** — o botão Excluir do drawer não faz nada. Bug funcional ativo. Padronizar usando `ProdutoView`/`FornecedorView` como referência.
2. **#1 + #24 (Deep-link quebrado para Editar a partir do drawer)**: 5 entidades sem `useEditDeepLink` — clicar em "Editar" no drawer fecha o stack e deixa `?editId=…` sujo na URL sem abrir modal. Adicionar o hook (10 linhas por página) restabelece o fluxo.
3. **#3 + #4 + #5 (Padronização de hooks de form)**: hoje 4 padrões para dirty + 2 para submit lock + 2 para confirmação de delete. Convergir todos para `useEditDirtyForm + useSubmitLock + useConfirmDialog` (já existem e já são usados em metade).
4. **#10 (`produtos.unidade_medida` como texto)**: dívida estrutural concreta. Migrar para `unidade_medida_id` FK exige migration + backfill, mas evita drift permanente. Pelo menos: **bloquear delete físico em `unidades_medida`** quando há produtos referenciando o `codigo`, e mostrar "X produtos vinculados" em UnidadesMedida.
5. **#15 + #16 (Race em `useDocumentoUnico` + cobertura faltando para Transportadoras)**: travar `submit` enquanto `docChecking=true` (não só quando falso) e adicionar Transportadoras ao cross-check.
6. **#19 (UnidadesMedida sem View)** + **#41 (sincronia Grupo↔Cliente.matriz)**: criar `UnidadeMedidaView` listando produtos vinculados; e ao definir `empresa_matriz_id` no grupo, atualizar `clientes.tipo_relacao_grupo='matriz'` para o cliente escolhido.
7. **#27 + #29 (Filtros locais sobre dados paginados)**: paginação server-side + filtros client-side gera resultados parciais. Mover filtros básicos (ativo/tipo) para o servidor via `CrudFilter` no `useSupabaseCrud`.
8. **#31 (Counts em tabs do ClienteForm não pré-carregam)**: rodar um COUNT(*) ao abrir o `openEdit` do Cliente para preencher `enderecosCount`/`comunicacoesCount` antes do usuário clicar.
9. **#32 (`formas_pagamento.tipo` desalinhado com o CHECK do banco)**: corrigir o `<Select>` para refletir os 6 tipos oficiais (`pix, boleto, cartao, dinheiro, transferencia, outro`) e adicionar `transferencia`/`outro` ao `tipoIcon`/`tipoLabel`.

---

## 5. Melhorias de UI/UX

- **Padronizar a confirmação de "Inativar"** em todas as 8 entidades. Usar sempre o `ConfirmDialog` enriquecido (como `Transportadoras`/`FormasPagamento`) com texto "Considere inativar — o histórico será preservado" e contagens de relacionamentos. Eliminar o caminho `onDelete={(x)=>remove(x.id)}` direto.
- **Ação "Reativar" inline na tabela** quando o registro está inativo: substituir o ícone de lixeira por `RotateCcw` para inativos, evitando abrir o form só pra ligar o switch.
- **Renomear "Excluir" → "Inativar"** nos botões dos drawers que fazem soft-delete (todas as Views da seção Cadastros). Reservar "Excluir" para hard delete real (que quase nenhuma entidade faz).
- **Padronizar o switch ativo no header do FormModal** (já usado em Clientes). Remover o `<Select>` do Funcionários e o switch interno do bloco do FormaPagamento — sempre no header.
- **Counts pré-carregados** nas tabs do ClienteForm e ProdutoForm (queries `head:true, count:'exact'` em paralelo no `openEdit`).
- **Banner de "fonte deprecada"** quando o sistema detectar `clientes.forma_pagamento_padrao` não-nulo em registros antigos: oferecer botão "vincular forma" no próprio drawer.
- **`UnidadesMedida`**: KPI "X em uso" (count distinct `produtos.unidade_medida` que matcha `codigo`) + drawer simples listando os 20 produtos mais recentes.
- **`Produtos` form**: separar tab "Compras" (fornecedores) de tab "Composição" (BOM) — alinhar com o que `ProdutoView` faz.
- **`AddProdutoFornecedor`**: trocar carga de todos os produtos por busca server-side via `ProductAutocomplete` (já existe no projeto e já é usado).
- **Greeting/empty states**: padronizar `emptyTitle`/`emptyDescription` em todas as tabelas (hoje só Transportadoras/Unidades fornecem).
- **`AdvancedFilterBar`**: padronizar `value` como `string[]` (array) em todas as páginas; atualizar tipo em `FilterChip` para forçar.

---

## 6. Melhorias estruturais

- **Criar um hook `useCadastroPage<T>`** que encapsule o boilerplate repetido em 8 páginas: `useSupabaseCrud + useEditDirtyForm + useSubmitLock + useConfirmDialog + useEditDeepLink + atalho ?new=1`. Reduz ~150 linhas por página.
- **Centralizar enums de domínio** em `src/lib/cadastros/enums.ts`:
  - `TIPO_CONTRATO_FUNCIONARIO` (alinhar com CHECK constraint chk_tipo_contrato).
  - `MODALIDADE_TRANSPORTADORA` (idem chk_modalidade).
  - `TIPO_FORMA_PAGAMENTO` (alinhar com CHECK do banco — corrige #32).
  - `TIPO_RELACAO_GRUPO` (matriz/filial/coligada/independente).
  Hoje cada página redeclara seus labels.
- **Migrar `produtos.unidade_medida` (text) para `produtos.unidade_medida_id` (FK uuid)**: migration de backfill por `codigo`, trigger de validação, e ajuste de UI/queries. Resolve #10/#38.
- **Migrar `funcionarios.tipo_contrato` e `transportadoras.modalidade` para enums Postgres** (com chk_ constraints — alinhado a `tech/integridade-dados-schema`).
- **Bloquear hard-delete em `unidades_medida` e `formas_pagamento`** via trigger `BEFORE DELETE` que verifica referências; ou nunca expor opção de hard-delete.
- **Unificar a verificação de duplicidade**: estender `useDocumentoUnico` para incluir `transportadoras` (#16) e travar submit enquanto `docChecking=true` (#15). Considerar uma RPC `check_documento_unico(doc, exclude_table, exclude_id)` que faça as 4 queries em uma chamada.
- **Padronizar `useDetailFetch`** — `ClienteView` usa `Promise.all`, `ProdutoView` migrou para `Promise.allSettled` (resiliente). Aplicar `allSettled` em todas para evitar que uma sub-query quebre o drawer inteiro.
- **Remover `forma_pagamento_padrao` da interface `Cliente`** (mantê-la só em uma migração de cleanup), zerar todos os pontos que ainda enviam `null` por compatibilidade.
- **Tipos compartilhados**: estender `src/types/cadastros.ts` para incluir `ClienteRow`, `TransportadoraRow`, `FormaPagamentoRow`, `FuncionarioRow`, `GrupoEconomicoRow` — hoje cada página redeclara `interface Cliente { … }` divergindo do schema gerado em `Tables<"clientes">`.
- **Mover filtros server-side** via `CrudFilter` no `useSupabaseCrud` para `tipo_pessoa`, `ativo`, `grupo_economico_id` (#27/#29). Manter local apenas filtros derivados (ex.: `getSituacaoEstoque`).
- **Padronizar ações do drawer** com `DrawerActionBar` (já existe e é tipado): remove os `<>Edit/Trash</>` ad-hoc das 7 views.
- **Documentar contrato `useDetailFetch + usePublishDrawerSlots + RecordIdentityCard`** num único `docs/cadastros-drawer-pattern.md` para fixar o template antes de criar a 9ª entidade.
- **Adicionar testes unitários** para `useDocumentoUnico` (cross-check), `getSituacaoEstoque` (já há util) e `intervalos_dias` da forma de pagamento (sort/dedup).

