

# Plano — Execução do "Para_o_Lovable-2.md"

## Diagnóstico do escopo

O documento contém **10 blocos** (Cadastros, Comercial, Compras, Suprimentos/Logística, Financeiro, Fiscal, Relatórios, Administração, Configurações, Dashboard, Cadastros v2, + 3 RPCs no final). Estimativa real:

- ~50 migrations (consolidação de status, novas colunas, constraints, FKs, views)
- ~25 RPCs novas/refatoradas (transacionais)
- Refactor em ~50 arquivos do frontend (hooks, services, páginas)
- Saneamento de dados legados em ~15 tabelas (UPDATE de status antigos → novos)
- Regeneração de types (automática após cada migration)
- ~30 erros TS pendentes do ciclo anterior

Executar tudo numa única rodada é **certeza de regressão massiva**. Cada bloco mexe em fluxos críticos (financeiro, estoque, fiscal) que precisam ser validados antes do próximo.

## Estratégia proposta — 8 rodadas

Cada rodada é auto-contida: migrations + RPCs + frontend + tests + correção dos TS errors do escopo. Você valida no preview antes de aprovar a próxima.

**Rodada 0 — Estabilização (esta rodada, alta prioridade)**
- Fechar os ~30 erros TS pendentes
- Item 1 do bloco Cadastros: regenerar tipos Supabase (via migration vazia se necessário) + remover `as any` desnecessários
- Items 3, 4 e 5 do bloco Cadastros (RPCs `set_principal_endereco`, filtro inativos, `save_produto_composicao`)
- Item 2 do bloco Cadastros (FK `forma_pagamento_id`)
- 3 RPCs avulsos do final do doc (`proximo_numero_nf`, `gerar_pedido_compra`, `proximo_numero_ordem_venda`)

**Rodada 1 — Comercial**: 7 itens (status canônico, frete em ordens_venda, salvar_orcamento, converter OV→pedido, gerar NF de pedido, integridade, types)

**Rodada 2 — Compras**: 8 itens (domínio oficial, status, propostas, RPCs converter/recebimento, integridade)

**Rodada 3 — Suprimentos/Logística**: 8 itens (estoque fonte de verdade, RPC manual, status remessas, recebimento parcial, 1:N pedido↔remessa)

**Rodada 4 — Financeiro**: 9 itens (status canônico, RPCs baixa/estorno/criar, parcelamento, conciliação, baixa de Dashboard)

**Rodada 5 — Fiscal**: 11 itens (status canônico, status SEFAZ separado, RPCs confirmação/estorno/devolução, fonte estoque, alinhamento financeiro)

**Rodada 6 — Relatórios + Dashboard**: views/RPCs canônicas, DRE estrutural, fluxo de caixa, drill-down, KPIs

**Rodada 7 — Administração + Configurações**: role_permissions, singleton empresa_config, user_preferences, separação personal/global, /perfil consolidado

## O que faço NESTA rodada (Rodada 0)

| # | Tarefa | Tipo |
|---|--------|------|
| 1 | Corrigir os ~30 erros TS pendentes (Index, Relatorios, configuracoes/*, Backup, Email, Geral, Notificacoes, Integracoes, useFinanceiroActions, useFinanceiroFiltros, ConfiguracaoFiscal, useEntregas, FluxoCaixaChart, process-email-queue) | Frontend |
| 2 | Migration: ajustar `mergeConfiguracoes` ou os tipos `Config*` para aceitar partial (resolve 6 erros de Backup/Email/Geral/Notificacoes/Integracoes) | Frontend |
| 3 | Migration: corrigir `useEntregas.ts` — schema sem `usuario_id` em ordens_venda (remover ou trocar por `vendedor_id`) | Frontend/SQL |
| 4 | RPC `set_principal_endereco(uuid, uuid)` + uso em Clientes.tsx | SQL + Frontend |
| 5 | RPC `save_produto_composicao(uuid, jsonb, jsonb)` + uso em Produtos.tsx | SQL + Frontend |
| 6 | Migration: FK `clientes.forma_pagamento_id` + dado migrado + drop `forma_pagamento_padrao` | SQL |
| 7 | Frontend Clientes.tsx: usar `forma_pagamento_id` em vez de `forma_pagamento_padrao` | Frontend |
| 8 | Filtro inativos: alterar `useSupabaseCrud` callers em Clientes/Fornecedores/Produtos/Funcionários/Transportadoras/GruposEconomicos/UnidadesMedida | Frontend |
| 9 | RPC `proximo_numero_nf()` + uso em useFaturarPedido.ts | SQL + Frontend |
| 10 | RPC `gerar_pedido_compra(...)` + uso em useGerarPedidoCompra.ts | SQL + Frontend |
| 11 | Verificar/criar `proximo_numero_ordem_venda()` + checar `convertToPedido` em orcamentos.service.ts | SQL + Frontend |

**Saneamento de dados**: nenhum nesta rodada (não muda status). Apenas a migração de `forma_pagamento_padrao → forma_pagamento_id` (UPDATE simples, idempotente, dentro da migration).

## O que NÃO faço nesta rodada

- Consolidação de status de Comercial/Compras/Logística/Financeiro/Fiscal (Rodadas 1–5)
- Novas views analíticas (Rodada 6)
- Refactor de roles/permissões (Rodada 7)
- Qualquer UPDATE em massa de status legados

## Riscos & mitigação

- A migration `clientes.forma_pagamento_padrao → forma_pagamento_id` faz DROP de coluna. Mitigo com `IF EXISTS` e UPDATE prévio.
- Filtro de inativos pode mudar contagens já visíveis nas grids — comportamento esperado pelo prompt.
- RPCs novas usam `SECURITY DEFINER` + `SET search_path = public` (regra de memória).

## Estimativa

~10 arquivos frontend + 1 migration consolidada (5 blocos SQL) + 3 RPCs novas. Build TS deve ficar verde ao final.

## Ao final, retorno explicitamente

- ✅ O que foi feito nesta rodada
- ⏳ **Pendente** (lista de cada item do documento que ficou para Rodadas 1–7), com a recomendação de iniciar a Rodada 1 (Comercial) na próxima mensagem.

