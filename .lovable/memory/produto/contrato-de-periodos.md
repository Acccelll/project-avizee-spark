---
name: Contrato de Períodos (filtros temporais)
description: PeriodFilter como fonte única — presets canônicos e regras para custom range
type: feature
---

# Contrato de Períodos

**Regra**: todo filtro temporal usa
`src/components/filters/PeriodFilter.tsx`. Novas telas **não** podem
criar inputs `<input type="date">` paralelos.

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