

# Diagnóstico visual — drawers do projeto

Mapeei **13 drawers**: 11 de domínio + 1 wrapper base (`ViewDrawerV2`/`ViewDrawer`) + 1 stack (`RelationalDrawerStack`). A infraestrutura visual já existe — `DrawerHeaderShell`, `DrawerSummaryCard`/`Grid`, `DrawerStickyFooter`, `ViewDrawerV2` com 3 variantes. O problema é **aplicação inconsistente**.

## Categorias

**A. Visualização leve (read-only)**
`EstoquePosicaoDrawer`, `EstoqueMovimentacaoDrawer`, `RecebimentoDrawer`, `ConfigHistoryDrawer`

**B. Visualização administrativa (edit/delete)**
`FinanceiroDrawer`, `ContaBancariaDrawer`, `ContaContabilDrawer`

**C. Operacional/transacional (fluxo de status)**
`PedidoCompraDrawer`, `CotacaoCompraDrawer`, `NotaFiscalDrawer`, `EntregaDrawer`

**D. Stack relacional**
`RelationalDrawerStack` + 8 *Views (Cliente, Fornecedor, Produto, NF, Pedido, Orçamento, Remessa, OV)

## Inconsistências visuais reais

### 1. Summary strip — 3 estilos diferentes coexistem
- `NotaFiscalDrawer`/`PedidoCompraDrawer` usam o padrão **certo**: `<DrawerSummaryGrid><DrawerSummaryCard tone="primary" /></DrawerSummaryGrid>`
- `FinanceiroDrawer` (linhas 94-119) hand-rolla `<div className="rounded-lg border bg-muted/30 p-3">` 4× com classes idênticas mas **diferentes** dos cards do componente padrão (paddings, tamanhos de fonte, cores semânticas misturadas)
- `EstoquePosicaoDrawer`/`RecebimentoDrawer`/`ContaContabilDrawer` usam variação `bg-card text-center` com `text-xl font-mono` — fonte maior, layout center, sem suporte a `tone`

Resultado: módulos parecem feitos por equipes diferentes.

### 2. Linha de ações inconsistente
- `FinanceiroDrawer`: 4 ícones ghost `h-8 w-8`, sem labels
- `PedidoCompraDrawer`: mistura ícones + botões com texto + agrupamento por permissão (mais maduro)
- `CotacaoCompraDrawer`: botões `outline size="sm"` com label — visual mais pesado
- `NotaFiscalDrawer`: ícones + alguns com texto (Confirmar, Estornar)

### 3. Hierarquia de status no summary
- `RecebimentoDrawer`/`PedidoCompraDrawer` colocam StatusBadge **dentro** do summary card (centro), perdendo destaque
- `ViewDrawerV2` aceita `badge` no header (zona certa) mas vários drawers ignoram e duplicam status no body
- "Atrasado" aparece como mini-badge dentro de card em `RecebimentoDrawer` — fácil de perder

### 4. Banners de status contextual
- `NotaFiscalDrawer` tem `statusInfoMap` rico (descrição + cor por status) — modelo bom
- `PedidoCompraDrawer` só tem alerta de overdue
- `FinanceiroDrawer` não tem banner contextual (só "X dias em atraso" perdido no card)
- Sem padrão `DrawerStatusBanner`

### 5. Tabelas internas com 3 estilos
Cada drawer recria `<table className="w-full text-sm">` com `bg-muted/50` no header. Hover, zebra, footer total — todos divergem.

### 6. Empty states soltos
`<p className="text-sm text-muted-foreground text-center py-4">Nenhum item</p>` repetido 12×, sem ícone, sem CTA. `EmptyState` existe (`@/components/ui/empty-state`) mas só é usado em 1 drawer.

### 7. Tabs sem contadores consistentes
- `FinanceiroDrawer` usa `baixasList.length > 0 ? \`Baixas (${n})\` : "Baixas"` — manual
- `NotaFiscalDrawer` não mostra contador
- `PedidoCompraDrawer` mostra em algumas tabs

### 8. Section headers OK (já padronizados via `ViewSection`)
Mas grids dentro variam: `grid-cols-2 gap-4` vs `gap-x-4 gap-y-3` vs `gap-3`.

### 9. Footer operacional disperso
`PedidoCompraDrawer`/`CotacaoCompraDrawer` usam `DrawerStickyFooter` com agrupamento esquerda/direita — bom. `NotaFiscalDrawer` ainda tem ações no header sem footer sticky claro para confirmar/estornar.

### 10. RelationalDrawerStack — sem indicação visual de profundidade
Drawers empilhados ficam visualmente idênticos; usuário perde noção de "estou no 3º nível". Header `DrawerHeaderShell` aceita `counter` mas não está sendo populado pelo stack.

## Estratégia de correção

Foco: **harmonizar usando os componentes que já existem** + criar 2 helpers pequenos. Sem reescrever conteúdo.

### Fase 1 — Helpers visuais novos (mínimos)

