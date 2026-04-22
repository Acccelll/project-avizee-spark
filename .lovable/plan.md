

# Revisão Técnica e Funcional — Módulo Compras

Revisão baseada no estado real (`src/pages/{CotacoesCompra,CotacaoCompraForm,PedidosCompra,PedidoCompraForm}.tsx`, `src/components/views/PedidoCompraView.tsx`, `src/components/compras/*`, `src/hooks/{useCotacoesCompra,usePedidosCompra}.ts`, `src/pages/comercial/hooks/{useGerarPedidoCompra,useReceberCompra}.ts`, `docs/compras-modelo.md`).

---

## 1. Visão geral do módulo

Cobre o ciclo **Cotação de Compra → Pedido de Compra → Recebimento (Estoque + Financeiro + NF entrada)**.

| Camada | Grid | Form rota dedicada | Modal | Drawer | Detalhe |
|---|---|---|---|---|---|
| Cotação Compra | `CotacoesCompra.tsx` | `CotacaoCompraForm.tsx` (`/cotacoes-compra/:id`) | `FormModal` inline | `CotacaoCompraDrawer` | — |
| Pedido Compra | `PedidosCompra.tsx` | `PedidoCompraForm.tsx` (`/pedidos-compra/:id`) | `PedidoCompraFormModal` | `PedidoCompraDrawer` | `PedidoCompraView` (drawer relacional) |

Workflow oficial (`docs/compras-modelo.md`):
- Cotação: `rascunho · aberta · em_analise · aguardando_aprovacao · aprovada · convertida · rejeitada · cancelada`. Terminais: `convertida/rejeitada/cancelada`.
- Pedido: `rascunho · aguardando_aprovacao · aprovado · enviado_ao_fornecedor · aguardando_recebimento · parcialmente_recebido · recebido · cancelado`. Terminais: `recebido/cancelado`.
- Aliases legados absorvidos: `finalizada→aprovada` (cotação), `recebido_parcial→parcialmente_recebido` (pedido).

RPCs: `gerar_pedido_compra`, `receber_compra`, `estornar_recebimento_compra`, `replace_pedido_compra_itens`, `replace_cotacao_compra_itens`, `cancelar_cotacao_compra`, `solicitar_aprovacao_pedido`, `aprovar_pedido`, `rejeitar_pedido`, `proximo_numero_*`.

Persistência: cotação usa `useSupabaseCrud` legado; pedido já usa **React Query**. Filtros via `useSearchParams` em ambos com **multivalor por param repetido** (`?status=a&status=b`).

---

## 2. Pontos fortes

- **Status canonizado** em `comprasStatus.ts` com aliases legados (`finalizada`, `recebido_parcial`) absorvidos no client; doc afirma que o banco já recusa os legados.
- **`gerar_pedido_compra`** via mutation hook com idempotência (`ux_pedidos_compra_cotacao_id`) e invalidação cross-módulo.
- **`receber_compra`** com `pg_advisory_xact_lock` e validação server-side de saldo pendente — recebimento parcial é tratado corretamente.
- **`estornar_recebimento_compra`** existe, devolve estoque e recalcula `quantidade_recebida`.
- **`PedidoCompraDrawer`** tem footer rico (cancelar, solicitar aprovação, aprovar/rejeitar com motivo, marcar enviado, registrar recebimento) gated por `useActionLock`.
- **`PedidoCompraView` (drawer relacional)** mostra progresso de recebimento por item, movimentações de estoque, datas de entrega, vínculo com cotação e logística — boa rastreabilidade.
- **`CotacaoCompraDrawer`** tem aba "Decisão" com totais aprovados, status do processo e gates explícitos por status. Boa UX de comparação de propostas.
- **Validação de fornecedor único** ao gerar pedido (`gerarPedido` em `useCotacoesCompra`) impede misturar fornecedores no mesmo pedido.
- **`replace_pedido_compra_itens` / `replace_cotacao_compra_itens`** transacionais — usadas pelos forms de rota (não pelo modal).
- **`useDetailFetch` com `abortSignal`** em `PedidoCompraView` — race resolvida.
- **`darEntrada`** redireciona para `/fiscal` com `pedido_compra_id` UUID + `fornecedor_id` para pré-vincular NF entrada — boa continuidade.
- **Auditoria documentada** no `docs/compras-modelo.md` para todas as RPCs do lifecycle.

