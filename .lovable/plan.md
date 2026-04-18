

# Diagnóstico técnico — telas de listagem/grid

Mapeei **~26 listagens** + 2 wrappers compartilhados (`DataTable`, `AdvancedFilterBar`) + hook base (`useSupabaseCrud`). Tudo roda com React Query + Supabase. A infraestrutura existe, mas a aplicação é desigual.

## Categorias

**A. Operacional com URL state (mais maduro)**
`Pedidos`, `Orcamentos`, `PedidosCompra`, `CotacoesCompra`, `Fiscal`

**B. Cadastros com debounce server-side**
`Produtos`, `Clientes`, `Fornecedores`, `GruposEconomicos`, `Transportadoras`, `Funcionarios`, `UnidadesMedida`, `FormasPagamento`

**C. Financeiro/contábil (filtros locais complexos)**
`Financeiro`, `ContasBancarias`, `ContasContabeis`, `FluxoCaixa`, `Conciliacao`

**D. Operacional misto**
`Estoque` (3 abas: saldos/movimentações/ajuste), `Logistica` (3 abas), `Remessas`, `Fiscal`, `Auditoria`, `Logs`

**E. Outras**
`Relatorios`, `MigracaoDados`, `ApresentacaoGerencial`, `Social`

## Problemas concretos encontrados

### 1. `useSupabaseCrud` faz busca **sem `pageSize`** mas retorna no máximo 1000 linhas (limite Supabase)
Em `Pedidos`, `Orcamentos`, `Fiscal`, `Financeiro`, etc., o hook é chamado sem `pageSize`. RQ traz tudo via `select("*", { count: "exact" })`, mas a Supabase tem **limite default 1000**. Para clientes com >1000 registros, a grid silenciosamente perde dados — só fica o sinal `truncated: true`, mas **nenhuma listagem o consome**. Risco real de bug em produção.

### 2. Duas camadas de filtro/sort — local vs server — concorrendo
`useSupabaseCrud` recebe `searchTerm` (server-side ilike) em `Produtos`/`Clientes`/`Fornecedores`/`GruposEconomicos`. As demais (`Pedidos`/`Orcamentos`/`Fiscal`/`Financeiro`) fazem **busca textual local em `useMemo`**. Sem padrão. Combinado com #1 produz inconsistência: Pedidos com 1500 linhas filtra só sobre as 1000 trazidas.

### 3. `DataTable` tem **filtros avançados próprios** (popover) duplicando `AdvancedFilterBar`
O `DataTable` mantém `rules` com filtros próprios (`contains/equals/gt/between`) persistidos em `localStorage`, **completamente desconectados** do `AdvancedFilterBar` da página. Resultado: dois lugares onde aplicar filtro, sem sincronização. Confunde usuário e duplica lógica. Nenhuma página parece estar usando esses filtros internos.

### 4. Ordenação por coluna **calculada/render** quebra
`DataTable.sortedData` faz `String(item[sortKey]).localeCompare`. Mas várias colunas são render-only (`acoes`, `prazo`, `recebimento`, `faturamento`) — clicar para ordenar tenta acessar `item['prazo']` (`undefined`) → tudo vai pro fim. Ainda pior em `Pedidos.faturamento` (acessa `status_faturamento`, mas a key da coluna é `faturamento`) — sort não funciona como esperado. Afetadas: Pedidos, PedidosCompra, Orcamentos, Fiscal, CotacoesCompra.

### 5. Paginação não reseta com mudança de filtros externos
`DataTable` reseta `currentPage` só em `handleSort`. Se o usuário está na página 5 e remove um filtro reduzindo dados a 20 linhas, fica numa página vazia. Acontece em todas as listagens.

### 6. `key={item.id || idx}` em loops cria colisões quando `id` está ausente
`DataTable` (linhas 459, 706, 712) usa `item.id || idx`. Se 2 itens vierem sem id, mesmo `idx` produz key duplicada. Risco baixo mas incorreto.

### 7. KPIs calculados sobre `data` vs `filteredData` — inconsistente
- `Pedidos.kpis` usa `data` (todos) — mostra totais globais
- `Orcamentos.kpis` usa `data` (todos)
- `Fiscal.kpis` usa `data` filtrado por `tipo` URL param
- `Financeiro.kpis` usa `filteredData`
- `CotacoesCompra.kpis` usa `data`

Sem padrão. Usuário aplica filtro e KPI não reflete — ou reflete só em algumas telas.

### 8. Carregamento auxiliar duplicado em todas as páginas
Cada listagem com filtro por cliente/fornecedor faz seu próprio `supabase.from("clientes").select(...)` em `useEffect`. `Pedidos`, `Orcamentos`, `Conciliacao`, `Fiscal` repetem. Sem cache, sem invalidação, sem cancellation token (somente `Fornecedores`/`Produtos` têm `loadTokenRef`).

