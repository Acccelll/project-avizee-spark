

# Revisão Técnica e Funcional — Módulo Comercial

Revisão baseada no estado real (`src/pages/{Orcamentos,OrcamentoForm,Pedidos,PedidoForm}.tsx`, `src/components/views/{OrcamentoView,OrdemVendaView}.tsx`, `src/pages/comercial/hooks/{useConverterOrcamento,useFaturarPedido,useGerarPedidoCompra,useReceberCompra}.ts`, `src/services/orcamentos.service.ts`, `src/services/comercial/cotacoes.service.ts`, `src/lib/{comercialWorkflow,statusSchema,orcamentoSchema}.ts`, `src/utils/comercial.ts`, `src/services/_invalidationKeys.ts`, `docs/comercial-modelo.md`).

---

## 1. Visão geral do módulo

O módulo Comercial cobre o ciclo **Orçamento → Pedido → NF**. Entidades reais:

| Camada | Página grid | Form (rota dedicada) | Drawer | Service / hook |
|---|---|---|---|---|
| Orçamento (= Cotação) | `Orcamentos.tsx` | `OrcamentoForm.tsx` (`/orcamentos/:id`) | `OrcamentoView` | `orcamentos.service.ts` |
| Pedido (`ordens_venda`) | `Pedidos.tsx` | `PedidoForm.tsx` (`/pedidos/:id`, parcial) | `OrdemVendaView` | `useFaturarPedido` |
| NF saída | externo (`Fiscal`) | — | `NotaFiscalDrawer` | `useFaturarPedido` (gera) |

Workflow oficial (`docs/comercial-modelo.md`): `rascunho → pendente → aprovado → convertido` (terminal); `rejeitado/cancelado/expirado` terminais; ramos auxiliares via `cancelar_orcamento`, `expirar_orcamentos_vencidos`, `criar_revisao_orcamento`.

Operações cross-módulo via RPC transacional:
- `converter_orcamento_em_ov` → invalida `conversaoOrcamento`.
- `gerar_nf_de_pedido` → invalida `faturamentoPedido`.
- `cancelar_orcamento`, `criar_revisao_orcamento` → operam no contexto do orçamento.

Persistência da grid via `useSupabaseCrud` legado (sem React Query). Drawers usam `useDetailFetch + usePublishDrawerSlots`. Filtros: a grid de Orçamentos usa multivalor via `getAll("status")` (querystring repetida), enquanto a grid de Pedidos usa CSV (`?status=a,b`) — duas convenções coexistem no mesmo módulo.

---

## 2. Pontos fortes

- **Modelagem de status canonizada** em `lib/statusSchema.ts` + `comercialWorkflow.ts`. `normalizeOrcamentoStatus` absorve aliases legados (`enviado`/`confirmado` → `pendente`).
- **Guards de transição puros** (`canSendOrcamento`, `canApproveOrcamento`, `canConvertOrcamento`) consumidos identicamente pela grid e pelo drawer — reduz bug de divergência entre lugares.
- **Cross-módulo via RPC**: conversão e faturamento são atômicos no banco. UI só chama `mutateAsync` e invalida via `INVALIDATION_KEYS.*`.
- **`useDetailFetch` com `abortSignal`** em ambos os drawers — race resolvida.
- **`CrossModuleActionDialog` + `crossToast`** com CTA "Abrir pedido / Abrir NF" entrega excelente continuidade de fluxo. Dois usos consistentes (conversão + faturamento).
- **`OrdemVendaView` mostra impacto financeiro real** (notas vinculadas + lançamentos a receber) na aba Faturamento — bom drill-down.
- **`OrcamentoView` bloqueia cancelamento quando há pedido vinculado** com `linkedOV` e mensagem explícita.
- **Guarda `isDirty` + `beforeunload`** em `PedidoForm` evita perda silenciosa.
- **Auto-detecção de "expirado" no badge da grid** (override visual de `pendente` validade-vencida) entrega informação imediata.
- **`CONTRACTS.md`** documenta o mapa de mutações e callers — referência viva.
- **Gate de estoque** na geração de NF (`Pedidos.handleRequestGenerateNF`) avisa shortfall por item antes de confirmar.

---

## 3. Problemas encontrados

### A. Coerência do fluxo Cotação → Aprovação → Pedido → NF

