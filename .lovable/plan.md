

## Revisão estrutural — Suprimentos & Logística

Plano enxuto que (A) consolida Recebimentos como domínio próprio, (B) padroniza vocabulário logístico canônico em remessas/entregas/recebimentos/movimentos de estoque, (C) reforça governança de ajustes manuais e (D) garante rastreabilidade ponta a ponta — preservando todas as tabelas, RPCs e fluxos atuais.

---

### B1. Recebimentos como domínio próprio (não mais derivado)

A "view" atual em `useRecebimentos` deriva tudo de `pedidos_compra` + somatório de itens. Sem persistência de data, NF, divergência ou observação. A RPC `receber_compra` já cria registros em `compras`/`compras_itens` mas o front logístico não usa.

**Migration `recebimentos_compra_dominio`:**

Nova tabela `recebimentos_compra` (cabeçalho consolidado por evento de recebimento — 1:N por pedido):
- `id uuid pk`, `pedido_compra_id uuid NOT NULL FK→pedidos_compra(id) ON DELETE RESTRICT`
- `compra_id uuid FK→compras(id) ON DELETE SET NULL` (vínculo com o cabeçalho fiscal/financeiro já gerado por `receber_compra`)
- `numero text` (gerado, ex.: `REC-yyyymmddHHMMSS`)
- `data_recebimento date NOT NULL`, `responsavel_id uuid FK→auth.users(id)`
- `nota_fiscal_id uuid FK→notas_fiscais(id) ON DELETE SET NULL` (entrada futura)
- `tem_divergencia boolean DEFAULT false`, `motivo_divergencia text`
- `observacoes text`, `status_logistico text NOT NULL DEFAULT 'recebido'` (vide §B2)
- `created_at`, `updated_at`, `usuario_id`

Tabela `recebimentos_compra_itens` (detalha quanto/qual produto entrou em CADA evento — não desloca `pedidos_compra_itens.quantidade_recebida`, complementa-o):
- `id`, `recebimento_id FK CASCADE`, `pedido_compra_item_id FK→pedidos_compra_itens(id) ON DELETE RESTRICT`
- `produto_id`, `quantidade_recebida numeric`, `quantidade_pedida_snapshot numeric`, `tem_divergencia boolean`, `motivo_divergencia text`

**RPC `receber_compra` v3** — refatora a atual para também inserir em `recebimentos_compra(_itens)` na mesma transação, mantendo o que já faz (compras, estoque, status do pedido). Nada quebra; apenas passa a popular o novo domínio. Não há backfill retroativo automático: os 17 movimentos atuais permanecem como histórico, sem cabeçalho de recebimento.

**View `vw_recebimentos_consolidado`** — substitui a derivação client-side de `useRecebimentos`: junta `pedidos_compra` + agregação de `recebimentos_compra` (qtd recebida, última data, divergências, NF) e devolve uma linha por pedido, com flag `tem_consolidacao_real`.

#### B2. Status canônico de recebimento (logístico)

Conjunto único, alinhado entre banco e front:

`pedido_emitido · aguardando_envio_fornecedor · em_transito · recebimento_parcial · recebido · recebido_com_divergencia · atrasado · cancelado`

- Elimina o duplo `recebido_parcial` / `parcialmente_recebido`. **No banco** (recebimentos e mapeamento a partir de `pedidos_compra.status`) usa-se **`recebimento_parcial`**; o status `parcialmente_recebido` continua existindo apenas em `pedidos_compra` (compra) — são domínios distintos: `pedidos_compra.status` = compra, `recebimentos_compra.status_logistico` = logística.
- CHECK `chk_recebimentos_compra_status_logistico` no novo CHECK.
- `atrasado` é **derivado** (não persistido): `previsao_entrega < CURRENT_DATE AND status NOT IN ('recebido','cancelado')`. A função `get_recebimento_status_efetivo(...)` (SQL helper) devolve o status com derivação aplicada — a view `vw_recebimentos_consolidado` já o usa.
- `normalizeRecebimentoStatus` no front é simplificado (mantém apenas como leitura defensiva para dados antigos).