---

## 3. Problemas encontrados

### A. Status: drift, alias e ações que ignoram o workflow

1. **`useCotacoesCompra.handleSendForApproval/handleApprove/handleReject`** fazem `update status=...` direto na tabela, **bypassando trigger** `trg_cotacao_compra_transicao` apenas no sentido de não usar RPC dedicada. Nenhuma RPC `aprovar_cotacao_compra` / `rejeitar_cotacao_compra` é usada — toda transição cai na trigger e **não há auditoria** dessas mudanças (só a doc fala em auditoria via `cancelar_cotacao_compra`). Inconsistente: cancelar tem RPC com auditoria; aprovar/rejeitar/enviar não.
2. **`CotacaoCompraForm.handleSave` permite alterar `form.status` livremente** (passa o status atual no payload). Apenas bloqueia `convertida/cancelada`. Um usuário pode salvar `aprovada` direto pelo form de edição, pulando o caminho de aprovação. O Modal da grid (`CotacoesCompra.tsx`) trava o select como disabled, mas o form de rota não — **dois caminhos divergentes**.
3. **`useCotacoesCompra.openEdit/openView` chamam `canonicalCotacaoStatus`** (alias `finalizada→aprovada`), mas a doc diz que o banco já não aceita o legado. O alias serve como leitura defensiva. **Concomitantemente**, `CotacaoCompraForm.tsx` (linha 99) seta `form.status = cot.status` sem canonização — abre brecha de salvar `finalizada` se algum registro legado existir e o usuário clicar Save.
4. **`pedidoStatusLabelMap`** adiciona dois rótulos que **não constam em `statusPedidoCompra`** do `lib/statusSchema`: `aguardando_aprovacao` e `rejeitado`. Esses status existem no DB e nas RPCs (`solicitar_aprovacao_pedido`, `rejeitar_pedido`), mas **não estão modelados em `statusSchema`** — `StatusBadge` cai no fallback de cor padrão. Drift entre lib e código real.
5. **`usePedidosCompra.kpis.aguardando`** filtra `["rascunho", "aguardando_aprovacao", "aprovado", "enviado_ao_fornecedor", "aguardando_recebimento"]`, mas **omite `parcialmente_recebido`** — pedidos com recebimento parcial não aparecem em "Aguardando" nem em "Recebidos". KPI subreporta o cenário mais comum operacionalmente.
6. **`recebimentoFilterOptions`** não tem opção "Cancelado" — usuário não consegue filtrar pedidos cancelados pelo grupo de recebimento (só pelo status). E `getRecebimentoFilter` retorna string vazia para `cancelado/rascunho/aguardando_aprovacao/rejeitado/parcialmente_recebido`. Pedido `parcialmente_recebido` cai em `"parcial"` (ok), mas `rejeitado/cancelado` somem do agrupamento.
7. **Em `PedidoCompraDrawer.tabRecebimento`**, a árvore `if/else` de ícones por status **não cobre `aguardando_aprovacao`** — pedido nesse status não mostra ícone na "Situação de Recebimento" (gap visual).
8. **`canonicalCotacaoStatus` default** é `"aberta"`, mas a doc lista `rascunho` como estado inicial. Cotações sem status (improvável, mas possível em legado) ficam visíveis como "Em Cotação" em vez de "Rascunho".

### B. Coexistência de modal e form em rota — divergências reais

