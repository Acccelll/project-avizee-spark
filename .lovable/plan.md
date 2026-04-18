

## Diagnóstico

Os drawers já têm uma base padronizada (`DrawerHeaderShell` + `ViewDrawerV2`/`RelationalDrawerStack` da fase anterior), mas há inconsistências reais drawer-a-drawer. Mapeei 13 drawers em 4 categorias:

**Categoria A — Visualização/detalhe (leitura)**
`EstoquePosicaoDrawer`, `ContaContabilDrawer`, `EstoqueMovimentacaoDrawer`, `ConfigHistoryDrawer` (este nem usa `ViewDrawerV2`)

**Categoria B — Visualização + ações de cadastro**
`ContaBancariaDrawer`, `FinanceiroDrawer`

**Categoria C — Operacional/transacional (com footer de fluxo)**
`PedidoCompraDrawer` (envio/aprovar/receber/cancelar/rejeitar), `CotacaoCompraDrawer` (aprovar/converter), `NotaFiscalDrawer` (confirmar/cancelar)

**Categoria D — Logística (consulta + rastreio)**
`RecebimentoDrawer`, `EntregaDrawer`

### Problemas concretos identificados
1. **Cards de resumo inconsistentes** — `RecebimentoDrawer` usa grid 4-col com bordas, `PedidoCompraDrawer` usa `bg-accent/30`, `EntregaDrawer` outro estilo. Cada um inventou seu visual.
2. **Footer não-sticky** — `ViewDrawerV2` aplica `sticky bottom-0` mas vários drawers operacionais têm footer com `flex-wrap` que cresce demais e conflita com scroll.
3. **`ConfigHistoryDrawer` fora do padrão** — usa `Sheet` direto sem `DrawerHeaderShell`.
4. **Badge legado duplicado** — `PedidoCompraDrawer`/`EntregaDrawer`/`RecebimentoDrawer` passam `badge` E `summary`; o badge fica "perdido" no canto direito da barra de resumo (lógica de fallback de ViewDrawerV2).
5. **Ações soltas no header** — `PedidoCompraDrawer` põe Editar/Excluir como `size="icon" h-8 w-8` na linha de ações, sem texto, enquanto `FinanceiroDrawer` e `ContaBancariaDrawer` usam outro padrão.
6. **Tabs sem peso visual** — `TabsList` com `text-xs` em todos, sem indicação clara da aba ativa contextualizada por tipo de drawer.
7. **Cores semânticas** — uso inconsistente de `warning` (amarelo) para coisas neutras (ex: "recebimento parcial" às vezes é apenas progresso, não alerta).
8. **Status cards fora do summary** — várias visualizações repetem o status em 3 lugares (badge no header, summary, e dentro da aba "Resumo").

## Estratégia

Não vou aplicar template cego. Em vez disso:

**1. Reforçar componentes compartilhados** (já existem, expandir):
- `DrawerSummaryCard` (novo) — card padronizado de KPI compacto: label uppercase + valor mono + sublabel opcional + cor semântica. Substitui as 4 variações atuais.
- `DrawerActionsBar` (novo wrapper leve) — agrupa ações com prioridade: ação primária (texto + ícone), secundárias (texto + ícone), destrutiva (variant outline + cor destructive), overflow menu para 4+.
- `DrawerStickyFooter` (novo) — padroniza footer operacional: zona esquerda (cancelar/destrutivo) + zona direita (próximas ações), com scroll-shadow.

**2. Tipologia visual por categoria** (variantes do `ViewDrawerV2`):
- Adicionar prop `variant?: "view" | "operational" | "edit"` no `ViewDrawerV2` que ajusta:
  - **view**: tabs slim, sem footer destacado
  - **operational**: tabs com peso médio, footer sticky com sombra superior, ações primárias coloridas
  - **edit**: tabs fortes, footer com salvar/cancelar fixo + indicador de "alterações não salvas"

**3. Refatoração drawer-a-drawer** (foco em problemas reais, não cosmético):

| Drawer | Mudanças |
|---|---|
| `ViewDrawerV2` | Add prop `variant`, `DrawerStickyFooter`, melhor scroll-shadow no header sticky |
| `DrawerHeaderShell` | Reforçar tabs sticky abaixo do header de ações; melhor responsivo (ações colapsam em overflow `<sm`) |
| `PedidoCompraDrawer` | variant=operational; trocar Editar/Excluir icon-only por texto+ícone; reorganizar footer (Cancelar à esquerda, fluxo à direita); summary usa `DrawerSummaryCard` |
| `CotacaoCompraDrawer` | variant=operational; consolidar status banners em 1 só; footer com hierarquia clara (primária Aprovar, secundária Rejeitar/Enviar) |
| `NotaFiscalDrawer` | variant=operational; revisar 9 status banners (`statusInfoMap`) — manter mas reduzir peso visual; corrigir cores neutras tratadas como warning |
| `FinanceiroDrawer` | variant=view+actions; reorganizar ações (Baixar como primária quando aplicável) |
| `ContaBancariaDrawer` | variant=view; padronizar summary com `DrawerSummaryCard` |
| `ContaContabilDrawer` | variant=view; reduzir verbosidade do summary atual |
| `EstoquePosicaoDrawer` | variant=view; SituacaoBadge no summary, não duplicado |
| `EstoqueMovimentacaoDrawer` | variant=view; tabs com peso adequado pra leitura |
| `RecebimentoDrawer` | variant=view; remover banner warning genérico do tabResumo (vai virar nota discreta no header); corrigir uso de "warning" para "recebimento parcial" (é progresso, não erro) |
| `EntregaDrawer` | variant=view; consolidar 3 badges (status/atrasado/ocorrência) no header |
| `ConfigHistoryDrawer` | **Migrar para `ViewDrawerV2`** variant=view; passa a herdar todo o padrão |

**4. Não vou tocar:**
- Lógica de negócio, permissões, fluxos
- Componentes `*View.tsx` relacionais (já refatorados na Fase 2 do trabalho anterior)
- Modais de edição (`*FormModal`, `NotaFiscalEditModal`) — escopo é drawer
- `src/components/ui/drawer.tsx` (vaul, é primitivo) — sem uso direto significativo

## Entregáveis

Após implementação, entrego um resumo por drawer listando: problema → ajuste aplicado.

## Critério de aceite
- Todos os 12 drawers `Sheet`-based usam `ViewDrawerV2` com variant adequada
- Summary cards padronizados via `DrawerSummaryCard`
- Footer operacional sticky com hierarquia visual clara (esquerda destrutiva / direita fluxo)
- Cores semânticas corretas (warning só para alertas reais)
- Build OK (`tsc --noEmit`)