**1. `DrawerStatusBanner`** (`src/components/ui/DrawerStatusBanner.tsx`)
Padroniza o banner contextual abaixo do summary:
```tsx
<DrawerStatusBanner
  tone="warning"  // success|warning|destructive|info|muted
  icon={AlertCircle}
  title="Pedido em atraso"
  description="Entrega prevista em 12/04 — 5 dias de atraso."
/>
```
Substitui `statusInfoMap` (NF) + alerta overdue (Pedido) + "X dias em atraso" perdido (Financeiro).

**2. `DrawerActionBar`** (`src/components/ui/DrawerActionBar.tsx`)
Wrapper opinionado para a `actions` do `ViewDrawerV2`:
- Agrupa em **primária** (1, destaque visual) / **secundárias** (icon ghost com tooltip) / **destrutivas** (vermelho, sempre por último)
- Em telas operacionais, primária pode virar botão com label
- Em telas read-only, tudo vira ícone ghost

```tsx
<DrawerActionBar
  primary={canConfirmar ? { label: "Confirmar", icon: CheckCircle, onClick, pending } : undefined}
  secondary={[{ icon: Edit, tooltip: "Editar", onClick }]}
  destructive={{ icon: Trash2, tooltip: "Excluir", onClick, confirmRequired: true }}
/>
```

**3. Reuso do `EmptyState` existente** — sem código novo, só aplicação.

### Fase 2 — Aplicação cirúrgica por drawer

| Drawer | Ajuste visual |
|---|---|
| `FinanceiroDrawer` | Trocar 4 `<div>` hand-rolled por `DrawerSummaryGrid+DrawerSummaryCard` (tones: neutral/success/warning/destructive); usar `DrawerStatusBanner` para "X dias em atraso" + status descrição; ações via `DrawerActionBar` |
| `EstoquePosicaoDrawer` | Migrar 4 cards `bg-card text-center` para `DrawerSummaryCard` (mantendo align="center"); `SituacaoBadge` vira `tone` do card de saldo; banner para `precisaReposicao` |
| `EstoqueMovimentacaoDrawer` | Mesma migração de summary; banner para "Ajuste manual" |
| `RecebimentoDrawer` | Summary cards padronizados; mover badge "Atrasado" do card para `DrawerStatusBanner` proeminente |
| `PedidoCompraDrawer` | Já está bom — só converter alerta overdue inline em `DrawerStatusBanner`; `DrawerActionBar` para reduzir 6 botões do header |
| `CotacaoCompraDrawer` | Manter header customizado (CotacaoCompraHeaderSummary); só padronizar empty states + `DrawerActionBar` no rodapé operacional |
| `NotaFiscalDrawer` | Trocar `statusInfoMap` inline por `DrawerStatusBanner`; agrupar 5+ ações via `DrawerActionBar` (primária = Confirmar/Estornar conforme status) |
| `EntregaDrawer` | Adicionar summary strip (hoje não tem); `DrawerStatusBanner` para "Atrasado"/"Com ocorrência"; padronizar tabela de eventos |
| `ContaBancariaDrawer` | Summary com 4 cards (saldo/entradas/saídas/última mov); empty states |
| `ContaContabilDrawer` | Já tem summary 4×; migrar para `DrawerSummaryCard tone` |
| `ConfigHistoryDrawer` | Read-only puro; só padronizar empty state |
| `RelationalDrawerStack` | Popular `counter={{index, total}}` no `DrawerHeaderShell` para indicar profundidade; sutil mudança de elevação por nível (já tem zIndex) |
| `ViewDrawerV2` | Sem mudanças funcionais; só garantir que todos os consumidores passam `summary`/`actions` pelas props certas |

### Fase 3 — Consistência fina

- Padronizar `gap-4` em todos os `grid-cols-2` dentro de `ViewSection`
- Empty state padrão: `<EmptyState icon={X} title="..." description="..." action={...} />` quando aplicável
- Tabelas internas: extrair classes shared via constante `drawerTableClasses` (sem novo componente — só harmonizar `bg-muted/50`, hover, zebra)
- Contadores em tabs: helper `tabLabel(label, count)` pequeno

### Fora do escopo
- Não vou refatorar `*View.tsx` da stack relacional (são páginas grandes; só ajusto `RelationalDrawerStack` para mostrar profundidade)
- Não vou tocar lógica/regra de negócio
- Não vou redesenhar campos individuais (`Input`/`Select`)
- Sem mudança em tokens de cor/tema

## Critério de aceite
- Todos os summary strips usam `DrawerSummaryCard`/`DrawerSummaryGrid`
- Banners de status contextual usam `DrawerStatusBanner` (eliminando hand-roll)
- Linha de ações dos drawers usa `DrawerActionBar` (primária/secundárias/destrutiva claras)
- Empty states usam `EmptyState`
- Stack relacional mostra profundidade no header
- Sem regressão funcional; build OK (`tsc --noEmit`)

## Entregáveis
Tabela final por drawer: `problema visual → ajuste aplicado`.