9. **Cotação tem 2 caminhos de edição** com escopo diferente:
   - **Modal** (`CotacoesCompra.tsx`): usa `useCotacoesCompra.handleSubmit` que faz delete+insert client-side dos itens (passos 222–249), não usa `replace_cotacao_compra_itens`.
   - **Form de rota** (`CotacaoCompraForm.tsx`): usa a RPC `replace_cotacao_compra_itens` (linha 189).
   Mesma operação, dois mecanismos. Em caso de falha entre delete e insert no modal, a cotação fica sem itens. **Bug latente.**
10. **`CotacaoCompraForm` salva via `update` direto** sem invalidar React Query — `useCotacoesCompra` na grid usa `useSupabaseCrud` (sem listener de queryKey), mas se outros consumidores usarem QC, ficam desatualizados. Hoje funciona porque a grid faz `fetchData()` ao reabrir, mas é frágil.
11. **`PedidoCompraFormModal`** e **`PedidoCompraForm`** têm o **mesmo set de status no Select** (`["rascunho", "aprovado"]`) mas a lógica de bloqueio é diferente: o Form de rota tem `WORKFLOW_ONLY_STATUSES` que **inclui também `enviado_ao_fornecedor`**; o Modal não bloqueia `enviado_ao_fornecedor` explicitamente, apenas não o oferece. Mesma intenção, dois códigos.
12. **Form de rota do Pedido tem comentário "Editar Pedido" mas escopo restrito** — aceita só `rascunho` e `aprovado`. Não há banner explícito (como em Comercial) avisando que se trata de "edição operacional restrita". O `isTerminal` warning só cobre `recebido/cancelado`.
13. **`onEdit` no drawer de Pedido** navega para `/compras/pedidos/${id}` (linha 220 do `PedidoCompraView`), mas a rota real é **`/pedidos-compra/:id`**. Bug real: clicar "Editar" no drawer relacional do pedido leva a uma rota inexistente. Dois espaços de naming (`/compras/pedidos/` vs `/pedidos-compra/`).
14. **`CotacoesCompra.tsx onEdit`** abre o **modal**, não navega para a rota dedicada. `PedidosCompra.tsx onEdit` abre o **modal** também (`ctx.openEdit`). A rota dedicada `/cotacoes-compra/:id` e `/pedidos-compra/:id` só é acessível via deep link manual ou pelo `PedidoCompraView` (com bug acima). Ou seja, o form de rota é praticamente inacessível pela UI normal. **Duplicação de código sem caminho de descoberta.**

### C. Geração de pedido a partir de cotação

15. **`useCotacoesCompra.gerarPedido`** chama `gerarPedidoCompra.mutateAsync`, e em sucesso faz `setDrawerOpen(false) + fetchData() + navigate("/pedidos-compra")`. **Sem confirmação de impacto** ("vai criar pedido com fornecedor X, R$ Y, validade Z"). Ação destrutiva (cria registro permanente, marca cotação como convertida via trigger), mas zero gate UX.
16. **Drawer de cotação não mostra o pedido gerado** após conversão — só um botão "Ver pedidos de compra" genérico. Compare com Comercial, onde o conversor mostra "Abrir pedido X". O usuário precisa procurar o pedido na lista.
17. **`CotacaoCompraForm` não oferece o botão "Gerar Pedido"** apesar de aceitar status `aprovada`. Toda a ação de conversão só acontece via drawer. Inconsistência: edição rota dedicada não tem o ciclo completo.
18. **`useGerarPedidoCompra` (não inspecionado mas usado)** invalida cross-módulo conforme CONTRACTS.md, mas o `fetchData()` manual na grid (passo 406) é evidência de que a invalidação do React Query não chega ao `useSupabaseCrud` da cotação (são caches separados). **Race entre cache RQ e cache do CRUD legado.**

### D. Recebimento parcial / total

