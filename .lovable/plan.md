

## Plano — Limpeza geral + Importação financeira por Conciliação

Objetivo: tornar a planilha `Conciliação_FluxoCaixa 2026.xlsx` a fonte primária de carga financeira inicial, sem inventar estrutura e sem duplicar registros.

### Realidade que descobri (importa para o plano)
- `financeiro_lancamentos` real tem: `tipo, descricao, valor, data_vencimento, data_pagamento, status, forma_pagamento, banco, cliente_id, fornecedor_id, conta_bancaria_id, conta_contabil_id, parcela_numero, parcela_total, saldo_restante, valor_pago, observacoes, ativo`. **Não há** `data_emissao`, `titulo`, `nome_abreviado`, `origem`, `centro_custo_id`, `pmv/pmp`, `sócio`, `i_level`. → Tudo isso vai para `observacoes` estruturado e/ou metadata no staging.
- `contas_contabeis` tem `codigo, descricao, natureza, aceita_lancamento, conta_pai_id, ativo` (sem `i_level` próprio).
- `clientes`/`fornecedores` têm `codigo_legado` e `cpf_cnpj` — chaves de match.
- `stg_financeiro_aberto(lote_id, dados jsonb, status, erro)` — staging genérico já serve.
- `importacao_lotes.fase` aceita texto livre — usaremos `fase='conciliacao'`.
- Nenhuma tabela de centro de custo / FOPAG / plano hierárquico — não vou criar.

### Bloco 1 — Limpeza segura de dados operacionais
RPC `limpar_dados_migracao(confirmar boolean)` (`SECURITY DEFINER`, `search_path=public`), só para `admin`, ordem dependente:
1. `DELETE FROM stg_financeiro_aberto, stg_estoque_inicial, stg_faturamento, stg_cadastros, stg_compras_xml`
2. `DELETE FROM importacao_logs; DELETE FROM importacao_lotes`
3. `DELETE FROM financeiro_baixas; DELETE FROM caixa_movimentos; DELETE FROM financeiro_lancamentos`
4. **Não toca**: profiles, user_roles, app_configuracoes, empresa_config, contas_bancarias, contas_contabeis, clientes/fornecedores/produtos, NFs, estoque_movimentos.

UI: botão "Limpar dados de migração" no topo da página `MigracaoDados` com `ConfirmDialog` exigindo digitação de "LIMPAR". Visível só para admin.

### Bloco 2 — Parser da planilha de conciliação
Novo `src/lib/importacao/conciliacaoParser.ts`:
- `parseConciliacaoWorkbook(file)`: detecta abas `CR`, `CP`, `FC`, `FOPAG`, `CLIENTES`, `FORNECEDORES`, `Plano de Contas`, `Centro de Custo` (case-insensitive, normalizado).
- Para cada aba: aplica aliases dedicados (P)Vencto/Vencimento, Cod./Código, etc.
- Normaliza: datas (BR/Excel serial via `parseDateFlexible`), moeda BR, nomes (uppercase + sem acentos + trim para matching).
- Retorna `{ cr[], cp[], fc[], fopag[], clientes[], fornecedores[], planoContas[], centroCusto[], abasFaltantes[] }`.

### Bloco 3 — Hook `useImportacaoConciliacao`
Substitui `useImportacaoFinanceiro` no card "Financeiro / Conciliação". Etapas:

**generatePreview**:
1. Carrega `clientes`, `fornecedores`, `contas_contabeis` existentes + clientes/fornecedores da própria planilha (vira `entityIndex` em memória — não grava, só ajuda no match).
2. Para cada CR/CP/FOPAG monta linha normalizada com `_action`, `_match` (`codigo_legado | cpf_cnpj | nome_abreviado | pendente`), `_duplicado` (lookup determinístico: `tipo + vencimento + valor + (cliente|fornecedor) + título`), `_errors`, `_warnings`.
3. **Reconciliação FC**: agrega CR+CP+FOPAG por (vencimento, tipo, pessoa, valor) e compara linha a linha com FC. Calcula divergências por valor/status/pessoa/tipo. **FC nunca vira lançamento.**
4. **Plano de Contas**: linhas viram preview de upsert por `codigo`.

**processImport (staging)**:
- Cria 1 lote `tipo='conciliacao_financeiro'`, `fase='conciliacao'`, `resumo={cr, cp, fopag, plano, fc_total, fc_divergencias, pendencias_vinculo, duplicados_estimados}`.
- Grava CR/CP/FOPAG em `stg_financeiro_aberto` com `dados.origem ∈ {'CR','CP','FOPAG'}` + campos auxiliares (titulo, parcela, pmv/pmp, banco, nome_abreviado, conta_contabil_codigo, fc_match_id).
- Grava plano de contas em `stg_cadastros` com `dados._tipo_enriquecimento='contas_contabeis'`.
- Grava FC em `importacao_logs` (nivel='info', mensagem JSON) — só para conferência, nunca consolidado.
- Centro de custo: grava em `importacao_logs` como "preservado para fase futura".

