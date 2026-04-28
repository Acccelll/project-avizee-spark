# Filtros temporais mais claros + fim das colunas "Ações" duplicadas

Três frentes que se reforçam visualmente: (1) deixar explícito se o período é "para trás" (histórico) ou "para frente" (vencimentos), (2) adicionar um seletor de **Mês fechado**, e (3) consolidar as colunas de Ações nas listas onde hoje aparecem duas.

---

## 1. Clareza de direção nos filtros temporais

### Problema atual
- Em **Lançamentos** e **Fluxo de Caixa**, os chips "7 / 15 / 30 / 90 dias" são *forward-looking* (vencimentos próximos), via `periodToFinancialRange`.
- Em **Pedidos**, **Orçamentos**, **Estoque** os mesmos chips são *backward-looking* (emissão/movimentação nos últimos N dias), via `periodToDateFrom`.
- Visualmente são idênticos — o usuário não sabe para que lado o tempo "anda".

### Proposta: contrato visual de direção

Acrescentar uma prop `direction` ao `PeriodFilter`:

```
direction: "past" | "future" | "neutral"   // default "past"
```

Efeitos visuais (pequenos, sem poluir):
- **past**: ícone `History` (ou `ArrowLeft`) cinza à esquerda dos chips, label do agrupador "Período (histórico)".
- **future**: ícone `CalendarClock` (ou `ArrowRight`), label "Período (vencimentos)".
- **neutral**: ícone `Calendar` atual, label "Período".
- Os próprios chips **mudam de rótulo** conforme a direção, para tirar a ambiguidade:
  - past → "Últimos 7d", "Últimos 30d", "Este ano até hoje"
  - future → "Próximos 7d", "Próximos 30d", "Vence hoje", "Vencidos"
- Tooltip no hover do chip explicita: "Vencimentos entre hoje e DD/MM" ou "Movimentos entre DD/MM e hoje".

Mapeamento de páginas:

| Página | Direção | Fonte de dados |
|---|---|---|
| Lançamentos, Fluxo de Caixa, Conciliação (vencimentos) | future | `data_vencimento` |
| Pedidos, Orçamentos, Cotações de Compra, Pedidos de Compra | past | `data_emissao` / `data_cotacao` |
| Estoque (movimentação) | past | `data_movimento` |
| Auditoria | past (range only) | `created_at` |
| Dashboard / Relatórios | past | conforme widget |

Atualizar `mem://produto/contrato-de-periodos` para registrar a doutrina de direção e os novos rótulos.

---

## 2. Novo filtro "Mês"

### Comportamento
Novo controle ao lado do `PeriodFilter`, chamado **`MonthFilter`**:
- Botão default mostra o mês corrente (ex.: "Abr/2026").
- Popover com seletor compacto de mês/ano (grid de 12 meses + setas de ano), no estilo do Calendar do shadcn.
- Atalhos: "Mês atual", "Mês anterior", "Próximo mês", "Limpar".
- Quando aplicado:
  - **future direction**: filtra por vencimentos dentro daquele mês (1º → último dia).
  - **past direction**: filtra por emissão/movimento dentro daquele mês.
- Ao escolher um mês, o `PeriodFilter` desliga seus chips (vão a `outline`) — só uma fonte de verdade temporal por vez.
- Ao clicar num chip de período, o `MonthFilter` volta ao estado vazio.

### Onde aplicar
- **Imediato (agora):** Lançamentos, Fluxo de Caixa, Conciliação, Pedidos, Orçamentos, Cotações de Compra, Pedidos de Compra, Estoque (movimentação), Relatórios.
- **Não aplicar**: Auditoria (já usa range customizado livre); Dashboard (período é global).

Convenção de URL: `?mes=YYYY-MM` quando definido; remove `de`/`ate` enquanto ativo.

---

## 3. Colunas "Ações" duplicadas

### Diagnóstico
O `DataTable` já gera **automaticamente** uma coluna "Ações" (à esquerda) com Visualizar / Editar / Excluir sempre que `onView/onEdit/onDelete` é passado. Algumas telas adicionam **uma segunda coluna manual** também rotulada "Ações" para botões contextuais — daí o usuário ver duas colunas com o mesmo título.

Ocorrências confirmadas:
- `src/pages/financeiro/config/financeiroColumns.tsx` → "Baixar"
- `src/pages/Orcamentos.tsx` → "Enviar / Aprovar / Gerar Pedido"
- `src/pages/Pedidos.tsx`
- `src/pages/Logistica.tsx` (Entregas e Recebimentos — duas colunas chamadas "Ações" cada)
- `src/components/compras/PedidoCompraTable.tsx`
- `src/pages/Relatorios.tsx`

