# Módulo Compras — Modelo Estrutural

## Status canônicos

**Cotação de Compra:** `rascunho · aberta · em_analise · aguardando_aprovacao · aprovada · convertida · rejeitada · cancelada`

**Pedido de Compra:** `rascunho · aguardando_aprovacao · aprovado · enviado_ao_fornecedor · aguardando_recebimento · parcialmente_recebido · recebido · cancelado`

## Máquina de estados

### Cotação
```
rascunho → aberta → em_analise → aguardando_aprovacao
                                       ├─ aprovada → convertida (RPC gerar_pedido_compra)
                                       └─ rejeitada (terminal)
qualquer não-terminal → cancelada (RPC cancelar_cotacao_compra)
```
Terminais: `convertida`, `rejeitada`, `cancelada`. Validação por `trg_cotacao_compra_transicao`.

### Pedido
```
rascunho → aguardando_aprovacao → aprovado → enviado_ao_fornecedor → aguardando_recebimento
                                                       ↓
                                  parcialmente_recebido (loop) → recebido (terminal)
qualquer não-terminal (até aguardando_recebimento) → cancelado
```
Terminais: `recebido`, `cancelado`. Validação por `trg_pedido_compra_transicao`.

## Política de exclusão/cancelamento de cotação
- DELETE físico apenas em `rascunho` sem pedido vinculado (`trg_cotacao_compra_protege_delete`).
- Em qualquer outro caso, usar `cancelar_cotacao_compra(p_id, p_motivo)`.

## Política de recebimento
- `receber_compra` aceita pedidos em `aprovado | enviado_ao_fornecedor | aguardando_recebimento | parcialmente_recebido`.
- Lock por `pg_advisory_xact_lock` impede recebimentos concorrentes.
- Quantidade recebida não pode exceder saldo pendente (`quantidade - quantidade_recebida`).
- Status do pedido recalculado: `recebido` se total ≥ pedido, senão `parcialmente_recebido`.
- Estorno via `estornar_recebimento_compra(p_compra_id, p_motivo)` devolve estoque e recalcula `quantidade_recebida`.

## RPCs
| Função | Gate | Idempotência | Auditoria |
|---|---|---|---|
| `gerar_pedido_compra` | cotação `aprovada` | `ux_pedidos_compra_cotacao_id` | sim |
| `receber_compra` | pedido em status de recebimento | `pg_advisory_xact_lock` | sim |
| `estornar_recebimento_compra` | compra ≠ `cancelada` | lock por pedido | sim |
| `replace_pedido_compra_itens` | pedido em `rascunho/aguardando_aprovacao/aprovado` | recalc total | — |
| `cancelar_cotacao_compra` | cotação não-terminal | — | sim |

## Rastreabilidade
- `pedidos_compra_itens.proposta_selecionada_id` → `cotacoes_compra_propostas.id`.
- View `v_trilha_compras` (security_invoker): cotação → pedido → fornecedor → compra (recebimento).

## Compatibilidade
- `pedidos_compra.condicoes_pagamento` (plural) marcada como **DEPRECATED**; usar `condicao_pagamento` (singular).
- Aliases `finalizada→aprovada` e `recebido_parcial→parcialmente_recebido` mantidos como leitura defensiva no front (`comprasStatus.ts`), mas o banco já não aceita os valores legados.