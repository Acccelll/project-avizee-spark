# Modelo Comercial — Referência Estrutural

## Entidade única: Cotação = Orçamento

A tabela `orcamentos` é a entidade única. "Cotação" e "Orçamento" são sinônimos na UI.

## Fluxo oficial de status do Orçamento

```
rascunho → pendente → aprovado → convertido (terminal)
                  ↘ rejeitado (terminal)
qualquer não-terminal → cancelado (terminal)
qualquer não-terminal com validade vencida → expirado (terminal)
pendente → rascunho (devolver para edição)
```

Status canônicos: `rascunho | pendente | aprovado | convertido | rejeitado | cancelado | expirado`

## Política de exclusão

- DELETE físico: **somente** `rascunho` sem pedido vinculado.
- Demais casos: usar `cancelar_orcamento(p_id, p_motivo)` (cancelamento lógico com auditoria).
- Trigger `trg_orcamento_protege_delete` impede exclusão indevida.

## Status do Pedido (ordens_venda)

| Operacional      | Faturamento válido        |
|------------------|---------------------------|
| rascunho         | aguardando                |
| pendente         | aguardando                |
| aprovada         | aguardando                |
| em_separacao     | aguardando, parcial       |
| faturada_parcial | parcial                   |
| faturada         | faturado                  |
| cancelada        | qualquer                  |

Constraint: `chk_ordens_venda_matriz_status`

## Trilha relacional

`orcamentos` ←(cotacao_id)→ `ordens_venda` ←(ordem_venda_id)→ `notas_fiscais`

View `v_trilha_comercial` consolida orçamento + pedido + NF + cliente para consulta rápida.

## RPCs principais

- `converter_orcamento_em_ov(p_orcamento_id, p_po_number, p_data_po, p_forcar)` — gate `aprovado`, idempotente, auditoria.
- `gerar_nf_de_pedido(p_pedido_id)` — advisory lock, gate operacional, retorna `status_faturamento_novo`.
- `cancelar_orcamento(p_id, p_motivo)` — cancelamento lógico com auditoria.
- `expirar_orcamentos_vencidos()` — marca expirados (para cron).

## Auditoria

Trigger `trg_auditoria_orcamento_status` grava toda mudança de status em `auditoria_logs`.
RPCs de conversão, faturamento e cancelamento também gravam logs.