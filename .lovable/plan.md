

# Diagnóstico técnico — Fluxos intermodulares

## Inventário dos fluxos críticos

| Fluxo | Origem → Destino | Mecanismo de propagação |
|---|---|---|
| Cotação → Pedido | `Orcamentos` → `Pedidos` | RPC `converter_orcamento_em_ov` |
| Pedido → NF saída | `Pedidos`/`OrdemVendaView` → `Fiscal` | `gerarNFParaPedido` (TS) |
| NF → Estoque + Financeiro | `Fiscal` | `confirmarNotaFiscal` (TS) — múltiplos inserts em sequência |
| Cotação compra → Pedido compra | `CotacoesCompra` → `PedidosCompra` | mistura: TS direto + RPCs |
| Pedido compra → Recebimento | `PedidosCompra` | RPC `receber_compra` (cria estoque + financeiro) |
| Pedido compra → NF entrada | redirect manual via URL | navegação (`navigate(/fiscal?…)`) |
| Estorno NF | `Fiscal`/`FiscalDetail` | `estornarNotaFiscal` (TS) |
| Baixa financeira | `Financeiro` | RPC `financeiro_processar_baixa_lote` com fallback TS |

## Problemas reais

### A. Refresh entre módulos — duas escolas convivendo

**A1. `fetchData()` legado vs `queryClient.invalidateQueries()`**
- Páginas antigas (`Pedidos`, `Orcamentos`, `Fiscal`, `ContasBancarias`, `useCotacoesCompra`, `usePedidosCompra` em parte) fazem `fetchData()` local após mutação cross-módulo. Isso atualiza só a tela atual.
- Quem está em outra tela aberta em background (ex: Financeiro aberto em outra aba/sessão SPA) não recebe atualização porque a mutação não invalida `["financeiro_lancamentos"]`.
- Hooks novos (`useConverterOrcamento`, `useFaturarPedido`, `useGerarPedidoCompra`, `useEstoqueMutations`) já fazem `invalidateQueries` cross-módulo. Padrão correto, mas inconsistente.

**A2. `gerarNFParaPedido` não invalida nada**
Chamado direto em `Pedidos.tsx` (handleGenerateNF) e em `OrdemVendaView` (`handleGenerateNF`). Após sucesso:
- `Pedidos.tsx` faz `fetchData()` local apenas → `Fiscal`/`Financeiro`/`Estoque` em outra rota ficam stale.
- `OrdemVendaView` faz `reload()` do detalhe apenas → grid de Pedidos, Fiscal, Estoque ficam stale.
- Existe `useFaturarPedido` (mutation com invalidação) mas **não é usado pelos callers principais** — caminho duplicado.

**A3. `confirmarNotaFiscal` / `estornarNotaFiscal` também não invalidam**
Após confirmar NF: estoque, financeiro, OV faturamento mudam. Mas `Fiscal.tsx` chama `fetchData()` local, e `OrdemVendaView` que está em outro drawer/aba não enxerga.

**A4. `convertToPedido` toca: orçamento + ordem_venda + items**
`useConverterOrcamento` invalida `["orcamentos", "ordens_venda"]`. Mas `Orcamentos.tsx` **não usa esse hook** — chama `convertToPedido` direto e faz `fetchData()`. Resultado: o hook não tem caller real; a página antiga continua com o problema.

### B. Encadeamento Compras → Fiscal: passagem de contexto frágil

**B1. `darEntrada` redireciona para `/fiscal?tipo=entrada&fornecedor_id=...&pedido_compra=NUMERO`**
- Passa o **número** do pedido (`pedidoNumero(p)`), não o `id`. O destino precisa fazer lookup pelo número, ou abre sem pré-vínculo.
- `Fiscal.tsx` não está documentado para consumir esses query params como pré-preenchimento — verificar se está implementado. Provavelmente o usuário cai em /fiscal genérico sem filtro aplicado, perdendo o contexto que o redirect prometia.

