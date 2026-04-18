

# Diagnóstico técnico — drawers do projeto

Mapeei **17 arquivos**: 2 wrappers base (`ViewDrawerV2`, `ViewDrawer`), 1 stack relacional (`RelationalDrawerStack` + `RelationalDrawerSlotsContext`), 4 helpers UI (`DrawerHeaderShell`, `DrawerStickyFooter`, `DrawerSummaryCard`, `Sheet`/`Drawer` shadcn), 11 drawers concretos.

## Categorias

**A. Visualização leve (read-only, sem ações transacionais)**
`EstoquePosicaoDrawer` (478L), `EstoqueMovimentacaoDrawer` (435L), `RecebimentoDrawer` (244L), `ConfigHistoryDrawer` (144L)

**B. Visualização com ações administrativas (edit/delete)**
`ContaContabilDrawer` (542L), `ContaBancariaDrawer` (600L), `FinanceiroDrawer` (306L)

**C. Operacional/transacional (fluxo de status)**
`PedidoCompraDrawer` (683L), `CotacaoCompraDrawer` (351L), `NotaFiscalDrawer` (897L), `EntregaDrawer` (556L)

**D. Stack relacional (drawers empilháveis)**
`RelationalDrawerStack` + 8 *Views (`ProdutoView`, `ClienteView`, `FornecedorView`, `OrcamentoView`, `PedidoCompraView`, `NotaFiscalView`, `RemessaView`, `OrdemVendaView`)

## Problemas concretos

### 1. Race condition em troca rápida de registro
`ContaBancariaDrawer`, `ContaContabilDrawer`, `FinanceiroDrawer`, `NotaFiscalDrawer` usam `useEffect(()=>{ Promise.all([...]).then(...) }, [open, selectedId])` **sem cancellation flag**. Trocar de registro rapidamente ⇒ resultado de fetch antigo sobrescreve estado do registro novo.

`EntregaDrawer` é o único que usa `let cancelled = false; ... return ()=>{cancelled=true}` corretamente. Vamos padronizar via hook compartilhado.

### 2. `onClose()` antes de handler quebra o fluxo
Padrão repetido em `FinanceiroDrawer`, `ContaBancariaDrawer`, `CotacaoCompraDrawer`, `NotaFiscalDrawer`, `PedidoCompraDrawer`:
```tsx
onClick={() => { onClose(); onEdit(selected); }}
```
Problema: `onClose()` desmonta o drawer (libera `selected`) **antes** do handler executar. Em `NotaFiscalDrawer.onConfirmar/onEstornar` há ainda pior: `onConfirmar(selected); onClose()` — ok, mas a maioria inverte. Resultado: handler pode receber referência inválida se houver microtask intermediária.

Solução: ordem deve ser `handler(); onClose()` ou (melhor) deixar o parent decidir se fecha — handlers já chamam toast e refetch.

### 3. Sem prevenção de duplo clique em ações destrutivas
`onCancel`, `onAprovar`, `onRejeitar`, `onConfirmar`, `onEstornar` em `PedidoCompraDrawer`/`NotaFiscalDrawer` não têm `disabled` enquanto pendente. Usuário clica 2× → 2 chamadas. Os parents (`Compras.tsx`, `Fiscal.tsx`) usam mutations sem lock visível no botão.

### 4. `usePublishDrawerSlots` re-publica em **todo render** sem deps
```ts
useEffect(() => { ctx.setSlots(key, slots); return () => ctx.setSlots(key, null); });
```
Sem dependency array → roda em todo render. Cada `setSlots` chama `setVersion(v=>v+1)` no provider → re-render do `RelationalDrawerStack` → re-render dos slots → loop. Hoje funciona porque React batcha, mas é frágil e custa renders extras a cada keystroke em qualquer view aninhada.

Fix: comparar referências do conteúdo via `useEffect` com deps `[key]` + `useMemo` para slots; ou comparar JSON-stringify de chave estável; ou apenas ignorar re-publish quando ref igual.

### 5. `RelationalDrawerStack` — "Voltar" e "Fechar drawer" fazem a mesma coisa
Ambos chamam `onPop`. `onPop` apenas remove o topo; isso não permite que o usuário use `Esc` para fechar **só** o atual quando há sub-drawers (já funciona via `Sheet onOpenChange={() => onPop()}`, mas conflita com clique fora ⇒ pode fechar drawer empilhado sem confirmação).

### 6. `ViewDrawerV2.renderFooter` heurística frágil
```ts
const isSticky = f?.type === DrawerStickyFooter;
```
Não detecta `React.memo(DrawerStickyFooter)` ou wrappers; em alguns casos aplica wrapper sticky duplo. Melhor: detectar via `displayName` ou prop explícita `footerSticky?: boolean`.

