

## Revisão estrutural do módulo Compras

Plano em duas frentes: (A) **2 correções de build bloqueantes** alheias ao módulo, e (B) revisão estrutural do módulo Compras alinhando banco, RPCs e front a um vocabulário canônico único, com base no estado real verificado no Postgres.

---

### Parte A — Correções de build (bloqueantes)

**A1.** `src/pages/financeiro/hooks/useConciliacaoBancaria.ts:95` — cast direto de `(SelectQueryError | …)[]` para `Record<string, unknown>[]` falha. Trocar por `(data as unknown as Array<Record<string, unknown>>) ?? []`.

**A2.** `src/services/financeiro/conciliacao.service.ts:230` — RPC `financeiro_conciliar_baixa` não existe nos tipos gerados. Como já há um cast `as any` em outra chamada análoga no arquivo, aplicar o mesmo padrão: `(supabase.rpc as any)("financeiro_conciliar_baixa", {...})`. (Não criar a função; o nome real precisa ser confirmado em outra rodada — fora do escopo deste módulo.)

---

### Parte B — Compras (estrutural)

#### B1. Vocabulário oficial — Cotação de compra

Conjunto canônico **alinhado ao banco** + ampliação controlada via novo CHECK:

`rascunho · aberta · em_analise · aguardando_aprovacao · aprovada · convertida · rejeitada · cancelada`

Decisão: **`finalizada` é eliminado** (alias antigo de `aprovada`). `aprovada` é o estado de decisão; `convertida` é terminal pós-geração de pedido.

**Migration `compras_cotacao_status_canonico`:**
- `UPDATE cotacoes_compra SET status='aprovada' WHERE status='finalizada'`.
- DROP `chk_cotacoes_compra_status` antigo; CREATE com o conjunto acima.
- Trigger `trg_cotacao_compra_transicao` valida a máquina de estados (mapa abaixo) e bloqueia saída de terminais (`convertida`, `cancelada`, `rejeitada`).
- Trigger `trg_cotacao_compra_protege_delete` impede DELETE quando `status <> 'rascunho'` OU quando há `pedidos_compra.cotacao_compra_id = id`.
- RPC `cancelar_cotacao_compra(p_id, p_motivo)` para cancelamento lógico (front substitui o "Excluir" por "Cancelar" fora de `rascunho`).

Máquina de estados oficial:

```text
rascunho → aberta → em_analise → aguardando_aprovacao
                                       ├─ aprovada → convertida   (via RPC gerar_pedido_compra)
                                       └─ rejeitada                (terminal)
qualquer não-terminal → cancelada                                  (via RPC cancelar_cotacao_compra)
```

#### B2. Vocabulário oficial — Pedido de compra

Conjunto canônico:

`rascunho · aguardando_aprovacao · aprovado · enviado_ao_fornecedor · aguardando_recebimento · parcialmente_recebido · recebido · cancelado`

Decisão: **`recebido_parcial` → `parcialmente_recebido`** (forma plena adotada). **`enviado` (legado) → `enviado_ao_fornecedor`**. Mantém `enviado_ao_fornecedor` e `aguardando_recebimento` separados: o primeiro é ato (PO emitida ao fornecedor), o segundo é estado de espera após confirmação do fornecedor — usado opcionalmente; transição automática se o fornecedor responder ou após X dias (decisão operacional, sem trigger).

**Migration `compras_pedido_status_canonico`:**
- `UPDATE pedidos_compra SET status='parcialmente_recebido' WHERE status='recebido_parcial'`.
- `UPDATE pedidos_compra SET status='enviado_ao_fornecedor' WHERE status='enviado'`.
- DROP `chk_pedidos_compra_status` antigo; CREATE com o conjunto canônico acima.
- Trigger `trg_pedido_compra_transicao` valida transições (mapa abaixo) e bloqueia saída de `recebido` e `cancelado`.

Máquina de estados oficial:

```text
rascunho → aguardando_aprovacao → aprovado → enviado_ao_fornecedor → aguardando_recebimento
                                  └────────────────────────────────────────────┘
                                                     │
                                  ┌──────────────────┴──────────────────┐
                                  ▼                                     ▼
                            parcialmente_recebido (loop)             recebido (terminal)
qualquer não-terminal → cancelado
```

Cancelamento permitido até `aguardando_recebimento`. Após início de recebimento, só `estornar_recebimento_compra`.

#### B3. RPC `gerar_pedido_compra` — reforços