### Proposta: uma única coluna "Ações"

Estender o `DataTable` com uma prop:
```
rowExtraActions?: (item) => ReactNode   // botões contextuais
```

Renderização: a coluna automática passa a ser `[ Visualizar ] [ Editar ] [ ...rowExtraActions ] [ ⋮ overflow ]`.

Regras visuais:
- Os 2 botões contextuais mais relevantes ficam visíveis (ex.: **Baixar** em Lançamentos, **Gerar Pedido** em Orçamentos).
- Ações terciárias colapsam num menu `⋮` (DropdownMenu) à direita, evitando linha "balão".
- Ícone-only com `title`+`aria-label` no desktop; rótulo curto quando há espaço.
- Mobile já usa `mobilePrimaryAction` no card — mantém-se inalterado.

Migração página a página:
1. Remover a 2ª coluna manual `acoes_*`.
2. Mover o conteúdo para `rowExtraActions={...}`.
3. Manter a ordem visual: Visualizar → Editar → Ação primária do domínio (Baixar/Aprovar/Gerar Pedido/Receber) → ⋮.

Atualizar `mem://tech/design-system-fontes-canonicas` com o contrato `rowExtraActions` (proibir nova coluna manual chamada "Ações").

---

## Resumo visual

```text
ANTES (Lançamentos)
| Ações | Status | Vencimento | Cliente | ... | Ações |
| 👁 ✏ 🗑 | aberto | 30/04 | ACME | ... | [Baixar] |

DEPOIS
| Ações                       | Status | Vencimento | Cliente | ... |
| 👁 ✏ [Baixar] ⋮             | aberto | 30/04      | ACME    | ... |

ANTES (filtros)
[📅] [Hoje] [7d] [30d] [90d]   ← past? future? indistinguível

DEPOIS (Lançamentos — future)
[⏩ Período (vencimentos)] [Vence hoje] [Próx. 7d] [Próx. 30d] [Vencidos]   [📆 Abr/2026 ▾]

DEPOIS (Pedidos — past)
[⏪ Período (emissão)] [Hoje] [Últ. 7d] [Últ. 30d] [Este ano]   [📆 Abr/2026 ▾]
```

---

## Detalhes técnicos

**Arquivos principais a tocar**
- `src/components/filters/PeriodFilter.tsx` — adicionar `direction`, ícone e rótulos dinâmicos.
- `src/components/filters/periodTypes.ts` — labels por direção (helper `getPeriodLabels(direction)`).
- `src/components/filters/MonthFilter.tsx` — **novo** componente (popover + grid de meses).
- `src/lib/periodFilter.ts` — adicionar `monthToRange(yyyyMm)`; manter `periodToDateFrom`/`periodToFinancialRange`.
- `src/components/DataTable.tsx` — nova prop `rowExtraActions`; cabeçalho único "Ações".
- Páginas que migram (remover coluna manual + passar `rowExtraActions`):
  Financeiro (`financeiroColumns.tsx`), `Orcamentos.tsx`, `Pedidos.tsx`, `Logistica.tsx`, `Relatorios.tsx`, `compras/PedidoCompraTable.tsx`, `compras/CotacaoCompraFilters.tsx` (substituir os dois `<input type=date>` pelo `MonthFilter`+`PeriodFilter` no padrão).
- Páginas que aplicam `direction` correta no `PeriodFilter`:
  Financeiro, FluxoCaixa, Conciliação → `direction="future"`.
  Pedidos, Orcamentos, Estoque, CotacoesCompra, PedidosCompra → `direction="past"`.
- Memórias a atualizar:
  - `mem://produto/contrato-de-periodos` (direção + MonthFilter).
  - `mem://tech/design-system-fontes-canonicas` (contrato de Ações única).

**Compatibilidade**
- `PeriodFilter` mantém API legada (string `Period`); `direction` é opcional com default `"past"` (preservando comportamento de Pedidos/Orçamentos).
- Páginas financeiras passam explicitamente `direction="future"` — a função de range continua sendo `periodToFinancialRange`.
- `rowExtraActions` é opcional; tabelas que não usarem ficam idênticas.

**Sem mudança de stack, sem refactor amplo.** Apenas extensões de componentes existentes + remoção das colunas duplicadas + criação do `MonthFilter`.