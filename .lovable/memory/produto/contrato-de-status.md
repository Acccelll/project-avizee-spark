---
name: Contrato de Status (transversal)
description: Doutrina única de status de domínio do ERP — grafia, variant e regra de adição
type: feature
---

# Contrato de Status — Fonte Única

**Regra**: todo novo status entra **primeiro** em `src/types/ui.ts`
(`STATUS_VARIANT_MAP`) e em `src/components/StatusBadge.tsx`
(`statusMeta` para ícone/label). Só depois pode ser referenciado em
`src/lib/statusSchema.ts` (que apenas alimenta `MultiSelect` de filtros).

`STATUS_VARIANT_MAP` é a **única** fonte de cor (`StatusVariant`).
Schemas em `statusSchema.ts` devem usar `color` consistente com o variant
canônico para o mesmo conceito.

## Tabela canônica (módulo × conceito → grafia → variant)

| Conceito | Módulo | Grafia canônica | Variant |
|---|---|---|---|
| Aprovado | Orçamento | `aprovado` | `success` |
| Aprovado | Pedido | `aprovada` | `success` |
| Aprovado | Cotação Compra | `aprovada` | `success` |
| Aprovado | Pedido Compra | `aprovado` | `success` |
| Pendente | Orçamento | `pendente` | `warning` |
| Pendente | Pedido | `pendente` | `warning` |
| Pendente | NF | `pendente` | `warning` |
| Em aberto | Financeiro | `aberto` | `warning` |
| Cancelado | Orçamento/Pedido/NF/Compra/Remessa | `cancelado`/`cancelada` | `destructive` |
| Cancelado | Financeiro (lançamento não pago) | `cancelado` | `muted` (exceção documentada) |
| Faturado | Pedido | `faturada` | `success` |
| Faturado | (canônico transversal) | `faturado` | `primary` |
| Em movimento | Pedido | `em_separacao` | `warning` |
| Em movimento | Cotação Compra | `em_analise` | `info` |
| Em movimento | Logística | `em_transito` | `info` |

## Aliases conhecidos

`comprasStatus.ts` mantém apenas aliases de Compras
(ex: `finalizada → aprovada`, `recebido_parcial → parcialmente_recebido`).
Não criar arquivos `pedidosStatus.ts` / `fiscalStatus.ts` análogos —
helpers de transição vão em hooks (`useTransicionarRemessa` etc).

## Checklist ao adicionar status

1. Adiciona em `STATUS_VARIANT_MAP` (cor).
2. Adiciona em `statusMeta` do `StatusBadge` (ícone + label PT-BR).
3. Se for filtrável, adiciona no schema correspondente em `statusSchema.ts`
   reusando o mesmo `color` (string equivalente ao variant).
4. Se houver transição (`em_movimento → entregue`), implementar no hook
   de transição do módulo, não em util global.