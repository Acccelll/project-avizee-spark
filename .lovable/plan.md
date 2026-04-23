

# Revisão Mobile — Dashboard

Análise baseada **exclusivamente** nos arquivos reais: `src/pages/Index.tsx`, `DashboardHeader`, `AlertStrip`, `QuickActions`, `FinanceiroBlock`, `ComercialBlock`, `EstoqueBlock`, `LogisticaBlock`, `FiscalBlock`, `PendenciasList`, `VendasChart`, `SummaryCard`, `MobileBottomNav`, `MobileQuickActions`. Viewport real do usuário = 1145px (desktop), portanto a análise abaixo refere-se ao comportamento que esses componentes **terão** em mobile (<768px) considerando classes Tailwind atuais.

---

## 1. Visão geral da experiência mobile

Em mobile o Dashboard hoje vira **um único trilho vertical de aproximadamente 9 blocos empilhados** (kpis → operational → alertas → financeiro → ações_rápidas → vendas_chart → pendências → comercial → estoque → logística → fiscal). Cada par lado-a-lado de desktop (`lg:grid-cols-2`) colapsa em duas linhas full-width. Resultado: **scroll vertical estimado ~2800–3500px** numa tela de 800px de altura, ou seja, **3,5–4,5 telas inteiras de rolagem só para chegar ao Fiscal**.

O shell mobile (`MobileBottomNav` + `MobileQuickActions` flutuante a 5,8rem do bottom) está bem resolvido — o problema está **dentro** do dashboard: blocos foram desenhados para grid 2-col com bastante espaço horizontal e, ao serem espremidos, mantêm padding/altura de desktop. Não há **nenhum tratamento específico** (`md:` / `sm:`) na maioria dos blocos para reduzir densidade em mobile.

O usuário consegue executar tarefas (todos os botões funcionam, drawers abrem), mas o dashboard vira **uma página de "leitura longa"**, não a "ferramenta de ação rápida" pretendida.

---

## 2. Problemas críticos (bloqueiam uso real)

| # | Problema | Onde | Por quê é crítico |
|---|---|---|---|
| C1 | Período/Refresh/Customize empilham em mobile, ocupando ~140px antes do primeiro KPI | `DashboardHeader` linha 62 (`flex-col gap-3 md:flex-row`) + `flex-wrap` na linha 83 | Saudação + título + 3 metadados (data, hora, range) + Select 175px + Atualizar + Customize = parede vertical antes de ver dado. Customizar widgets é raro; expor toda hora desperdiça topo da tela. |
| C2 | Custom range expõe 2 inputs `date` + botão Aplicar em sub-card de ~110px adicional | `DashboardHeader` linha 109 | Em mobile inputs `type="date"` nativos ficam altos; o sub-painel cobre quase 1/4 da tela. |
| C3 | Bloco `operational` força `grid-cols-2 sm:grid-cols-4` — em <640px mantém 2-col mas cada card tem altura de ~95px (4 cards = 200px de scroll) | `Index.tsx` linha 162, `SummaryCard density="compact"` | Mesmo compacto, 4 cards × 2 linhas = bloco quase do tamanho da viewport útil de um iPhone SE. |
| C4 | `FinanceiroBlock` indicadores ficam `grid-cols-2` em mobile (4 indicadores × ~60px = 120px) **+** `FluxoCaixaChart` com `min-h-[120px]` **+** rodapé "Hoje" — bloco totaliza ~340–380px | `FinanceiroBlock` linhas 74, 116 | É o bloco mais alto sem ser o mais útil em mobile. Gráfico de fluxo de caixa em <375px fica ilegível. |
| C5 | `ComercialBlock` tem 4 KPIs (`grid-cols-2 md:grid-cols-4` → 2-col em mobile, 4 cells × 2 linhas) + lista de últimos orçamentos + footer "Ver pedidos" — ~360–420px | `ComercialBlock` linhas 78, 113 | Cada KPI ocupa ~64px e o quarto ainda tem variação MoM. Excesso para mobile. |
| C6 | `VendasChart` renderiza com `h-[200px]` fixo + tooltip Recharts não-touch friendly + barras clicáveis sem hit-area expandida | `Index.tsx` linha 197, `VendasChart.tsx` | Tap em barra estreita falha em telas <375px; tooltip aparece mas usuário precisa tocar de novo para drill. Sem indicação visual de "tap-to-drill" em touch. |
| C7 | Lista de pendências com botão Eye `h-6 w-6` (24px) — abaixo do mínimo touch target Apple (44px) e Material (48px) | `PendenciasList` linha 188 | Cinco lançamentos com botão de 24px num gap de 1.5px entre linhas → toque errado garantido. |
| C8 | `EstoqueBlock`/`LogisticaBlock` linhas internas com `py-1.5 px-1` clicáveis (`onClick={() => pushView(...)}`) sem touch target mínimo — ~32px de altura | `EstoqueBlock` linha 84, `LogisticaBlock` linha 105 | Listas inteiras viram área de toque ambígua; sem estado pressed visível. |
| C9 | Hover-only states predominam (`hover:bg-muted/20`, `hover:opacity-80`, `hover:border-primary/30`) sem `active:` equivalente | Todos os blocos | Em touch não há hover; usuário nunca recebe feedback de "estou prestes a clicar". |
| C10 | `MobileQuickActions` FAB conflita com a posição "Ver fluxo de caixa →" no rodapé do FinanceiroBlock + botão "Mostrar todas" no PendenciasList — FAB cobre conteúdo a 5.8rem do bottom | `MobileQuickActions` linha 26 | Ao rolar até o fim de qualquer bloco, FAB sobrepõe o último botão de ação. |

