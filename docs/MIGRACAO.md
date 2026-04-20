# Migração de Dados — Documentação Técnica

## Visão Geral

O módulo de migração de dados do ERP AviZee implementa um fluxo de **staging real** com consolidação transacional controlada por lote, garantindo segurança, auditabilidade e idempotência.

## Fluxo de Staging

```
Arquivo → generatePreview → processImport → [STAGING] → finalizeImport → [TABELAS FINAIS]
           (validação)      (stg_* tables)                (RPC SQL)
```

1. **generatePreview**: Valida os dados, resolve lookups (produto, cliente, fornecedor), enriquece o preview com `_action` (inserir/atualizar/duplicado). Nenhuma escrita no banco.

2. **processImport**: Grava registros válidos nas tabelas de staging (`stg_cadastros`, `stg_estoque_inicial`, `stg_financeiro_aberto`, `stg_faturamento`) e cria o lote em `importacao_lotes` com `status = 'staging'`. Nenhum dado operacional é alterado.

3. **finalizeImport**: Chama a RPC de consolidação correspondente que processa as linhas de staging e faz upsert/insert nas tabelas finais de forma transacional.

## Tabelas de Staging

| Tabela | Fase | Destino Final |
|--------|------|---------------|
| `stg_cadastros` | Cadastros + Enriquecimento | `produtos`, `clientes`, `fornecedores`, `grupos_produto`, `produtos_fornecedores`, `formas_pagamento`, `contas_contabeis`, `contas_bancarias` |
| `stg_estoque_inicial` | Estoque | `estoque_movimentos` (+ trigger atualiza `produtos.estoque_atual`) |
| `stg_financeiro_aberto` | Financeiro | `financeiro_lancamentos`, `financeiro_baixas` |
| `stg_faturamento` | Faturamento | `notas_fiscais`, `notas_fiscais_itens` |

Todas possuem schema: `id`, `lote_id` (FK para `importacao_lotes`), `dados` (jsonb), `status`, `erro`, `created_at`.

## RPCs de Consolidação

| Função | Fase |
|--------|------|
| `consolidar_lote_cadastros(p_lote_id)` | Cadastros-base |
| `consolidar_lote_estoque(p_lote_id)` | Estoque inicial |
| `consolidar_lote_financeiro(p_lote_id)` | Financeiro em aberto |
| `consolidar_lote_faturamento(p_lote_id)` | Faturamento histórico |

Todas são `SECURITY DEFINER` com `SET search_path = public` e retornam `jsonb` com contadores (`inseridos`, `atualizados`, `erros`, `ignorados`).

## Chaves de Deduplicação

| Entidade | Prioridade 1 | Prioridade 2 | Fallback |
|----------|-------------|-------------|----------|
| Produtos | `codigo_legado` | `codigo_interno` | — |
| Clientes | `codigo_legado` | `cpf_cnpj` | — |
| Fornecedores | `codigo_legado` | `cpf_cnpj` | — |
| NF Histórica | `chave_acesso` | `numero + serie + data_emissao` | — |
| Financeiro (pessoa) | `codigo_legado_pessoa` | `cpf_cnpj` | — |

## Ordem Correta das Fases

```
Fase 1: Saneamento Estrutural (schema, staging, RPCs)
Fase 2: Cadastros-base (grupos_produto → produtos/insumos → clientes → fornecedores)
Fase 3: Enriquecimento Relacional (produtos_fornecedores, formas_pagamento, contas)
Fase 4: Estoque Inicial (saldo de corte → estoque_movimentos)
Fase 5: Financeiro em Aberto (CR/CP → financeiro_lancamentos + baixas)
Fase 6: Faturamento Histórico (NFs → notas_fiscais com movimenta_estoque=false)
```

**Importante**: Cadastros-base (Fase 2) DEVEM ser concluídos antes das fases 4-6, pois os lookups de produto/pessoa dependem dos registros já existentes.

## Status de Lote

| Status | Descrição |
|--------|-----------|
| `rascunho` | Lote criado, ainda sem dados |
| `validado` | Dados validados, preview gerado |
| `staging` | Dados gravados nas tabelas stg_* |
| `consolidando` | RPC de consolidação em execução |
| `concluido` | Consolidação finalizada com sucesso |
| `parcial` | Consolidação com erros parciais |
| `erro` | Consolidação falhou completamente |
| `cancelado` | Lote descartado pelo usuário |

