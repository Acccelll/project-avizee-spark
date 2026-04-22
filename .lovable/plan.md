

# Submódulo "Sócios e Participações"

Implementação nativa, separada de Funcionários (RH/CLT), com modelagem societária própria, apuração por competência, integração com `financeiro_lancamentos` (via `origem_tipo='societario'`) e `fechamentos_mensais`.

## Decisões de arquitetura

- **Cadastro** em `Cadastros > Sócios` (rota `/socios`).
- **Operação** em `Financeiro > Sócios e Participações` (rota `/socios-participacoes`) — apuração mensal, retiradas e geração financeira.
- **Integração financeira** reutilizando os campos já existentes em `financeiro_lancamentos`: `origem_tipo='societario'`, `origem_tabela='socios_retiradas'`, `origem_id=<retirada_id>`. Sem alterar schema do financeiro.
- **Fechamento mensal**: `apuracoes_societarias.fechamento_mensal_id` (nullable) referencia `fechamentos_mensais`. Lucro base sugerido a partir de `fechamento_financeiro_saldos` quando houver fechamento; ajustável manualmente.
- **Permissões**: novo recurso ERP `socios` com ações `visualizar | criar | editar | aprovar | gerar | cancelar`.
- **Funcionários permanece intocado** — nenhum reaproveitamento de `funcionarios`/`folha_pagamento`.

## Fase 1 — Modelagem de banco (migration única)

### Tabelas novas (todas com RLS, `chk_` constraints e `search_path=public` nas RPCs)

1. **`socios`** — cadastro
   - `id, nome, cpf (unique), email, telefone, ativo (default true)`
   - `percentual_participacao_atual` (numeric 5,2 — denormalizado para conveniência; histórico em `socios_participacoes`)
   - `data_entrada, data_saida`
   - `forma_recebimento_padrao, chave_pix, banco, agencia, conta, tipo_conta`
   - `observacoes, created_at, updated_at, created_by, updated_by`
   - Constraints: `chk_socios_pct_nao_negativo`, validação CPF via trigger.

2. **`socios_participacoes`** — histórico vigência
   - `id, socio_id (FK), percentual, vigencia_inicio (date), vigencia_fim (date null), observacoes`
   - EXCLUDE constraint impedindo sobreposição por sócio (gist + tstzrange).
   - Trigger `trg_sync_pct_atual` atualiza `socios.percentual_participacao_atual` quando vigência abre/fecha.

3. **`socios_parametros`** — pró-labore mensal congelado por competência
   - `competencia (date, unique), pro_labore_total, base_referencia ('salario_minimo'|'manual'), observacoes`

4. **`apuracoes_societarias`** — mestre por competência
   - `id, competencia (date, unique), fechamento_mensal_id (FK null)`
   - `lucro_base, ajustes, lucro_distribuivel (computed via trigger), pro_labore_total, bonus_total`
   - `status ('rascunho'|'fechado'|'aprovado'|'cancelado')`
   - `observacoes, created_at, updated_at, fechado_em, fechado_por`
   - `chk_apuracao_status`. UPDATE bloqueado quando status ∈ (`fechado`,`aprovado`) exceto reabertura via RPC.

5. **`apuracoes_societarias_itens`** — detalhamento por sócio
   - `apuracao_id, socio_id, percentual_aplicado, direito_teorico, pro_labore_calculado, bonus_calculado, distribuicao_calculada, retirado_no_periodo, saldo_disponivel`
   - Unique `(apuracao_id, socio_id)`.

6. **`socios_retiradas`** — eventos transacionais
   - `id, socio_id, competencia, apuracao_id (null)`
   - `tipo ('pro_labore'|'bonus'|'distribuicao_lucros'|'ajuste')`
   - `criterio_rateio ('percentual_societario'|'valor_fixo'|'manual')`
   - `valor_total_evento, percentual_aplicado, valor_calculado, valor_aprovado`
   - `data_prevista, data_pagamento`
   - `status ('rascunho'|'aprovado'|'financeiro_gerado'|'pago'|'cancelado')`
   - `financeiro_lancamento_id (FK null)`, `observacoes`, audit cols
   - Constraint `uq_retirada_financeiro` em `financeiro_lancamento_id` impedindo dupla geração.

### Triggers/regras
- Bloquear DELETE em `socios` com histórico (`socios_retiradas` ou `apuracoes_societarias_itens`).
- Bloquear DELETE em `apuracoes_societarias` quando `status ∈ (fechado, aprovado)`.
- Bloquear UPDATE em colunas calculadas de itens de apuração fechada.