#### B3. Entrega × Remessa (múltiplas remessas)

Hoje `useEntregas` mostra "última remessa por updated_at" como se fosse a entrega. Isso é ambíguo quando `remessas_count > 1`.

**Decisão estrutural:** manter a aba "Entregas" como visão **agregada por pedido**, mas com regras claras e materializadas no banco — não no front.

**Migration `vw_entregas_consolidadas`:**
- View `vw_entregas_consolidadas` (security_invoker) por `ordem_venda_id` retornando:
  - `total_remessas`, `total_volumes` (SUM), `peso_total` (SUM), `previsao_entrega_min`, `data_postagem_min`, `data_entrega_max` (das remessas);
  - `status_consolidado` calculado por regra: `entregue` se TODAS remessas entregues; `entrega_parcial` se ALGUMAS; `em_transporte` se ALGUMA em trânsito; `aguardando_expedicao` se nenhuma postada; etc. — tabela de regras documentada em `docs/logistica-modelo.md`.
  - `transportadora_principal` = transportadora da remessa de maior peso (regra explícita, não "última atualizada");
  - `tem_divergencia_quantidade boolean` (volumes/peso somados das remessas vs itens do pedido).
- Front `useEntregas` passa a `select` desta view; remove ordenação por `updated_at`.

#### B4. Status oficial de remessa & entrega

Atualmente `remessas.status_transporte` (default `'pendente'`) sem CHECK. ENTREGA_STATUS_ORDER no front lista 9 valores. Padronização:

**Remessa** (status físico): `pendente · coletado · postado · em_transito · ocorrencia · entregue · devolvido · cancelado` — adicionar `chk_remessa_status_transporte`.

**Entrega consolidada** (derivada — não persiste): `aguardando_separacao · em_separacao · separado · aguardando_expedicao · em_transporte · entrega_parcial · entregue · ocorrencia · cancelado` — definida pela view de B3.

Trigger `trg_remessa_status_transicao` valida transições válidas (mapa em `docs/logistica-modelo.md`), bloqueia saída de `entregue/devolvido/cancelado`.

#### B5. Governança de ajustes manuais de estoque

`estoque_movimentos` hoje tem só `tipo`, `motivo`, `documento_tipo`. Sem CHECK de tipo, sem aprovação, sem categoria.

**Migration `estoque_movimentos_governanca`:**
- CHECK `chk_estoque_mov_tipo` com o conjunto canônico: `entrada · saida · ajuste · reserva · liberacao_reserva · estorno · inventario · perda_avaria · transferencia` (já é o vocabulário do front em `tipoMovConfig`).
- Adicionar colunas:
  - `categoria_ajuste text` (NULL exceto quando `tipo IN ('ajuste','perda_avaria','inventario')`) com CHECK em `('correcao_inventario','perda','avaria','vencimento','furto_extravio','divergencia_recebimento','outro')`.
  - `requer_aprovacao boolean DEFAULT false` (true quando `tipo IN ('ajuste','perda_avaria')` E `quantidade > limite_app_config`).
  - `aprovado_por uuid FK auth.users`, `aprovado_em timestamptz`, `motivo_estruturado text` (≥10 chars quando crítico).
- Trigger `trg_estoque_mov_validacao_manual`: quando `documento_tipo='manual'` exige `motivo` não-nulo e `categoria_ajuste` quando aplicável.
- RPC `ajustar_estoque_manual` v2 — gate de permissão: tipos críticos (`ajuste`, `perda_avaria`) só permitidos com role `admin` ou `estoquista` (consulta `has_role`); registra em `auditoria_logs`.

Front:
- `useAjustarEstoque` aceita `categoria_ajuste`; modal de ajuste (Estoque.tsx) ganha campo "Categoria" quando tipo é crítico.

