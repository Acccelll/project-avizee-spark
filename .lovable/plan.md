# Sugestões de melhorias e novos componentes

A varredura de cores cruas e a documentação `EmptyState` × `DetailEmpty` já estão concluídas. Abaixo, sugestões priorizadas a partir do `.lovable/plan.md` (auditoria geral) e das memórias do projeto. Cada item é entregável de forma independente — escolha por onde seguir.

---

## 🔴 Alta prioridade (risco real)

### 1. Bug do `forwardRef` no `Badge` (Eixo E.1 do plano)
- Console warning ativo: *"Function components cannot be given refs"* dentro de `ApresentacaoSlidesPreview`.
- **Ação**: envolver `Badge` com `React.forwardRef` (ou trocar wrapper por `<span>` quando o ref vier de Tooltip/Popover).
- **Esforço**: ~10 min. Risco zero.

### 2. Auditoria dos 22 `SECURITY DEFINER` views (Eixo A.1)
- Linter Supabase aponta 22 ERRORS. Classificar caso a caso:
  - **Manter** (relatórios que precisam bypassar RLS) → adicionar `COMMENT ON VIEW` justificando.
  - **Converter** para `security_invoker=on` (vistas consumidas direto pelo client).
- **Esforço**: médio. **Risco se não fizer**: vazamento silencioso de dados entre escopos.

### 3. Script de drift schema ↔ código (Eixo A.4)
- Causa raiz dos PGRST204 recentes. Cruza `Database["public"]["Tables"][T]["Row"]` (de `types.ts`) com colunas usadas em cada `*.service.ts`.
- Roda em CI / pré-commit como smoke. Reforça a regra "toda alteração de service exige migration prévia".
- **Esforço**: 1 script Node + 1 doc.

---

## 🟡 Média prioridade (qualidade & DX)

### 4. Cobertura de testes nos núcleos críticos (Eixo D.1)
Status real (auditoria 2026-04): **64 arquivos / 729 testes, todos verdes**. O plano antigo subestimava a cobertura.
Cobertos: workbook (comparators, historicoCsv, workbook), apresentacao (7 specs), financeiro (baixas, calculos, cancelamentos, conciliacao, estornos, ofxParser), sefaz (xmlBuilder + sefazUrls + cancelamento + inutilizacao — adicionados nesta iteração), validadores fiscais (CEST/NCM/IE/chave), permissions, integração financeiro/fiscal/venda, smoke (auth, dashboard, financeiro).
Gaps menores ainda em aberto:
- `src/lib/workbook/fetchWorkbookData`/`generateWorkbook`/`buildVisualSheets` — exigem fixture do template `.xlsx`; não autocontidos.
- `src/services/fiscal/sefaz/autorizacao` + `consulta` — fluxos longos com vários branches; vale split em helpers antes de testar.
- `src/services/fiscal/sefaz/assinaturaDigital` — depende de WebCrypto; testar via integration na própria edge function.

### 5. Logger estruturado em Edge Functions (Eixo D.3)
- ✅ `supabase/functions/_shared/logger.ts` implementado (níveis debug/info/warn/error, JSON em uma linha, `request_id` extraído de `x-request-id`/`x-correlation-id`, suporte a `child(extra)`).
- ✅ Aplicado nos 4 alvos do plano (`sefaz-proxy`, `admin-users`, `process-email-queue`, `apresentacao-cadencia-runner`) + extensões nesta iteração: `admin-sessions`, `validate-invite`, `notify-admin-new-signup`, `auth-email-hook`.
- Pendente (não-críticos): `correios-api`, `handle-email-suppression`, `handle-email-unsubscribe`, `preview-transactional-email`, `send-transactional-email`, `social-sync` — ainda usam `console.*` mas baixo volume e fluxos não-fiscais.

### 6. Painel admin "Saúde do sistema" (Eixo D.4)
- ✅ Implementado em `src/pages/admin/sections/SaudeSistemaSection.tsx` + hook `useSaudeSistema` (`src/pages/admin/hooks/useSaudeSistema.ts`).
- Lê `v_admin_audit_unified` (eventos por módulo 24h/7d) + `email_send_log` (taxa de erro de envio) + `email_send_state` (backoff). Renderiza com `<HealthBadge>` para integrações (e-mail/auditoria/permissões), KPI 24h de e-mail e tabela de atividade por módulo. Refresh manual + auto-refresh a cada 5min.
- Acessível em `/administracao?tab=saude` (item "Saúde do sistema" sob "Dados & Auditoria").
- Próximos incrementos opcionais: latência média de RPCs críticos (precisa instrumentação) e status real das filas pgmq (depende de RPC dedicada).

### 7. Hardening TypeScript — lote financeiro/fiscal (Eixo B.2)
- ✅ Concluído. `tsconfig.strict-core.json` agora cobre `src/services/financeiro/**`, `src/services/fiscal/**`, `src/pages/financeiro/**` e `src/pages/fiscal/**` com `strict: true` e zero erros.
- 6 correções aplicadas: (1) `useConciliacaoBancaria` removeu `|| null` morto na RPC `sugerir_conciliacao_bancaria` (param `p_conta_id` é sempre `string`); (2) `useNotaFiscalLifecycle` trocou `motivo ?? null` por `motivo` (RPC aceita `string | undefined`); (3-6) os 4 serviços Sefaz (`autorizacao`, `cancelamento`, `consulta`, `inutilizacao`) extraíram `certBase64`/`certSenha` em locais antes do branch `useVault ? null : {...}` para o TS estreitar `string | undefined` → `string`.
- Próximo lote sugerido: `src/services/comercial/**`, `src/services/admin/**` e `src/services/cadastros/**`.

