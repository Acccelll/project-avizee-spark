
## Onda — PWA / offline-first leve (28/abr/2026)

### O que entrou

- `vite-plugin-pwa@1` + `workbox-window@7`, registro manual em
  `src/lib/pwa.ts` (não roda em DEV nem em iframe do preview).
- Manifest "Sistema AviZee" + ícones 192/512/maskable em `public/images/`.
- Estratégias de cache: precache de assets do build; `CacheFirst` para
  Google Fonts; `StaleWhileRevalidate` (5min) só para GETs em
  `clientes/fornecedores/produtos/app_configuracoes`. Mutations e
  domínios sensíveis (NF, financeiro, pedidos) **nunca** são cacheados.
- Componentes globais montados em `App.tsx`:
  - `OfflineBanner` (já existia) — barra amber sticky.
  - `PwaUpdatePrompt` — toast Sonner persistente quando há SW novo.
  - `InstallPwaButton` (variant `floating`) — card flutuante captura
    `beforeinstallprompt`. Variant `inline` disponível para reuso.

### Decisões

- `registerType: "prompt"` evita updates silenciosos em forms abertos.
- Sem Background Sync / fila offline de mutations — escopo "leve".
- iOS Safari não dispara `beforeinstallprompt`; install guide manual fica
  para próxima onda.

### Arquivos

- `vite.config.ts` (plugin VitePWA configurado)
- `index.html` (manifest, theme-color, apple-touch-icon)
- `src/lib/pwa.ts`, `src/main.tsx` (registro do SW)
- `src/components/OfflineBanner.tsx`, `PwaUpdatePrompt.tsx`, `InstallPwaButton.tsx`
- `public/images/pwa-{192,512,512-maskable}.png`
- `.lovable/memory/features/pwa-offline-leve.md`

Próxima frente sugerida: **Multi-tenant `empresa_id` + RLS** (alto risco,
roteiro em `rls-single-tenant.md`) ou **Install guide para iOS Safari**.
# Auditoria — onda de correções priorizada

A auditoria que você passou tem itens já resolvidos pelas Ondas 1-6 (Logística já tem `src/services/logistica/` com `remessas`/`recebimentos`/`lookups`; `Fiscal.tsx` e `Orcamentos.tsx` não acessam mais Supabase direto — chamam `upsertNotaFiscalComItens` e `duplicateOrcamento`). O risco real está **dentro dos services** e em alguns pontos de infraestrutura. Abaixo o plano para o que de fato precisa de correção, agrupado por bloco entregável.

## Bloco 1 — Críticos de segurança e atomicidade

### 1.1 `vite.config.ts`: remover fallbacks hardcoded
- Remover `FALLBACK_SUPABASE_URL`, `FALLBACK_SUPABASE_PUBLISHABLE_KEY`, `FALLBACK_SUPABASE_PROJECT_ID` e `FALLBACK_APP_URL`.
- O bloco `define` passa a usar apenas `process.env.VITE_*`; quando ausente, injeta `undefined` (string `"undefined"` no bundle), e `isSupabaseConfigured` em `src/integrations/supabase/client.ts` já cobre o caso com mensagem clara.
- Atualizar `.env.example` listando as 4 variáveis como obrigatórias.
- Como o build do preview Lovable já provê essas envs automaticamente, isto não quebra o ambiente atual; apenas elimina o vínculo de fork ao endpoint de produção.

### 1.2 RPC `salvar_nota_fiscal` (Fiscal — atomicidade)
- Migração SQL criando `public.salvar_nota_fiscal(p_nf_id uuid, p_payload jsonb, p_itens jsonb) returns uuid` com `SECURITY DEFINER`, `SET search_path = public` (regra core do projeto).
- Lógica em transação única:
  1. Se `p_nf_id` é nulo → `INSERT` em `notas_fiscais` retornando `id`; senão `UPDATE`.
  2. `DELETE` de `notas_fiscais_itens WHERE nota_fiscal_id = id`.
  3. `INSERT` em massa dos itens a partir do JSONB.
