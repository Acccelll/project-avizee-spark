# Modelo Comercial — Referência Estrutural

## Entidade única: Cotação = Orçamento

A tabela `orcamentos` é a entidade única. "Cotação" e "Orçamento" são sinônimos na UI.

## Fluxo oficial de status do Orçamento

O orçamento é o pedido: quando o cliente envia o número do pedido (ou OC),
"Registrar pedido" grava o número e muda o status para `aprovado`, exibido
como **Pedido**. Não há etapa de aprovação interna nem Ordem de Venda no meio.

```
rascunho ──(registrar_pedido_orcamento)──► aprovado ("Pedido")
   │                                          ▲
   └─► pendente ("Enviado") ──────────────────┘
            ↘ rejeitado ("Recusado", terminal)
qualquer não-terminal → cancelado (terminal)
pendente com validade vencida → expirado (terminal)
pendente → rascunho (devolver para edição)
aprovado → convertido (legado: OV criada por converter_orcamento_em_ov)
```

Status canônicos: `rascunho | pendente | aprovado | convertido | rejeitado | cancelado | expirado | historico`

Dados do pedido em `orcamentos`: `pedido_cliente` (sem número do cliente,
recebe o próprio número do orçamento), `data_pedido_cliente`,
`previsao_despacho`, `pedido_anexo_path` (bucket `orcamentos-pdf`,
pasta `<orcamento_id>/pedido-cliente/`), `pedido_registrado_em/por` e
`faturamento_status` (`aberto | parcial | faturado | encerrado`).

Com status `aprovado` os itens ficam travados; ajustes só por
`criar_revisao_orcamento`. Quando a revisão vira pedido, a versão anterior
que já era pedido é cancelada.

## Vínculo NF ↔ pedido

As NFs de saída são emitidas fora do ERP (Sebrae) e importadas pelo XML. A
importação lê o número do pedido (`prod/xPed` dos itens e "PEDIDO:", "OC:",
"PC:" ou "ORC…" em `infCpl`), grava em `notas_fiscais.referencias_pedido` e
chama `vincular_nf_automatico`:

1. pedido do cliente igual a uma referência (`xml_pedido`), mesmo cliente pela raiz do CNPJ;
2. número do orçamento igual a uma referência (`xml_orcamento`);
3. sem referência que bata: mesmo valor vira só **sugestão** (`sugerir_pedidos_nf`).

`orcamento_nf_vinculos` (nota ↔ orçamento) e `orcamento_nf_vinculo_itens`
(item da nota ↔ item do pedido, com quantidade) guardam o vínculo. Uma nota
pode atender vários pedidos e um pedido pode ter várias notas.
`vw_orcamento_itens_saldo` dá pedido, faturado e saldo por item; nota
cancelada não conta. `orcamentos.faturamento_status` é recalculado a cada
vínculo, desvínculo ou cancelamento de nota (`aberto → parcial → faturado`);
`encerrado` vem de `encerrar_saldo_orcamento`.

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

- `registrar_pedido_orcamento(p_id, p_pedido_cliente, p_data_pedido, p_previsao_despacho, p_anexo_path)` — rascunho/pendente → `aprovado`, grava o pedido do cliente, encerra a versão anterior numa revisão, auditoria.
- `vincular_nf_orcamento`, `desvincular_nf_orcamento`, `vincular_nf_automatico`, `sugerir_pedidos_nf`, `encerrar_saldo_orcamento` — vínculo NF ↔ pedido e saldo.
- `atualizar_pedido_orcamento(...)` — edita número, datas e anexo de um pedido já registrado, sem mexer nos itens.
- `converter_orcamento_em_ov(p_orcamento_id, p_po_number, p_data_po, p_forcar)` — gate `aprovado`, idempotente, auditoria.
- `gerar_nf_de_pedido(p_pedido_id)` — advisory lock, gate operacional, retorna `status_faturamento_novo`.
- `cancelar_orcamento(p_id, p_motivo)` — cancelamento lógico com auditoria.
- `expirar_orcamentos_vencidos()` — marca expirados (para cron).

## Auditoria

Trigger `trg_auditoria_orcamento_status` grava toda mudança de status em `auditoria_logs`.
RPCs de conversão, faturamento e cancelamento também gravam logs.