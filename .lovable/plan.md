# Plano — Conciliação Bancária padrão TOTVS RM

Objetivo: entregar em 4 sprints a evolução completa da tela `/financeiro/conciliacao`, cobrindo layout, persistência por lote, tolerâncias configuráveis, ajustes automáticos, estorno de conciliação e trilha de auditoria.

O que já foi feito na sessão anterior e será mantido:
- Extrato OFX persistido em `financeiro_extrato_importacoes` (idempotente por `conta+fitid`).
- Reidratação automática ao trocar conta/período/recarregar.
- Reordenação parcial de layout (dash acima do painel OFX).
- Nome de cliente/fornecedor no painel de conciliação.

---

## Sprint 1 — Layout final e fim do sumiço pós-conciliação

Escopo:
- Confirmar a ordem vertical: Filtros → Mini-dash → Painel OFX × ERP → Filtros de lançamentos → Tabela.
- Corrigir o desaparecimento: após conciliar, o lançamento permanece na lista com badge verde "Conciliado" + ícone check; o extrato permanece com mesma marca visual.
- Novo filtro rápido "Exibir apenas pendentes" (toggle no cabeçalho da grade e do painel OFX). Padrão: desligado.
- Ampliar `fetchLancamentosParaConciliacao` para trazer também os títulos pagos vinculados a baixas do período (já ok via eixo baixa) e marcar `statusConciliacao = "conciliado"` quando existir baixa ativa correspondente ao extrato.

Aceite:
- Após confirmar 1 par, a linha do ERP e do OFX continuam visíveis, verdes, com badge "Conciliado".
- Toggle "Apenas pendentes" oculta linhas conciliadas em ambos os lados.

---

## Sprint 2 — Lotes de importação e retomada de trabalho

Backend (migration):
- Nova tabela `financeiro_extrato_lotes` (id, empresa_id, conta_bancaria_id, arquivo_nome, arquivo_hash, total_transacoes, inseridas, criado_por, criado_em, status).
- Coluna `lote_id uuid` em `financeiro_extrato_importacoes` referenciando o lote.
- GRANTs e RLS por `empresa_id` (padrão do projeto).

Serviço:
- `criarLoteImportacao` cria o cabeçalho antes do upsert das transações e devolve `lote_id`.
- `persistirExtratoOFX` recebe `lote_id` e grava em cada linha.
- `listarLotesImportacao(contaId, periodo?)` para a nova aba.

UI:
- Nova aba "Histórico de Importações" dentro da própria página (Tabs: "Conciliação" | "Histórico"), listando lotes com colunas: Data, Arquivo, Conta, Transações, Conciliadas, Pendentes, Usuário, Ações (Abrir / Excluir se 0 conciliadas).
- Ao clicar "Abrir": aplica filtros de conta/período do lote e rola até o painel OFX.
- Progresso persistido: como o status vive no banco (`pendente|conciliado|ignorado`), fechar a aba e voltar mantém o trabalho — apenas garantir que a UI hidrate `matches` a partir das linhas já `conciliado` do lote ativo.

Aceite:
- Cada upload gera um registro em `financeiro_extrato_lotes`.
- Aba Histórico lista os lotes e permite retomar.

---

## Sprint 3 — Tolerâncias e ajuste automático

Backend:
- Coluna JSON `conciliacao_tolerancias` em `empresa_config` (default `{ dias: 3, valor_centavos: 10 }`).

Serviço:
- `calcularScoreConciliacao` passa a considerar as tolerâncias configuradas para elevar o score em vez de zerá-lo.
- Novo `gerarLancamentoAjusteBancario({ diferenca, conta, data, descricao })` que cria um lançamento tipo despesa/receita bancária e sua baixa, no mesmo dia do extrato.

UI:
- Ao confirmar par com divergência ≤ tolerância: banner "Divergência de R$ x,xx" com botão "Gerar ajuste bancário automático".
- Configuração das tolerâncias em `Configurações → Financeiro` (form simples).

Aceite:
- Match automático encontra pares com até 3 dias e R$ 0,10 de diferença.
- Botão de ajuste cria lançamento e baixa vinculada, zerando a divergência.

---

## Sprint 4 — Estorno e auditoria

Estorno:
- Botão "Desfazer vínculo" já existe para conciliação persistida; estender para pares recém-confirmados na sessão (usa `desfazerConciliacaoExtrato` + estorno da baixa) e para a nova grade de lançamentos conciliados.
- Confirmação com motivo obrigatório (dialog).

Auditoria (backend):
- Nova tabela `financeiro_conciliacao_auditoria` (id, empresa_id, usuario_id, acao ENUM: importacao|conciliacao|estorno|ajuste|exclusao, entidade, entidade_id, payload jsonb, criado_em).
- GRANTs, RLS por empresa, índice por (empresa, criado_em desc).
- Serviço `registrarAuditoriaConciliacao` chamado em cada handler crítico.
- Não exposta na UI nesta sprint (tabela "oculta"), mas consultável via SQL/relatórios futuros.

Aceite:
- Toda importação, conciliação, estorno, ajuste e exclusão gera um registro com usuário e timestamp.
- Desfazer vínculo retorna extrato e lançamento ao status "pendente" e estorna a baixa.

---

## Detalhes técnicos

Arquivos principais a tocar:
- `src/pages/Conciliacao.tsx` (layout + aba Histórico + toggle "apenas pendentes").
- `src/pages/financeiro/conciliacao/OFXMatchingPane.tsx` (badge verde, toggle, estorno inline).
- `src/pages/financeiro/conciliacao/useConciliacao.ts` (hidratação de conciliados no ERP, lote ativo, ajuste automático, auditoria).
- `src/services/financeiro/extratoImportacoes.service.ts` (lote_id em upsert, `criarLoteImportacao`, `listarLotesImportacao`).
- `src/services/financeiro/conciliacao.service.ts` (tolerâncias + `gerarLancamentoAjusteBancario`).
- Novo `src/services/financeiro/conciliacaoAuditoria.service.ts`.
- Migrations: `financeiro_extrato_lotes`, coluna `lote_id`, `conciliacao_tolerancias`, `financeiro_conciliacao_auditoria` (com GRANTs e RLS conforme padrão do projeto).

Execução: entrego uma sprint por vez. Ao final de cada sprint faço `tsgo` + validação visual quando aplicável e sigo para a próxima ao seu "seguir".