---

## 3. Problemas médios (atrapalham uso)

- **M1** — Saudação+vencimentos é texto contínuo (`<p>` linha 313) em mobile vira 3 linhas truncadas; "1 recebimento e 2 pagamentos vencendo hoje · 3 pedidos aguardando faturamento" é informação valiosa enterrada em parágrafo cinza.
- **M2** — `ScopeBadge` (snapshot/global-range/fixed-window) aparece **8 vezes** no dashboard — em desktop é metadado útil; em mobile vira ruído pequeno e ilegível dentro dos headers `<h3>`.
- **M3** — `AlertStrip` usa `flex-wrap` com pílulas cinza-text — em mobile com 2 alertas (Vencidos + Notas), pílulas quebram em 2 linhas + label "ALERTAS" em 1 linha = 3 linhas para 2 informações.
- **M4** — `QuickActions` é grid `grid-cols-2 gap-2` com 6 botões altura ~70px = 220px de bloco. Em mobile já existe `MobileQuickActions` (FAB) com as mesmas ações. **Duplicação real**.
- **M5** — `PendenciasList` mostra `INITIAL_VISIBLE = 5` + "Mostrar todas (N)" — bloco varia de 200px a 600px; sem max-height interno, expande indefinidamente.
- **M6** — `FiscalBlock` lista 3-5 itens em cards `border` com `py-2` cada (~60px) = 180–300px; cada card tem ícone + label + sub + valor → poluído para a métrica simples que carrega.
- **M7** — Tooltips Recharts (`VendasChart`, `FluxoCaixaChart`) abrem ao tap mas não somem ao tap-fora — ficam grudados.
- **M8** — Status pílulas no `ComercialBlock` (`text-[10px] px-1.5`) + `mono leading-tight` ficam ilegíveis em telas <360px.
- **M9** — `DashboardCustomizeMenu` aparece sempre, mesmo em mobile onde reordenar widgets é tarefa de desktop. Botão extra que rouba espaço do header.

---

## 4. Problemas leves (polimento)

- **L1** — Saldo `mono` font para valores monetários em telas pequenas pode quebrar alinhamento.
- **L2** — "Atualizado às HH:MM" no header — em mobile poderia ser tooltip/chip menor.
- **L3** — Botões "Ver módulo →" repetem-se em 5 blocos; em mobile cada um ocupa linha própria por causa do `flex-wrap`.
- **L4** — `LogisticaBlock` mostra "prévia — até 10 registros" (`text-[10px]`) que ninguém precisa em mobile.
- **L5** — `BlockErrorBoundary` fallback não foi auditado para mobile (não testado neste review).
- **L6** — Skeletons (`DashboardSkeleton`) estão dimensionados para grid desktop — em mobile mostram blocos largos demais por ~600ms.
- **L7** — `DashboardCard` (wrapper de `vendas_chart` e `pendencias`) adiciona padding `p-3` extra dentro do card já com padding — duplicação de espaço.

---

## 5. Melhorias de layout (mobile)

