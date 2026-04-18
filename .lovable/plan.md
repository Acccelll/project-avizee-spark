

# Diagnóstico técnico — telas de detalhe/visualização

## Inventário

**Páginas de rota dedicada (2)**
- `FiscalDetail.tsx` — `/fiscal/:id` (página + drawer NF)
- `PedidoCompraForm.tsx` / `CotacaoCompraForm.tsx` — detalhe + edição (form-páginas, fora deste escopo)

**Views relacionais (8) — renderizadas dentro de `RelationalDrawerStack`**
- `ClienteView`, `FornecedorView`, `ProdutoView` (cadastrais)
- `OrcamentoView`, `OrdemVendaView`, `PedidoCompraView`, `NotaFiscalView`, `RemessaView` (operacionais)

**Drawers de domínio com lógica de detalhe (auxiliares)**
`NotaFiscalDrawer`, `FinanceiroDrawer`, `ContaBancariaDrawer`, `ContaContabilDrawer`, `LancamentoDrawer` (financeiro), drawers de Estoque, Logística — esses já foram tratados nas rodadas de drawers.

Foco desta rodada: **as 8 Views relacionais** + `FiscalDetail`.

## Categorias e complexidade

| Categoria | Telas | Complexidade |
|---|---|---|
| Cadastrais com KPIs+abas+ações | Cliente, Fornecedor, Produto | Alta |
| Operacionais com ações de ciclo | Orçamento, Ordem de Venda | Muito alta |
| Operacionais com tabs e estoque | Pedido de Compra | Alta |
| Operacionais leves | Nota Fiscal, Remessa | Média/Baixa |
| Página-rota híbrida | FiscalDetail | Média |

## Problemas concretos encontrados

### A. Carregamento e ciclo de vida

**A1. Race condition ao trocar `id` rapidamente** — todas as 8 Views
Nenhuma usa `AbortController` ou flag `cancelled`. Trocar de registro rápido (clicar 2 produtos no histórico) pode resolver `setSelected` do registro antigo após o novo, exibindo dados errados. `useDrawerData` (usado em outros drawers) já resolve isso — Views relacionais não.

**A2. `RemessaView`/`NotaFiscalView`/`OrcamentoView`/`OrdemVendaView` esquecem `setLoading(false)` em paths de erro/early-return**
- `RemessaView` linha 26: `if (!r) return;` antes do `setLoading(false)` → loading eterno se 404.
- `NotaFiscalView` linha 42: `if (!nf) return;` mesmo bug.
- `OrdemVendaView` linha 97-102: trata, mas linha 134 só seta loading false depois de tudo — se `nfList.length>0` falha silenciosamente em `lanc`, segue ok; ponto menor.

**A3. `OrdemVendaView` faz fetch dependente de `nfList` em sequência** — não é exatamente bug, mas o segundo `await` (lançamentos) bloqueia. Tudo bem para o caso, mas se NFs forem muitas dispara `.in("nota_fiscal_id", nfIds)` sem limite.

**A4. `ProdutoView` faz 5 queries em `Promise.all` sem fallback de erro individual** — se uma falhar, `setHistorico/setComposicao/setMovimentos` recebem `[]` silenciosamente. Não há sinal pro usuário.

**A5. `useEffect([id])` sem cleanup** — em todas. Combinado com A1, fragiliza navegação rápida.

### B. Consistência dos dados exibidos

**B1. Duplicação `selected.condicao_pagamento || selected.condicoes_pagamento`** — `PedidoCompraView` linha 442. Coluna no banco varia, view aceita ambas. Fragiliza tipagem (`PedidoCompraRow` declara as duas como opcionais). Edição grava em qual? Inconsistência potencial entre detalhe e form.

**B2. KPI `valorPendente` em `OrdemVendaView`** — `Math.max(0, valor_total - valorFaturado)`, mas `valorFaturado` soma `notas_fiscais.valor_total` **incluindo NFs canceladas/denegadas**. Detalhe diverge da realidade.

**B3. `ProdutoView.estoqueValor` declarado mas nunca usado** (linha 115). Lixo de cálculo.

**B4. `OrcamentoView` exibe `prazo_pagamento` como string crua** (linha 470) — em outros lugares é label mapeado por `pagamentoLabels`. Inconsistente.

**B5. `OrdemVendaView` calcula `qtdTotal`/`pesoTotal` mas nunca exibe** (linhas 161-162). Código morto.

**B6. `ClienteView.totalAberto` inclui status `'aberto' | 'vencido'`** mas `'parcial'` (existente no banco) é ignorado — saldo subestimado para parcelas em quitação parcial. Bate com a memória `financeiro-migracao-saldos`.

**B7. `FornecedorView.prazoMedio`** mistura `lead_time_dias` por produto com `prazo_padrao` cadastral como fallback — fontes heterogêneas exibidas no mesmo KPI sem distinguir.

