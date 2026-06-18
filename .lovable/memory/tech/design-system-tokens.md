---
name: Design System — Cores Hardcoded e Exceções
description: Regras de uso de tokens semânticos vs. exceções (PDFs, página pública, etiquetas)
type: design
---

## Regra

Componentes em `src/components` e `src/pages` NÃO podem ter hex literais
(`#xxxxxx`) nem classes de cor cruas do Tailwind (`text-green-600`,
`bg-amber-500`, etc.). Use tokens semânticos:

- `bg-primary` / `text-primary-foreground`
- `bg-success` / `text-success`
- `bg-warning` / `text-warning`
- `bg-destructive` / `text-destructive`
- `bg-info` / `text-info`
- `bg-muted` / `text-muted-foreground`
- `border-border`

## Gráficos (recharts)

Centralizado em `src/lib/chartColors.ts`. Novos gráficos importam
`CHART_PRIMARY`, `CHART_PALETTE`, `chartIntent.*` daquele arquivo —
nunca inline `hsl(var(--...))` repetido nem hex.

## Exceções legítimas (não migrar)

1. **PDFs de orçamento** (`src/components/Orcamento/OrcamentoPdfTemplate*.tsx`)
   — `@react-pdf/renderer` exige hex; paleta de marca documentada no topo.
2. **Página pública de orçamento** (`src/pages/OrcamentoPublico.tsx`) —
   estilos inline com hex para renderização consistente cliente-final
   independente do tema institucional.
3. **Pré-visualização de etiquetas e DANFE** (`EtiquetaSimplesPreviewDialog`,
   `DanfeRender`) — `bg-white`/`text-neutral-900` reproduzem o impresso.
4. **Color pickers de branding** (`EmpresaSection`, `AparenciaSection`,
   `passwordPolicy`) — valores hex são *dados* (input do admin), não estilo.
5. **Overlays de Dialog/Drawer/Sheet** (`bg-black/70`) — primitivos shadcn.
6. **Scanner de câmera** (`FiscalChaveScannerDialog`) — `bg-black` é a
   moldura do vídeo.

## Auditoria contínua

```bash
rg -n --no-heading -g '*.tsx' \
  "(text|bg|border)-(green|red|blue|yellow|amber|orange|purple|pink|indigo)-[0-9]" \
  src/components src/pages
```

Resultado deve ficar vazio (ou apenas exceções listadas acima).