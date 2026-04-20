# Modelo Suprimentos & Logística

## Domínios separados

| Domínio | Tabela canônica | Responsável pelo status |
|---|---|---|
| Compra (administrativo) | `pedidos_compra.status` | módulo Compras |
| Recebimento (logística de entrada) | `recebimentos_compra.status_logistico` + `vw_recebimentos_consolidado` | módulo Logística |
| Remessa (transporte físico) | `remessas.status_transporte` | módulo Logística |
| Entrega (visão consolidada por OV) | `vw_entregas_consolidadas.status_consolidado` (derivado) | view |
| Estoque | `estoque_movimentos.tipo` | módulo Estoque |

## Status canônicos

### Recebimento (logística)
`pedido_emitido · aguardando_envio_fornecedor · em_transito · recebimento_parcial · recebido · recebido_com_divergencia · atrasado · cancelado`

- `atrasado` é derivado por `get_recebimento_status_efetivo` (não persistido).
- `recebido_com_divergencia` quando `tem_divergencia=true`.

### Remessa (transporte)
`pendente · coletado · postado · em_transito · ocorrencia · entregue · devolvido · cancelado`

CHECK: `chk_remessa_status_transporte`. Trigger bloqueia saída de `entregue/devolvido/cancelado`.

### Entrega consolidada (derivada)
Calculada por `vw_entregas_consolidadas` a partir de TODAS as remessas ativas da OV:

| Condição | Status |
|---|---|
| Sem remessas | `aguardando_separacao` |
| Todas canceladas | `cancelado` |
| Alguma com ocorrência | `ocorrencia` |
| Todas entregues | `entregue` |
| Algumas entregues | `entrega_parcial` |
| Alguma em trânsito | `em_transporte` |
| Alguma postada/coletada | `aguardando_expedicao` |
| Demais | `aguardando_separacao` |

`transportadora_principal` = remessa de maior peso (regra determinística).

## Estoque — política de ajustes manuais

- Tipos críticos: `ajuste`, `perda_avaria`, `inventario`.
- Exigem `categoria_ajuste` ∈ (`correcao_inventario`, `perda`, `avaria`, `vencimento`, `furto_extravio`, `divergencia_recebimento`, `outro`) e `motivo_estruturado` ≥ 10 chars.
- Permitidos apenas para roles `admin` ou `estoquista` (gate na RPC `ajustar_estoque_manual`).
- Registrados em `auditoria_logs` com ação `ajuste_critico`.

## Recebimento — fluxo

1. RPC `registrar_recebimento_compra(pedido, data, itens[], obs, nf, compra)` cria `recebimentos_compra` + itens em transação com `pg_advisory_xact_lock`.
2. Trigger marca `tem_divergencia` quando `quantidade_recebida <> quantidade_pedida_snapshot`.
3. `vw_recebimentos_consolidado` agrega todos os recebimentos por pedido para a UI.

## Trilha

`v_trilha_logistica` une `ordem_venda → remessas` e `pedido_compra → recebimentos_compra → compras`.