## Campos Adicionados

- `produtos.codigo_legado` — chave do sistema legado
- `produtos.variacoes` — variações do produto (texto)
- `produtos.tipo_item` — `'produto'` ou `'insumo'`
- `clientes.codigo_legado` — chave do sistema legado
- `fornecedores.codigo_legado` — chave do sistema legado
- `importacao_lotes.fase` — fase da migração
- `importacao_lotes.resumo` — jsonb com contadores detalhados
- `importacao_lotes.registros_duplicados/atualizados/ignorados` — contadores

## Idempotência

A consolidação é idempotente: registros de staging com `status = 'consolidado'` são ignorados em execuções subsequentes. Apenas registros com `status = 'pendente'` são processados.

## Faturamento Histórico

NFs importadas via faturamento histórico são criadas com:
- `movimenta_estoque = false`
- `gera_financeiro = false`
- `origem = 'importacao_historica'`

Isso garante que o histórico não impacta estoque nem financeiro.

## Revisão Estrutural do Módulo de Cadastros (2026-04)

Consolidação realizada em migration única e idempotente. Decisões-chave:

- **Clientes × Formas de Pagamento**: `forma_pagamento_id` é a fonte oficial. `forma_pagamento_padrao` (texto) preservado e marcado `DEPRECATED`.
- **Formas de Pagamento**: `tipo` formalizado via `CHECK chk_forma_pagamento_tipo` com valores `pix | boleto | cartao | dinheiro | transferencia | outro`. `descricao` é a condição comercial.
- **Financeiro**: nova coluna `financeiro_lancamentos.forma_pagamento_id` com FK; texto legado mantido como fallback visual.
- **Grupos Econômicos**: FK real `grupos_economicos.empresa_matriz_id → clientes(id)` com `ON DELETE SET NULL`. Idem `clientes.grupo_economico_id → grupos_economicos(id)`.
- **Documentos únicos**: trigger `trg_normaliza_documento` (strip não-dígitos) + índice único parcial `WHERE ativo = true` permitindo reutilização de documento inativo. Duplicatas ativas registradas em `cadastros_pendencias_migracao` sem apagar dados; o índice único só é criado se nenhuma duplicata ativa persistir.
- **Soft delete oficial**: `deleted_at`, `deleted_by`, `motivo_inativacao` em `clientes`, `fornecedores`, `transportadoras`, `produtos`, `funcionarios`. Trigger `trg_registrar_inativacao` espelha mudanças de `ativo`.
- **FKs faltantes** adicionadas em `cliente_transportadoras`, `clientes_enderecos_entrega`, `cliente_registros_comunicacao` e `financeiro_lancamentos` (cliente/fornecedor/conta_contabil/conta_bancaria, todas `RESTRICT`).

Pendências de consolidação ficam em `public.cadastros_pendencias_migracao` (somente admin pode ler). Consulta de auditoria:

```sql
SELECT entidade, motivo, count(*)
  FROM cadastros_pendencias_migracao
 GROUP BY entidade, motivo
 ORDER BY entidade, motivo;
```

## Revisão estrutural do módulo Comercial (2026-04-20)

Migrations idempotentes aplicadas em lote:

1. Padronização de status do orçamento (`confirmado`/`enviado` → `pendente`), CHECK atualizado e trigger `trg_orcamento_transicao_valida`.
2. Proteção de exclusão + RPC `cancelar_orcamento(p_id, p_motivo)`.
3. Matriz `chk_ordens_venda_matriz_status`; removido CHECK duplicado `chk_ordens_venda_status_fat`.
4. RPC `converter_orcamento_em_ov` v2 — gate `aprovado`, `ux_ordens_venda_cotacao_id`, auditoria, parâmetro `p_forcar`.
5. RPC `gerar_nf_de_pedido` v2 — `pg_advisory_xact_lock`, gate operacional, retorno com `status_faturamento_novo`.
6. FKs `cotacao_id` e `ordem_venda_id` com `ON DELETE RESTRICT`; índices; view `v_trilha_comercial` (security_invoker).
7. `chk_orcamento_frete_tipo` / `chk_orcamento_modalidade` + FK transportadora `ON DELETE SET NULL`.
8. Trigger `trg_auditoria_orcamento_status` em `auditoria_logs`.

Ver `docs/comercial-modelo.md` para o modelo completo.
