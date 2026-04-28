---
name: DataTable - coluna única "Ações"
description: Toda lista usa a coluna automática do DataTable; botões contextuais via rowExtraActions, nunca uma 2ª coluna manual chamada "Ações"
type: preference
---

# Coluna única "Ações" no DataTable

**Regra**: o `<DataTable>` já gera **uma única** coluna "Ações" quando
recebe `onView`/`onEdit`/`onDelete`/`onDuplicate`. **É proibido** declarar
uma segunda coluna chamada "Ações" dentro do array `columns`.

## Como adicionar botões contextuais

Use a prop `rowExtraActions={(item) => ReactNode}` do `DataTable`. Esses
botões são renderizados dentro da coluna automática, à direita do
ícone "Visualizar" e antes do menu overflow `⋮` (que agrupa Editar,
Duplicar, Excluir).

**Why:** evita duas colunas com o mesmo título (Lançamentos, Orçamentos,
Pedidos, Logística, PedidoCompraTable já tinham esse problema antes da
refatoração de 2026-04-28).

**How to apply:**
- Sempre use `rowExtraActions` para "Baixar", "Aprovar", "Gerar Pedido",
  "Receber", "Enviar NF" e similares.
- Nas linhas, sempre fazer `e.stopPropagation()` no `onClick` para não
  disparar o `onRowClick`/`onView`.
- Mobile mantém o padrão atual via `mobilePrimaryAction` (botão
  full-width no card) — não migra para `rowExtraActions`.

## Antipadrões

- Coluna `{ key: "acoes_*", label: "Ações", render: ... }` no array de
  colunas quando o DataTable já tem `onView`/`onEdit` (gera 2 colunas
  com mesmo título).
- Botões de "Visualizar" duplicados no `rowExtraActions` — já existe via
  `onView`.