### C. Estado e gerenciamento

**C1. Tipos `any` espalhados** — `OrdemVendaView` (4×), `OrcamentoView` (4×), `RemessaView` (1×). Já flagados via `@ts-nocheck` local. Mascaram divergências de tipo entre fetch e uso.

**C2. `selected as any` quando setando state** — várias Views. Permite que `selected.cliente_id`, `selected.status_faturamento` etc passem sem type-check.

**C3. `OrcamentoView.handleGeneratePublicToken`** muta `selected` via `setSelected((prev: any) => ({ ...prev, public_token: token }))` em vez de refetch. Se token tiver side-effects no DB (data_validade, etc.), tela fica defasada.

**C4. Slots publicados fora de `useEffect`** — `usePublishDrawerSlots` é chamado a cada render. O contexto deduplica via `shallowEqualSlots`, mas `summary`/`actions` são novos `<JSX>` em cada render → comparação sempre falha. Isso causa **publicação a cada render** que dispara listeners do `useSyncExternalStore` no `DrawerSlot`. Funciona mas re-renderiza o header em cada keystroke do form da action (ex.: PO number do `OrcamentoView`).

**C5. `OrcamentoView` mantém estado de 3 dialogs + 2 inputs (PO/data) na própria View** — quando o drawer fecha por trás (clearStack), inputs ficam preenchidos no remount.

### D. Ações disponíveis

**D1. Ações sem prevenção de duplo clique consistente**
- `OrdemVendaView.handleGenerateNF` usa `generatingNf` ✓
- `OrcamentoView.handleSendForApproval/handleApprove/handleConvertToOV` usam `actionLoading` ✓ (mas é estado único compartilhado — clicar Aprovar trava todos)
- `ClienteView`/`FornecedorView`: delete sem lock, só `setDeleteConfirmOpen`. Confirmar no dialog não desabilita botão durante o `await`.

**D2. Delete não invalida queries do React Query**
Nenhuma View chama `queryClient.invalidateQueries`. `OrcamentoView` deleta orçamento e faz `clearStack()` — a listagem de orçamentos no React Query continua exibindo o item até refetch manual. Mesmo padrão em Cliente/Fornecedor/Produto. **Bug real**: usuário deleta no detalhe e volta para grid vendo o item ainda lá.

**D3. `PedidoCompraView` e `RemessaView` e `NotaFiscalView` não publicam `actions`** — só `breadcrumb`+`summary`. Para o usuário não há atalho de Editar / Confirmar a partir do detalhe relacional. Inconsistente com Cliente/Fornecedor/Produto/Orçamento/OV.

**D4. `OrcamentoView` "Aprovar" só aparece para `isAdmin`** mas o botão de "Gerar Pedido" (status aprovado) não tem o mesmo gate. Verificar regra com a memória RBAC.

**D5. `navigate(/produtos?editId=)` + `clearStack()` em setTimeout** — `Cliente/Fornecedor/Produto` usam o pattern. Frágil: se a página atual já é `/produtos`, o clearStack roda antes da navegação completar e o drawer abre por cima do form de edição. Race conhecida.

### E. Telas com abas

**E1. Aba ativa não persiste na URL nem no contexto** — todas as Views usam `defaultValue="..."` no `<Tabs>`. Trocar para outro registro reseta para a aba inicial mesmo que o usuário estivesse em "Histórico". Pequeno UX bug.

**E2. `ProdutoView` carrega dados de TODAS as abas no mount** (5 queries paralelas) — não há lazy loading. Se o usuário só vai à aba "Geral", paga custo das outras. Ok para cadastro pequeno, problema em produtos com 10k movimentos.

**E3. `LogisticaRastreioSection` renderizado em 3 Views** (OV, NF, Remessa, PedidoCompra) — recarrega a cada troca de aba se não estiver ativa. Verificar se o componente é montado/desmontado pelo Tabs (radix mantém todos por default → ok). Mas isso vira render duplo.

### F. Integração grid → detalhe → edição

**F1. Edição via navegação de página quebra a stack relacional**
`navigate(/clientes?editId=${id})` sai do contexto de drawer. Quando salva edição, retorna pra grid de Clientes. Se o usuário tinha empilhado: Cliente → Pedido → Cliente (mesmo cliente em outro contexto), perde toda a navegação.

**F2. Fechar drawer não dispara refetch da grid** — combinado com D2. O usuário edita um cliente via drawer (que faz patch), volta pra grid e os dados estão stale (a lista usa `useSupabaseCrud` com cache próprio, não compartilhado).

**F3. `OrcamentoView` após "Gerar Pedido" faz `navigate('/pedidos')`** — boa intenção, mas perde o orçamento aberto. Usuário queria ver o pedido criado, é redirecionado para listagem.

### G. `FiscalDetail.tsx` específico