### 7. `defaultTab` é estático — troca de registro não reseta aba
`ViewDrawerV2` usa `<Tabs defaultValue={...}>` (uncontrolled). Ao trocar de pedido enquanto drawer está aberto, a aba ativa do registro anterior é mantida — **inclusive quando ela não existe ou faz menos sentido para o novo registro** (ex: aba "Recebimento" vazia). Isso é especialmente ruim em `CotacaoCompraDrawer`, cujo `defaultTab` é dinâmico (`viewPropostas.length > 0 ? "propostas" : "resumo"`) mas é ignorado após o primeiro mount.

### 8. Render condicional inconsistente quando `selected = null`
`FinanceiroDrawer`, `ContaBancariaDrawer`, `ContaContabilDrawer`, `NotaFiscalDrawer`, `EstoquePosicaoDrawer`, `EstoqueMovimentacaoDrawer`, `EntregaDrawer`, `RecebimentoDrawer` retornam:
```tsx
if (!selected) return <ViewDrawerV2 open={open} onClose={onClose} title="" />;
```
Renderiza um `Sheet` vazio quando o parent abre o drawer sem ter o registro carregado. Pior: monta/desmonta hooks desnecessariamente quando `selected` muda de `null` ⇒ objeto. Melhor: `if (!open || !selected) return null;` e parent garante `open` apenas com registro válido.

### 9. `PedidoCompraDrawer` recebe `selected: PedidoCompra` (não-nullable) mas é renderizado com `selected={null}` em alguns lugares
Pelo tipo o `selected` é obrigatório, mas o parent pode passar undefined; sem guard interno ⇒ TypeError potencial em `selected.fornecedores?...`. Confirmar via `Compras.tsx` e blindar.

### 10. Tabelas internas re-renderizadas a cada update
`NotaFiscalDrawer`/`ContaBancariaDrawer` mapeiam `lancamentos`/`movimentos`/`baixas` em JSX inline sem memo; em listas grandes e drawer com muitos `useState`, todo digitação em filtro externo re-renderiza tudo. Apenas `CotacaoCompraDrawer` memoiza (`totalAprovado`).

### 11. `key={l.id || idx}` mescla id+index
Vários drawers usam `key={x.id || idx}` em listas. Se 2 itens vierem sem id, mesmo `idx` = key duplicada. Trocar por `key={x.id ?? \`tmp-${idx}\`}`.

### 12. Acessibilidade: foco inicial e `aria-label`
Drawers usam `<SheetHeader className="sr-only"><SheetTitle>` para evitar duplicar título visível, mas perdem foco trap inicial bom. Alguns botões de ícone sem `aria-label` (vários botões em `EntregaDrawer`, `EstoquePosicaoDrawer`).

### 13. Lógica de negócio espalhada na UI
- `PedidoCompraDrawer.canReceive/canSend/canCancel/canSolicitarAprovacao/canApproveReject` — duplicado entre drawer e ações no parent. Deveria vir de helper `getPedidoCompraPermissions(p, isAdmin)`.
- `NotaFiscalDrawer.canConfirmar/canEstornar/canDevolucao` — mesmo padrão.
- `FinanceiroDrawer.canBaixa/canEstorno` — mesmo padrão.
- Cálculos de overdue/atraso replicados em 4 drawers (`isAtrasado`, comparação com `today`).

### 14. `onClose` propagation ambígua
`<Sheet onOpenChange={onClose}>` é chamado tanto para abrir quanto fechar. Hoje `onClose` é tratado como "fechar"; quando o `Sheet` interno do shadcn dispara `onOpenChange(true)` durante mount em alguns casos (foco), pode causar fechamento espúrio. Padrão correto: `onOpenChange={(o) => !o && onClose()}` — já presente em `RelationalDrawerStack`, ausente em `ViewDrawerV2` e `ViewDrawer`.

### 15. `ViewDrawer` legado coexiste com `ViewDrawerV2`
`src/components/ViewDrawer.tsx` ainda é importado para `ViewField`/`ViewSection` (re-exportados pelo V2). Manter, mas declarar V1 deprecated apenas como container de helpers.

## Estratégia de correção

Foco: estabilidade e padronização **sem reescrever fluxos**.

### Fase 1 — Infraestrutura compartilhada