Reescrita via `CREATE OR REPLACE`:
- **Gate**: aceitar apenas `cotacoes_compra.status = 'aprovada'`.
- **Validação**: para cada item da cotação, exigir ao menos uma proposta com `selecionado=true AND preco_unitario > 0`. Caso contrário, `RAISE EXCEPTION`.
- **Idempotência**: `UNIQUE INDEX ux_pedidos_compra_cotacao_id ON pedidos_compra(cotacao_compra_id) WHERE cotacao_compra_id IS NOT NULL`. Se já existe pedido para a cotação, retorna o `pedido_id` existente em vez de duplicar.
- **Status final cotação**: `convertida`.
- **Status inicial pedido**: `aprovado` (mantém).
- **Auditoria**: `INSERT INTO auditoria_logs (entidade, entidade_id, acao, payload)` com `acao='gerar_pedido_compra'`.

#### B4. RPC `receber_compra` — reforços

`CREATE OR REPLACE`:
- **Gate**: aceitar `IN ('aprovado','enviado_ao_fornecedor','aguardando_recebimento','parcialmente_recebido')` apenas (remover `rascunho` e `enviado` legado).
- **Lock**: `pg_advisory_xact_lock(hashtext(p_pedido_id::text))` para impedir duplicação concorrente.
- **Validação**: rejeitar `quantidade_recebida` que excede `quantidade - quantidade_recebida` do item.
- **Status final**: usa `parcialmente_recebido` (não `recebido_parcial`).
- **Auditoria**: registra evento.

#### B5. RPC `estornar_recebimento_compra` — alinhamento

`CREATE OR REPLACE`:
- Substitui `'recebido_parcial'` por `'parcialmente_recebido'` no recálculo.
- Usa novo `pg_advisory_xact_lock`.
- Auditoria.

#### B6. Substituição de itens — `replace_pedido_compra_itens`

`CREATE OR REPLACE`:
- **Gate**: bloqueia execução se `pedido.status NOT IN ('rascunho','aguardando_aprovacao','aprovado')` (não permite editar itens após envio/recebimento).
- **Recalcula `valor_total`** do cabeçalho ao final (hoje só insere itens, deixa header desatualizado).
- Mantém transacionalidade; preserva `quantidade_recebida` se item ainda existe (matching por `produto_id`).

#### B7. Modelagem — duplicidade `condicao_pagamento` vs `condicoes_pagamento`

`pedidos_compra` tem **as duas colunas**. Decisão: **`condicao_pagamento` (singular)** é canônica.

**Migration `pedidos_compra_condicao_pagamento_consolidar`:**
- `UPDATE pedidos_compra SET condicao_pagamento = COALESCE(condicao_pagamento, condicoes_pagamento)`.
- `COMMENT ON COLUMN pedidos_compra.condicoes_pagamento IS 'DEPRECATED: usar condicao_pagamento'`.
- **Não dropa** a coluna nesta fase (preserva compatibilidade); front passa a ler/gravar só a singular.

#### B8. Integridade relacional — FKs e índices faltantes

**Migration `compras_integridade_relacional`:**
- `ux_cotacao_propostas_item_fornecedor` UNIQUE(`item_id`,`fornecedor_id`) — impede proposta duplicada do mesmo fornecedor para o mesmo item.
- `idx_cotacao_propostas_cotacao_id` em `cotacoes_compra_propostas(cotacao_compra_id)`.
- `idx_pedidos_compra_cotacao_id` em `pedidos_compra(cotacao_compra_id)`.
- `idx_pedidos_compra_fornecedor_status` em `(fornecedor_id, status)`.
- `idx_compras_pedido_id` em `compras(pedido_compra_id)`.
- `pedidos_compra.cotacao_compra_id` FK já existe com `ON DELETE SET NULL` — manter (alinhado a "cotação preservada se pedido for excluído").
- Adicionar coluna `proposta_selecionada_id uuid REFERENCES cotacoes_compra_propostas(id) ON DELETE SET NULL` em `pedidos_compra_itens` para rastreabilidade direta proposta→item-pedido (preenchida pela RPC v2).

#### B9. Auditoria mínima

Reusar `auditoria_logs` (já existe). Pontos de gravação **dentro das RPCs** (sem trigger global):
- `cotacao_compra:status_change` — trigger `AFTER UPDATE OF status ON cotacoes_compra`.
- `pedido_compra:status_change` — trigger `AFTER UPDATE OF status ON pedidos_compra`.
- `gerar_pedido_compra`, `receber_compra`, `estornar_recebimento_compra`, `cancelar_cotacao_compra` — `INSERT` direto.

Payload JSONB: `{ antes, depois, usuario: auth.uid(), contexto }`.

#### B10. View de rastreabilidade

`v_trilha_compras` (read-only, security_invoker): `cotacao_id, cotacao_numero, pedido_id, pedido_numero, fornecedor, compra_id (recebimento), nf_compra_id, financeiro_lancamento_id, valores, status_atual` — espelho do `v_trilha_comercial` adotado em vendas.

---

### Migrations entregues (ordem)

