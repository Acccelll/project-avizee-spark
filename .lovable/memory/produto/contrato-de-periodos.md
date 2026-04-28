---
name: Contrato de Períodos (filtros temporais)
description: PeriodFilter como fonte única — presets canônicos e regras para custom range
type: feature
---

# Contrato de Períodos

**Regra**: todo filtro temporal usa
`src/components/filters/PeriodFilter.tsx`. Novas telas **não** podem
criar inputs `<input type="date">` paralelos.

## Direção temporal (obrigatória)

Toda instância do `PeriodFilter` deve declarar `direction`:

| direction | Quando usar | Rótulos | Ícone |
|---|---|---|---|
| `past` | Histórico/emissão (Pedidos, Orçamentos, Estoque, Cotações) | "Hoje", "Últ. 7d/30d…", "Este ano" | History |
| `future` | Vencimentos (Lançamentos, Fluxo de Caixa) | "Vence hoje", "Próx. 7d/30d…", "Até fim do ano" | CalendarClock |
| `neutral` | Datas genéricas/raras | rótulos curtos ("7d", "30d") | Calendar |

Default: `past` (preserva comportamento legado). Páginas financeiras
devem passar `direction="future"` explicitamente.

Cada chip leva tooltip detalhando o intervalo concreto.

## MonthFilter (mês fechado)

Componente `src/components/filters/MonthFilter.tsx` complementa o
`PeriodFilter` para selecionar **um mês específico** (1º → último dia).
Convivem na mesma toolbar; quando `MonthFilter` está ativo, a tela
ignora o `PeriodFilter` (uma única fonte de verdade temporal).

- URL: `?mes=YYYY-MM` quando ativo.
- Aplicar em: Lançamentos, Fluxo de Caixa, Conciliação, Pedidos,
  Orçamentos, Cotações de Compra, Pedidos de Compra, Estoque,
  Relatórios.
- Não aplicar em: Auditoria (range livre), Dashboard (período global).

## Presets canônicos (orientação para trás — análise histórica)

| Valor | Label PT-BR | Significado |
|---|---|---|
| `hoje` | "Hoje" | hoje 00:00 → agora |
| `7d` | "7 dias" | hoje-7d → hoje |
| `15d` | "15 dias" | hoje-15d → hoje |
| `30d` | "30 dias" | hoje-30d → hoje |
| `90d` | "90 dias" | hoje-90d → hoje |
| `year` | "Este ano" | 1º jan → hoje |

## Presets financeiros (orientação para frente — vencimentos)

Usar `periodToFinancialRange` (já existente). Adicional: `vencidos`
(tudo antes de hoje, status filter complementa) e `todos`.

## API alvo do `PeriodFilter`

```
mode: "preset" | "range" | "both"  (default "both")
value: { preset?: string; from?: string; to?: string }
onChange: (next) => void
```

- `preset` chips no topo + popover "Personalizar período" que abre
  range picker (date inputs).
- Quando custom range é aplicado, `preset` vai para `null` e os chips
  ficam todos `outline`.

## Telas que devem migrar

- `Estoque.tsx` (movimentação) — substitui inputs manuais.
- `Pedidos.tsx` — substitui inputs manuais (preserva URL `de`/`ate`).
- `Financeiro.tsx` / `Conciliacao.tsx` — usar `mode="preset"` com presets financeiros.
- `Auditoria.tsx` — usa `mode="range"` (sem presets).
- `Dashboard` (`DashboardPeriodContext`) — pode permanecer como contexto,
  mas o widget visual deve ser o `PeriodFilter` canônico.

## Antipadrões

- `<input type="date">` solto na barra de filtros.
- "Limpar Datas" como botão separado (limpar é o estado vazio).
- Definir presets locais que conflitam (ex: "últimos 30 dias" significando
  algo diferente em Estoque vs Pedidos).