- Refatorar `upsertNotaFiscalComItens` em `src/services/fiscal.service.ts` para uma única chamada `supabase.rpc('salvar_nota_fiscal', ...)`. Remover os 3 round-trips atuais (linhas 175-196).
- Tipagem via `src/types/rpc.ts` (`callRpc`) seguindo o padrão já estabelecido.

### 1.3 RPC `duplicar_orcamento` (Orçamentos — atomicidade)
- Migração SQL criando `public.duplicar_orcamento(p_orcamento_id uuid) returns jsonb` (`{ id, numero }`) com `SECURITY DEFINER`, `search_path = public`.
- Internamente usa a sequence/RPC `proximo_numero_orcamento` já existente, copia cabeçalho como `rascunho` e replica os itens em uma transação.
- Refatorar `duplicateOrcamento` em `src/services/orcamentos.service.ts` para uma única chamada de RPC (substituindo os 4 passos atuais nas linhas 175-240).

## Bloco 2 — Robustez de fetch e CI

### 2.1 `useSupabaseCrud`: propagar `AbortSignal` no loop chunked
- React Query 5 entrega `signal` em `queryFn`. Hoje o hook ignora.
- Mudanças em `src/hooks/useSupabaseCrud.ts`:
  - Receber `{ signal }` no `queryFn`.
  - Encadear `.abortSignal(signal)` em `buildQuery()` (suportado pelo Supabase JS v2 PostgREST builder) tanto no modo `paged` quanto no loop `all`.
  - Sair do `while (true)` quando `signal.aborted` for true, sem `setState`.
- Sem mudança na API pública do hook.

### 2.2 GitHub Actions — pipeline mínimo
- Criar `.github/workflows/ci.yml` com jobs em paralelo:
  - `typecheck` → `npm run typecheck:core` (config strict já existe em `tsconfig.strict-core.json`).
  - `lint` → `npm run lint`.
  - `test` → `npx vitest run`.
  - `schema-drift` → `node scripts/check-schema-drift.mjs`.
- `lint:touch-targets` fica como step não-bloqueante (`continue-on-error: true`).
- Trigger: `pull_request` + `push` em `main`.
- Sem secrets necessários (testes não tocam Supabase real; schema-drift usa snapshot local).

## Itens deliberadamente fora desta entrega

Para manter a onda focada e revisável, **não** incluo agora:
- Migração de forms para Zod (Bloco MÉDIA) — entrega separada por módulo.
- Auditoria das 32 supressões de `exhaustive-deps` (MÉDIA) — varredura própria.
- Dynamic imports de ExcelJS/pptxgenjs (FUTURA) — ganho marginal, requer benchmark.
- `PeriodFilter direction`, `MonthFilter`, `rowExtraActions`, Budget vs Realizado, Notificações proativas, PWA, Webhooks de saída, Multi-tenant — são features/refactors maiores já documentados em `.lovable/plan.md` e merecem ondas próprias.

Se quiser, depois desta onda eu abro a próxima já com 1-2 desses itens combinados (sugiro `PeriodFilter direction` + `rowExtraActions` por terem spec pronta no `plan.md`).

## Resumo técnico de arquivos tocados

```text
vite.config.ts                                  (remover fallbacks)
.env.example                                    (4 envs obrigatórias)
supabase/migrations/<ts>_salvar_nota_fiscal.sql (nova RPC)
supabase/migrations/<ts>_duplicar_orcamento.sql (nova RPC)
src/services/fiscal.service.ts                  (usar RPC)
src/services/orcamentos.service.ts              (usar RPC)
src/hooks/useSupabaseCrud.ts                    (AbortSignal)
.github/workflows/ci.yml                        (novo)
```

## Verificação pós-implementação