### 9. Race condition no auto-open via URL param
`Financeiro` abre drawer quando `?id=` corresponde a item carregado. Usa `autoOpenedRef` para não reabrir, **mas** se o usuário trocar `?id=` na URL sem F5, o ref bloqueia. Em outras (`Produtos`, `Fornecedores`) há `cancelled` flag — bom, mas inconsistente.

### 10. Ações por linha sem prevenção de duplo clique
`Pedidos.handleGenerateNF`, `PedidoCompraTable.onSend/onReceive`, `Orcamentos.handleSendForApproval/handleApprove/handleConvertToPedido` não desabilitam botão durante request (exceto pelo state `generatingNfId` em Pedidos — bom, mas não aplicado a outras ações). Risco de gerar NF duplicada/PC duplicado.

### 11. URL params: padronização inconsistente
- `Pedidos`/`Orcamentos`: `q`, `status`, `cliente`, `de`, `ate`
- `PedidosCompra`: `q`, `status`, `fornecedor`, `dataInicio`/`data_inicio` (aceita ambos por compatibilidade — boa intenção, mas indica que houve refactor incompleto)
- `Fiscal`: usa `searchParams` só pra `tipo`; resto é state local
- `Financeiro`: hook próprio `useFinanceiroFiltros` com URL state
- `Estoque`/`ContasBancarias`/`Produtos`: sem URL state — perde-se ao recarregar

### 12. Limpar filtros incompleto
`Orcamentos.onClearAll` em `AdvancedFilterBar` recebe handler que zera filtros, mas **não limpa `searchTerm`**. Idem em `Pedidos`. O usuário precisa apagar a busca manualmente.

### 13. `selected*` state vaza entre operações
`Fiscal` mantém `selected: NotaFiscal | null` que serve tanto para abrir drawer quanto modal de edição quanto devolução. Trocar entre modos pode arrastar o registro errado. `Estoque` tem `selected` (mov) e `selectedPosicao` separados — melhor.

### 14. Optimistic updates do `useSupabaseCrud` não invalidam queries derivadas
`update` faz cache patch otimista no `queryKey` do próprio hook, mas não em queries com `select` diferente da mesma tabela. Fiscal cria 4 instâncias (`useSupabaseCrud<NotaFiscal>`, `<FornecedorRef>`, `<ClienteRef>`, `<ProdutoRef>`) sobre tabelas distintas — ok. Mas `Financeiro` + `ContasBancarias` operam ambos `contas_bancarias` (saldo) e `financeiro_lancamentos`. Atualizar baixa em Financeiro **não invalida** `contas_bancarias` cache no outro módulo, risco de saldo desatualizado.

### 15. `DataTable` virtualization quebra layout sob certas condições
`VirtualizedOrPlainTbody` faz `display: 'block'` no `<tbody>` e usa `<td style={{display: 'contents'}}>` dentro do `<tr>` virtualizado. Em algumas combinações (colspan, scroll-x simultâneo), as colunas perdem alinhamento porque o container virtual é separado do `<thead>` rígido. Threshold default 50 — afeta listagens médias.

### 16. Export usa `pdf` muito básico
`exportData('pdf')` faz `pdf.text(line.slice(0, 180))` cortando linhas longas. Sem cabeçalho de colunas, sem tabela. Funciona, mas deselegante. Baixa prioridade.

### 17. `EstoqueMovimentacao` filtra por data sem normalização
`m.created_at < dataInicio` compara ISO timestamp completo com `YYYY-MM-DD`. `'2025-01-15T10:30:00' < '2025-01-15'` é `false` (string compare) → ok, mas fim do dia: `m.created_at > dataFim + "T23:59:59"` ignora milissegundos. Edge case mas existe.

### 18. `Pedidos.handleRequestGenerateNF` chama Supabase **sem await/cancel**
Função `async` que dispara fetch ao clicar; se usuário clica 2 vezes rapidamente, abre 2 dialogs. Usa `generatingNfId` mas só é setado depois do fetch, não antes.

### 19. `MultiSelect` repetido em todas as páginas com placeholder e width hardcoded
Padrão `className="w-[180px]"` se repete. Não é bug, mas inconsistência — mesmo filtro em telas diferentes pode ter larguras divergentes.

### 20. `Logs` (Auditoria deprecated) coexiste com `Auditoria.tsx`
Já documentado no próprio arquivo. Confirmar que sidebar não aponta pra `/admin/logs`.

## Estratégia de correção

Foco: padronização e robustez sem reescrever fluxos.

### Fase 1 — Infraestrutura compartilhada

**1.1 `useSupabaseCrud` — paginação real opt-in**
- Aceitar `paginationMode: 'all' | 'paged'`. Quando `'all'`, fazer fetch em chunks de 1000 e concatenar até esgotar `count` (similar ao chunked export já existente).
- Expor `truncated` com aviso visual padronizado (toast.warning) quando ocorrer e o caller não migrar para paged.

