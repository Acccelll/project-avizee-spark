

## Revisão estrutural do módulo Comercial — Execução

Aplicar o plano aprovado em 8 migrations idempotentes + ajustes de front alinhando banco, RPCs e UI ao vocabulário canônico.

### Migrations (ordem)

1. **`padronizar_status_orcamento`** — recria `chk_orcamentos_status` com `(rascunho, pendente, aprovado, convertido, rejeitado, cancelado, expirado)`; `UPDATE` normalizando `confirmado`/`enviado` → `pendente`; trigger `trg_orcamento_transicao_valida` bloqueando transições inválidas; RPC `expirar_orcamentos_vencidos()`.
2. **`protecao_exclusao_orcamento`** — trigger `trg_orcamento_protege_delete` (só permite DELETE em `rascunho` e sem OV vinculada); RPC `cancelar_orcamento(p_id, p_motivo)`.
3. **`pedido_status_integridade`** — drop `chk_ordens_venda_status_fat` duplicado; `chk_ordens_venda_matriz_status` (matriz operacional × faturamento); trigger `trg_pedido_status_auto` recalcula ao emitir NF.
4. **`converter_orcamento_em_ov_v2`** — `CREATE OR REPLACE`: gate `status='aprovado'` (com bypass `p_forcar`); `UNIQUE INDEX ux_ordens_venda_cotacao_id`; grava em `auditoria_logs`.
5. **`gerar_nf_de_pedido_v2`** — `CREATE OR REPLACE`: `pg_advisory_xact_lock`, gate operacional, `INSERT` em `nota_fiscal_eventos`, retorno com `status_faturamento_novo`.
6. **`trilha_comercial_integridade`** — FKs `cotacao_id` e `ordem_venda_id` com `ON DELETE RESTRICT`; índices em `cotacao_id`, `ordem_venda_id`, `(cliente_id,status)`; view `v_trilha_comercial`.
7. **`orcamento_condicoes_comerciais_checks`** — `chk_orcamento_frete_tipo`, `chk_orcamento_modalidade`; `transportadora_id` com `ON DELETE SET NULL`.
8. **`auditoria_comercial_triggers`** — trigger `trg_auditoria_orcamento_status` em `AFTER UPDATE` gravando `{antes, depois, usuario, contexto}` em `auditoria_logs`.

Todas com `SET search_path = public`, idempotentes (`IF NOT EXISTS`, `DROP ... IF EXISTS` antes de `CREATE`), preservando dados.

### Código afetado

- `src/lib/statusSchema.ts` — `statusOrcamento` passa a ter só o conjunto canônico (7 valores); `statusPedido` realinhado a `rascunho|pendente|aprovada|em_separacao|faturada_parcial|faturada|cancelada`.
- `src/lib/orcamentoSchema.ts` — enum Zod com os 7 status canônicos.
- `src/lib/comercialWorkflow.ts` — remover `ORCAMENTO_STATUS_ALIAS`; `canApproveOrcamento` testa `'pendente'`; `canConvertOrcamento` mantém `'aprovado'`.
- `src/services/orcamentos.service.ts` — `sendForApproval` grava `'pendente'`; nova `cancelarOrcamento(id, motivo)` chamando a RPC.
- `src/pages/comercial/hooks/useConverterOrcamento.ts` — tolera retorno enriquecido (sem mudança de assinatura pública).
- `src/pages/comercial/hooks/useFaturarPedido.ts` — usa `status_faturamento_novo` do retorno para update otimista.
- `src/components/views/OrcamentoView.tsx` e `src/pages/Orcamentos.tsx` — ação "Excluir" só aparece em `rascunho` sem OV; caso contrário, "Cancelar" abre modal de motivo.
- `src/components/StatusBadge.tsx` / `statusFaturamentoLabels` — remover labels órfãs (`confirmado`, `enviado`, `em_transporte`, `separado`, `entregue`).
- `docs/comercial-modelo.md` (novo) — documenta: cotação = `orcamentos`; fluxos oficiais; política de exclusão; matriz de status do pedido; trilha `v_trilha_comercial`.
- `docs/MIGRACAO.md` — apêndice com as 8 migrations e backfills aplicados.

### Detalhes técnicos

- **Transição válida de orçamento** (trigger): mapa de `OLD.status → NEW.status permitidos`; bloqueia qualquer saída de terminal (`convertido`, `rejeitado`, `cancelado`, `expirado`).
- **Matriz pedido** (CHECK composto): conforme tabela do plano; `em_separacao` aceita `aguardando|parcial` porque faturamento parcial pode ocorrer durante separação.
- **Auditoria**: payload JSONB com `{ antes:{status}, depois:{status}, usuario:auth.uid(), contexto:'trigger|rpc:<nome>' }`.
- **Compatibilidade**: `forma_pagamento_padrao` e demais colunas legadas não sofrem alteração; nenhum DROP de coluna; `statusOrdemVenda` alias mantido para não quebrar imports.

### Relatório pós-execução

Após aplicar, reportar: migrations aplicadas, contagem de orçamentos renomeados (`confirmado`/`enviado` → `pendente`), contagem de marcados como `expirado`, orçamentos bloqueados para DELETE, e entradas criadas em `auditoria_logs`.

### Fora de escopo

Nenhuma mudança visual além dos botões condicionais de exclusão/cancelamento; sem alterações em RLS, fiscal, financeiro ou estoque além dos gates listados.