1. **`statusOrcamento` não inclui `historico`** apesar de `orcamentoSchema` aceitar e o filtro "Apenas históricos" existir. Status `historico` cai no fallback `getOrcamentoStatusLabel` e renderiza string crua. Inconsistência entre schema, statusSchema e UI.
2. **`statusPedido` não inclui `entregue` nem `em_transporte`** apesar de `Pedidos.tsx` usar (`TERMINAL_STATUSES_PEDIDO = ["entregue", "faturado", "cancelada"]` na linha 45 e KPI "Em Andamento" filtra `["em_separacao", "separado", "em_transporte"]`). Status renderiza cru no badge ("em_transporte" textual). E `statusPedido` lista `pendente` / `aprovada` / `faturada_parcial` / `faturada` que **não combinam com o set operacional do PedidoForm** (`aprovada/em_separacao/separado/em_transporte/entregue/cancelada`). Há **2 universos de status de pedido** no mesmo módulo:
   - `statusPedido` (rascunho/pendente/aprovada/em_separacao/faturada_parcial/faturada/cancelada) — usado no Select da grid.
   - `PedidoForm.statusOptions` (pendente/aprovada/em_separacao/separado/em_transporte/entregue/cancelada) — usado na edição.
   O usuário pode salvar `entregue` no form mas o filtro da grid não tem essa opção; e pode salvar `separado` mas o KPI "Em Andamento" só conta isso parcialmente.
3. **Faturamento ortogonal não está separado visualmente** da `matriz chk_ordens_venda_matriz_status`. O CHECK do banco (ver doc) restringe combinações status × status_faturamento, mas a UI não impede o usuário de mudar `status` para `cancelada` quando `status_faturamento='parcial'` etc. — só vai falhar no save. Falta de validação local.
4. **`OrdemVendaView.canGenerateNF`** aceita `["aprovada", "em_separacao", "separado"]` enquanto **`Pedidos.tsx` columns "Gerar NF"** aceita só `["aprovada", "em_separacao"]` (sem `separado`). Mesma ação, dois gates. Pedido com status `separado` mostra botão no drawer mas não na grid.
5. **`canSendOrcamento`/`canApprove`** ignoram o estado de items: é possível enviar para aprovação um orçamento `rascunho` **com 0 itens**. RPC pode aceitar. Não há gate na UI nem service.
6. **`approveOrcamento` no service não é admin-gated**. A grid e o drawer fazem `if (!isAdmin)` na UI, mas a função `approveOrcamento` em `orcamentos.service.ts` é uma chamada pura `update status='aprovado'`. Qualquer caller pode burlar via console — depende inteiramente de RLS no Supabase. Não há documentação garantindo a policy.

### B. Cotação vs Orçamento na UX

7. **`docs/comercial-modelo.md` afirma "Cotação = Orçamento"** mas a UI mistura termos:
   - `Pedidos.tsx` lê `orcamentos(numero)` mas chama de "Orçamento" no chip.
   - `OrdemVendaView` chama de "Cotação de Origem" (`selected.orcamentos?.numero ? "Cotação ..." : "Ver cotação"`).
   - `Orcamentos.tsx` título: "Orçamentos".
   - `searchPlaceholder` em Pedidos: "número, PO, cliente ou orçamento".
   - `RelatedRecordsStrip` em OrdemVendaView: chip "Cotação origem".
   Usuário vê a mesma entidade chamada de dois nomes na mesma sessão.
8. **`comercialLabels` em `comercialWorkflow.ts`** define `quote: "Orçamento"` mas **não é importado em lugar nenhum**. Centralização que não pegou.

### C. Grid vs drawer vs tela de edição