- Editar uma NF existente removendo itens e salvando → confirmar que o cabeçalho e itens permanecem consistentes mesmo se a chamada for interrompida.
- Duplicar orçamento → checar `numero` sequencial e itens copiados; em falha simulada, nenhum cabeçalho órfão fica no banco.
- Trocar filtro rapidamente em uma listagem grande (`paginationMode: 'all'`) → confirmar nos devtools que requests pendentes são canceladas.
- Abrir PR no GitHub → confirmar que os 4 jobs do CI executam.

Aprova para eu executar este plano?

---

## Onda complementar — verificação `PeriodFilter direction` + `rowExtraActions` (28/abr/2026)

Antes de iniciar mudanças, varredura confirmou que ambos os itens **já estão implementados e adotados**:

- `PeriodFilter` expõe `direction?: 'past' | 'future' | 'neutral'` (default `past`), com chips,
  ícones (`History`/`CalendarClock`/`Calendar`) e tooltips específicos por direção.
  - `direction="future"` em uso: `Financeiro.tsx`, `FluxoCaixa.tsx`, `MonthFilter` em `Financeiro`.
  - `direction="past"` (explícito) em uso: `Pedidos.tsx`, `Orcamentos.tsx`, `Conciliacao.tsx`, `Estoque.tsx`.
  - `Auditoria.tsx` usa default (`past`), apropriado para log histórico.
- `DataTable.rowExtraActions?: (item) => ReactNode` (linha 168 de `src/components/DataTable.tsx`)
  já consumido em: `Orcamentos`, `Logistica` (entregas + recebimentos), `compras/PedidoCompraTable`,
  `Financeiro`, `Pedidos`.

Sem gap funcional → nenhuma alteração de código necessária nesta onda. Próxima frente sugerida:
migração de forms para Zod (NF, Orçamento, Cliente) ou multi-tenant `empresa_id`.

---

## Onda — Dynamic imports ExcelJS / pptxgenjs (28/abr/2026)

Objetivo: tirar as duas libs mais pesadas do bundle inicial. Cada uma só é necessária quando o usuário aciona uma ação explícita (gerar workbook, gerar apresentação, importar planilha).

- `src/services/workbookService.ts`: removido `import { generateWorkbook }` estático;
  introduzido helper `loadGenerateWorkbook()` com `await import('@/lib/workbook/generateWorkbook')`.
  Toda a árvore `src/lib/workbook/*` (que importa `exceljs`) passa a virar um chunk separado
  via code-splitting do Vite/Rollup.
- `src/services/apresentacaoService.ts`: import de `generatePresentation` virou `import type` +
  helper `loadGeneratePresentation()` com `await import('@/lib/apresentacao/generatePresentation')`.
  `pptxgenjs` (~250KB) sai do bundle inicial.
- `src/lib/xlsx-compat.ts`: ExcelJS agora carregado via `loadExcelJS()` (cached promise) em vez
  de `import ExcelJS from "exceljs"` no topo. `read()` continua síncrona (já retornava workbook
  com `_loaded` promise — consumidores já chamam `await ensureLoaded(wb)`). `utils.book_new` e
  `utils.json_to_sheet` viraram `async` (sem consumidores ativos — verificado).
- `src/services/export.service.ts` já usava `await import("exceljs")` desde o Bloco 1.

Resultado esperado: três chunks lazy distintos — `chunk-workbook.*.js` (ExcelJS + planilhas
gerenciais), `chunk-apresentacao.*.js` (pptxgenjs), `chunk-exceljs.*.js` (compartilhado entre
xlsx-compat e export.service). Bundle inicial deixa de carregar ~650KB de libs Office.

Sem mudança na API pública dos services consumidos por componentes/páginas.

---

## Onda — Auditoria Zod nos formulários (28/abr/2026)

Antes de iniciar mudanças, varredura confirmou que **todos os formulários
críticos já validam com Zod**. Não há código a alterar nesta onda.

