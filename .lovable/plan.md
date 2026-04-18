

# Diagnóstico visual — Telas de detalhe/visualização

## Inventário (9 telas)

| Tela | Tipo | Header padrão? | KPIs inline? | Empty states |
|---|---|---|---|---|
| ClienteView | Cadastral | DrawerHeaderShell ✓ | Inline ad-hoc | Texto solto |
| FornecedorView | Cadastral | DrawerHeaderShell ✓ | Inline ad-hoc | EmptyState ✓ |
| ProdutoView | Cadastral | DrawerHeaderShell ✓ | Inline ad-hoc (5×) | Misto |
| OrcamentoView | Operacional | DrawerHeaderShell ✓ | Inline ad-hoc | Texto solto |
| OrdemVendaView | Operacional | DrawerHeaderShell ✓ | Inline ad-hoc | Texto solto |
| PedidoCompraView | Operacional | DrawerHeaderShell ✓ | Inline ad-hoc | Texto solto |
| NotaFiscalView | Operacional leve | DrawerHeaderShell ✓ | — | — |
| RemessaView | Histórico | DrawerHeaderShell ✓ | — | — |
| FiscalDetail (`/fiscal/:id`) | Página-rota | Header próprio ad-hoc | Card ad-hoc | — |

## Problemas visuais encontrados

### 1. **KPIs inline reimplementados em cada View (8 variações do mesmo cartão)**
Todas as Views usam `<div className="rounded-lg border bg-card p-3 text-center space-y-1">` com label uppercase + valor mono. Já existe `DrawerSummaryCard` + `DrawerSummaryGrid` no projeto (rodada anterior) com tons semânticos (`primary/success/warning/destructive`) — não está sendo usado pelas Views. Resultado: cor de KPI (vermelho/verde) inconsistente entre módulos, paddings diferentes (p-3 vs p-4 no Produto), grids hardcoded.

### 2. **Empty states inconsistentes**
- Cliente/Orcamento/OV/PedidoCompra: `<p className="text-xs text-muted-foreground text-center py-6">Nenhum pedido encontrado</p>` (texto solto)
- Fornecedor/Produto: `<EmptyState icon={...} title="..." />` (componente)
- Resultado: abas vazias parecem "tela quebrada" em algumas Views, organizadas em outras.

### 3. **Loading e error genéricos sem hierarquia**
Todas usam `<div className="p-8 text-center animate-pulse">Carregando...</div>` — texto cinza, sem skeleton, sem ícone. Erro idem. Numa tela de detalhe profissional, esperaria-se skeleton de header+KPIs+tabs.

### 4. **Tabs com tipografia agressiva**
`text-[9px]` no ProdutoView (7 abas), `text-[10px]` em Cliente/Fornecedor — texto quase ilegível. Comprometendo escaneabilidade e acessibilidade.

### 5. **Listas internas (timeline/histórico) com padrões divergentes**
- ClienteView "Histórico de Contatos" usa timeline com border-l-2 + bullet
- FornecedorView "Compras" usa cards flat com flex-between
- ProdutoView "Movimentações" usa tabela
- OV "NFs vinculadas" usa cards
- Sem padrão de "lista de eventos / registros relacionados" reutilizável.

### 6. **Headers de seção repetidos com 4 variações**
`<h4 className="font-semibold flex items-center gap-2 border-b pb-1 text-muted-foreground uppercase text-[10px]">` (Cliente)
vs `<h4 className="font-semibold text-sm flex items-center gap-2 px-1 text-muted-foreground uppercase text-[10px]">` (Fornecedor)
vs `<h4 className="text-xs font-semibold flex items-center gap-2 px-1 text-muted-foreground uppercase mb-3">` (Remessa).
Sem componente `<SectionTitle>`.

### 7. **Badges de status faturamento em OV escapam do StatusBadge**
`statusFaturamentoColors` local com `bg-warning/10 text-warning border-warning/30` — não passa pelo `StatusBadge` central. Resultado: cores divergem das demais badges do sistema.

### 8. **FiscalDetail (`/fiscal/:id`) não segue o padrão das Views**
- Header próprio com "Voltar / NF X / Ver Detalhes"
- Card duplicando dados que já estão no drawer (numero, valor, tipo, status, emissão)
- Botão "Abrir Detalhes Completos" repetido 2× na mesma tela
- Layout solto, sem `ListPageHeader` nem identidade visual ERP

### 9. **Resumo do registro (DrawerHeaderShell.recordSummary) sem alinhamento entre Views**
Cliente/Fornecedor/Produto/OV/PedidoCompra: `<div className="flex items-start gap-3">` com avatar circular (h-10 w-10 bg-primary/10).
NotaFiscal/Remessa: mesmo padrão.
Orcamento: idem mas sem o avatar circular (legenda diferente).
Está quase consistente; falta extrair em `<RecordIdentityCard>` para padronizar uma vez por todas.