1. **Sticky header compacto < 60px** em mobile: linha única [Período chip] [↻] [⋯ Customize/Refresh]. Saudação + greeting line viram banner único de 1 linha no topo do scroll content (não sticky).
2. **KPIs em carrossel horizontal de cards** em <640px (snap scroll, 1.2 cards visíveis), em vez de empilhar 3 em coluna. Mesma técnica para `operational` (mostra 4 cards num swipe horizontal de 60px de altura cada).
3. **`AlertStrip` vira chip-row scrollável horizontal** com 1-tap drill-down, ficando logo abaixo do header (acima dos KPIs em mobile — alerta antes de número).
4. **Esconder `QuickActions` block em mobile** (já há FAB `MobileQuickActions`). Adicionar `hidden md:block` no widget renderer.
5. **`FinanceiroBlock` em mobile**: 4 indicadores numa única linha horizontal compacta scrollável + esconder `FluxoCaixaChart` (mover para drawer "Ver fluxo" via botão). Reduz altura ~340px → ~140px.
6. **`ComercialBlock`/`EstoqueBlock`/`LogisticaBlock`/`FiscalBlock` viram "cards colapsáveis"** (`<details>`/Collapsible) com header sempre visível mostrando apenas 1 KPI principal + chip de alerta. Tap expande conteúdo. Default: financeiro/estoque expandidos; demais colapsados.
7. **Período custom em mobile**: trocar 2 inputs `date` por `Drawer` bottom-sheet com calendário único (touch-first) ao invés do popover do `Select` + sub-card.
8. **Densidade**: usar `density="compact"` já existente em todos os SummaryCards em <768px e reduzir `mt-1` interno; padding interno de 16px → 12px.

---

## 6. Melhorias de navegação

- **N1** — Eliminar duplicação `QuickActions` block × FAB: em mobile, manter só FAB (já implementado).
- **N2** — Adicionar **botão "Voltar ao topo"** flutuante depois do scroll passar de 600px (dashboard tem 3000+ px).
- **N3** — Drawers abertos via `pushView` (Orçamento, Produto, Pedido_compra) já usam `RelationalDrawerStack`; verificar se em mobile o sheet ocupa 100vw (não revisado aqui).
- **N4** — Header sticky em mobile permite trocar período sem scrollar de volta ao topo — hoje header rola junto.
- **N5** — `DashboardCustomizeMenu` deve ficar `hidden md:flex`. Reordenar widgets é tarefa desktop.

---

## 7. Melhorias de componentes

- **`SummaryCard` density="dense"** novo nível: `p-2`, `text-base` (em vez de `text-xl`), sem ícone box (ícone inline ao lado do título). Para uso em carrossel/linha horizontal.
- **`AlertStrip` mobile mode**: prop opcional `compact` que renderiza como `overflow-x-auto` snap-scroll de chips com `min-w-[120px]`.
- **`QuickActions`**: aceitar prop `hideOnMobile` (default false → mudar callsite em Index.tsx para true).
- **`FinanceiroBlock`/`ComercialBlock`/etc**: aceitar prop `mobileCollapsible` (default false → true no Dashboard); quando true, renderiza header tappable que expande conteúdo. Reaproveita componente `Collapsible` do shadcn.
- **`PendenciasList`**: aumentar botão `Eye` para `h-9 w-9` em mobile (touch target 36–44px); aumentar `py-1.5` para `py-2.5`; remover `INITIAL_VISIBLE` em mobile (mostrar 3 e botão "Ver todas" abre drawer).
- **`VendasChart`/`FluxoCaixaChart`**: em mobile desativar bar-click drill-down (gera frustração) e adicionar chip "Ver detalhes" abaixo do gráfico que navega ao relatório.
- **`DashboardHeader`**: extrair `MobileDashboardHeader` próprio com layout sticky mínimo (chip período + refresh + menu trigger) em vez de `flex-col` empilhado.

---

## 8. Melhorias de fluxo

- **F1** — Reordenar widgets default em mobile (override `DEFAULT_ORDER` para `mobileDefault`): alertas → kpis → operacional → financeiro (colapsado) → pendências → comercial (colapsado) → estoque (colapsado) → logística (colapsado) → fiscal (colapsado) → vendas_chart (colapsado).
- **F2** — Saudação vira **banner-action**: se `vencimentosHoje > 0` ou `backlogOVs > 0`, render como `<button>` full-width com ícone, não parágrafo.
- **F3** — "Ver módulo →" de cada bloco deve ficar **dentro** do header colapsável (tap no header expande; ícone setinha pro módulo separado para drill-down direto).
- **F4** — Persistência por device: `useDashboardLayout` (já em `useUserPreference`) deveria salvar **estado expandido/colapsado por widget em mobile** separado do desktop.

---

## 9. Sugestões de redesign mobile (sem inventar sistema novo)

Reaproveitando 100% do que já existe (`SummaryCard`, `AlertStrip`, `Collapsible`, `Drawer`, `Sheet`, `MobileQuickActions`, `useDashboardLayout`):

