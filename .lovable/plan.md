` tags — this is a research/audit response.)

# Revisão técnica e funcional — Módulo Cadastros

## 1. Visão geral do módulo

O módulo Cadastros do ERP cobre 8 entidades, com páginas dedicadas em `src/pages`:

| Entidade | Linhas | Drawer de detalhe | Sub-componentes |
|----------|------:|-------------------|-----------------|
| Produtos | 1247 | `ProdutoView` (stack relacional) | `cadastros/produtos/components/columns.tsx` (legado, não usado) |
| Clientes | 848 | `ClienteView` (stack relacional) | `clientes/components/{Enderecos,Comunicacoes,Transportadoras}Tab.tsx` |
| Fornecedores | 818 | `FornecedorView` (stack relacional) | `AddProdutoFornecedor` |
| Transportadoras | 1051 | `ViewDrawerV2` local | `cadastros/transportadoras/hooks/useTransportadoras.ts` (não usado) |
| Funcionários | 1006 | `ViewDrawerV2` local | folha embutida |
| Grupos Econômicos | 1031 | `ViewDrawerV2` local | — |
| Formas de Pagamento | 849 | `ViewDrawerV2` local | — |
| Unidades de Medida | 305 | sem drawer (só edita) | — |

**Stack comum**: `ModulePage` + `AdvancedFilterBar` + `DataTable` + `FormModal` + `FormModalFooter` + `useSupabaseCrud` + `useEditDeepLink` (parcial). Validação Zod (`clienteFornecedorSchema`, `produtoSchema`) cobre Clientes/Fornecedores/Produtos. Outras entidades validam manualmente. Edição é por modal (não drawer); visualização ora abre drawer relacional global (`pushView`), ora abre drawer local (`ViewDrawerV2`).

## 2. Pontos fortes

- `useEditDeepLink` (recém-criado) já padronizou `?editId=…` em Clientes / Fornecedores / Produtos.
- Validação CPF/CNPJ com DV via `clienteFornecedorSchema` em Clientes/Fornecedores; DV manual em Funcionários (`isValidCpf`, rejeita repetidos).
- `useDocumentoUnico` checa unicidade cross-table (clientes + fornecedores + funcionários) com debounce e exclusão do próprio id em edição.
- RPC transacional `save_produto_fornecedores` e `save_produto_composicao` em Produtos — eliminou o "delete + insert" não-atômico.
- `set_principal_endereco` (RPC) garante exclusividade de "principal" em endereços de entrega.
- `FormModal` consistente: header com identifier/status/meta, footer fixo, suporte a "Salvar e novo" e confirmação de descarte via `useConfirmDialog`.
- `AdvancedFilterBar` + `MultiSelect` + chips ativos uniforme em todas as listagens.
- `deleteBehavior="soft"` é a regra (não há `delete` físico em nenhuma listagem).
- Confirmação contextualizada antes de excluir Forma de Pagamento e Grupo Econômico (mostra dependências).

## 3. Problemas encontrados

### A. Inconsistência arquitetural: drawer relacional vs. drawer local
- `Clientes`, `Fornecedores`, `Produtos` usam `pushView(...)` → `RelationalDrawerStack` global (com `RelationalLink` para navegar entre entidades, breadcrumb, profundidade máxima).
- `Transportadoras`, `Funcionários`, `Grupos Econômicos`, `Formas de Pagamento` usam `ViewDrawerV2` local, sem participar do stack relacional. Clicar em uma transportadora dentro de um cliente abre o drawer global; clicar nessa transportadora na própria página abre outro drawer. Comportamento divergente para o mesmo recurso. **Risco real de UX**.
- `Unidades de Medida` não tem drawer de visualização — `onView` ausente no `DataTable`, só edita.

### B. Filtros locais sobre dados paginados (KPIs e contagens enganosas)
- `useSupabaseCrud` carrega em `pageSize` páginas (default ~50) ou modo "all" com chunk hard cap; filtros `tipoFilters`, `ativoFilters`, `grupoFilters`, `estoqueFilters` etc. são todos `data.filter(...)` em memória — **só veem a página atual**.
- Resultado: KPIs do topo (`SummaryCard`) somam apenas `data` recebida, e o filtro "Inativos" pode mostrar 0 mesmo havendo registros inativos no banco fora da página. Igualmente nos chips `count={filteredData.length}`.
- Particularmente grave em Produtos (>1000 SKUs típico) e Clientes históricos.

### C. Coexistência das colunas `forma_pagamento_id` (FK) e `forma_pagamento_padrao` (texto legado)
- O fix anterior introduziu `forma_pagamento_id`, mas `Clientes.tsx` ainda escreve sincronizado em `forma_pagamento_padrao` (texto da descrição) "para fallback visual" (linhas 219–221). `ClienteView.tsx` (linha 278) e `OrcamentoForm.tsx` (linha 390) ainda **leem** `forma_pagamento_padrao` como fonte de verdade.
- Two-source-of-truth: edita por `id`, mas exibições/auto-fill leem o texto. Quando o admin renomear uma forma de pagamento em `formas_pagamento`, os clientes mostrarão a descrição antiga até o próximo save. Risco estrutural.
- O drawer de Formas de Pagamento já lê `clientes` por `forma_pagamento_id` (correto). Falta migrar `ClienteView` e `OrcamentoForm` e desativar a coluna texto.

### D. `financeiro_lancamentos.forma_pagamento` continua sendo texto livre
- Drawer de Forma de Pagamento conta uso via `.eq("forma_pagamento", selected.tipo)` (não `id`). Isso conta TODOS os lançamentos com `tipo=boleto`, não os dessa regra específica. Métrica enganosa: duas formas distintas com mesmo `tipo` somam o mesmo valor.
- Mesmo problema em `caixa_movimentos`.

### E. Semântica "excluir" vs. "inativar" não é uniforme
- `Produtos`, `Clientes`, `Fornecedores`, `Transportadoras`, `Grupos`, `Formas de Pagamento`, `Unidades` → `deleteBehavior="soft"` (correto).
- `Funcionários` → `<DataTable ... onView={openView} />` **sem `onEdit` nem `onDelete`** (ações da tabela ausentes; só dá pra ver). Para editar, precisa abrir drawer e clicar em "Editar"; nem todo usuário descobre.
- `Formas de Pagamento` mostra `Switch` de status só em modo "edit" (Bloco 1). Outras entidades (Produtos, Fornecedores, Clientes) não têm toggle de ativo no formulário — só dá pra inativar pelo botão "Excluir" (soft) da tabela. Inconsistente.

### F. Pop-up vs. tab em sub-coleções
- `ClienteEnderecosTab` usa `<Dialog>` interno para criar/editar endereço (modal-em-modal, profundidade 2).
- `Transportadoras` aba "Clientes vinculados" lista inline (sem dialog).
- `Produtos` aba "Compras" (fornecedores vinculados) edita inline.
- `Funcionários` abre `Dialog` separado para registrar folha.
- Nenhum padrão estabelecido.

### G. Validação de documento heterogênea
- Clientes/Fornecedores: `clienteFornecedorSchema` (Zod com DV).
- Funcionários: validação manual (`isValidCpf`).
- Transportadoras: **nenhuma validação de DV** — só `useDocumentoUnico("cnpj", ...)`. Aceita `00.000.000/0000-00` se o servidor aceitar.
- Grupos Econômicos / Formas de Pagamento / Unidades não têm documento.

### H. Estratégias de "dirty form" diferem
- Produtos/Unidades/Formas/Transportadoras: `useEditDirtyForm` ou `useSubmitLock` + `submit(...)`.
- Clientes/Fornecedores: `useState<boolean> + setIsDirty(true)` manual em `updateForm`.
- Funcionários/Grupos: `JSON.stringify(form) !== JSON.stringify(baselineForm)` em `useMemo`.
- Manutenção fica difícil, e o comportamento de "Salvar e novo" só existe em Fornecedores/Produtos.

### I. Deep-link de edição não está em todas as entidades
- `useEditDeepLink` aplicado em Clientes, Fornecedores, Produtos.
- **Faltam** Transportadoras, Funcionários, Grupos, Formas de Pagamento, Unidades. Acesso via `?editId=...` dessas entidades não abre o modal de edição. Quebra uniformidade.

### J. Atalho `?new=1`
- Implementado em Clientes e Produtos (Quick Actions do dashboard apontam pra cá).
- **Não implementado** em Fornecedores, Transportadoras, Funcionários, Grupos, Formas, Unidades. Ações futuras de quick-create dessas entidades cairão na listagem sem abrir o form.

### K. Geração de folha + financeiro embutida em Funcionários (`handleFecharFolha`)
- A página `Funcionarios.tsx` calcula FGTS 8%, vencimento dia 5/dia 7, e faz `insert` direto em `financeiro_lancamentos` (linhas 246–302). Sem RPC, sem transação: se o segundo insert falhar, o primeiro fica órfão; status da folha não é revertido.
- Comentário no código admite que `funcionario_id` ainda não está nos tipos gerados → `as never` casts em todo lado. Dívida técnica explícita.
- Lógica fiscal/contábil não pertence ao módulo de cadastro — pertence ao módulo financeiro/RH.

### L. Componentes legacy não renderizados
- `src/pages/cadastros/produtos/components/columns.tsx` (158 linhas) define `produtoColumns` mas `Produtos.tsx` redefine `columns` inline — o arquivo é morto.
- `src/pages/cadastros/transportadoras/hooks/useTransportadoras.ts` (90 linhas, React Query estrito + tipagem `Database`) **não é importado** por `Transportadoras.tsx`, que usa `useSupabaseCrud`. Hook dedicado morto.
- Lifecycle: dois caminhos foram iniciados, nenhum concluído. Risco de divergência futura.

### M. KPIs no header poluídos por dados históricos
- `Clientes` mostra "Total de Clientes" somando data atual da página (ver B). Não exclui registros históricos importados (hoje a maior parte da base).
- `Produtos` o mesmo — `total`, `ativos`, `criticos` não filtram fonte. Há 203 documentos históricos importados em outros módulos; se a mesma política for aplicada a clientes/produtos, esses KPIs ficarão inflados.

### N. `Produtos` sub-form "Composição" e "Compras (fornecedores)" são UI complexa dentro do modal
- Modal `xl` com 5 abas (Dados/Estoque/Fiscal/Compras/Obs) + sub-listas dinâmicas + dialog inline (`novaUnidadeDialogOpen`). Edição em mobile fica inviável.
- Custo composto recalculado a cada render do `Produtos` inteiro (`editComposicao.reduce` com `data.find` O(n²) sobre todos os produtos). Em base com 1k+ produtos, lag perceptível.

### O. `ClienteView.tsx` (drawer relacional) lê `forma_pagamento_padrao` (texto)
- Já citado em C. Mostra "Não definida" se a sincronização falhou em algum salvamento via outra interface (importação, RPC). Inconsistente com o que o modal de edição mostra.

### P. `RelationalDrawerStack` ↔ `useEditDeepLink` colidem
- Se o usuário abrir `?editId=<uuid>` numa rota e `pushView("cliente", uuid)` em outra, ambos modais/drawers podem renderizar simultaneamente — `useEditDeepLink` **não consulta** se o stack já tem aquele recurso aberto.

### Q. `caixa_postal` em Clientes mas não em Fornecedores/Transportadoras
- Pequena divergência semântica (só Clientes tem); a UI de endereço replica o mesmo bloco em 3 páginas com pequenas variações.

### R. Acessibilidade e detalhes
- Vários `<Input type="number">` com `step="0.01"` para moeda — sem máscara, sem locale BR (o usuário digita `0,01` e vira `NaN`).
- `Switch` de "Ativo" sem `aria-label` em vários lugares.
- Tabs do Modal não têm `aria-label` na `TabsList` (só ícone visual).

## 4. Problemas prioritários

1. **B** — Filtros e KPIs de cabeçalho calculados sobre página atual produzem números errados em bases >`pageSize`. **Crítico** para Produtos e Clientes.
2. **C / D / O** — Two-source-of-truth de Forma de Pagamento (`id` vs. `descricao`/`tipo`) ainda persiste em `ClienteView`, `OrcamentoForm`, `caixa_movimentos`, `financeiro_lancamentos`. Bug latente sempre que descrição é renomeada.
3. **A** — Drawer relacional vs. local: o mesmo registro abre em 2 estilos conforme o ponto de entrada. Confusão visível.
4. **K** — Geração de folha + financeiro sem transação dentro do módulo de cadastro. Risco de inconsistência financeira.
5. **L** — Código morto (`columns.tsx`, `useTransportadoras.ts`) sinaliza refatorações abandonadas. Risco de manutenção.
6. **G** — Transportadoras sem validação de DV de CNPJ.

## 5. Melhorias de UI/UX

- Padronizar todos os drawers de detalhe via `pushView(...)` + `RelationalDrawerStack` (rota única para ver qualquer entidade). Aposentar `ViewDrawerV2` local em Funcionários, Grupos, Formas, Transportadoras.
- `Unidades de Medida`: adicionar `onView` que abra um drawer mínimo mostrando "produtos que usam esta unidade".
- `Funcionários`: adicionar `onEdit`/`onDelete` na tabela (hoje só `onView`).
- Toggle de "Ativo" no formulário de Clientes/Fornecedores/Produtos/Transportadoras (hoje só Switch em Formas e Transportadoras). Quem inativa pelo "Excluir" não consegue reativar pela tabela atual.
- Trocar inputs de moeda (`type="number"`) por componente com máscara BR (existe `MaskedInput`, faltam variantes `currency`).
- Padronizar criação de sub-itens: ou tudo inline (Compras/Endereços de Entrega), ou tudo em dialog secundário. Hoje variam por entidade.
- Mostrar contagem real de filtros (server-side count) ao invés de `filteredData.length` quando paginação é "paged".
- `Save and New` em todas as entidades, não apenas Fornecedores e Produtos.
- Botão "Reativar" explícito para registros inativos (hoje, só dá para reativar editando o registro inativo, que muitos usuários nem sabem que é o caminho).

## 6. Melhorias estruturais

- **Consolidar contrato de "Forma de Pagamento"**: deprecar definitivamente `clientes.forma_pagamento_padrao`, `financeiro_lancamentos.forma_pagamento`, `caixa_movimentos.forma_pagamento`. Backfill final via `forma_pagamento_id` e remover writes textuais. Atualizar `ClienteView` e `OrcamentoForm` para consumir `formas_pagamento(descricao)` por join.
- **Hook único de cadastro**: criar `useCadastroBase<T>(table, schema, options)` que encapsule `useSupabaseCrud + useEditDirtyForm + useSubmitLock + useEditDeepLink + useConfirmDialog + ?new=1`. Reduz drift entre páginas (problemas H, I, J).
- **Componentes compartilhados de formulário**:
  - `<DocumentoFields tipo="cnpj|cpf" {...} />` (CNPJ + lookup + unique check + DV).
  - `<EnderecoFields {...} />` (CEP + ViaCEP + UF + caixa_postal).
  - Hoje cada página recicla ~80 linhas idênticas de JSX.
- **Filtros server-side**: estender `useSupabaseCrud` para aceitar filtros como query (`{column, op, value}`) ao invés de `data.filter` no cliente. Resolve B/M.
- **Mover `handleFecharFolha`** para RPC `gerar_financeiro_folha(folha_id)` no banco (atomicidade + auditoria + reuso).
- **Apagar código legado** (`cadastros/produtos/components/columns.tsx`, `cadastros/transportadoras/hooks/useTransportadoras.ts`) ou converter em código realmente usado.
- **Validação Zod uniforme**: `transportadoraSchema` (DV de CNPJ), `funcionarioSchema` (DV de CPF), `formaPagamentoSchema` (tipo enum, parcelas vs. intervalos coerentes).
- **Tipos do `funcionario_id` em `financeiro_lancamentos`** — regenerar tipos do Supabase para eliminar os `as never` casts.
- **Prevenir colisão modal × stack** (P): `useEditDeepLink` deve checar `useRelationalNavigation().stack` e ignorar `?editId` se o recurso já está no stack — ou converter `editId` em "abrir drawer relacional em modo edição" quando o módulo participar do stack.I called the wrong tool. The audit doesn't require `<lov-plan>` (it's a research/analysis task per chat-and-plan-instructions). Let me deliver the answer directly.

# Revisão técnica e funcional — Módulo Cadastros

## 1. Visão geral do módulo

O módulo Cadastros cobre 8 entidades, todas em `src/pages`:

| Entidade | LOC | Drawer de detalhe | Sub-componentes |
|---|---:|---|---|
| Produtos | 1247 | `ProdutoView` (stack relacional) | `cadastros/produtos/components/columns.tsx` (legado, não importado) |
| Clientes | 848 | `ClienteView` (stack relacional) | `clientes/components/{Enderecos,Comunicacoes,Transportadoras}Tab.tsx` |
| Fornecedores | 818 | `FornecedorView` (stack relacional) | `AddProdutoFornecedor` |
| Transportadoras | 1051 | `ViewDrawerV2` local | `cadastros/transportadoras/hooks/useTransportadoras.ts` (não usado) |
| Funcionários | 1006 | `ViewDrawerV2` local | folha de pagamento embutida |
| Grupos Econômicos | 1031 | `ViewDrawerV2` local | — |
| Formas de Pagamento | 849 | `ViewDrawerV2` local | — |
| Unidades de Medida | 305 | sem drawer (só edita) | — |

**Stack comum**: `ModulePage` + `AdvancedFilterBar` + `DataTable` + `FormModal` + `FormModalFooter` + `useSupabaseCrud` + `useEditDeepLink` (parcial). Validação Zod (`clienteFornecedorSchema`, `produtoSchema`) cobre Clientes/Fornecedores/Produtos. Outras validam manualmente. Visualização ora usa drawer relacional global (`pushView`), ora drawer local (`ViewDrawerV2`).

## 2. Pontos fortes

- `useEditDeepLink` recém-criado padronizou `?editId=…` em Clientes/Fornecedores/Produtos.
- DV de CPF/CNPJ via `clienteFornecedorSchema` (Zod) em Clientes/Fornecedores; DV manual em Funcionários (`isValidCpf` rejeita repetidos).
- `useDocumentoUnico` checa cross-table (clientes + fornecedores + funcionários) com debounce e exclusão do próprio id.
- RPCs transacionais `save_produto_fornecedores` e `save_produto_composicao` em Produtos eliminaram o "delete + insert" não-atômico.
- `set_principal_endereco` (RPC) garante exclusividade de "principal" em endereços de entrega.
- `FormModal` consistente: header com identifier/status/meta, footer fixo, suporte a "Salvar e novo" e confirm de descarte.
- `AdvancedFilterBar` + `MultiSelect` + chips ativos uniforme em todas as listagens.
- `deleteBehavior="soft"` é regra geral (não há delete físico).
- Confirmação contextualizada antes de excluir Forma de Pagamento e Grupo Econômico (mostra dependências).

## 3. Problemas encontrados

### A. Drawer relacional vs. drawer local (inconsistência arquitetural)
- Clientes/Fornecedores/Produtos usam `pushView(...)` → `RelationalDrawerStack` global, com `RelationalLink`, breadcrumb e profundidade.
- Transportadoras/Funcionários/Grupos/Formas de Pagamento usam `ViewDrawerV2` local, fora do stack relacional.
- O **mesmo** registro abre em estilos diferentes conforme o ponto de entrada. Em Funcionários e Formas, `RelationalLink` para cliente abre o drawer global; clicar na própria página abre outro drawer não-relacional. UX divergente.
- Unidades de Medida não tem `onView` na tabela (só edita).

### B. Filtros locais sobre dados paginados → KPIs e contagens enganosas
- `useSupabaseCrud` carrega em páginas (default `pageSize`) ou em chunks no modo "all" (com hard-cap). Os filtros (`tipoFilters`, `ativoFilters`, `grupoFilters`, `estoqueFilters`) e KPIs (`SummaryCard`, `count={filteredData.length}`) usam `data.filter(...)` em memória — só veem **a página atual**.
- Em Produtos (>1k SKUs) e Clientes históricos, "Inativos" pode mostrar 0 mesmo havendo inativos no banco. **Crítico**.

### C. Coexistência `forma_pagamento_id` (FK) + `forma_pagamento_padrao` (texto)
- O fix anterior introduziu `forma_pagamento_id`, mas `Clientes.tsx` segue **escrevendo** `forma_pagamento_padrao` sincronizado (linhas 219–221, "para fallback visual").
- `ClienteView.tsx` (linha 278) e `OrcamentoForm.tsx` (linha 390) **leem `forma_pagamento_padrao`** como fonte de verdade. Quando admin renomear a forma em `formas_pagamento`, clientes mostrarão a descrição antiga até o próximo save. Two-source-of-truth latente.

### D. `financeiro_lancamentos.forma_pagamento` e `caixa_movimentos.forma_pagamento` ainda são texto livre
- Drawer de Forma de Pagamento conta uso via `.eq("forma_pagamento", selected.tipo)` (não por id). Conta **todos** os lançamentos com `tipo=boleto`, não os daquela regra específica. Métrica enganosa: duas formas distintas com mesmo `tipo` somam o mesmo valor.

### E. "Excluir" vs. "Inativar" não-uniforme
- `Funcionários` define `<DataTable ... onView={openView} />` **sem `onEdit` nem `onDelete`**. Para editar/inativar, é preciso abrir o drawer e clicar em ações lá dentro — descoberta ruim.
- Apenas Transportadoras e Formas de Pagamento têm `Switch` de status no formulário. Em Clientes/Fornecedores/Produtos, inativar exige clicar no "Excluir" (soft) da tabela; reativar exige editar o registro inativo (que muitos não acham).

### F. Sub-coleções: dialog vs. inline sem padrão
- `ClienteEnderecosTab` abre `<Dialog>` interno (modal-em-modal, profundidade 2).
- Aba "Clientes vinculados" em Transportadoras edita inline.
- Aba "Compras (fornecedores)" em Produtos edita inline.
- Aba "Folha" de Funcionários abre `Dialog` separado.
- Convenção inexistente.

### G. Validação heterogênea
- Clientes/Fornecedores: Zod com DV.
- Funcionários: validação manual (`isValidCpf`).
- Transportadoras: **sem DV de CNPJ** — só `useDocumentoUnico` (unicidade).
- Grupos / Formas / Unidades: sem documento (ok), mas sem schema Zod (ok minimamente).

### H. Estratégias de "dirty form" diferentes
- Produtos/Unidades/Formas/Transportadoras: `useEditDirtyForm` ou `useSubmitLock`.
- Clientes/Fornecedores: `useState<boolean>` manual em `updateForm`.
- Funcionários/Grupos: `JSON.stringify(form) !== JSON.stringify(baseline)` em `useMemo`.
- "Salvar e novo" só existe em Fornecedores e Produtos.

### I. Deep-link `?editId` ausente em metade das páginas
- Aplicado: Clientes, Fornecedores, Produtos.
- **Faltam**: Transportadoras, Funcionários, Grupos, Formas, Unidades.

### J. Atalho `?new=1` ausente em metade
- Implementado: Clientes, Produtos.
- **Faltam**: Fornecedores, Transportadoras, Funcionários, Grupos, Formas, Unidades. Quick Actions futuras cairão na listagem sem abrir o form.

### K. Geração de folha + financeiro embutida em `Funcionarios.tsx`
- `handleFecharFolha` (linhas 246–302) calcula FGTS 8%, vencimento dia 5/dia 7 e faz `insert` direto em `financeiro_lancamentos` **sem RPC e sem transação**: se o segundo insert falhar, o primeiro fica órfão e o status da folha não é revertido.
- O comentário no código admite que `funcionario_id` ainda não está nos tipos gerados → `as never` em vários pontos. Dívida técnica explícita. Lógica fiscal/contábil fora do módulo correto.

### L. Componentes legacy não usados
- `src/pages/cadastros/produtos/components/columns.tsx` (158 linhas) define `produtoColumns` mas `Produtos.tsx` redefine inline. **Morto**.
- `src/pages/cadastros/transportadoras/hooks/useTransportadoras.ts` (90 linhas, padrão React Query estrito) **não é importado** por `Transportadoras.tsx`, que usa `useSupabaseCrud`. **Morto**.
- Sinaliza refatorações iniciadas e abandonadas.

### M. Performance e estabilidade
- `Produtos.tsx`: cálculo de custo composto (`editComposicao.reduce` com `data.find` por componente) é O(n²) sobre o array `data` (todos os produtos) a cada render do form. Lag perceptível em base com 1k+ SKUs.
- `Inputs type="number" step="0.01"` para preço/salário/peso não respeitam locale BR — usuário digita "0,01" e vira `NaN` silencioso.

### N. Colisão potencial `useEditDeepLink` × `RelationalDrawerStack`
- `useEditDeepLink` não consulta o stack relacional — `?editId=<uuid>` pode abrir o `FormModal` mesmo se já houver um drawer do mesmo recurso aberto (duplicação visual).

### O. Pequenas divergências semânticas
- `caixa_postal` só existe em Clientes — não em Fornecedores nem Transportadoras. Bloco de endereço replicado ~80 linhas em 3 páginas com micro-variações.
- Switch "Ativo" sem `aria-label` em vários pontos.
- `TabsList` dos modais sem `aria-label` (só ícone visual).

## 4. Problemas prioritários

1. **B** — Filtros e KPIs sobre página atual produzem números errados em bases > `pageSize`. Crítico em Produtos e Clientes.
2. **C / D / O** — Two-source-of-truth de Forma de Pagamento (`id` vs. `descricao`/`tipo`) ainda persiste em `ClienteView`, `OrcamentoForm`, `caixa_movimentos`, `financeiro_lancamentos`. Bug latente quando descrição é renomeada.
3. **A** — Drawer relacional vs. local: o mesmo registro abre em 2 estilos diferentes.
4. **K** — Geração de folha + financeiro sem transação dentro do módulo de Cadastro. Risco de inconsistência financeira.
5. **L** — Código morto (`columns.tsx`, `useTransportadoras.ts`).
6. **G** — Transportadoras sem validação de DV de CNPJ.
7. **E** — Funcionários sem `onEdit/onDelete` na tabela; Clientes/Fornecedores/Produtos sem toggle de Ativo no form.

## 5. Melhorias de UI/UX

- Padronizar todos os drawers de detalhe via `pushView(...)` + `RelationalDrawerStack`. Aposentar `ViewDrawerV2` local em Funcionários/Grupos/Formas/Transportadoras.
- Adicionar `onView` em Unidades de Medida (drawer mínimo: "produtos que usam esta unidade").
- Adicionar `onEdit/onDelete` (soft) na tabela de Funcionários.
- Adicionar toggle "Ativo" no formulário de Clientes/Fornecedores/Produtos/Transportadoras. Botão "Reativar" explícito para inativos.
- Trocar `<Input type="number">` de moeda por componente com máscara BR (extender `MaskedInput` para `currency`).
- Padronizar criação de sub-itens: ou tudo inline ou tudo em dialog secundário, não misturar.
- Mostrar contagem **server-side** ao invés de `filteredData.length` quando paginação é "paged".
- "Salvar e novo" em todas as entidades.
- `aria-label` em `Switch`, `TabsList`.

## 6. Melhorias estruturais

- **Consolidar contrato de Forma de Pagamento**: deprecar `clientes.forma_pagamento_padrao`, `financeiro_lancamentos.forma_pagamento`, `caixa_movimentos.forma_pagamento`. Atualizar `ClienteView` e `OrcamentoForm` para `formas_pagamento(descricao)` por join.
- **Hook único de cadastro**: `useCadastroBase<T>(table, schema, options)` encapsulando `useSupabaseCrud + useEditDirtyForm + useSubmitLock + useEditDeepLink + useConfirmDialog + ?new=1`. Resolve H/I/J/N de uma vez.
- **Componentes compartilhados**: `<DocumentoFields tipo="cnpj|cpf" />` (CNPJ + lookup + unique + DV) e `<EnderecoFields />` (CEP + ViaCEP + UF + caixa_postal). Hoje há ~80 linhas duplicadas em 3 páginas.
- **Filtros server-side**: estender `useSupabaseCrud` para aceitar filtros como query parameters, não `data.filter`. Resolve B/M.
- **RPC `gerar_financeiro_folha(folha_id)`**: mover `handleFecharFolha` para o banco (atomicidade + auditoria + reuso).
- **Apagar código legado** ou ativar: `cadastros/produtos/components/columns.tsx`, `cadastros/transportadoras/hooks/useTransportadoras.ts`.
- **Validação Zod uniforme**: `transportadoraSchema` (DV CNPJ), `funcionarioSchema` (DV CPF), `formaPagamentoSchema` (tipo enum, coerência parcelas × intervalos).
- **Regenerar tipos Supabase** para incluir `funcionario_id` em `financeiro_lancamentos` e remover os `as never`.
- **Prevenir colisão modal × stack** (N): `useEditDeepLink` consulta `useRelationalNavigation().stack` e ignora `?editId` se o recurso já está aberto, ou converte em "abrir drawer relacional em modo edição".<final-text>
# Revisão técnica e funcional — Módulo Cadastros

## 1. Visão geral

8 entidades em `src/pages`: Produtos (1247 LOC), Clientes (848), Fornecedores (818), Transportadoras (1051), Funcionários (1006), Grupos Econômicos (1031), Formas de Pagamento (849), Unidades de Medida (305). Stack comum: `ModulePage` + `AdvancedFilterBar` + `DataTable` + `FormModal` + `useSupabaseCrud`. Visualização ora via `pushView` (drawer relacional global), ora via `ViewDrawerV2` local.

## 2. Pontos fortes

- `useEditDeepLink` padronizou `?editId` em Clientes/Fornecedores/Produtos.
- `useDocumentoUnico` checa unicidade cross-table (clientes + fornecedores + funcionários) com debounce.
- DV de CPF/CNPJ via Zod (`clienteFornecedorSchema`) em Clientes/Fornecedores; DV manual em Funcionários.
- RPCs transacionais `save_produto_fornecedores` e `save_produto_composicao` em Produtos.
- `set_principal_endereco` (RPC) garante exclusividade do endereço principal.
- `FormModal` consistente com identifier/status/meta/footer e confirm de descarte.
- `deleteBehavior="soft"` é regra geral.
- Confirm de exclusão de Forma de Pagamento e Grupo mostra dependências antes.

## 3. Problemas encontrados

**A. Drawer relacional vs. local.** Clientes/Fornecedores/Produtos usam `pushView` → stack global. Transportadoras/Funcionários/Grupos/Formas usam `ViewDrawerV2` local. O mesmo registro abre em estilos distintos conforme a entrada. Unidades sequer tem `onView`.

**B. Filtros locais sobre dados paginados.** `tipoFilters/ativoFilters/grupoFilters/estoqueFilters` e `count={filteredData.length}` rodam `data.filter(...)` em memória, vendo só a página atual. Em bases > pageSize (Produtos, Clientes históricos), KPIs e contagens ficam errados. **Crítico.**

**C. Two-source-of-truth de Forma de Pagamento.** `Clientes.tsx` (linhas 219–221) ainda escreve `forma_pagamento_padrao` em sync com o `id` "para fallback visual". `ClienteView.tsx` (l.278) e `OrcamentoForm.tsx` (l.390) leem o campo textual como verdade — renomear a forma deixa clientes mostrando descrição antiga.

**D. `financeiro_lancamentos.forma_pagamento` e `caixa_movimentos.forma_pagamento` ainda são texto livre.** Drawer de Forma conta uso por `.eq("forma_pagamento", selected.tipo)` (não por id) — duas formas distintas com mesmo `tipo` somam o mesmo total.

**E. Excluir × Inativar não-uniforme.** Funcionários: `DataTable` sem `onEdit`/`onDelete`. Clientes/Fornecedores/Produtos: sem toggle "Ativo" no form — para inativar o usuário clica em "Excluir" (soft) e fica sem caminho óbvio para reativar. Só Transportadoras e Formas têm Switch de status.

**F. Sub-coleções sem padrão.** `ClienteEnderecosTab` usa `<Dialog>` interno (modal-em-modal). Aba "Clientes vinculados" em Transportadoras edita inline. Compras/Fornecedor em Produtos edita inline. Folha em Funcionários abre Dialog próprio.

**G. Validação heterogênea.** Transportadoras: `useDocumentoUnico` mas **sem DV de CNPJ**. Grupos/Formas/Unidades sem schema Zod (mínimas, ok). Falta `transportadoraSchema` e `funcionarioSchema`.

**H. Estratégias de "dirty" diferentes.** `useEditDirtyForm` (Produtos/Unidades/Formas), `useState<boolean>` manual (Clientes/Fornecedores), `JSON.stringify` em `useMemo` (Funcionários/Grupos/Transportadoras).

**I. `?editId` ausente em metade.** Falta em Transportadoras, Funcionários, Grupos, Formas, Unidades.

**J. `?new=1` ausente em metade.** Implementado em Clientes e Produtos. Quick Actions futuras cairão na listagem.

**K. Geração de folha + financeiro embutida em `Funcionarios.tsx`.** `handleFecharFolha` (l.246–302) calcula FGTS 8% e faz `insert` direto em `financeiro_lancamentos` **sem RPC e sem transação**: se o segundo insert falhar o primeiro fica órfão. Comentário no código admite `as never` por tipos desatualizados. Lógica fiscal/contábil no módulo errado.

**L. Código legado morto.** `src/pages/cadastros/produtos/components/columns.tsx` (158 linhas) define `produtoColumns` mas `Produtos.tsx` redefine inline. `src/pages/cadastros/transportadoras/hooks/useTransportadoras.ts` (90 linhas, padrão React Query estrito) não é importado. Refatorações iniciadas e abandonadas.

**M. Performance.** `Produtos.tsx`: `editComposicao.reduce` faz `data.find` por componente — O(n²) sobre o array completo de produtos a cada render. `<Input type="number" step="0.01">` em moeda/salário ignora locale BR (vírgula vira NaN).

**N. Colisão potencial.** `useEditDeepLink` não consulta `RelationalNavigationContext` — `?editId` pode abrir `FormModal` mesmo com drawer do mesmo recurso aberto.

**O. Divergências semânticas.** `caixa_postal` só em Clientes. Bloco de endereço replicado ~80 linhas em 3 páginas. Switch "Ativo" e `TabsList` sem `aria-label`.

## 4. Problemas prioritários

1. **B** — Filtros/KPIs sobre página atual produzem números errados (Produtos/Clientes).
2. **C/D/O** — Two-source-of-truth de Forma de Pagamento ainda vivo em `ClienteView`, `OrcamentoForm`, `caixa_movimentos`, `financeiro_lancamentos`.
3. **A** — Mesmo registro abre em 2 drawers distintos.
4. **K** — Folha + financeiro sem transação dentro de Cadastros.
5. **L** — Código morto (`columns.tsx`, `useTransportadoras.ts`).
6. **G** — Transportadoras sem DV de CNPJ.
7. **E** — Funcionários sem ações na tabela; Clientes/Fornecedores/Produtos sem toggle de Ativo no form.

## 5. Melhorias de UI/UX

- Padronizar todos os drawers de detalhe via `pushView`. Aposentar `ViewDrawerV2` local.
- Adicionar `onView` em Unidades de Medida (drawer mínimo: produtos que usam).
- Adicionar `onEdit/onDelete` na tabela de Funcionários.
- Toggle "Ativo" no formulário de Clientes/Fornecedores/Produtos/Transportadoras + botão "Reativar" explícito.
- `MaskedInput mask="currency"` para preço/salário/peso.
- Padronizar criação de sub-itens (tudo inline OU tudo em dialog secundário).
- Mostrar contagem server-side em vez de `filteredData.length`.
- "Salvar e novo" em todas as entidades.
- `aria-label` em `Switch` e `TabsList`.

## 6. Melhorias estruturais

- **Consolidar contrato de Forma de Pagamento**: deprecar `clientes.forma_pagamento_padrao` e os textos em `financeiro_lancamentos`/`caixa_movimentos`. Atualizar `ClienteView` e `OrcamentoForm` via join em `formas_pagamento(descricao)`.
- **Hook único `useCadastroBase<T>(table, schema, options)`** encapsulando `useSupabaseCrud + useEditDirtyForm + useSubmitLock + useEditDeepLink + useConfirmDialog + ?new=1`. Resolve H/I/J/N de uma vez.
- **Componentes compartilhados**: `<DocumentoFields tipo="cnpj|cpf">` (lookup + unique + DV) e `<EnderecoFields>` (CEP + ViaCEP + UF + caixa_postal). Elimina ~80 linhas duplicadas em 3 páginas.
- **Filtros server-side**: estender `useSupabaseCrud` com filtros como query parameters. Resolve B e parte de M.
- **RPC `gerar_financeiro_folha(folha_id)`**: mover `handleFecharFolha` para o banco (atomicidade + auditoria + reuso). Resolve K.
- **Apagar `cadastros/produtos/components/columns.tsx` e `cadastros/transportadoras/hooks/useTransportadoras.ts`** (ou ativar o segundo como padrão futuro substituindo `useSupabaseCrud`).
- **Schemas Zod** `transportadoraSchema` (DV CNPJ), `funcionarioSchema` (DV CPF), `formaPagamentoSchema` (enum tipo + coerência `parcelas × intervalos_dias`).
- **Regenerar tipos Supabase** para incluir `funcionario_id` em `financeiro_lancamentos` e eliminar `as never`.
- **`useEditDeepLink` consciente do stack**: ignorar `?editId` se o recurso já está aberto, ou abrir o drawer relacional em modo edição.
</final-text>