| Formulário | Schema | Mecanismo |
|---|---|---|
| NF-e (`pages/fiscal/components/NFeForm`) | `nfeSchema` (com `superRefine` p/ CFOP e parcelas) | `zodResolver` + react-hook-form |
| Orçamento (`pages/OrcamentoForm.tsx`) | `orcamentoSchema` | `zodResolver` + react-hook-form |
| Pedido de Compra (`hooks/usePedidosCompra.ts`) | `pedidoCompraSchema` + `validatePedidoItems` | `validateForm()` helper |
| Cotação de Compra (`hooks/useCotacoesCompra.ts`) | `cotacaoCompraSchema` + `validateCotacaoItems` | `validateForm()` helper |
| Cliente (`pages/Clientes.tsx`) | `clienteFornecedorSchema` | `validateForm()` helper |
| Fornecedor (`pages/Fornecedores.tsx`) | `clienteFornecedorSchema` | `validateForm()` helper |
| Produto (`pages/Produtos.tsx`) | `produtoSchema` (com `extend` p/ insumo) | `validateForm()` helper |
| Transportadora (`pages/Transportadoras.tsx`) | `transportadoraSchema` | `validateForm()` helper |
| Configuração Fiscal / SPED | schemas próprios | `zodResolver` |

Convivem dois padrões válidos: `zodResolver` (forms grandes com
react-hook-form) e `validateForm()` helper (forms imperativos com `useState`).
Ambos retornam erros por campo — não há divergência funcional. Decisão: manter
os dois padrões; não vale o risco de refatorar `Clientes/Fornecedores/Produtos`
para react-hook-form sem ganho de UX correspondente.

Próximas frentes candidatas: **Painel de saúde do sistema** (admin),
**Multi-tenant `empresa_id` + RLS** ou **Notificações proativas (email queue
+ in-app badges)**.

---

## Onda — Painel de saúde do sistema (28/abr/2026)

Painel `/administracao?tab=saude` já existia cobrindo e-mail/auditoria/
permissões. Esta onda **estendeu** com duas integrações críticas que estavam
fora do radar:

- **Fila pgmq de e-mail** (`auth_emails`, `transactional_emails`, `*_dlq`).
  Nova RPC `public.email_queue_metrics()` (SECURITY DEFINER, admin-only,
  `search_path = public`) varre `pgmq.q_*` e devolve `total_messages` e
  `oldest_msg_age_seconds`. Card dedicado mostra a tabela de filas com badge
  DLQ destacando mensagens travadas.
- **Sefaz proxy** — nova action `health` na edge function `sefaz-proxy`
  (apenas valida JWT, devolve `{ ok, hasPfxPassword, timestamp }`). Hook faz
  ping a cada refresh e mede latência. Classifica `down` / `degraded` /
  `healthy` conforme resposta + presença do secret de senha do PFX.

Limites de classificação (em `useSaudeSistema.ts`):
- Fila: DLQ>0 → `down`. ≥200 pendentes ou idade ≥1h → `down`. ≥50 ou ≥15min → `degraded`.
- Sefaz: erro → `down`. Sem PFX → `degraded`. OK → `healthy` com latência.

Arquivos:
- `supabase/migrations/<ts>_email_queue_metrics.sql` (nova RPC)
- `supabase/functions/sefaz-proxy/index.ts` (action `health`)
- `src/pages/admin/hooks/useSaudeSistema.ts` (filas + sefaz)
- `src/pages/admin/sections/SaudeSistemaSection.tsx` (card de filas + ícones)
- `.lovable/memory/features/painel-saude-sistema.md` (atualizada)

Próxima frente sugerida: **Notificações proativas** (in-app badges puxando
da fila pgmq + email_send_log) ou **Multi-tenant `empresa_id` + RLS**.

---

## Onda — Notificações proativas no sidebar (28/abr/2026)

Estende o pipeline já existente (`useSidebarAlerts` + `useSidebarBadges` +
canal singleton `sidebar-alerts-shared`) com duas novas fontes operacionais
críticas:

- **Fiscal — NF rejeitada**: contagem de `notas_fiscais` ativos com
  `status = 'rejeitada'` aparece no módulo `fiscal` e na rota `/fiscal`
  com tom `danger`. Realtime cobre via novo listener em `notas_fiscais`.
- **Administração — DLQ de e-mail**: soma de mensagens nas filas
  `*_dlq` via RPC `email_queue_metrics()`. Como a RPC é admin-only, o
  service só invoca quando `useIsAdmin()` retorna true; para os demais o
  badge fica em 0 e não polui a UI.

QueryKey passa a incluir `{ isAdmin }` para invalidar quando a role muda.
Tons preservam o contrato (`danger`/`warning`/`info`). Memória nova:
`features/notificacoes-proativas-sidebar.md`.

Arquivos:
- `src/services/sidebarAlerts.service.ts` (novas contagens)
- `src/hooks/useSidebarAlerts.ts` (admin gate + queryKey)
- `src/hooks/useSidebarBadges.ts` (mapeamento fiscal/admin)
- `src/lib/realtime/alertsChannel.ts` (escuta `notas_fiscais`)

Próxima frente sugerida: **Multi-tenant `empresa_id` + RLS** (alto risco,
roteiro pronto em `rls-single-tenant.md`) ou **Webhooks de saída** para
integrações externas.

---

## Onda — Webhooks de saída (28/abr/2026)

Infraestrutura completa para emitir eventos do ERP para sistemas externos
via HTTP POST assinado.

### O que entrou

- Tabelas `webhooks_endpoints` (catálogo) e `webhooks_deliveries`
  (histórico de tentativas) com RLS admin-only e `chk_` em status/URL.
- Fila `pgmq.webhook_events` consumida pelo dispatcher.
- Triggers em `notas_fiscais`, `orcamentos`, `ordens_venda`,
  `pedidos_compra` enfileiram payloads quando o status muda.
- Edge function `webhooks-dispatcher` (cron 1min via pg_net + ação
  manual) que: lê fila, busca endpoints assinantes, faz POST com
  `X-AviZee-Signature` (HMAC SHA-256), persiste delivery e aplica
  retry exponencial até 5 tentativas.
- RPCs `webhooks_create_endpoint`, `webhooks_rotate_secret`,
  `webhooks_increment_counter`, `webhooks_metrics` (todas
  SECURITY DEFINER + `search_path = public`).
- UI `/administracao?tab=webhooks` com KPIs, CRUD de endpoints,
  reveal one-shot do segredo, tabela de deliveries com filtro por
  endpoint e botão "Disparar agora".

### Decisões

- **Secret HMAC = `secret_hash`**: o banco nunca guarda o segredo em
  texto puro; quem valida do outro lado armazena o mesmo hash que o
  admin recebeu via dialog. Trade-off: simplicidade vs vault — vale
  o ganho operacional para esta primeira versão.
- Catálogo `WEBHOOK_EVENTOS` em `src/services/webhooks.service.ts`
  é a fonte client-side; o banco aceita texto livre, mas a UI valida.
- `webhooks-dispatcher` com `verify_jwt = false` para o cron
  funcionar; é admin-only no painel via gate de UI e o dispatcher
  só consome fila + faz POST para endpoints já cadastrados pelo admin.

### Arquivos

- `supabase/migrations/<ts>_webhooks_*.sql` (estrutura + cron)
- `supabase/functions/webhooks-dispatcher/index.ts`
- `src/services/webhooks.service.ts`
- `src/pages/admin/hooks/useWebhooks.ts`
- `src/pages/admin/sections/WebhooksSection.tsx`
- `src/pages/Administracao.tsx` (rota `webhooks`)
- `supabase/config.toml` (entrada da função)
- `.lovable/memory/features/webhooks-saida.md`

### Iterações pós-onda (28/abr/2026)