### RPCs (`SECURITY DEFINER`, `search_path=public`)
- `criar_apuracao_societaria(p_competencia)` — cria mestre + itens para sócios ativos com pct vigente.
- `recalcular_apuracao_societaria(p_apuracao_id)` — recalcula direito_teorico/pro_labore/bonus/saldo.
- `fechar_apuracao_societaria(p_apuracao_id)` — congela valores, valida soma de % = 100% (warning se ≠).
- `reabrir_apuracao_societaria(p_apuracao_id, p_motivo)` — registra log, volta a `rascunho`.
- `aprovar_retirada(p_retirada_id)`.
- `gerar_financeiro_retirada(p_retirada_id, p_data_vencimento, p_conta_bancaria_id)` — INSERT atômico em `financeiro_lancamentos` com `origem_tipo='societario'`, vincula em `socios_retiradas.financeiro_lancamento_id`, idempotente (retorna o existente se já gerado).
- `cancelar_retirada(p_retirada_id, p_motivo)` — cancela retirada e seu lançamento financeiro vinculado.

### RLS
- `socios:visualizar` para SELECT autenticado; INSERT/UPDATE com `has_role('admin') OR has_permission(auth.uid(),'socios:editar')`.
- DELETE apenas admin.

## Fase 2 — Tipagem, navegação e permissões

- `src/lib/permissions.ts`: adicionar `'socios'` em `ERP_RESOURCES`, label "Sócios e Participações".
- `src/lib/navigation.ts`: novo item em `cadastros > Sócios` (`/socios`) e em `financeiro > Sócios e Participações` (`/socios-participacoes`).
- `src/types/domain.ts`: interfaces `Socio`, `SocioParticipacao`, `ApuracaoSocietaria`, `ApuracaoItem`, `SocioRetirada`.
- `src/App.tsx`: rotas com `PermissionRoute resource="socios"`.
- `src/hooks/useVisibleNavSections.ts`: mapear `socios` em `cadastros` e `financeiro`.

## Fase 3 — Front-end

### Página `/socios` — `src/pages/Socios.tsx`
- `ModulePage` + `DataTable`: Nome, CPF, Participação atual, Status, Pró-labore mês, Bônus período, Direito acumulado, Retirado, Saldo.
- Ações: visualizar, editar, inativar, abrir histórico, abrir retiradas.
- `FormModal` `SocioForm` — blocos Identificação / Participação / Recebimento / Status / Observações.
- `ViewDrawerV2` `SocioDrawer` — tabs Resumo / Participações / Retiradas / Financeiro / Observações.

### Página `/socios-participacoes` — `src/pages/SociosParticipacoes.tsx`
- Tabs:
  1. **Apuração mensal**: seletor de competência, KPIs (lucro base/ajustes/distribuível/pró-labore total/bônus total), tabela de itens por sócio, ações `Recalcular | Fechar | Reabrir | Aprovar`.
  2. **Retiradas**: filtro competência/sócio/tipo/status, ações `Nova retirada | Aprovar | Gerar financeiro | Cancelar`. `RelationalLink` para o lançamento financeiro.
  3. **Parâmetros**: pró-labore por competência.

### Componentes reutilizáveis em `src/components/socios/`
- `SocioForm.tsx`, `SocioDrawer.tsx`, `ApuracaoTable.tsx`, `RetiradaForm.tsx`, `GerarFinanceiroDialog.tsx`.

### Hooks em `src/hooks/`
- `useSocios.ts`, `useSocioParticipacoes.ts`, `useApuracoesSocietarias.ts`, `useSociosRetiradas.ts`, `useSociosKpis.ts`. Padrão `useSupabaseCrud` + React Query com `INVALIDATION_KEYS.socios`.
- `useBeforeUnloadGuard` nos formulários dirty.

## Fase 4 — Integrações

- **Financeiro**: `Financeiro.tsx` filtro adicional `origem_tipo=societario`; `FinanceiroDrawer` mostra link "Ver retirada" quando `origem_tipo='societario'`.
- **Dashboard** (`src/pages/Index.tsx`): card opcional "Sócios — competência atual" com pró-labore total / retirado / saldo (gated por `can('socios:visualizar')`).
- **Fechamento mensal**: ao criar apuração, sugerir `lucro_base` a partir de `fechamento_financeiro_saldos` da competência (apenas sugestão, editável).

## Fase 5 — Validação e auditoria

- Triggers `set_audit_cols` (created_by/updated_by via `auth.uid()`).
- Validação client-side via Zod em `src/lib/validationSchemas.ts` (`socioSchema`, `retiradaSchema`).
- Tudo passa por `tsc --noEmit` antes de fechar.

## Pontos que exigirão configuração manual após deploy
1. Conceder permissão `socios:*` aos perfis desejados (admin recebe automaticamente).
2. Cadastrar os 4 sócios reais com seus percentuais (3×20% + 1×40%) — sem seed automático para não inserir dados fictícios.
3. Cadastrar primeiro `socios_parametros` informando o pró-labore total da competência atual.
4. (Opcional) Definir conta bancária padrão para gerar retiradas.

## Critérios de aceite
- Cadastrar/editar/inativar sócios; histórico de participação preservado.
- Criar apuração de uma competência → calcular direito por sócio → fechar → aprovar.
- Lançar pró-labore (rateio automático) e bônus (manual) → aprovar → gerar financeiro (idempotente).
- Visualizar direito, retirado e saldo por sócio e total.
- Lançamentos aparecem em Financeiro com vínculo bidirecional.
- Funcionários permanece 100% intocado.