**1.2 `useUrlListState` (hook novo)**
- Encapsula `useSearchParams` + serialização: `q`, `status[]`, `cliente[]`, `de`, `ate`, etc.
- API: `const { value, set, clear } = useUrlListState({ schema })`. Substitui ~80 linhas duplicadas em `Pedidos`/`Orcamentos`/`PedidosCompra`/Fiscal.
- Padroniza nomes (`dataInicio`/`dataFim`, removendo aliases legados gradualmente).

**1.3 `useReferenceCache` (hook novo)**
- Wrapper sobre React Query para `clientes`/`fornecedores`/`contas_bancarias`/`grupos_produto` — uma query global compartilhada com `staleTime: 5min`.
- Substitui os ~12 `useEffect(()=>supabase.from("clientes")...)` espalhados.

**1.4 `DataTable` correções**
- Remover (ou esconder por flag) o popover de "Filtros avançados" interno — está duplicando `AdvancedFilterBar` e ninguém usa.
- Resetar `currentPage` quando `data.length` mudar e `currentPage > totalPages - 1`.
- `key={item.id ?? \`row-${idx}\`}` em vez de `item.id || idx`.
- Sort-safe: ignorar (ou tornar não-sortable por default) colunas sem `key` mapeada no item; aceitar `sortValue?: (item) => string|number` para colunas calculadas.
- Não virtualizar com scroll-x simultâneo (fallback para plain tbody).

**1.5 `useActionLock` aplicado a ações de linha**
Já existe (criado para drawers). Aplicar nos botões "Gerar NF", "Aprovar", "Enviar", "Receber", "Converter".

### Fase 2 — Aplicação cirúrgica por listagem

| Listagem | Ajuste técnico |
|---|---|
| `Pedidos` | KPIs sobre `filteredData`; lock em "Gerar NF"; clearAll também limpa `q`; usar `useUrlListState`; sort-safe nas colunas calculadas |
| `Orcamentos` | KPIs sobre `filteredData`; lock em send/approve/convert; clearAll inclui `q` |
| `PedidosCompra` | Lock em onSend/onReceive; padronizar `dataInicio`/`dataFim` (remover alias) |
| `CotacoesCompra` | Lock em ações de drawer já tratado; verificar KPIs sobre `data` está correto pelo contexto (manter) |
| `Fiscal` | Mover `selected` ambíguo para estados separados (`selectedDrawer`, `selectedEdit`, `selectedDevolucao`); KPIs sobre `filteredData` |
| `Financeiro` | Validar invalidação cruzada `contas_bancarias` ↔ `financeiro_lancamentos` (queryClient.invalidateQueries em ambos após baixa) |
| `Produtos`/`Clientes`/`Fornecedores`/`GruposEconomicos` | Remover `useEffect` de cargas auxiliares duplicadas → `useReferenceCache` |
| `ContasBancarias`/`ContasContabeis` | Adicionar URL state mínimo (`q`, filtros) |
| `Estoque` | URL state para aba ativa (`?tab=`); date-range normalizar para ISO completo na comparação |
| `Conciliacao` | Cancellation token nos fetches por período |
| `MigracaoDados` | `onDelete` placeholder retorna toast — ok manter, só remover do `DataTable` se não há intenção |
| `Logs` (deprecated) | Confirmar inacessível por sidebar/rotas; marcar removível em ronda futura |

### Fase 3 — Padronização final
- Largura de filtros via constante `FILTER_WIDTH_DEFAULT = 'w-[180px]'`.
- `EmptyState` já usado pelo `DataTable` — só revisar `emptyTitle`/`emptyDescription` faltantes em `Estoque`/`Conciliacao`.
- Documentar contrato `Column<T>` com `sortValue`.

### Fora do escopo
- Não tocar em `Relatorios.tsx` (page de leitura, comportamento diferente)
- Não migrar React Query para v5 nem mexer em `queryClient` config
- Não redesenhar visualmente
- Não mudar regras de negócio (KPI redefinido só onde for inconsistência clara — Fiscal/Pedidos/Orcamentos)
- Não mexer em `ApresentacaoGerencial`/`Social` (módulos opt-in)

## Critério de aceite
- `useSupabaseCrud` não trunca silenciosamente >1000 registros (avisa OU pagina)
- Sort não quebra em colunas calculadas
- Paginação não trava em página vazia ao mudar filtros
- Dupla camada de filtros do `DataTable` removida (ou explicitamente desativada por default)
- Ações por linha previnem duplo clique
- KPIs consistentes (sobre `filteredData`) em Fiscal/Pedidos/Orcamentos
- Cargas auxiliares duplicadas centralizadas em `useReferenceCache` para clientes/fornecedores
- URL state padronizado via `useUrlListState`
- Build OK (`tsc --noEmit`); sem regressão funcional

## Entregáveis
Tabela final por listagem: `problema → ajuste aplicado → pendência (se houver)`.