**B2. Chave estrangeira `pedido_compra_id` em `financeiro_lancamentos` existe mas não é populada por todos os caminhos**
`receber_compra` (RPC) provavelmente preenche, mas se um financeiro for criado manualmente após confirmação de NF de entrada, perde-se o link com o pedido de compra original. Isso quebra a tab "Financeiro" do `PedidoCompraView` que faz `eq("pedido_compra_id", id)`.

### C. Consistência transacional — TS vs RPC

**C1. `confirmarNotaFiscal` é multi-step em TS (não atômico)**
Sequência: update NF → insert estoque (Promise.all N+1 com select prévio) → insert financeiro (Promise.all) → update OV. Se qualquer passo falhar no meio, fica:
- NF marcada `confirmada` mas estoque parcialmente movido.
- Financeiro com algumas parcelas inseridas e outras não.
- Sem rollback. Idempotência só por `if status === "confirmada" return`.

Comparar com `receber_compra` que é RPC atômico. Falta paridade.

**C2. `gerarNFParaPedido` idem — multi-step TS**
8 passos sequenciais (busca itens, RPC numeração, insert NF, insert itens, update faturamento item-a-item, update status faturamento OV, confirma NF). Falha no meio = NF criada sem confirmação ou OV com faturamento parcialmente atualizado.

**C3. Update item-a-item de `quantidade_faturada`**
Em `gerarNFParaPedido` e `updateOVFaturamento` em fiscal.service: `Promise.all(nfItens.map(item => update(...)))`. N requests; sem locking. Dois faturamentos concorrentes do mesmo pedido em janelas paralelas podem dobrar `quantidade_faturada`. RPC com SELECT FOR UPDATE resolveria.

**C4. `estornarNotaFiscal` — código de busca ambíguo**
```ts
.or(`nota_fiscal_id.eq.${nf.id},documento_fiscal_id.eq.${nf.id}`);
```
A coluna `documento_fiscal_id` não consta em `financeiro_lancamentos` no schema. Filtro `or` com coluna inexistente provavelmente quebra silenciosamente ou ignora. Confirmar e remover.

### D. Navegação de retorno — perda de contexto

**D1. `darEntrada` faz `navigate("/fiscal?...")` sem trilha de volta**
Usuário no Pedido de Compra → recebe → vai para Fiscal → não tem botão "Voltar ao Pedido de Compra origem". Precisa lembrar e digitar URL.

**D2. `OrdemVendaView.handleGenerateNF` fica no drawer, mas não navega para a NF criada**
Faz `reload()` e o usuário precisa clicar manualmente em "NF X" nos botões do header. Aceitável, mas inconsistente com Pedidos.tsx (que também não navega) e com `convertToPedido` que navega para `/pedidos`.

**D3. `Orcamentos.handleConvertToPedido` faz `navigate('/pedidos')` mas o `OrcamentoView` no drawer faz `setConvertConfirmOpen(false)` sem navegar**
Comportamento divergente entre grid e drawer para a mesma ação.

**D4. Filtros perdidos ao voltar**
`Pedidos` usa `useSearchParams` — filtros sobrevivem refresh ✓. Mas `Fiscal` aparenta usar `useState` local. Sair de Fiscal → entrar em outro módulo → voltar perde filtros aplicados. Inconsistente entre módulos (Pedidos/Orçamentos persistem; Fiscal/Estoque/Logística não — verificar).

**D5. Drawer aberto perde-se ao navegar entre rotas**
`/pedidos?drawer=ordem_venda:UUID` está implementado em `RelationalNavigationContext`. Mas se o usuário clica em link que muda `pathname` (ex: ir do drawer para `/fiscal/UUID`), o stack de drawers fecha. Não há "preservar drawer ao mudar de rota" — pode ser intencional, mas vale confirmar UX.

### E. Acoplamento e duplicação técnica