### 10. **Densidade vertical desigual**
- Cliente/Fornecedor: `space-y-5` no root, `gap-3` no KPI
- Produto: `space-y-5` mas KPIs `p-4` (mais altos)
- OV/Orcamento: `space-y-4`/`space-y-5` misturados entre seções
Falta token de espaçamento canônico para detalhe.

## Estratégia visual

Foco: **harmonizar reusando o que já existe** + 3 componentes pequenos novos. Sem reescrever lógica.

### Fase 1 — Componentes visuais compartilhados

**1.1 `RecordIdentityCard`** (novo)
Padroniza a faixa de resumo do registro (avatar + título + meta + badges).
```tsx
<RecordIdentityCard
  icon={Receipt}
  title={selected.numero}
  titleMono
  meta={`${formatDate(data)} · ${cliente}`}
  badges={[<StatusBadge status={...} />, ...]}
/>
```
Substitui o mesmo bloco copiado em 8 Views.

**1.2 `SectionTitle`** (novo)
```tsx
<SectionTitle icon={CreditCard}>Situação Financeira</SectionTitle>
```
Único formato (uppercase, text-[10px], muted, ícone à esquerda).

**1.3 `DetailLoading` + `DetailError` + `DetailEmpty`** (novos, leves)
- `DetailLoading`: skeleton com header+KPIs+tabs
- `DetailError`: ícone + mensagem + botão tentar novamente
- `DetailEmpty`: padroniza "registro não encontrado"

**1.4 Reuso obrigatório de `DrawerSummaryCard`/`DrawerSummaryGrid`**
Substitui os KPI cards inline em todas as Views. Usa tons semânticos (`destructive` para saldo devedor, `success` para faturado/lucro, `warning` para vencidos, `primary` para destaque).

**1.5 Reuso obrigatório de `EmptyState`**
Substitui textos soltos "Nenhum X encontrado" em todas as abas vazias.

### Fase 2 — Aplicação por View

| View | Ajustes visuais |
|---|---|
| **ClienteView** | RecordIdentityCard; KPIs → DrawerSummaryGrid (Saldo `destructive`, Lmt Crédito `success`); SectionTitle nas abas; EmptyState em Vendas/Financeiro/Contatos/Logística; tabs `text-xs` |
| **FornecedorView** | Mesmo padrão; "fonte do prazo" como hint do DrawerSummaryCard; tabs `text-xs` |
| **ProdutoView** | KPIs `p-3` (não p-4); Lucro/Margem com tone semântico; tabs reduzir para 5-6 ou aumentar `text-xs` (hoje `text-[9px]` é ilegível) |
| **OrcamentoView** | Status faturamento via StatusBadge (consolidar tones); KPIs com tones; SectionTitle |
| **OrdemVendaView** | Migrar `statusFaturamentoColors` local para StatusBadge central; KPIs com tones (Faturado `success`, Pendente `warning`); SectionTitle |
| **PedidoCompraView** | KPIs com tones; SectionTitle; consistência com OV |
| **NotaFiscalView** | RecordIdentityCard; tabela de itens com cabeçalho mais legível; abas com EmptyState |
| **RemessaView** | RecordIdentityCard; SectionTitle; densidade alinhada |
| **FiscalDetail** | **Refatorar header** para usar `ListPageHeader` (já existe); remover card duplicado (dados estão no drawer); manter "Voltar" + "Abrir Detalhes" como ação primária; reduzir página a um shell limpo que abre o drawer |

### Fase 3 — Polimento

- Tokens de espaçamento: `space-y-5` no root de cada View, `gap-3` em KPI grid, `gap-2` em badges, `mt-3` em TabsContent — aplicar consistentemente
- Tabs: mínimo `text-xs` (não `text-[9px]/[10px]`)
- Consistência entre módulos sem template cego: cadastrais mantêm "Histórico de Contatos" estilo timeline; operacionais mantêm cards-de-evento

## Fora do escopo
- Não tocar lógica de fetch, ações ou regra de negócio (já cobertos)
- Não mexer em `DrawerHeaderShell`, `RelationalDrawerStack`, `ViewDrawerV2` (estáveis)
- Não reescrever drawers de domínio (NotaFiscalDrawer, FinanceiroDrawer)
- Não alterar formulários de edição

## Critério de aceite
- Todos os KPIs via `DrawerSummaryCard` com tons semânticos coerentes
- Todas as abas vazias via `EmptyState` (não texto solto)
- Headers de seção via `SectionTitle` único
- Resumo do registro via `RecordIdentityCard`
- Loading/erro/not-found via `DetailLoading`/`DetailError`/`DetailEmpty`
- Tabs legíveis (`text-xs` mínimo)
- `FiscalDetail` harmonizado com padrão ERP
- Build OK (`tsc --noEmit`); sem regressão funcional

## Entregáveis
Tabela final por View: `problema visual → ajuste aplicado`.