**1. `useDrawerData<T>(open, selectedId, loader)`** (`src/hooks/useDrawerData.ts`)
Encapsula:
- cancellation token (corrige #1)
- reset de estado quando `selectedId` muda
- `loading`/`error`
- não dispara fetch quando `!open || !selectedId`

```ts
const { data, loading, error } = useDrawerData(
  open, selectedId,
  async (id, signal) => Promise.all([...])
);
```

**2. Corrigir `usePublishDrawerSlots`** (#4)
Adicionar comparação por chave estável + deps explícitas. Os consumidores `*View.tsx` já passam objetos novos a cada render — vou aceitar e otimizar comparação shallow no provider (compara `breadcrumb/summary/actions` por `===`; só dispara `setVersion` se mudou). Acaba o re-render loop.

**3. `useActionLock()`** (já existe `useSubmitLock` — reusar)
Aplicar nos handlers internos de `PedidoCompraDrawer`/`NotaFiscalDrawer`/`FinanceiroDrawer` para travar duplo clique (#3). Como handlers vêm via prop, vou criar um wrapper interno `useDeferredAction` que disable o botão por ~600ms ou até a prop `selected` mudar.

**4. `getDrawerActionPermissions`** helpers (#13)
Extrair regras de status para `src/lib/drawerPermissions.ts`:
- `canPedidoCompraAction(p, isAdmin)` → `{canSend, canReceive, canCancel, canApprove, canReject}`
- `canNotaFiscalAction(nf)` → `{canConfirmar, canEstornar, canDevolucao, canEditar}`
- `canFinanceiroAction(l, status)` → `{canBaixa, canEstorno}`
Drawer importa só pra UI; parents continuam usando livremente (sem regressão lógica).

### Fase 2 — Aplicação cirúrgica

| Drawer | Ajustes |
|---|---|
| `ViewDrawerV2` | `onOpenChange={(o)=>!o && onClose()}`; `Tabs` controlado com reset quando `tabs[0].value` mudar; `footerSticky` prop explícita ao invés de heurística por `type` |
| `ViewDrawer` (V1) | Mesma correção de `onOpenChange` |
| `RelationalDrawerStack` | Diferenciar "Fechar drawer atual" vs "Voltar" (semântica idêntica hoje, ok manter, mas nomear melhor); evitar fechamento espúrio em sub-drawer |
| `RelationalDrawerSlotsContext` | Comparação shallow para evitar re-render loop |
| `FinanceiroDrawer` | Adotar `useDrawerData`; inverter ordem `handler()→onClose()`; lock duplo clique; `if (!open||!selected) return null` |
| `ContaBancariaDrawer` | Mesmo conjunto |
| `ContaContabilDrawer` | Mesmo conjunto |
| `NotaFiscalDrawer` | `useDrawerData` (5 fetches); `getNotaFiscalPermissions`; locks de ação; `key` corrigido em tabelas |
| `PedidoCompraDrawer` | Guard `if (!selected) return null`; `getPedidoCompraPermissions`; locks |
| `CotacaoCompraDrawer` | Locks em `onApprove/onReject/onSendForApproval/onGerarPedido` |
| `EntregaDrawer` | Já tem cancel; só lock no `handleRastrear` (já existe `trackingLoading`); cleanup `if(!open) return null` |
| `RecebimentoDrawer` | Read-only puro; manter; só padronizar guard |
| `EstoquePosicaoDrawer`/`EstoqueMovimentacaoDrawer` | Read-only; só padronizar guard e `aria-label` |
| `ConfigHistoryDrawer` | Já usa `useQuery` (cancela bem); ok |

### Fora do escopo
- Não vou redesenhar visual (drawer headers/summaries continuam como estão)
- Não vou refatorar o conteúdo de cada `*View.tsx` (são páginas grandes; só corrijo o slots-provider)
- `Drawer` (vaul) primitivo não tem uso significativo — sem mudanças
- Não vou tocar em `useFinanceiroActions`/`useNotasFiscais` (são hooks de página, fora do escopo de drawer)

## Critério de aceite
- Trocar registro com drawer aberto **não** mistura dados (cancellation token aplicado em 4 drawers).
- Botões de ação travam contra duplo clique.
- `usePublishDrawerSlots` não causa re-render loop (comparação shallow).
- Helpers de permissão centralizados; drawers e páginas usam a mesma fonte.
- Guards `if (!open||!selected) return null` aplicados; drawer não monta hooks com registro nulo.
- `onOpenChange` corrigido em `ViewDrawer`/`ViewDrawerV2`.
- `Tabs` reseta corretamente ao trocar conjunto de tabs.
- Build OK (`tsc --noEmit`); sem regressão funcional.

## Entregáveis
Tabela final por drawer: `problema → ajuste aplicado → pendência (se houver)`.