**E1. Lógica fiscal espalhada**
- `gerarNFParaPedido` em `nf.service.ts` — caller TS direto.
- `confirmarNotaFiscal` em `fiscal.service.ts` — chamado por `nf.service` e por `Fiscal.tsx`.
- `gerar_nf_de_pedido` (RPC) — usada em `useFaturarPedido` mas **ninguém chama o hook**.

Decisão pendente: padronizar em RPC (preferido — atômica) e descontinuar `gerarNFParaPedido` TS. Mover `Pedidos.tsx` e `OrdemVendaView.handleGenerateNF` para `useFaturarPedido`.

**E2. `useCotacoesCompra` mistura `fetchData` com mutações cross-módulo**
- `gerarPedido` cria `pedidos_compra` + items + atualiza cotação. Faz `fetchData()` apenas das cotações. `pedidos_compra` em outra tela fica stale.
- Já existe `useGerarPedidoCompra` (mutation com invalidação correta) mas não é integrado.

**E3. `useSupabaseCrud` (legado) vs hooks de mutation novos**
`useSupabaseCrud` faz seu próprio `useQuery` mas expõe `fetchData()` que é um `refetch()`. Quando usado lado a lado com mutations que invalidam queryKey, as duas convivem mas semanticamente confundem (qual é o caminho canônico?). `Pedidos.tsx`, `Orcamentos.tsx`, `Fiscal.tsx` usam o legado.

**E4. Hooks de mutation existentes mas não integrados**
- `useFaturarPedido` ❌ não usado em `Pedidos.tsx`/`OrdemVendaView`
- `useGerarPedidoCompra` ❌ não usado em `useCotacoesCompra`
- `useConverterOrcamento` ❌ não usado em `Orcamentos.tsx`/`OrcamentoView`

A estrutura "correta" foi criada mas ninguém ligou. Plug-in está faltando.

### F. Reflexos faltantes nos KPIs/badges

**F1. KPI "Faturamento" no `OrdemVendaView` filtra `n.status === "autorizada"`**
Mas `gerarNFParaPedido` cria NF com `status: "pendente"` e `confirmarNotaFiscal` muda para `"confirmada"`. Nunca passa por `"autorizada"` (isso é o status SEFAZ, não o status interno). Resultado: KPI de "valor faturado" fica sempre 0 a menos que alguém marque manualmente. Inconsistência conceitual entre `status` (interno) e `status_sefaz`.

**F2. `status_faturamento` da OV é atualizado no service, mas a page Pedidos só refaz fetch local**
Outras telas com mesma OV em background ficam stale. Sintoma: vendedor abre Pedidos em uma aba, faturador gera NF em outra → vendedor vê status antigo.

### G. Contratos entre áreas — sem types compartilhados

**G1. `gerarNFParaPedido(pedidoId, pedidoNumero, clienteId)` recebe 3 args primitivos**
Caller precisa lembrar a ordem. Se um for `null` errado, falha silenciosa. Trocar por `{ pedidoId, pedidoNumero, clienteId }` (objeto).

**G2. `confirmarNotaFiscal({ nf, parcelas })` recebe um shape duplicado de `NotaFiscal`**
Interface inline com 13 campos picados. Se o tipo `NotaFiscal` em `@/types/domain` evoluir, esta interface fica drift. Importar do domínio.

**G3. `OvItem`, `NfItemInsert` em `nf.service.ts` redefinem tipos que existem em `Database["public"]["Tables"]`**
Replicação manual.

## Estratégia de correção

### Decisão 1 — RPC como caminho canônico para operações cross-módulo
Toda operação que afeta 2+ tabelas em domínios distintos (estoque, financeiro, OV, NF) deve ser RPC com transação. Manter wrappers TS apenas como **shims** que chamam a RPC.

Já existem: `converter_orcamento_em_ov`, `gerar_nf_de_pedido`, `receber_compra`, `financeiro_processar_baixa_lote`, `financeiro_processar_estorno`. Falta: `confirmar_nota_fiscal`, `estornar_nota_fiscal`. Como criar essas duas RPCs é cirurgia maior, **fora do escopo** desta passada — manter TS e tratar os sintomas (idempotência + invalidação).