```text
┌──────────────────────────────┐
│ [Hoje ▾] [↻] [⋯]   ← sticky 52px
├──────────────────────────────┤
│ Bom dia, João                │
│ ▸ 2 recebimentos vencem hoje │ ← banner-action 56px
├──────────────────────────────┤
│ ⚠ 3 vencidos · 5 pendentes  │ ← AlertStrip horizontal 44px
├──────────────────────────────┤
│ ◀ R$ 45k │ R$ 32k │ +R$ 13k ▶│ ← KPI carousel 88px
├──────────────────────────────┤
│ ◀ Estoque ⚠2│Backlog 5│... ▶│ ← Operational carousel 72px
├──────────────────────────────┤
│ 💰 Financeiro      R$ +13k ▼│ ← Collapsible, expandido
│   [4 indicadores em linha]   │
│   [Ver módulo financeiro →]  │
├──────────────────────────────┤
│ ⏰ Pendências (5)         ▼│ ← Collapsible, expandido
│   • Cliente A  R$ 5.000  👁  │ ← Eye 36px
├──────────────────────────────┤
│ 🛒 Comercial    Tkt R$2.5k ▶│ ← Collapsido
├──────────────────────────────┤
│ 📦 Estoque      ⚠3 críticos▶│ ← Collapsido (com badge)
├──────────────────────────────┤
│ 🚚 Logística    ⚠2 atrasadas▶│
├──────────────────────────────┤
│ 📄 Fiscal       5 pendentes▶│
├──────────────────────────────┤
│ 📊 Vendas (mês)            ▶│ ← Chart só ao expandir
└──────────────────────────────┘
                          [+] FAB (já existe)
                          [▲] Voltar ao topo
[Bottom nav já existe ────────]
```

Resultado: scroll cai de ~3000px para **~1200px** com tudo colapsado, **~2200px** com 3-4 blocos expandidos. Usuário vê alertas + KPIs + ações imediatas sem rolar nada.

---

## 10. Roadmap de execução

| Fase | Escopo | Resolve | Esforço |
|---|---|---|---|
| **1** | Sticky `MobileDashboardHeader` (chip período + refresh + ⋯) substituindo `DashboardHeader` em <md; banner-action de saudação | C1, C2, M1, N4 | M |
| **2** | `hidden md:block` no widget `acoes_rapidas` e no `DashboardCustomizeMenu` em mobile | M4, M9, N1, N5 | XS |
| **3** | Carrossel horizontal `kpis` e `operational` em <md (snap-x, sem mexer em desktop) | C3 | S |
| **4** | `Collapsible` em `FinanceiroBlock`, `ComercialBlock`, `EstoqueBlock`, `LogisticaBlock`, `FiscalBlock` com prop `defaultOpenMobile`; persistir estado por widget em `useDashboardLayout` | C4, C5, M6, F1, F4 | M |
| **5** | Em mobile: ocultar `FluxoCaixaChart` dentro de `FinanceiroBlock` e adicionar botão "Ver fluxo" → navega `/fluxo-caixa` | C4 | XS |
| **6** | Touch targets: `Eye` em PendenciasList → 36px; rows clicáveis em Estoque/Logística/Pendências → `min-h-[44px]`, `active:bg-muted/40` | C7, C8, C9 | S |
| **7** | `AlertStrip` modo `compact` (chips horizontais scrollable) + reposicionar acima dos KPIs em mobile | M3, M2 | S |
| **8** | `VendasChart` mobile: desativar bar-click drill-down, adicionar chip "Ver relatório de vendas →" abaixo do gráfico | C6, M7 | XS |
| **9** | Custom range: trocar inputs `date` + sub-card por `Drawer` bottom-sheet em mobile | C2 | M |
| **10** | Botão "Voltar ao topo" flutuante após scroll>600px (não cobrir FAB) + ajustar `bottom` do FAB para não cobrir rodapés de blocos | C10, N2 | XS |
| **11** | Atualizar `DashboardSkeleton` para refletir layout mobile reduzido (carrossel + colapsados) | L6 | S |
| **12** | Atualizar `mem://produto/contrato-de-status.md` ou criar `mem://produto/dashboard-mobile.md` documentando padrão de cards colapsáveis e carrosséis para futuros módulos | governança | XS |

**Quick wins (1 PR cada)**: 2, 5, 8, 10.
**Estruturais**: 1, 3, 4, 6, 7, 9.
**Cosméticos**: 11, 12.