### 8. Centralização dos tipos de RPC
- ✅ `src/types/rpc.ts` agora expõe `RpcName`/`RpcArgs`/`RpcReturn`/`invokeRpc` + atalhos nomeados para as RPCs críticas: `proximoNumeroOrcamento`, `proximoNumeroPedidoCompra`, `sugerirConciliacaoBancaria`, `aprovarPedido`, `rejeitarPedido`, `cancelarPedidoCompra`, `receberCompra`.
- Próximo incremento (não bloqueante): migrar incrementalmente os ~15 call sites em `usePedidosCompra`, `Orcamentos`, `OrcamentoForm`, `RegistrarRecebimentoDialog` para os atalhos — uma renomeação no banco quebrará apenas em `rpc.ts`.

---

## 🟢 Polimento de produto

### 9. Acessibilidade dos diálogos críticos (Eixo E.3)
- ✅ Auditados os 4 dialogs do plano:
  - `ApresentacaoGeracaoDialog`, `LimparDadosMigracaoButton`, `TempPasswordDialog` — já tinham `DialogDescription` (Radix mapeia para `aria-describedby`) + `aria-label` nos botões-ícone. OK.
  - `SefazRetornoModal` — faltava `DialogDescription` e bloco de erros sem `role="alert"`. **Corrigido**.
- Esc/foco inicial são gerenciados pelo Radix `Dialog`/`AlertDialog` por padrão — manter. Próximo passo opcional: integrar `axe-core` em testes de smoke para regressão automática.

### 10. Code-split / bundle
- ✅ `src/App.tsx` usa `lazy()` para todas as páginas (Workbook, Apresentação, Fiscal, Financeiro, Importação, Pedidos, Orçamentos, Cotações, Auditoria, Administração, etc.). Não há rotas eagerly-loaded fora de `Login`/`Signup`/`NotFound`.
- Próximo incremento (opcional): rodar `npm run build -- --report` para identificar chunks ainda > 250 KB gzip e aplicar `lazy()` em sub-componentes pesados (ex.: `OrcamentoForm` 1.272 LOC, `ApresentacaoSlidesPreview`).

### 11. Componentes novos sugeridos (reaproveitáveis)
- ✅ **`<ConfirmDestructiveDialog>`** — Implementado em `src/components/ConfirmDestructiveDialog.tsx` + hook `useConfirmDestructive`. Aplica a árvore de `mem://produto/excluir-vs-inativar-vs-cancelar` (motivo obrigatório, lista de efeitos colaterais, badge "Ação terminal"). Migração das telas que ainda usam `window.confirm`/`ConfirmDialog` para ações terminais é incremental.
- ✅ **`<HealthBadge>`** — Implementado em `src/components/HealthBadge.tsx`. 5 estados (`healthy`/`degraded`/`down`/`unknown`/`checking`), tooltip opcional com detalhes (latência, última checagem) e modo `compact` para tabelas densas. Próximo passo: endpoint `/integracoes/health` (ou equivalente) consolidando Sefaz/SMTP/Correios/AI Gateway para alimentar o painel de saúde (#6).
- ✅ **`<AsyncJobStatus>`** — Implementado em `src/components/AsyncJobStatus.tsx`. 6 estados (`queued`/`running`/`succeeded`/`failed`/`cancelled`/`paused`), barra de progresso opcional em `running`, mensagem com `role="alert"` em `failed`/`cancelled` e modo `compact` para tabelas. Pronto para substituir incrementalmente badges ad-hoc em `ImportacaoTimeline`, `ApresentacaoHistoricoTable`, `WorkbookGeracoesTable` e fila de e-mail.
- **`<DiffViewer>`** — para auditoria (`/auditoria`): mostra diffs antes/depois de updates, hoje renderizados como JSON cru.

### 12. Migração final de services (Phase 2 cadastros — Eixo C.1)
Status real (auditoria 2026-04): os 4 services já existiam (`clientes`, `fornecedores`, `transportadoras`, `contasBancarias`); `Funcionarios.tsx` não consome Supabase direto (usa hooks). A dívida residual eram **4 arquivos do domínio cliente** ainda chamando `supabase.from/rpc`:
- ✅ `src/pages/Clientes.tsx` — 2 lookups (`grupos_economicos`, `formas_pagamento`) movidos para `listGruposEconomicosAtivos` + `listFormasPagamentoAtivas` em `clientes.service.ts`.
- ✅ `src/pages/clientes/components/ClienteEnderecosTab.tsx` — load/CRUD/`set_principal_endereco` agora via service.
- ✅ `src/pages/clientes/components/ClienteTransportadorasTab.tsx` — load/vincular/desvincular via service.
- ✅ `src/pages/clientes/components/ClienteComunicacoesTab.tsx` — load/insert via service.

Resultado: nenhum `import { supabase }` em `src/pages/Clientes.tsx` ou `src/pages/clientes/**`. Typecheck verde. Os demais 4 services do plano (`fornecedores`, `transportadoras`, `contasBancarias`, e funcionários via hook) já não tinham consumidores com query direta.

---

## Ordem sugerida

1. **#1 forwardRef Badge** (10 min, mata um warning visível)
2. **#2 Security Definer views** (segurança real)
3. **#11 ConfirmDestructiveDialog** (ganho de UX e consistência rápido)
4. **#4 Testes núcleo** (lote fiscal+financeiro+workbook)
5. **#7 Strict TS** lote fiscal/financeiro ✅
6. **#5 Logger Edge** + **#6 Painel saúde** (juntos fazem sentido) ✅
7. **#12 Services cadastros** (zera dívida arquitetural)
8. **#9 A11y** + **#10 bundle** (polimento final)

Diga qual item (ou bloco) você quer atacar primeiro e eu executo.