19. **`darEntrada` em `usePedidosCompra`** sempre envia "tudo o que falta" (linhas 440–451) — recebe o saldo pendente integral. **Não há UI de recebimento parcial controlado pelo usuário** (escolher quantidade por item). A RPC `receber_compra` aceita itens granular, mas a UI só dispara o "tudo de uma vez". Capacidade do back-end inutilizada pela UI.
20. **Ausência de "Estornar recebimento"** na UI — RPC `estornar_recebimento_compra` existe e está documentada, mas **nenhum botão a invoca**. Drawer de pedido recebido mostra movimentações de estoque mas não permite reverter. Em fluxo real (devolução/erro), usuário precisa ir ao banco.
21. **`PedidoCompraDrawer` não mostra o total já recebido em valor** — só quantidade. `pctRecebimento` usa quantidade total ÷ ordenado, mas se há valores diferentes por item, o percentual de quantidade ≠ percentual financeiro. Distorção em pedidos com itens de preço heterogêneo.

### E. Semântica de exclusão / cancelamento

22. **`useCotacoesCompra.remove`** (do `useSupabaseCrud`) chama DELETE direto. A doc protege via `trg_cotacao_compra_protege_delete` — só permite DELETE em rascunho sem pedido vinculado. Mas **a UI não comunica isso**: o `ConfirmDialog` em `CotacoesCompra.tsx` só diz "Esta ação não pode ser desfeita". Se a trigger barrar, o usuário recebe erro genérico de Supabase.
23. **`cancelar_cotacao_compra` (RPC) existe e está documentada** com auditoria, mas **nenhum caller a usa**. Toda exclusão/cancelamento passa por `remove()` (DELETE) ou pela ausência de cancelamento na UI. A doc afirma "Em qualquer outro caso, usar `cancelar_cotacao_compra(p_id, p_motivo)`" — desalinhado com o código real.
24. **`CotacaoCompraDrawer.actions`** tem botão "Excluir" para todo status não-terminal, mas chama `onDeleteOpen` → `remove(selected.id)`. Em cotação `aguardando_aprovacao`/`aprovada`, isso vai bater na trigger e falhar. Affordance enganosa.
25. **`usePedidosCompra.cancelarPedido`** faz `update status='cancelado'` direto, **sem RPC** com auditoria. A doc lista `cancelado` como terminal, mas não menciona RPC de cancelamento dedicada — porém, dado que `solicitar_aprovacao_pedido/aprovar_pedido/rejeitar_pedido` existem, a ausência de `cancelar_pedido_compra` é uma lacuna do lifecycle.
26. **`usePedidosCompra.deleteSelected`** faz **soft delete** (`ativo=false`) sem confirmar com o usuário (o ConfirmDialog parental existe na grid, mas o método em si não tem gate). Pedido com NF de entrada vinculada vira "ativo=false" e desaparece de todas as queries que filtram por `ativo=true` — incluindo `PedidoCompraView`, que chama `eq("id", pId).maybeSingle()` (não filtra ativo, então ainda abre). **Inconsistência cross-tela**: o pedido "some" da grid mas continua acessível por deep link.

### F. Form e edição

27. **`useCotacoesCompra.handleSubmit` (modal)**: payload do `update` (linha 211) inclui `status: form.status`. Como o form do modal mostra status disabled, isso reescreve com o status canonizado. **Mas se o status atual era um alias legado**, a canonização aconteceu no openEdit (passo 157), então o save grava o canônico. Bom efeito colateral, ruim por estar implícito.
28. **`PedidoCompraForm.handleSave`** valida `form.status === pedido.status` para liberar workflow-only statuses, mas **não invalida React Query** após salvar — só atualiza state local (`setPedido(...)`). A grid (`PedidosCompra`) e o drawer (`PedidoCompraView`) usam React Query e ficam desatualizados até refetch manual.
29. **`PedidoCompraForm` tem 412 linhas, `CotacaoCompraForm` 451 linhas, `useCotacoesCompra` 470 linhas, `usePedidosCompra` 622 linhas**. Hooks são **God hooks**: data + state + KPIs + actions + workflow. Difícil testar e refatorar.
30. **`PedidoCompraView.onEdit`** navega para `/compras/pedidos/${id}` (rota errada). **`PedidoCompraDrawer.onEdit`** delega para `usePedidosCompra.openEdit` que abre **modal**. Dois drawers, dois caminhos de edição diferentes — usuário acaba em telas distintas.
31. **`CotacaoCompraForm` usa `useSubmitLock`** mas **não usa `useEditDirtyForm`** padronizado — `isDirty` é manual com setters wrapper. `PedidoCompraForm` faz o mesmo. Não há `beforeunload` guard em nenhum dos dois — só `confirm dialog` no botão Voltar. Fechar a aba descartar mudanças silenciosamente.