**finalizeImport (consolidação)**:
- Roda `consolidar_lote_enriquecimento` (já existe — processa contas_contabeis).
- Roda `consolidar_lote_financeiro` ajustada (Bloco 4).

### Bloco 4 — Ajustes na RPC `consolidar_lote_financeiro`
Migration substituindo a função:
1. **Resolução de pessoa**: `codigo_legado` → `cpf_cnpj` → match exato por `nome_razao_social` normalizado (uppercase sem acento). Sem fuzzy. Ambíguo = pendente (status `erro`, mensagem clara).
2. **Resolução de conta contábil**: lookup por `dados.conta_contabil_codigo` em `contas_contabeis.codigo` → preenche `conta_contabil_id`.
3. **Status derivado**: `pago` (data_pagamento + valor_pago≥valor) | `parcial` (valor_pago>0) | `vencido` (sem pagamento + vencimento<hoje) | `aberto`.
4. **Deduplicação determinística**: antes de inserir, busca `financeiro_lancamentos` com mesmo `(tipo, data_vencimento, valor, cliente_id|fornecedor_id, observacoes ILIKE '%[Título: X]%')`. Se existir → marca staging `status='duplicado'`, não insere.
5. **Observações estruturadas**: `[Origem: CR|CP|FOPAG] [Título: ...] [Parcela: 1/3] [Nome Abrev: ...] [PMP: ...] [Sócio: ...] — descricao original`. Garante auditabilidade do que veio da planilha.
6. **FOPAG**: tipo='pagar', sem `fornecedor_id` se não houver match (vira pendente com aviso, lançamento ainda é criado com observação `[Origem: FOPAG][Sócio: X]` e `fornecedor_id=NULL`).
7. Resposta: `{inseridos, duplicados, pendentes_vinculo, erros, por_origem:{cr,cp,fopag}}`.

### Bloco 5 — UI da Migração (apenas o necessário)
- **Novo card** "Conciliação / Financeiro" no grupo "Posição inicial / Saldos", substituindo o card "Financeiro" atual (mantém retrocompat lendo o mesmo `tipo='conciliacao_financeiro'` para os indicadores).
- **Wizard adaptado** quando `activeImportSource='conciliacao'`:
  - Etapa Upload: aceita só este arquivo, lista abas detectadas com check verde/amarelo.
  - Etapa Preview: tabs `CR | CP | FOPAG | Plano de Contas | FC (conferência) | Pendências de vínculo`. Cards-resumo no topo (lidos / válidos / duplicados / pendentes / divergências FC).
  - Etapa Staging: chama `processImport`.
  - Etapa Confirmação: mostra resumo do lote staged + botão "Confirmar carga".
- Componente novo `PreviewConciliacaoTabs.tsx` reutilizando `PreviewFinanceiroTable` com filtro por origem.

### Fora de escopo
- Centro de Custo como entidade (preservado em logs).
- Atualização de cadastros de cliente/fornecedor a partir das abas CLIENTES/FORNECEDORES da planilha — **suportado** apenas como `enriquecimento` opcional desligado por padrão (toggle); nesta passada implemento o toggle mas o efeito apenas registra match; criar/atualizar cadastro fica para próxima rodada para não inflar o lote.
- Tabela própria de FOPAG/RH.
- Refatorar `OrcamentoForm.tsx` (P12B pendente).

### Critério de aceite
- `MigracaoDados` mostra botão "Limpar dados de migração" (admin) e card "Conciliação / Financeiro".
- Upload da planilha → preview com 6 tabs e cards de resumo + reconciliação FC com contagem de divergências.
- Carga final cria contas contábeis (upsert por código) e financeiro_lancamentos sem duplicar (rerodar o mesmo lote = 0 inseridos, todos duplicados).
- FC nunca vira lançamento, mas aparece nos logs e na reconciliação.
- FOPAG vira `tipo='pagar'` com observação `[Origem: FOPAG]`.
- Build OK.

### Migrations
1. `CREATE OR REPLACE FUNCTION limpar_dados_migracao(p_confirmar boolean)` — admin only, retorna jsonb com contadores apagados.
2. `CREATE OR REPLACE FUNCTION consolidar_lote_financeiro` — versão nova com dedup determinístico, conta contábil, status correto, observações estruturadas, contadores por origem.

### Arquivos afetados
**Novos**: `src/lib/importacao/conciliacaoParser.ts`, `src/hooks/importacao/useImportacaoConciliacao.ts`, `src/components/importacao/PreviewConciliacaoTabs.tsx`, `src/components/importacao/LimparDadosMigracaoButton.tsx`, 1 migration.
**Editados**: `src/pages/MigracaoDados.tsx` (botão limpeza + card conciliação + wizard novo source), `src/hooks/importacao/types.ts` (novo `PreviewConciliacaoBundle`), `src/lib/importacao/aliases.ts` (aliases CR/CP/FC/FOPAG/Plano), `docs/MIGRACAO.md` (atualizar fluxo conciliação).

### Relatório final será entregue após execução com: arquivos modificados, contagens reais (CR/CP/FOPAG/contas/divergências FC), interpretação vs TXT, build/lint.