**G1. Tela "redundante"** — abre apenas o `NotaFiscalDrawer`, replicando dados que já estão no drawer. O summary card duplica numero/valor/tipo/status que o drawer mostra.

**G2. `handleDelete` usa `.then` (não async)** — sem loading, sem prevenção de duplo clique. Ok porque é fluxo terminal, mas inconsistente.

**G3. `fetchNF` não usa `AbortController`** — mesmo bug que A1.

### H. Performance / código

**H1. Console.log/console.error não centralizado** — 6 Views logam erros direto no console. Sem telemetria, sem categorização.

**H2. `OrdemVendaView`/`OrcamentoView` ~620 linhas cada** — God components misturando fetch+UI+actions+dialogs.

**H3. KPI cards inline duplicados** — Cliente/Fornecedor/Produto/Orçamento/OV reimplementam mini-KPI card 4× cada. Já existe `SummaryCard` (rodada anterior).

## Estratégia de correção

### Fase 1 — Infraestrutura compartilhada

**1.1 `useDetailFetch<T>(id, fetcher, deps)`** — hook novo
- AbortController + cancellation flag
- `loading`, `error`, `data`, `refetch`
- Substitui o boilerplate de 8 Views (~80 linhas cada)

**1.2 `usePublishDrawerSlots` melhorado**
- Mover slot publishing para dentro de `useMemo` no caller (instruir via JSDoc) ou
- Usar `useEffect` no provider para deduplicação por estrutura, não por referência
- Resultado: para o re-render do header em cada keystroke

**1.3 `useDetailActions`** — hook novo
- Lock por ação (não global): `const { run, locked } = useDetailActions()`
- `run("approve", async () => ...)` — só "approve" trava
- Substitui `actionLoading` único compartilhado

**1.4 `useInvalidateAfterMutation`** — helper
- Recebe lista de queryKeys + tabela e chama `qc.invalidateQueries`
- Aplicado em delete/approve/convert/generate em todas as Views

### Fase 2 — Aplicação cirúrgica

| View | Correções |
|---|---|
| **ClienteView** | useDetailFetch (race A1); incluir `'parcial'` em totalAberto (B6); lock no delete (D1); invalidar `clientes`+grids relacionadas (D2); cleanup any |
| **FornecedorView** | useDetailFetch; lock delete; invalidar `fornecedores`; distinguir prazoMedio vs prazoPadrao na UI (B7) |
| **ProdutoView** | useDetailFetch; remover `estoqueValor` morto (B3); error reporting individual nas 5 queries (A4); lock delete; invalidar `produtos` |
| **OrcamentoView** | useDetailFetch; useDetailActions (D1); refetch após handleGeneratePublicToken (C3); invalidar `orcamentos`+`ordens_venda` após convert/delete; tipos sem `any` |
| **OrdemVendaView** | useDetailFetch; filtrar NFs canceladas/denegadas no `valorFaturado` (B2); remover qtdTotal/pesoTotal mortos (B5); publicar `actions` consistentes; tipos sem `any` |
| **PedidoCompraView** | useDetailFetch; padronizar `condicao_pagamento` (B1) — usar uma única coluna canônica; publicar `actions` (Editar via navegação) |
| **NotaFiscalView** | useDetailFetch (corrige A2 loading eterno); publicar `actions` mínimas (Editar/Confirmar/Estornar via NotaFiscalDrawer? ou navegar) |
| **RemessaView** | useDetailFetch (corrige A2); publicar `actions` mínimas |
| **FiscalDetail** | useDetailFetch ou abandonar a página em favor de redirect direto pro drawer (avaliar G1); lock no delete |

### Fase 3 — Persistência de aba ativa (opcional)
- `useTabsPersistence(key)` — guarda aba ativa em sessionStorage por entidade. Aplicar em todas as Views.

### Fora do escopo
- Não reescrever UI das Views (não é prompt visual)
- Não mexer em `RelationalDrawerStack` nem `RelationalDrawerSlotsContext` (estáveis)
- Não reescrever drawers de domínio (NotaFiscalDrawer, FinanceiroDrawer etc — já cobertos)
- Não tocar `PedidoCompraForm`/`CotacaoCompraForm`/`PedidoForm`/`OrcamentoForm` (são forms de edição, fluxo distinto)

## Critério de aceite
- Sem race condition: trocar de registro cancela fetch anterior
- Loading eterno corrigido (RemessaView, NotaFiscalView)
- Delete invalida queries → grid não exibe item morto
- KPIs corrigidos (totalAberto inclui parcial; valorFaturado exclui canceladas)
- Ações com lock por ação, não global
- `actions` publicadas consistentemente (Editar mínimo) em todas as 8 Views
- Slot publishing não causa re-render por keystroke
- Tipos `any` removidos onde possível (manter em joins complexos com TODO)
- Build OK (`tsc --noEmit`); sem regressão funcional

## Entregáveis
Tabela final por View: `problema → correção aplicada → pendência (se houver)`.