### G. Integrações (Fiscal, Financeiro, Estoque)

32. **`darEntrada` redireciona para `/fiscal?tipo=entrada&pedido_compra_id=...`** mas o estoque já foi movimentado pela RPC `receber_compra` **antes** do usuário chegar no Fiscal. Se o usuário fechar a aba ou cancelar a NF de entrada, a movimentação de estoque permanece. **NF de entrada e movimento de estoque ficam desacoplados temporalmente** — isso é um risco de duplicação se o usuário emitir nova entrada por engano.
33. **`PedidoCompraView.tabRecebimento`** mostra `viewEstoque` mas **não mostra `viewFinanceiro`** (lançamentos a pagar gerados). O drawer `PedidoCompraDrawer` carrega `viewFinanceiro` mas só usa em `tabRecebimento` (na verdade não, ele tampouco renderiza — declarado nas props, mas o trecho do código mostrado não consome). **Dado carregado e descartado** — ou pelo menos não usado consistentemente. Drill-down financeiro perdido.
34. **`PedidoCompraView` (rota relacional) não carrega financeiro nem cotação completa** — `useDetailFetch` só busca pedido + itens + estoque + cotação minimal. Aba "Vínculos" não tem chip "Lançamentos financeiros" nem "NF entrada". O `RelatedRecordsStrip` chips são apenas Cotação e Estoque. NF de entrada gerada pelo recebimento não aparece como vínculo.
35. **Não há ponte de retorno de Fiscal → Pedido de Compra** documentada na UI. CONTRACTS.md menciona breadcrumb "Voltar ao Pedido de Compra" mas a implementação não foi inspecionada — se o `OriginContextBanner` não tratar `pedido_compra_id`, o usuário fica sem retorno.

### H. Filtros e nomenclatura

36. **`CotacoesCompra.tsx` filtros são apenas Status** — não tem filtro por Fornecedor, Validade, Item ou Origem. `useCotacaoCompraFilters` declara setters para fornecedor/data, mas a `CotacaoCompraFilters.tsx` (componente de UI) só renderiza o `MultiSelect` de status. Capacidade no hook não exposta na UI.
37. **`PedidosCompra` usa `?atrasadas=1`** vindo do dashboard para popular `recebimento=["aguardando", "parcial"]`, mas o filtro **não persiste a flag** — a próxima navegação para `/pedidos-compra` mantém o filtro mas perde o contexto de "vim do dashboard de atrasadas". Drill-down não é reversível.
38. **2 convenções de querystring multivalor**: ambas as grids do Compras usam `searchParams.getAll("status")` (param repetido). Compras está **alinhado internamente** mas **divergente do `Pedidos.tsx` do Comercial** (CSV `?status=a,b,c`). Já identificado em revisão anterior — Compras precisa migrar para CSV se a convenção do projeto convergir.
39. **`searchPlaceholder` do filtro de Cotação**: "Buscar por número ou observações..." — mas o filtro client-side em `useCotacaoCompraFilters` (linhas 75–80) busca apenas em `numero` e `observacoes`. **Não busca por nome de produto, fornecedor ou itens**. Em uma cotação com 20 propostas, usuário não consegue achar por SKU ou fornecedor.
40. **Filtro `data_cotacao` é client-side** sobre dados paginados pelo servidor (limite default Supabase). Mesma observação dos demais módulos.

### I. Risco de consistência / dívidas estruturais