1. `compras_cotacao_status_canonico` — backfill `finalizada→aprovada`, novo CHECK, trigger transição, trigger anti-delete, RPC `cancelar_cotacao_compra`.
2. `compras_pedido_status_canonico` — backfill `recebido_parcial→parcialmente_recebido` e `enviado→enviado_ao_fornecedor`, novo CHECK, trigger transição.
3. `compras_gerar_pedido_v2` — `gerar_pedido_compra` reescrita + UNIQUE INDEX cotacao_id.
4. `compras_receber_v2` — `receber_compra` + `estornar_recebimento_compra` reescritas com gates novos.
5. `compras_replace_itens_v2` — `replace_pedido_compra_itens` com gate de status e recálculo de header.
6. `compras_pedido_condicao_pagamento_consolidar` — backfill + comment de deprecação.
7. `compras_integridade_relacional` — índices, UNIQUE de propostas, coluna `proposta_selecionada_id`.
8. `compras_auditoria_triggers` — triggers de log de status em cotação e pedido.

Todas com `SET search_path = public`, idempotentes (`DROP ... IF EXISTS` antes de `CREATE`, `IF NOT EXISTS` em índices/colunas), preservando dados.

---

### Código afetado

- **A1/A2:** `src/pages/financeiro/hooks/useConciliacaoBancaria.ts`, `src/services/financeiro/conciliacao.service.ts`.
- `src/components/compras/comprasStatus.ts` — remover `COTACAO_STATUS_ALIAS` (`finalizada` deixa de existir nos dados); `PEDIDO_STATUS_ALIAS` mantém `recebido_parcial→parcialmente_recebido` apenas como leitura defensiva (compat de dados pré-migration); `pedidoCanReceive` passa a usar a forma plena.
- `src/lib/statusSchema.ts` — `statusCotacaoCompra`: remover `finalizada`; adicionar `em_analise`, `aguardando_aprovacao`, `rejeitada`. `statusPedidoCompra`: remover `enviado` legado; adicionar `aguardando_aprovacao`, `rejeitado` se necessário (ou remover do label map se não fizer parte do CHECK — decisão: **não** existem como status de pedido, removê-los).
- `src/lib/cotacaoCompraSchema.ts` — Zod enum atualizado; `validateCotacaoItems` ganha checagem de propostas selecionadas (cliente-side).
- `src/lib/pedidoCompraSchema.ts` — Zod enum atualizado.
- `src/components/views/CotacaoCompraDrawer.tsx` e `src/pages/CotacoesCompra.tsx` — botão "Excluir" só em `rascunho` sem pedido vinculado; senão "Cancelar" abre modal de motivo, chama `cancelar_cotacao_compra`.
- `src/components/views/PedidoCompraDrawer.tsx` — edição de itens só nos estados permitidos por B6.
- `src/pages/comercial/hooks/useReceberCompra.ts` — toast usa `parcialmente_recebido`.
- `src/components/compras/PedidoCompraFormModal.tsx` — formulário grava só `condicao_pagamento`.
- `src/hooks/useNotificationDetails.ts` — `.in('status', [...])` realinhado ao vocabulário canônico.
- `src/pages/logistica/logisticaStatus.ts` — `normalizeRecebimentoStatus` simplificado (não precisa mais aceitar `recebido_parcial`).

### Documentação

- `docs/compras-modelo.md` (novo): status canônicos, máquinas de estado (cotação e pedido), políticas de exclusão/cancelamento, política de recebimento parcial/total, view `v_trilha_compras`.
- `docs/MIGRACAO.md` apêndice com as 8 migrations.

### Relatório pós-execução

- migrations aplicadas;
- contagens: cotações renomeadas (`finalizada→aprovada`), pedidos renomeados (`recebido_parcial→parcialmente_recebido`, `enviado→enviado_ao_fornecedor`);
- pedidos com `cotacao_compra_id` duplicado detectados (se houver, listar para decisão manual);
- pedidos cuja `condicao_pagamento` foi preenchida via backfill;
- entradas iniciais em `auditoria_logs`.

### Pontos de atenção manual

- Cotações em `aberta` há muito tempo: avaliar reabertura/cancelamento conforme regra operacional.
- Pedidos em `enviado` (legado) cuja transição correta seria `aguardando_recebimento` em vez de `enviado_ao_fornecedor` — backfill conservador adota `enviado_ao_fornecedor`; revisão manual opcional.
- Eventuais propostas duplicadas `(item_id, fornecedor_id)` que impeçam o UNIQUE: relatório listará.

### Fora de escopo

- Mudança visual além dos botões condicionais "Excluir/Cancelar" e validação extra no formulário.
- Alteração em RLS, fiscal, financeiro ou estoque além dos gates listados.
- DROP de `condicoes_pagamento` (apenas marcado como DEPRECATED nesta fase).

