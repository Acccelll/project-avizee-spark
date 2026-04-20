# Formas de Pagamento — Modelagem

## Separação semântica

| Campo | Papel |
|-------|-------|
| `tipo` | **Categoria do meio de pagamento**. Valores oficiais validados por CHECK: `pix`, `boleto`, `cartao`, `dinheiro`, `transferencia`, `outro`. |
| `descricao` | **Condição comercial** exibida ao usuário (ex.: "Boleto 30/60/90", "Pix à vista", "Cartão 3x sem juros"). |
| `parcelas` / `prazo_dias` / `intervalos_dias` | Configuração de parcelamento usada pelo financeiro. |
| `gera_financeiro` | Se a forma gera automaticamente títulos em `financeiro_lancamentos`. |

## Referência única por ID

Todas as tabelas que mencionam forma de pagamento devem referenciar `formas_pagamento.id`, não texto:

- `clientes.forma_pagamento_id` (FK oficial) — coluna legada `forma_pagamento_padrao` está marcada como `DEPRECATED`.
- `financeiro_lancamentos.forma_pagamento_id` (FK oficial) — coluna textual `forma_pagamento` mantida apenas como fallback visual.

## Backfill

O backfill casa a descrição textual legada com `formas_pagamento.descricao` (case-insensitive, ignorando espaços). Matches únicos são aplicados automaticamente; casos sem match ou ambíguos ficam registrados em `cadastros_pendencias_migracao` para tratamento manual por um admin.

## Verificação pós-migração

```sql
SELECT motivo, count(*) FROM cadastros_pendencias_migracao
 WHERE campo = 'forma_pagamento_padrao'
 GROUP BY motivo;
```