- **Replay individual**: nova RPC `webhooks_replay_delivery(uuid)`
  (admin-only) zera tentativas e marca `proxima_tentativa_em = now()`
  para o dispatcher reenviar no próximo ciclo. Botão "Send" aparece na
  tabela de deliveries apenas para entregas em `falha`/`cancelado`.
- **Webhooks no painel de saúde**: `SaudeSistemaSection` ganha cartão
  "Webhooks de saída" alimentado por `webhooks_metrics()`.
  Classificação: `down` se ≥10 falhas 24h ou ≥200 na fila;
  `degraded` se ≥1 falha ou ≥50 na fila; `unknown` se sem endpoints.

Próxima frente sugerida: **Multi-tenant `empresa_id` + RLS** (alto risco,
roteiro em `rls-single-tenant.md`) ou **PWA / offline-first leve**.
### Próximas frentes candidatas

- **Replay de delivery individual** (botão "reenviar" + endpoint
  `?action=retry&delivery=<id>` no dispatcher).
- **Integração ao painel de saúde**: card consumindo
  `webhooks_metrics()` ao lado das filas de e-mail.
- **Multi-tenant `empresa_id` + RLS** (alto risco/impacto).

## Onda — Multi-tenant Onda 1: Cadastros (28/abr/2026)

### Decisões aprovadas
- **Modelo:** 1 usuário = 1 empresa fixo (`user_empresas` com PK `user_id`, expansível para N:N).
- **Backfill:** empresa default `"AviZee — Empresa Padrão"` recebe todos `auth.users` e todas as linhas existentes.
- **Escopo:** fatiado — apenas `clientes`, `fornecedores`, `produtos` nesta onda.

### O que entrou
- Tabelas `public.empresas` e `public.user_empresas` com RLS (admin-only para writes).
- Função `public.current_empresa_id()` SECURITY DEFINER (sem recursão de policy).
- Coluna `empresa_id NOT NULL DEFAULT current_empresa_id()` em clientes/fornecedores/produtos + índices.
- Trigger `set_empresa_id_default()` BEFORE INSERT como safety-net.
- RLS reescrita: `empresa_id = current_empresa_id() OR has_role(uid,'admin')`.
- Backfill 100% (sem perda de dados).

### Por que não quebrou o frontend
- `DEFAULT current_empresa_id()` torna a coluna opcional no tipo gerado pelo Supabase, então os QuickAdd e demais inserts continuam compilando sem precisar enviar `empresa_id`.

### Linter
- 404 warnings pré-existentes (security-definer views da onda fiscal; RLS USING(true) das tabelas single-tenant ainda não migradas). Nenhum novo finding introduzido por esta onda.

### Próximas ondas
- **Onda 2:** Comercial (orcamentos, ordens_venda) + Compras.
- **Onda 3:** Estoque + Logística.
- **Onda 4:** Financeiro + Fiscal (mais sensível — exige reescrita de RPCs).
- **UI admin de empresas/vínculos** (hoje só via SQL).

## Onda — Multi-tenant Onda 2: Comercial + Compras (28/abr/2026)

### O que entrou
- `empresa_id NOT NULL DEFAULT current_empresa_id()` em `orcamentos`, `ordens_venda`, `compras`, `pedidos_compra`.
- Backfill 100% para empresa padrão; índices + triggers BEFORE INSERT como safety-net.
- RLS por empresa nos parents; itens herdam via EXISTS(parent).

### Por que itens não ganharam coluna
- Evita inconsistência item↔parent. Filho sempre lê empresa do pai por FK.

### Linter
- 404 → 380 (24 RLS USING(true) eliminados). Frontend não precisou mudar (DEFAULT torna empresa_id opcional no Insert tipado).

### Próximas ondas
- **Onda 3:** Estoque + Logística (estoque_movimentos, conciliacao_bancaria).
- **Onda 4:** Financeiro + Fiscal — exige reescrita de `salvar_nota_fiscal` e views `vw_workbook_*` para propagar filtro empresa.