### Decisão 2 — `useInvalidateAfterMutation` em todo lugar
Eliminar `fetchData()` solto após operação cross-módulo. Toda mutação cross-módulo deve listar **todas as keys afetadas**.

### Fase 1 — Plugar hooks de mutation existentes
- `Pedidos.tsx` → trocar `gerarNFParaPedido` direto por `useFaturarPedido` (que usa RPC `gerar_nf_de_pedido` + invalida).
- `OrdemVendaView.handleGenerateNF` → idem.
- `Orcamentos.tsx`/`OrcamentoView` → trocar `convertToPedido` direto por `useConverterOrcamento`.
- `useCotacoesCompra.gerarPedido` → trocar TS multi-step por `useGerarPedidoCompra`.

### Fase 2 — Adicionar invalidação cross-módulo aos serviços que ficam em TS
- `confirmarNotaFiscal`/`estornarNotaFiscal`: receber opcional `queryClient` ou retornar lista de keys a invalidar; callers (`Fiscal.tsx`, `FiscalDetail`, `NotaFiscalDrawer`) chamam `useInvalidateAfterMutation(["notas_fiscais","fiscal","ordens_venda","financeiro_lancamentos","financeiro_baixas","estoque-produtos","estoque-movimentacoes","contas_bancarias"])`.
- `gerarNFParaPedido` (mantido para callers que não puderem trocar agora): mesmo tratamento.

Padrão: criar `src/services/_invalidationKeys.ts` exportando `INVALIDATION_KEYS = { fiscal: [...], compras: [...], etc }` para evitar listas mágicas espalhadas.

### Fase 3 — Corrigir `estornarNotaFiscal.or(... documento_fiscal_id ...)`
Coluna inexistente. Remover do filtro; manter só `nota_fiscal_id`.

### Fase 4 — Resolver KPI "valor faturado" em `OrdemVendaView`
Status interno após `confirmarNotaFiscal` é `"confirmada"`, não `"autorizada"`. Trocar filtro do KPI para `["confirmada","autorizada"].includes(n.status)`. Documentar que `status_sefaz` é separado.

### Fase 5 — Padronizar passagem de contexto Compras → Fiscal
- `darEntrada`: passar `pedido_compra_id` (UUID) em vez de número.
- `Fiscal.tsx`: ler `pedido_compra_id` de query e pré-preencher form de NF de entrada (ou abrir modal pré-vinculado).
- Adicionar `pedido_compra_id` em `notas_fiscais` (se não existir) ou usar `referencia_externa_id`.
- Botão "Voltar ao Pedido de Compra" no header de Fiscal quando vier desse contexto (ler query, mostrar breadcrumb).

### Fase 6 — Padronizar navegação pós-conversão de orçamento
Decidir: ficar no detalhe (mostrar pedido vinculado) OU navegar para `/pedidos/<novo>`. Aplicar a mesma decisão nos dois callers (`Orcamentos.tsx` grid + `OrcamentoView` drawer). Recomendado: ficar e mostrar — é menos disruptivo no drawer; na grid também faz sentido pois a coluna "Status" passa para "convertido".

### Fase 7 — Tipos compartilhados
- Trocar `interface ConfirmarNFParams.nf` por `Pick<Tables<"notas_fiscais">, ...>` ou usar `NotaFiscal` de `@/types/domain`.
- Trocar `gerarNFParaPedido(...)` para receber objeto `{ pedidoId, pedidoNumero, clienteId }`.
- `OvItem`, `NfItemInsert` → derivar de `Database["public"]["Tables"]`.

### Fase 8 — Persistir filtros nos módulos legados
- `Fiscal.tsx`, `Estoque.tsx`, `Logistica.tsx` (verificar quais usam `useState` local) → migrar para `useSearchParams` igual `Pedidos`/`Orcamentos`.
- Fora do escopo: refatorar paginação/cursor, apenas filtros + searchTerm.

