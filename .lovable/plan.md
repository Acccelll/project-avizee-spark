## Etapa 2 — Backend: dados, paginação & resiliência

Escopo confirmado na auditoria:
- **14 `TODO(paginação)`** em 8 services (orcamentos, estoque, pedidosCompra, cotacoesCompra, recorrencias, precosEspeciais, comprasLifecycle, logistica/{remessas,entregas,prepostagem}).
- **11 Edge Functions com `fetch` externo**; só 3 têm `AbortController` (sefaz-proxy, sefaz-distdfe, webhooks-dispatcher). 8 sem timeout: correios-api, consultadanfe-proxy, social-sync, instagram-oauth, ia-sugestao, ia-extracao-documento, process-nfe-retry-cron, process-distdfe-cron.
- Não existe `_shared/validate.ts` — validações são ad-hoc.
- Tetos defensivos (`limit(500)` em cadastros pequenos como sócios/plano de contas) ficam — não viram paginação server.

Ordem de execução (4 PRs, baixo→médio risco):

### PR-2.1 — Paginação server-side dos `TODO(paginação)`

Concluído (abordagem revisada): substituídos os `.limit(N) // TODO(paginação)` por
`fetchAllPages` (chunks de 1000, hard cap de 50k) via novo helper
`src/services/_lib/fetchAllPages.ts` (re-export do canônico em
`services/relatorios/lib/`). Isso elimina o teto silencioso (1k/2k) sem alterar
assinaturas públicas nem UIs. Lista paginada server-side com `count: exact` fica
reservada para casos em que volume real comprovar necessidade (Financeiro/Notas
Fiscais já adotam o padrão via `useFinanceiroLancamentosPaged` /
`fetchNotasFiscaisPaged`).

Services atualizados:
- `orcamentos.service.ts` (2x lookups)
- `estoque.service.ts` (3x: produtos, vw_estoque_posicao, movimentos)
- `cotacoesCompra.service.ts` (1x produtos)
- `pedidosCompra.service.ts` (3x: produtos, pedidos, produtos para form)
- `recorrencias.service.ts` (1x)
- `precosEspeciais.service.ts` (2x)
- `comercial/comprasLifecycle.service.ts` (1x)
- `logistica/{remessas,prepostagem,entregas}.service.ts` (4x)

Verificação: `rg "TODO\(pagina" src` → 0.

Arquivos:
- `src/services/orcamentos.service.ts` (2x — históricos, listagem)
- `src/services/estoque.service.ts` (2x — movimentos, posições)
- `src/services/pedidosCompra.service.ts` (3x)
- `src/services/cotacoesCompra.service.ts` (1x)
- `src/services/recorrencias.service.ts` (1x)
- `src/services/precosEspeciais.service.ts` (2x)
- `src/services/comercial/comprasLifecycle.service.ts` (1x)
- `src/services/logistica/{remessas,entregas,prepostagem}.service.ts` (4x)
- `src/pages/admin/hooks/useEventosAdminTimeline.ts` (timeline — vira infinite query com `useInfiniteQuery`).

Telas a migrar para paginação visível (já têm `DataTable`):
- Cotações de Compra, Pedidos de Compra, Recorrências, Preços Especiais, Remessas, Entregas, Pré-postagens, Histórico de Orçamentos.

Telas onde scroll virtual cabe melhor (lista densa, sem paginação clássica): `useEventosAdminTimeline` com `@tanstack/react-virtual` (já no projeto).

Verificação: `rg "TODO\(pagina" src` → 0. Smoke test em cada tela com >2000 registros simulados (paginação avança, total bate com `count`).

### PR-2.2 — Auditoria de `select("*")` e N+1

Concluído. Auditoria executada nas 27 chamadas `select("*")` dos services e nos
services de logística/compras/orçamentos/estoque.

Ajustes aplicados (alto volume, payload mensurável):
- `logistica/entregas.service.ts` — `vw_entregas_consolidadas` agora seleciona
  explicitamente as 15 colunas do `ViewRow` (antes puxava todas as colunas da
  view consolidada, inclusive joins internos).
- `estoque.service.ts` — `vw_estoque_posicao` agora seleciona explicitamente as
  12 colunas do `EstoquePosicaoRow`.

Mantidos como `*` (decisão registrada):
- Lookups de form (`listClientesAtivosOrcamento`, `listProdutosAtivosComFornecedores`,
  `fetchProdutosEstoque`) — consumidores tipados pelo `Tables<...>` gerado dependem
  da row completa; restringir quebraria contratos espalhados em ~12 componentes.
- CRUDs single-row (`getOrcamentoById`, `getPedidoCompra`, etc.) — payload já é 1
  registro; ganho nulo.