9. **`Orcamentos.tsx onEdit` navega direto para `/orcamentos/:id`** (form), enquanto `onView` empilha drawer. Mas a coluna Ações da grid não oferece o drawer — só os botões de workflow. Usuário precisa clicar em **um espaço vazio da linha** para abrir o drawer (comportamento padrão do `DataTable`). Descoberta ruim.
10. **`Pedidos.tsx` columns "Editar"** chama `navigate("/pedidos/:id")` — tela de edição operacional bem reduzida. Não há ação "Detalhar" na coluna; só clique na linha abre `pushView("ordem_venda", id)`. Inconsistente: Orçamentos tem Edit + onClick; Pedidos só tem Edit + onClick.
11. **`OrcamentoView` atalho "Editar" usa `clearStack() + navigate(/orcamentos/:id)`** — fecha todo o stack, perdendo contexto se o orçamento foi aberto a partir de um cliente, NF ou drill-down. `OrdemVendaView` faz a mesma coisa ("Editar Pedido"). Quebra do padrão de drawer aninhado.
12. **`PedidoForm` é "edição operacional restrita"** (status, PO, datas, observações) — desalinhado com `OrcamentoForm` que edita tudo. Discrepância semântica: "Editar Pedido" no drawer leva a uma tela com escopo radicalmente menor sem aviso prévio (só há um banner dentro da tela explicando "escopo desta edição").

### D. Geração de Pedido (conversão)

13. **`Orcamentos.tsx handleConvertToPedido` lê `poNumberCliente`/`dataPoCliente` que existem como state global da página, sem reset entre orçamentos**. Se o usuário abre o dialog para o orçamento A, digita PO, fecha, abre o dialog para o orçamento B, **o state ainda contém o PO do A** porque o reset no `onClose` zera, mas se o usuário fechar via tecla ESC sem disparar `onClose`, persiste. Uso compartilhado entre 2 dialogs (grid e drawer) com state local — cheiro de bug.
14. **Após conversão, `Orcamentos.tsx fetchData()`** mas o filtro de status pode ocultar o orçamento agora `convertido` (se o usuário tinha filtrado por `pendente/aprovado`). Sem aviso visual de que o registro saiu da listagem.
15. **`OrcamentoView handleConvertToOV` permanece na visualização** após sucesso (decisão documentada em CONTRACTS.md), mas o badge do header só atualiza após `reload()`. O CTA "Abrir Pedido" do toast é o caminho oficial — mas o botão "Ver Pedido X" só aparece **após** o reload completar. Janela de ~300ms sem affordance pra abrir o pedido recém-criado se o usuário fechar o toast.
16. **`convertToPedido` no service emite `toast.success` direto** (linha 70) — duplica com o `crossToast.success` chamado no caller. Usuário vê 2 toasts ("Pedido X criado!" + "Pedido gerado! OV X criada"). Bug confirmado.
17. **Estado `convertingId` em `Orcamentos.tsx`** não é resetado se `convertLock.run` rejeitar. O `setConvertingId(null)` está dentro do `finally` do `try/catch` interno — ok — mas o `convertLock.pending` não cobre o tempo entre o clique no botão "Gerar Pedido" e o usuário confirmar no dialog. Se o usuário clica em duas linhas rápido, o `setConvertingId` muda só o último.

### E. Geração de NF

18. **`Pedidos.tsx handleRequestGenerateNF` faz query de estoque no clique** mas **não filtra `ativo=true` em `produtos`** nem considera produtos que migraram pra `inativo`. Pode mostrar shortfall errado.
19. **Stock check é apenas `estoque_atual` agregado** — não considera reservas (pedidos abertos consumindo o mesmo SKU). Para um ERP real isso é otimista. Documentar ou implementar `estoque_disponivel = estoque_atual - reservas`.
20. **`OrdemVendaView.canGenerateNF`** não faz stock check — usuário pode gerar NF direto sem aviso. Inconsistência: a grid avisa, o drawer não.
21. **Botão "Gerar NF" no drawer fica disponível mesmo durante `locked("generate_nf")`** porque o `disabled` está só no botão do header, não no botão dentro da aba "Faturamento" (linha 540-549). Duplo-submit possível clicando rápido entre as abas.
22. **`OrdemVendaView valorFaturado`** soma NFs com status `["confirmada", "autorizada"]`. Mas `statusNFLabels` lista `["pendente", "autorizada", "cancelada", "denegada"]`. Status `confirmada` é interno — está documentado em comentário no código mas **não aparece em `statusNotaFiscal`** de `statusSchema.ts` (que tem só pendente/autorizada/cancelada/denegada/inutilizada). Drift entre o que o cálculo soma e o que a UI sabe rotular.
23. **Após `gerar_nf_de_pedido`, a UI não mostra impacto no estoque/financeiro** dentro do drawer do pedido até o `reload()` rodar. O dialog de impacto promete "Atualiza estoque (saída)" + "Gera lançamentos a receber" mas o usuário precisa abrir o NF Drawer ou navegar pra ver a evidência.