#### B6. Tipos de movimentação — separar de status visual

Já existe `tipoMovConfig` (visual). Decisão: **adicionar enum de DOMÍNIO** via CHECK (B5) — o front continua usando `tipoMovConfig` para renderizar, mas o domínio é o CHECK do banco. Sem nova tabela.

Adicionar também CHECK em `documento_tipo` com valores `('manual','compra','pedido_compra','venda','pedido_venda','nota_fiscal','inventario','transferencia','carga_inicial','estorno_fiscal')` — alinha com `origemConfig`.

#### B7. Rastreabilidade — FKs e índices faltantes

**Migration `logistica_integridade_relacional`:**
- `remessas.ordem_venda_id` — confirmar FK e adicionar índice `idx_remessas_ordem_venda_id`.
- `remessa_eventos.remessa_id` — FK CASCADE (já existe?) + índice `idx_remessa_eventos_remessa_id_data`.
- `estoque_movimentos.documento_id` é polimórfico (sem FK física por design) — manter, mas adicionar índice `idx_estoque_mov_documento (documento_tipo, documento_id)`.
- `recebimentos_compra.pedido_compra_id` — índice + view de trilha.
- View `v_trilha_logistica`: `ordem_venda_id → remessas → eventos`, e `pedido_compra_id → recebimentos_compra → compras → estoque_movimentos` (espelha `v_trilha_comercial`/`v_trilha_compras`).

#### B8. Atraso, pendência e divergência

Decisão final:
- **Atraso**: continua **derivado** por data, agora dentro da view (`vw_recebimentos_consolidado`, `vw_entregas_consolidadas`) — front não calcula mais.
- **Pendência**: `quantidade_pedida - quantidade_recebida` continua como soma SQL na view (não persistida).
- **Divergência**: passa a ser **persistida** em `recebimentos_compra.tem_divergencia` + `recebimentos_compra_itens.tem_divergencia` (B1). A trigger `trg_recebimento_marca_divergencia` setá automaticamente quando `quantidade_recebida <> quantidade_pedida_snapshot`.

---

### Migrations entregues (idempotentes, `SET search_path=public`)

1. `recebimentos_compra_dominio` — tabelas `recebimentos_compra`, `recebimentos_compra_itens`, índices, FKs, CHECK, trigger de divergência.
2. `recebimentos_status_canonico` — CHECK do `status_logistico` + função `get_recebimento_status_efetivo`.
3. `receber_compra_v3` — `CREATE OR REPLACE` populando o novo domínio.
4. `vw_recebimentos_consolidado` — view com agregação + status derivado (atrasado).
5. `vw_entregas_consolidadas` — view por OV consolidando múltiplas remessas com regras determinísticas.
6. `remessa_status_canonico` — CHECK `chk_remessa_status_transporte` + trigger de transição.
7. `estoque_movimentos_governanca` — CHECK `tipo`, CHECK `documento_tipo`, novas colunas, trigger de validação manual; RPC `ajustar_estoque_manual` v2 com gate por role + auditoria.
8. `logistica_integridade_relacional` — índices, view `v_trilha_logistica`.

### Código afetado