41. **`useCotacoesCompra` mistura `useSupabaseCrud` + `useQuery`** (via `useGerarPedidoCompra`). Cache desconectado: invalidação do mutation hook não atinge o CRUD legado.
42. **`CotacaoCompraForm.handleSave` não chama `replace_cotacao_compra_itens` quando `localItems.length === 0`** — passa array vazio que a RPC pode interpretar como "limpar tudo". Validação client (linha 157) bloqueia, mas o caminho via modal (`useCotacoesCompra.handleSubmit`) **só insere se `localItems.length > 0`** (linha 236). Se usuário remover todos itens no modal, o cabeçalho é atualizado mas itens antigos ficam (o delete na linha 230–234 ocorreu, mas insert é skipped). **Cotação com 0 itens persistida** — bug confirmado.
43. **`condicao_pagamento` (singular) vs `condicoes_pagamento` (plural)**: doc marca a plural como DEPRECATED, mas vários pontos do código ainda leem ambas (`p.condicao_pagamento || p.condicoes_pagamento`). Pedidos antigos podem ter dados na coluna deprecated; saves novos só gravam na canônica. **OK como leitura defensiva, mas o duplo código nunca é limpo** — risco de manutenção.
44. **`cotacao_compra_id` em `PedidoCompra`** é tipado como `string | number | null`. Nada no código assume number, mas o mix tipográfico denuncia herança legada.
45. **`PedidoCompraDrawer.tabRecebimento` lista status `aprovado`** como "Aguardando", mas em `recebimentoStatus` (linhas 100–106) `aprovado` cai no `else` ("Pendente"). Inconsistência interna entre o ícone (Clock para aprovado) e o label retornado pela função (Pendente).
46. **`canonicalPedidoStatus` default `"rascunho"`** — pedidos sem status caem em rascunho, mas `pedidoCanReceive("rascunho")` retorna `false`. Pedido legado pode aparecer como "Rascunho" e usuário não consegue receber, sem explicação.

---

## 4. Problemas prioritários

Ordem por risco × impacto:

1. **#13 (Rota inexistente em `PedidoCompraView.onEdit`)** — `/compras/pedidos/${id}` não existe; a rota correta é `/pedidos-compra/:id`. Botão "Editar" do drawer relacional leva a 404. Bug visível.
2. **#14 + #9 + #11 (Modal vs Form de rota duplicados)** — duas implementações de save da cotação, uma sem RPC atômica. Definir caminho único: ou só modal, ou só rota. Hoje o form de rota é praticamente inacessível.
3. **#42 (Cotação fica sem itens se modal salvar com array vazio)** — bug confirmado: delete + skip insert.
4. **#23 + #24 + #25 (Cancelamento bypassa RPC)** — `cancelar_cotacao_compra` existe mas não é usada; nenhuma RPC de cancelamento de pedido. Padronizar.
5. **#19 + #20 (Recebimento sempre total + ausência de estorno)** — capacidade da RPC desperdiçada. Ciclo real sem estorno na UI.
6. **#5 + #4 (KPIs e status incompletos)** — `parcialmente_recebido` fora de "Aguardando"; `aguardando_aprovacao`/`rejeitado` fora de `statusPedidoCompra` no `lib/statusSchema`.
7. **#1 + #2 (`sendForApproval/approve/reject` sem RPC + form que altera status livre)** — o form de rota da cotação permite gravar `aprovada` sem passar pelo workflow.
8. **#33 + #34 (Financeiro carregado mas não renderizado / `PedidoCompraView` sem vínculo financeiro/NF)** — drill-down financeiro perdido; vínculos importantes invisíveis.
9. **#15 + #16 (Conversão sem confirmação + sem CTA "Abrir pedido X")** — UX abaixo do padrão estabelecido em Comercial.
10. **#22 + #26 (Exclusão sem feedback semântico + soft delete sem gate)** — usuário não entende quando pode excluir; pedido com NF some da grid.
11. **#28 (`PedidoCompraForm` não invalida queries)** — divergência de cache cross-tela.
12. **#36 + #39 (Filtros pobres em Cotação)** — sem fornecedor, sem busca por produto, sem validade.