### F. Semântica de exclusão / cancelamento

24. **`OrcamentoView "Cancelar"** chama `update status='cancelado'` direto (linha 544), **bypassa** a RPC `cancelar_orcamento` que existe no service e está documentada como o caminho oficial com auditoria. Falta de auditoria silenciosa em todo cancelamento via UI.
25. **Grid de Orçamentos não oferece cancelamento** — só botões de workflow. Para cancelar um orçamento `pendente`, o usuário precisa abrir o drawer.
26. **Pedidos não têm botão "Cancelar"** em lugar nenhum (grid, drawer, form). O único caminho é mudar o `status` para `cancelada` no `PedidoForm`. E não há gate: usuário pode cancelar pedido que já tem NF emitida — quebra integridade. Backend pode aceitar ou rejeitar (depende de constraint), mas a UI não orienta.
27. **`useSupabaseCrud` legado oferece `remove()` (DELETE/soft-delete)** para `orcamentos` e `ordens_venda`. Não há proteção UI — se algum botão chamar, conflita com a doc ("DELETE físico: somente rascunho sem pedido vinculado"). Trigger `trg_orcamento_protege_delete` é a última linha de defesa, mas a UI não comunica.

### G. Vínculo com Fiscal e Financeiro

28. **`OrdemVendaView` carrega `lancamentos` filtrando `ativo=true`** (bom), mas `notasFiscais` também usa `ativo=true` — ok. Porém **só mostra NFs onde `ordem_venda_id = ov.id`**. Não cobre devolução (NF de devolução pode estar vinculada à NF original, não direto ao pedido). Aba Faturamento subreporta em cenários de devolução.
29. **`Fiscal cross-module` é one-way**: gerar NF no pedido leva pro Fiscal, mas se o usuário cancelar uma NF no Fiscal, o pedido só atualiza após invalidação React Query (`fiscalLifecycle` lista `pedidos`). Bom em teoria — mas o `useSupabaseCrud` da grid de Pedidos **não escuta queryKey** (comentário no código linha 197-198). Refresh manual é necessário.
30. **`Financeiro` é mostrado dentro do drawer** (lançamentos), bom. Mas não há link "Fazer baixa" inline — usuário precisa navegar para `/financeiro?lancamento=...`. Affordance perdida.
31. **`OrdemVendaView` não exibe a `cotacao_id` quando o pedido foi criado fora do fluxo Cotação→Pedido** — o chip "Cotação origem" mostra count 0 mas não diz "criado direto" ou "sem origem". Confunde.

### H. Filtros e nomenclatura

32. **2 convenções de query string no mesmo módulo**: `Orcamentos.tsx` usa `searchParams.getAll("status")` (param repetido), `Pedidos.tsx` usa CSV (`?status=a,b,c`). Drill-downs do dashboard só funcionam pra Pedidos (CSV padrão do `buildDrilldownUrl`), e não pra Orçamentos.
33. **`filtroData` em ambas as grids é client-side** sobre dados paginados pelo servidor — se a tabela tiver milhares de orçamentos, o filtro só trabalha no que veio na página atual. Mesma observação da revisão de Cadastros, agora aqui.
34. **Filtro "Histórico"** em Orçamentos cruza dois conceitos: `origem === "importacao_historica"` **OU** `status === "historico"`. Se algum legado estiver com `origem='importacao_historica'` e `status='aprovado'`, "Apenas históricos" o mostra; "Excluir históricos" o oculta — pode confundir um analista que quer ver todos os "aprovado".
35. **`Pedidos KPIs` "Em Andamento" filtra `["em_separacao", "separado", "em_transporte"]`** — mas `separado` e `em_transporte` não constam em `statusPedido` (lib). KPI conta um set, badge renderiza com fallback de string crua, filtro da grid não oferece a opção. Trinca.

### I. Form e edição

36. **`OrcamentoForm` tem 1397 linhas** — God component. Estado disperso (`useState` x 30+, `useForm`, `useMemo` x 10+). Uma única responsabilidade dispara render de tudo (ex.: digitar no PO simulado de cenário re-renderiza grid de itens).
37. **`OrcamentoForm` não usa `useEditDirtyForm`** padronizado do projeto — usa `useForm.formState.isDirty` que tem semântica diferente (compara contra `defaultValues`, não contra a baseline pós-load). Pode reportar dirty incorretamente quando `reset` é chamado após load.
38. **`PedidoForm.isDirty` usa `JSON.stringify`** — ineficiente e quebra se a ordem das chaves mudar. Já existe `useEditDirtyForm` no projeto, não foi adotado.
39. **`PedidoForm.handleSave` faz `update` direto na tabela** sem service / hook. Não invalida React Query — outras telas (Pedidos grid, dashboard) só veem a mudança após refresh manual.
40. **`OrcamentoForm` ainda envia `frete_tipo` derivado de `["CIF", "FOB", "sem_frete"].includes(formValues.freteTipo) ? freteTipo : modalidade`** (linha 567) — coerção implícita confusa. `freteTipo` e `modalidade` são campos diferentes mas se cruzam silenciosamente.

### J. Risco de consistência

41. **`orcamentos.service.ts.sendForApproval`** faz `if (orc.status !== "rascunho") return;` **silenciosamente** — sem toast, sem erro. Se o usuário clicar em "Enviar" duas vezes em condição de race (ex.: outra aba já enviou), o segundo clique simplesmente não faz nada. Sem feedback.
42. **`approveOrcamento`** não checa estado atual antes do update — se o orçamento foi cancelado/expirado por trigger entre o load e o clique, a UI marca como `aprovado` por cima. RPC seria preferível.
43. **`cancelarOrcamento` (RPC) existe no service mas não é chamada por nenhum caller real**. Toda exclusão lógica passa por update direto.
44. **`TERMINAL_STATUSES`** em `Orcamentos.tsx` é `["convertido", "cancelado", "rejeitado"]`, mas o doc lista também `expirado` como terminal. `getValidadeStatus` retorna "vigente" para terminais — ou seja, um orçamento `expirado` é considerado "vigente" no badge. Bug semântico.
45. **`OrdemVendaView` faz `useFaturarPedido` mas não invalida o próprio `useDetailFetch`** — depende do `reload()` manual chamado depois. Se `mutateAsync` resolve e o `reload` falha, o estado do drawer fica desatualizado mas o cache do React Query (que outras telas escutam) está atualizado. Inconsistência cross-aba.

---

## 4. Problemas prioritários

Ordem por risco × impacto:

1. **#16 (Toast duplicado em conversão)** — bug visível em produção. Remover o `toast.success` do service `convertToPedido` e deixar só o `crossToast` no caller.
2. **#2 + #4 + #35 (Universos de status de pedido divergentes)** — `statusPedido` (lib), `statusOptions` (PedidoForm), `canGenerateNF` (drawer/grid) e KPI "Em Andamento" usam sets diferentes. Centralizar em `lib/statusSchema.ts` o **set canônico operacional** + **regra única `canFaturarPedido`** consumida pelas duas telas.
3. **#22 + #44 (Drift de status NF e Orçamento expirado)** — o cálculo de "Faturado" usa `confirmada` que não está em `statusNotaFiscal`; "expirado" é considerado terminal no doc mas não em `Orcamentos.TERMINAL_STATUSES`. Sincronizar.
4. **#24 + #43 (Cancelamento bypassa RPC)** — substituir `update status='cancelado'` no `OrcamentoView` pela chamada `cancelarOrcamento(id, motivo)` para garantir auditoria. Adicionar campo de motivo no dialog.
5. **#26 (Pedido sem caminho de cancelamento)** — adicionar ação "Cancelar pedido" no drawer (com gate: bloquear se houver NF ativa) usando RPC dedicada (criar se não existir).
6. **#21 (Botão duplicado de Gerar NF sem disable compartilhado no drawer)** — propagar `locked("generate_nf")` para todos os botões dentro da aba.
7. **#13 + #17 (State compartilhado PO/dataPo entre dialogs)** — escopar o state ao dialog (resetar no abrir, não só no fechar). Impede vazamento entre orçamentos.
8. **#7 + #8 (Cotação vs Orçamento)** — escolher um nome único na UX. Doc diz "= Orçamento", então usar "Orçamento" em todos os strings (chips, labels, breadcrumb). Remover `comercialLabels.quote` ou passar a usá-lo.
9. **#1 + #34 (Status `historico` órfão)** — incluir no `statusOrcamento` ou removê-lo do schema; documentar a relação com `origem='importacao_historica'`.
10. **#39 (`PedidoForm.handleSave` não invalida queries)** — usar mutation hook + `INVALIDATION_KEYS.faturamentoPedido` parcial (só `pedidos`, `ordens_venda`).
11. **#11 (Drawer "Editar" mata stack)** — em vez de `clearStack + navigate`, oferecer botão modal-secondary "Abrir em tela cheia" e manter o drawer como fluxo principal. Ou navegar e preservar o stack via state.
12. **#6 + #41 + #42 (Guards apenas client-side)** — confirmar/criar policies RLS para `update status` em orçamentos (admin only para `aprovado`); migrar `sendForApproval`/`approveOrcamento` para RPC com gate de status server-side.

---

## 5. Melhorias de UI/UX

- **Padronizar nomenclatura**: usar "Orçamento" em todos os pontos visíveis ao usuário; "Cotação" só aparece em Compras (cotação de fornecedor).
- **Action column do `Orcamentos`**: adicionar ícone "👁 Ver" explícito além dos botões de workflow — descoberta do drawer não pode depender de clicar em espaço vazio.
- **Uniformizar gate "Gerar NF"** entre grid e drawer com a mesma função pura `canFaturarPedido(pedido)`.
- **Toast pós-conversão**: única notificação contextual com CTA "Abrir pedido"; remover o duplicado.
- **Dialog de cancelamento de orçamento**: campo "Motivo (opcional)" + chamada RPC + exibir motivo no `OrcamentoView` se status for `cancelado`.
- **Aviso visual quando orçamento sai do filtro após conversão**: toast info "Orçamento X agora aparece em outro filtro".
- **Mostrar `lancamentos` com botão "Fazer baixa"** inline no drawer do pedido (link para `/financeiro?lancamento=:id&action=baixar`).
- **Pedido cancelado deve mostrar banner com data/motivo** no header do `OrdemVendaView`.
- **`PedidoForm` deve declarar visualmente seu escopo restrito** com chip "Edição operacional" no header (já há banner; promover a chip mais visível).
- **KPI "Em Andamento" em Pedidos** deve ter tooltip "inclui em_separacao, separado, em_transporte" se esses dois forem mantidos.
- **`OrcamentoView` cancel button**: renomear de "Cancelar" para "Cancelar orçamento" — fica ambíguo com o botão "Cancelar" do dialog.
- **Prazo de despacho do Pedido**: mostrar dias restantes ao lado da data prometida (já existe no badge de grid; replicar no drawer).
- **Status `entregue`**: adicionar ao `statusPedido` para que badges não renderizem texto cru.

---

## 6. Melhorias estruturais

- **Centralizar todos os status em `lib/statusSchema.ts`** incluindo `entregue`, `em_transporte`, `separado` no `statusPedido`; incluir `historico` no `statusOrcamento`; incluir `confirmada` no `statusNotaFiscal` (ou documentar canonização `confirmada → autorizada`).
- **Função `canFaturarPedido(pedido): boolean`** em `comercialWorkflow.ts`, consumida pela grid, drawer e Pedido form. Tipar com `Pedido`.
- **Função `canCancelarPedido(pedido, hasNFAtiva): boolean`** + ação no drawer + RPC `cancelar_pedido_venda`.
- **Migrar `update status` direto para RPCs com gate**: `enviar_orcamento_aprovacao`, `aprovar_orcamento`. Já há `cancelar_orcamento`; padronizar todo lifecycle em RPC + auditoria.
- **Migrar `useSupabaseCrud` legado para React Query** nas grids `Orcamentos`/`Pedidos` para que `INVALIDATION_KEYS` realmente funcione sem `fetchData()` manual.
- **Padronizar querystring multivalor**: adotar CSV (`?status=a,b`) em todo o módulo + utility helper compartilhada (`useMultiSelectParam(key)`).
- **Decompor `OrcamentoForm`** (1397 linhas) em: `useOrcamentoFormState` (state), `useOrcamentoCalculations` (totais/cenário), `useOrcamentoDraft` (autosave/restore), `useOrcamentoTemplates`. Cada um <300 linhas.
- **Adotar `useEditDirtyForm`** no `PedidoForm` e `OrcamentoForm` em vez de `JSON.stringify`/`react-hook-form.isDirty` ad-hoc.
- **Hook `useGerarNF`/`useCancelarPedido`/`useEnviarAprovacao`/`useAprovarOrcamento`** seguindo o padrão de `useFaturarPedido` (mutation + invalidation centralizada). Hoje, só conversão e faturamento têm hook; `sendForApproval`/`approve` chamam o service direto e invalidam manualmente.
- **`PedidoForm.handleSave`** virar mutation hook que invalida `["pedidos", "ordens_venda"]`.
- **Tipagem do drawer**: `OrcamentoDetail` e `OVDetail` declaram `any` em todos os campos. Tipar com `Tables<"orcamentos">` + relações.
- **Aba "Devoluções" em `OrdemVendaView`** (ou expandir Faturamento) que busca NFs de devolução vinculadas via `nota_fiscal_origem_id`.
- **Stock check unificado** em utility `verificarEstoquePedido(pedidoId): Promise<Shortfall[]>` consumido pela grid e pelo drawer.
- **Documentar matriz de status × status_faturamento** em `comercialWorkflow.ts` como uma função `validarTransicaoPedido(from, to, statusFaturamento)` que espelha a CHECK constraint `chk_ordens_venda_matriz_status` — falha rápida no client antes do roundtrip.
- **Realtime em `notas_fiscais` + `ordens_venda`** (Supabase channel) para invalidar React Query automaticamente — elimina o "fetchData manual" do `Pedidos.tsx`.

---

## 7. Roadmap de execução

**Fase 1 — Bugs visíveis e drift (1 sessão)**
1. Remover toast duplicado em `convertToPedido` (#16).
2. Adicionar `expirado` em `Orcamentos.TERMINAL_STATUSES` (#44).
3. Incluir `entregue`, `em_transporte`, `separado` em `statusPedido` (#2).
4. Incluir `historico` em `statusOrcamento` (#1).
5. Adicionar `confirmada` em `statusNotaFiscal` ou canonizar para `autorizada` (#22).
6. Resetar `poNumberCliente`/`dataPoCliente` ao **abrir** o dialog (#13).
7. Propagar `locked("generate_nf")` para o botão dentro da aba Faturamento (#21).

**Fase 2 — Coerência de gates e nomenclatura (1 sessão)**
8. Função `canFaturarPedido` única + uso na grid + drawer (#4).
9. Renomear todos os "Cotação" referentes ao orçamento para "Orçamento" (#7, #8).
10. `OrcamentoView` cancel via `cancelarOrcamento` RPC com motivo (#24).
11. `Orcamentos` grid: adicionar coluna explícita "👁" para abrir drawer (#9).
12. Banner de "saiu do filtro" pós-conversão (#14).

**Fase 3 — Cancelamento de pedido + lifecycle RPC (1-2 sessões)**
13. RPC `cancelar_pedido_venda` (com gate de NF ativa) + `useCancelarPedido` + ação no drawer (#26).
14. RPCs `enviar_orcamento_aprovacao` e `aprovar_orcamento` com gate server-side + hooks (#6, #41, #42).
15. Migrar `PedidoForm.handleSave` para mutation hook com invalidação (#39).

**Fase 4 — Estrutura e tipagem (2-3 sessões)**
16. Tipagem dos drawers (`OrcamentoDetail`, `OVDetail`) sem `any` (#tipagem).
17. Adotar `useEditDirtyForm` em `PedidoForm` (#38) e `OrcamentoForm` (#37).
18. Padronizar querystring multivalor com util compartilhada (#32).
19. Função `validarTransicaoPedido` espelhando a CHECK constraint (#3).
20. Stock check em utility unificada usada por grid+drawer (#19, #20).
21. Aba/devoluções vinculadas por `nota_fiscal_origem_id` (#28).

**Fase 5 — Refator do God component (3+ sessões)**
22. Decompor `OrcamentoForm` em hooks (`useOrcamentoFormState`, `useOrcamentoCalculations`, `useOrcamentoDraft`, `useOrcamentoTemplates`) (#36).
23. Migrar grids para React Query nativo, eliminando `useSupabaseCrud` legado nas duas telas (#33, #29).
24. Realtime channel em `notas_fiscais`/`ordens_venda` para invalidação automática (#realtime).

