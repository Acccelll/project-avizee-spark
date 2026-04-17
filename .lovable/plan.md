

User aprovou execução completa das 8 fases. Plano confirmado da última proposta:

**Fase 1** — Tabela `comentarios` polimórfica + RLS (autor edita/deleta, admin tudo)
**Fase 2** — Workflow aprovação pedidos compra: colunas + 3 RPCs + UI
**Fase 3** — `quantidade_recebida` em `pedidos_compra_itens` + ajuste `receber_compra` + `RecebimentoDrawer`
**Fase 4** — Triggers anti-delete em `contas_bancarias` e `contas_contabeis`
**Fase 5** — Triggers de auditoria em `empresa_config` e `app_configuracoes`
**Fase 6** — Índices de performance (validar via `pg_indexes` antes)
**Fase 7** — `orcamento_drafts` server-side + refator autosave em `OrcamentoForm`
**Fase 8** — `hash_conteudo` em `importacao_lotes` (verificar existência primeiro)

# Execução

## Ordem
1 → 4 → 5 → 6 → 8 → 3 → 7 → 2 (DDL/triggers primeiro, refatores de UI por último)

## Validações pré-execução
- `pg_indexes` para Fase 6 (não duplicar)
- Existência de `importacao_lotes` para Fase 8
- Ler RPC `receber_compra` completa para Fase 3
- Ler `OrcamentoForm.tsx` autosave atual para Fase 7
- Ler `usePedidosCompra.ts` para Fase 2

## Migrations (consolidadas em arquivos por fase)
- Fase 1: tabela `comentarios` + 4 policies RLS + índice
- Fase 2: ALTER `pedidos_compra` (4 colunas) + 3 RPCs + insert config `compras.limite_aprovacao`
- Fase 3: ALTER `pedidos_compra_itens` + UPDATE RPC `receber_compra`
- Fase 4: 1 função + 2 triggers
- Fase 5: 1 função + 2 triggers
- Fase 6: CREATE INDEX condicional (IF NOT EXISTS)
- Fase 7: tabela `orcamento_drafts` + RLS por dono
- Fase 8: ALTER `importacao_lotes` (se existir)

## Código (frontend)
- `src/hooks/usePedidosCompra.ts` — ações aprovar/rejeitar via novas RPCs; novo status `aguardando_aprovacao` em filtros
- `src/components/compras/PedidoCompraDrawer.tsx` — botões Aprovar/Rejeitar para admin quando status = aguardando_aprovacao
- `src/components/logistica/RecebimentoDrawer.tsx` — exibir `quantidade_recebida` real
- `src/pages/OrcamentoForm.tsx` — substituir `localStorage` autosave por upsert em `orcamento_drafts`

## Riscos
- Fase 4: lançamentos órfãos podem bloquear inativação — função filtra apenas `ativo=true` em referências
- Fase 7: refator de form crítico — manter fallback `localStorage` em caso de erro de rede
- Fase 2: status novo precisa ser tratado em todos os filtros existentes

## Critério de conclusão
- Build OK (`tsc --noEmit`)
- Migrations aplicadas
- Hooks e drawers refatorados
- Sem regressão em fluxos críticos (recebimento, orçamento, pedidos compra)