---

## 5. Melhorias de UI/UX

- **Edição "operacional restrita" do Pedido**: chip visível no header indicando que o form não cobre items/fornecedor (paralelo ao que existe em Comercial).
- **Banner pós-conversão**: dialog "Pedido X criado · Abrir agora?" com CTA — replicar `CrossModuleActionDialog` do Comercial.
- **Recebimento parcial controlado**: Dialog que lista itens com saldo pendente e permite editar quantidade a receber por item antes de chamar `receber_compra`.
- **Botão "Estornar recebimento"** no `PedidoCompraDrawer.tabRecebimento` para status `recebido`/`parcialmente_recebido` (admin only), com motivo obrigatório → `estornar_recebimento_compra`.
- **Confirmação de impacto antes de gerar pedido**: "Gerar pedido para fornecedor X · 5 itens · R$ Y · Cotação será marcada como convertida".
- **Mostrar lançamentos financeiros no drawer de pedido recebido** com link "Ir para Financeiro / Fazer baixa".
- **Vínculos no `PedidoCompraView`**: chips de NF entrada, lançamentos a pagar, cotação origem (já tem só esse).
- **Cancelar cotação com motivo** no `CotacaoCompraDrawer` — adicionar dialog igual ao de rejeitar pedido.
- **Filtros de cotação**: expor MultiSelect de Fornecedor, range de Validade e busca por produto/SKU.
- **Indicador de "expirada"**: cotação com `data_validade < hoje` deve mostrar badge override (`Expirada`), assim como Pedidos têm `Em atraso`.
- **`PedidoCompraView.onEdit`** corrigir rota para `/pedidos-compra/:id`.
- **Status `parcialmente_recebido` deve ter ícone próprio** no `recebimentoStatus` do drawer (já tem) e **entrar em "Aguardando"** dos KPIs.

---

## 6. Melhorias estruturais

- **RPCs de lifecycle paralelas às existentes**:
  - `enviar_cotacao_aprovacao`, `aprovar_cotacao_compra`, `rejeitar_cotacao_compra` (com auditoria, espelhando o pattern do Pedido).
  - `cancelar_pedido_compra(p_id, p_motivo)` com gate de NF entrada ativa.
  - Hooks correspondentes (`useEnviarCotacao`, `useAprovarCotacao`, `useCancelarPedidoCompra`).
- **Unificar caminho de edição**: decidir modal **ou** rota dedicada para Pedido e Cotação. Se ambos forem mantidos, garantir que **ambos chamem `replace_*_itens`** (RPC atômica).
- **Migrar `useCotacoesCompra` para React Query** (eliminar `useSupabaseCrud`), padronizando com `usePedidosCompra` e fazendo `INVALIDATION_KEYS.geracaoPedidoCompra` realmente refletir na grid sem `fetchData()` manual.
- **`PedidoCompraForm.handleSave`** virar `useSalvarPedidoCompra` mutation hook com invalidação `["pedidos_compra"]`.
- **Adotar `useEditDirtyForm`** + `beforeunload` em ambos os forms de rota.
- **Tipagem do drawer**: `PedidoCompraDetail` em `PedidoCompraView` e `OVDetail`-like em `PedidoCompraDrawer` declarando relações (`Tables<"pedidos_compra"> & { fornecedores: ..., notas_fiscais: ... }`) sem `unknown as`.
- **Decompor `usePedidosCompra` (622L)** em: `usePedidosCompraQuery` (data), `usePedidoCompraForm` (modal state), `usePedidoCompraActions` (lifecycle). Mesma divisão para `useCotacoesCompra`.
- **Realtime** em `pedidos_compra` + `cotacoes_compra` + `estoque_movimentos` (para cancelar NF Fiscal e ver pedido atualizar) — o canal já tem precedente em Comercial.
- **Stock check antes de cancelar pedido com recebimento parcial** — utility `verificarMovimentosPedidoCompra(id)`.
- **Substituir `condicoes_pagamento` legado**: migration que copia para `condicao_pagamento` e remove a coluna deprecated, depois eliminar leituras duplicadas.
- **Função `validarTransicaoCotacao`/`validarTransicaoPedidoCompra`** pura espelhando triggers `trg_*_transicao` — falha rápida no client.
- **Documentar e expor o caminho `Pedido de Compra → NF Entrada → Estoque/Financeiro`** com matriz de estados em `comprasStatus.ts` ou novo `comprasWorkflow.ts`.
- **Aba "Devoluções/Estornos"** no `PedidoCompraView` mostrando estornos via `estornar_recebimento_compra` quando existirem.