- `src/pages/logistica/hooks/useRecebimentos.ts` — passa a ler de `vw_recebimentos_consolidado`; remove o mapa client-side de status.
- `src/pages/logistica/hooks/useEntregas.ts` — passa a ler de `vw_entregas_consolidadas`; remove ordenação por `updated_at`.
- `src/pages/logistica/logisticaStatus.ts` — `RECEBIMENTO_STATUS_ORDER` mantém os 8 valores canônicos; `normalizeRecebimentoStatus` simplificado; novo `ENTREGA_TRANSICOES_VALIDAS` derivado das regras da view.
- `src/components/logistica/RecebimentoDrawer.tsx` — passa a mostrar lista de eventos de recebimento (`recebimentos_compra` linha-a-linha) com data, NF, responsável, divergência.
- `src/components/logistica/EntregaDrawer.tsx` — exibe `total_remessas`, com link para todas as remessas; remove ambiguidade de "última remessa".
- `src/pages/Estoque.tsx` + `src/pages/estoque/components/AjusteEstoqueModal.tsx` (já existente) — adiciona seleção de `categoria_ajuste` quando tipo crítico; mostra badge "Requer aprovação" quando aplicável.
- `src/pages/estoque/hooks/useAjustarEstoque.ts` — assinatura recebe `categoria_ajuste?: string`.
- `src/components/estoque/estoqueMovimentacaoConfig.ts` — sem mudanças (já alinhado ao novo CHECK).
- `src/services/logistica/recebimentos.service.ts` (novo) — CRUD de `recebimentos_compra`, função `registrarRecebimento` (chama RPC `receber_compra` v3) e `marcarDivergencia(recebimento_id, motivo)`.
- `docs/logistica-modelo.md` (novo) — domínios separados (estoque/entrega/remessa/recebimento), status canônicos, máquina de transição da remessa, regra de consolidação de entregas multi-remessas, política de ajuste manual.
- `docs/MIGRACAO.md` — apêndice com as 8 migrations.

### Política final — ajustes manuais de estoque

- Tipos `entrada`/`saida` simples: qualquer usuário com permissão `estoque:editar`.
- Tipos críticos (`ajuste`, `perda_avaria`, `inventario`): exigem `categoria_ajuste`, `motivo_estruturado` ≥ 10 chars, role `admin` ou `estoquista`. Registrados em `auditoria_logs` automaticamente.
- Quantidade ≥ limite (config em `app_configuracoes.estoque.limite_aprovacao_unidades`, default 100): `requer_aprovacao=true` e bloqueia atualização de saldo até aprovação por admin.

### Múltiplas remessas — estratégia adotada

Visão "Entregas" continua agregada por pedido, mas calculada na view `vw_entregas_consolidadas` com regras determinísticas (status consolidado por máximo, transportadora por maior peso, datas por min/max). Front nunca mais resolve ambiguidade — o banco resolve.

### Backfills

- Nenhum dado retroativo é movido para `recebimentos_compra` (movimentos antigos têm `documento_tipo='carga_inicial'`); a tabela passa a registrar a partir do próximo `receber_compra`.
- Nenhuma normalização de status em `pedidos_compra` (já realizada no módulo Compras).
- `estoque_movimentos` existentes: se houver `tipo` fora do CHECK, relatório lista para revisão manual antes de aplicar a constraint (provavelmente nenhum: hoje só existe `entrada`).

### Pontos para revisão manual

- Remessas com `status_transporte=NULL` ou valor fora do conjunto canônico — relatório listará.
- Pedidos de compra com `quantidade_recebida > 0` mas sem `recebimentos_compra` — operação histórica permanece como está (não retroage).
- Limite de unidades para aprovação de ajuste manual — admin precisa setar em `app_configuracoes`.

### Impacto no front

- Aba **Recebimentos**: passa a mostrar dados reais persistidos (data, NF, responsável, divergência) em vez de derivação visual; o badge "Visão derivada de Compra" só aparece para pedidos sem nenhum recebimento registrado.
- Aba **Entregas**: badge "Múltiplas remessas" continua, mas o `status_logistico` agora é o consolidado real (não a última remessa).
- Aba **Remessas**: sem mudança visual; ganha trigger de transição que rejeita updates inválidos com toast de erro amigável.
- Página **Estoque**: modal de ajuste ganha "Categoria" e validação obrigatória de motivo para tipos críticos.

### Fora de escopo

- Sem novas telas (drawer/modal são incrementos sobre os existentes).
- Sem mudança em RLS, fiscal ou financeiro além do gate de role no ajuste manual.
- Sem DROP de colunas ou tabelas; `documento_tipo='carga_inicial'` permanece válido.