### Fase 9 — Documentar contratos
Criar `src/services/CONTRACTS.md` com:
- Tabela de mutações cross-módulo: input, side-effects, keys a invalidar.
- Quem chama quem (caller → service → RPC).
- Decisão: "operações multi-tabela são RPC; serviços TS são adapters."

## Fora do escopo
- Criar RPCs `confirmar_nota_fiscal`/`estornar_nota_fiscal` (mudança maior — pode quebrar XML/SEFAZ).
- Implementar locking otimista (SELECT FOR UPDATE) em `quantidade_faturada`.
- Realtime subscriptions cross-módulo (Supabase Realtime para invalidação automática).
- Refatorar `useSupabaseCrud` para depreciar `fetchData()`.
- Migrar `Fiscal.tsx`/`Estoque.tsx` para hooks de mutation novos (escopo grande — fica para passada própria).
- Drawer aberto sobreviver a mudança de rota (decisão UX).
- Auditoria de impacto em testes (`OrcamentoForm.test.tsx`, `financeiro.service.test.ts`).

## Critério de aceite
- `Pedidos.tsx`, `OrdemVendaView`, `Orcamentos.tsx`, `OrcamentoView`, `useCotacoesCompra.gerarPedido` consomem hooks de mutation centralizados em vez de serviços TS diretos.
- Toda operação cross-módulo invalida o conjunto completo de keys via `useInvalidateAfterMutation` ou `queryClient` direto. Sem `fetchData()` solto.
- `estornarNotaFiscal` não referencia coluna `documento_fiscal_id`.
- KPI "Valor faturado" em `OrdemVendaView` reflete NFs com status interno `confirmada` ou `autorizada`.
- `darEntrada` passa `pedido_compra_id` (UUID); `Fiscal.tsx` lê e pré-preenche; header mostra breadcrumb de retorno.
- Conversão de orçamento → pedido tem comportamento de navegação consistente entre grid e drawer.
- Contratos de `confirmarNotaFiscal`/`gerarNFParaPedido` usam tipos do domínio + payload-objeto.
- `src/services/_invalidationKeys.ts` documentando keys cross-módulo.
- `src/services/CONTRACTS.md` com mapa caller→service→RPC.
- Build OK; sem regressão funcional.

## Arquivos afetados
- `src/pages/Pedidos.tsx` — usar `useFaturarPedido`
- `src/components/views/OrdemVendaView.tsx` — usar `useFaturarPedido` + corrigir KPI
- `src/pages/Orcamentos.tsx` — usar `useConverterOrcamento`
- `src/components/views/OrcamentoView.tsx` — usar `useConverterOrcamento` + decisão de navegação
- `src/hooks/useCotacoesCompra.ts` — `gerarPedido` via `useGerarPedidoCompra`
- `src/services/fiscal.service.ts` — corrigir `.or(documento_fiscal_id...)`, expor lista de keys; tipos do domínio
- `src/services/nf.service.ts` — assinatura objeto + tipos do domínio (manter lógica até RPC paridade)
- `src/pages/Fiscal.tsx` — invalidação completa após confirmar/estornar; ler query `pedido_compra_id`
- `src/pages/FiscalDetail.tsx` — invalidação completa nos handlers
- `src/components/fiscal/NotaFiscalDrawer.tsx` (provável) — chamar invalidação
- `src/hooks/usePedidosCompra.ts` — `darEntrada` passa UUID; remover `fetchData` redundante
- `src/services/_invalidationKeys.ts` (novo)
- `src/services/CONTRACTS.md` (novo)

## Entregáveis
Resumo final por categoria: hooks de mutation cross-módulo plugados nos callers reais, invalidação completa de keys, correção de filtro inexistente em estorno, KPI faturamento alinhado a status interno, contexto Compras→Fiscal preservado por UUID, navegação pós-conversão consistente, tipos compartilhados, documentação de contratos.