- Joins embedados específicos (`*, produtos(nome,sku)`) — `produtos` já é restrito;
  o `*` é da tabela principal (poucos itens por página).

N+1: varredura de loops `for/map` em logística, compras, orçamentos e estoque não
revelou chamada Supabase por item — todos os fan-outs já usam `.in(...)` ou
`Promise.all` controlado (`fetchRemessasRastreioPorDocumento`, geração de PDF de
pré-postagem, hidratação de remessas por OV).

Verificação: `bunx vitest run` → 785/785 verdes. Payload do consolidado de
entregas cai conforme número de colunas extras retiradas pelo PostgREST.

### PR-2.3 — Resiliência das Edge Functions

Criar `supabase/functions/_shared/validate.ts`:
- `validateJson<T>(req, schema): Promise<{ data: T } | Response>` com Zod (já usado em outras funções), retornando 400 padronizado com `corsHeaders`.
- `fetchWithTimeout(url, init, ms): Promise<Response>` envolvendo `AbortController` + 504 amigável; reuso de retry exponencial só em 5xx/timeout.

Aplicar em todas as 8 funções sem timeout (timeouts sugeridos):
- `correios-api` (15s), `consultadanfe-proxy` (20s), `social-sync` (20s por chamada), `instagram-oauth` (10s), `ia-sugestao`/`ia-extracao-documento` (60s — modelos longos), `process-nfe-retry-cron`/`process-distdfe-cron` (já usam sefaz wrappers, validar cadeia).

CORS: confirmar que toda função browser-facing usa `buildCorsHeaders(origin)` em vez de `*`; crons internos podem manter `ALLOWED_ORIGIN ?? "*"` (aceitável).

cron-health: garantir `recordCronHealth` em `process-distdfe-cron`, `process-nfe-retry-cron`, `process-email-queue`, `apresentacao-cadencia-runner`, `social-sync` (modo cron).

Validação Zod (body) adicionada onde hoje há checagem ad-hoc: `correios-api`, `consultadanfe-proxy`, `ia-sugestao`, `ia-extracao-documento`, `send-transactional-email`, `validate-invite`, `notify-orcamento-resposta`, `instagram-oauth`, `webhooks-dispatcher`, `admin-sessions`, `admin-users`, `test-smtp`.

Verificação: chamar cada função com body inválido → 400 claro. `nc`/curl bloqueando upstream → 504 sem pendurar. Logs sem PII (`logger` já mascara — auditar call sites novos).

### PR-2.4 — Integridade de fluxos multi-tabela

Mapeamento (auditoria leve — sem nova RPC se já existir):
- **Emissão NF → financeiro → estoque:** verificar se passa por RPC `confirmar_nota`/`autorizar_nfe` (memória já confirma). Se algum branch ainda escreve em múltiplas tabelas direto do client, propor RPC `SECURITY DEFINER`.
- **Conversão orçamento → pedido:** já é RPC.
- **Baixa em lote financeira:** já é RPC `baixar_lote`.
- **Cancelamento NF → estorno financeiro/estoque:** revisar `DevolucaoDialog` e `FiscalChaveDialogs` para confirmar atomicidade.

Constraints novas (migration única):
- `chk_orcamentos_total_nonneg`, `chk_pedidos_valor_total_nonneg`, `chk_estoque_movimentos_qtd_positiva` (onde aplicável por tipo), `chk_financeiro_lancamentos_valor_nonneg`.
- Checagens de `status` já existem como `chk_*` (memória) — completar onde faltar.

Verificação: forçar falha no meio de fluxo multi-tabela em ambiente de teste → sem estado órfão (RPC reverte). `supabase--linter` limpo após migration.

## Não-objetivos

- Não tocar RLS (Etapa 3).
- Não refatorar monólitos (Etapa 6).
- Não migrar `useToast` para sonner (Etapa 5).
- Tetos `limit(500)` em cadastros pequenos (sócios, plano de contas, auditDups) ficam como estão.

## Riscos & mitigações

- **Assinatura paginada**: manter wrapper legado evita romper callers atuais; deprecation gradual.
- **Timeouts em IA**: 60s é folgado mas evita falsos 504; quando o modelo de fato pendura, retornamos 504 limpo em vez de browser timeout opaco.
- **Constraints novas**: rodar `SELECT` prévio (via `read_query`) garantindo que dados atuais satisfazem; caso contrário, sanear dados antes da migration.

## Ordem sugerida

1. PR-2.3 (Edge Functions) — independente, alto valor de resiliência.
2. PR-2.1 (paginação) — maior diff, mas mecânico.
3. PR-2.2 (queries) — aproveita refactor de 2.1.
4. PR-2.4 (integridade) — finaliza com migration e auditoria.

Cada PR roda `npm run lint && npm run typecheck && bunx vitest run`.