---

## 7. Roadmap de execução

**Fase 1 — Bugs visíveis e drift (1 sessão)**
1. Corrigir rota em `PedidoCompraView.onEdit` para `/pedidos-compra/:id` (#13).
2. Corrigir bug do `handleSubmit` do modal: garantir `replace_cotacao_compra_itens` ou bloquear save com 0 itens (#42).
3. Incluir `parcialmente_recebido` no KPI "Aguardando" (#5).
4. Adicionar `aguardando_aprovacao`, `rejeitado`, `parcialmente_recebido` em `statusPedidoCompra` no `lib/statusSchema` (#4).
5. Corrigir `recebimentoStatus` do drawer para incluir `aguardando_aprovacao` (#7).
6. Canonizar `cot.status` no `CotacaoCompraForm.openLoad` antes do `setForm` (#3).

**Fase 2 — Cancelamento e lifecycle padronizados (1-2 sessões)**
7. Migrar `OrcamentoView`-style: `CotacaoCompraDrawer` cancelar via `cancelar_cotacao_compra` RPC com motivo (#23).
8. Criar RPC `cancelar_pedido_compra(p_id, p_motivo)` com gate de NF entrada ativa + hook + ação no drawer (#25).
9. Bloquear `form.status` mutável no `CotacaoCompraForm` (campo disabled) (#2).
10. Migrar `handleSendForApproval/Approve/Reject` da cotação para RPCs com auditoria (#1).

**Fase 3 — Recebimento parcial + estorno (1-2 sessões)**
11. Dialog "Receber Compra" com edição por item antes de chamar `receber_compra` (#19).
12. Botão "Estornar recebimento" no drawer com motivo → `estornar_recebimento_compra` (#20).
13. Mostrar `viewFinanceiro` no `PedidoCompraDrawer.tabRecebimento` com link para Financeiro (#33).
14. Adicionar vínculos (NF entrada, lançamentos) no `PedidoCompraView.tabVinculos` (#34).

**Fase 4 — Caminho único de edição + invalidação (1-2 sessões)**
15. Decidir modal **xor** rota; remover o caminho não escolhido ou unificar via `replace_*_itens` em ambos (#9, #14).
16. `useSalvarPedidoCompra` hook + invalidação correta (#28).
17. Migrar `useCotacoesCompra` para React Query (eliminar `useSupabaseCrud`) (#41).
18. Confirmação de impacto + CTA "Abrir pedido" pós-conversão (#15, #16).

**Fase 5 — Estrutura, filtros e tipagem (2-3 sessões)**
19. Decompor `usePedidosCompra` e `useCotacoesCompra` em hooks menores (#29).
20. Tipagem dos drawers sem `unknown as` (#tipagem).
21. Expor filtros adicionais em `CotacaoCompraFilters` (fornecedor, validade) e busca por produto (#36, #39).
22. `useEditDirtyForm` + `beforeunload` nos dois forms de rota (#31).
23. Realtime channel em `pedidos_compra`/`cotacoes_compra`/`estoque_movimentos` (#realtime).
24. `validarTransicaoCotacao`/`validarTransicaoPedidoCompra` puros + uso preventivo na UI.

