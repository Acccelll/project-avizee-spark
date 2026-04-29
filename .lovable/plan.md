# Módulo Social — Retomada com foco em Instagram

## Diagnóstico do estado atual

**O que já existe:**
- Tabelas `social_contas`, `social_metricas_snapshot`, `social_posts` com RLS aberta a `authenticated`.
- RPCs stub: `social_dashboard_consolidado`, `social_posts_filtrados`, `social_sincronizar_manual`, `social_alertas_periodo` — todas retornando dados vazios/fake.
- Edge function `social-sync` com chamada Graph API real (`/v19.0/{id}/media`, `/insights`) mas usando token global de env (`INSTAGRAM_ACCESS_TOKEN`) — não suporta múltiplas contas, não persiste no banco, não renova token, retorna mock se token ausente.
- UI completa em abas: `Dashboard | Contas | Métricas | Posts | Alertas | Relatórios` (`src/pages/Social.tsx` + `src/components/social/*`).
- Provider mock (`socialProviders.ts`) que apenas devolve cenário de homologação.
- Módulo escondido atrás de `VITE_FEATURE_SOCIAL=true` na sidebar.
- Permissões RBAC já mapeadas (`social:visualizar`, `:configurar`, `:sincronizar`, `:exportar`, `:gerenciar_alertas`).

**O que falta (gaps reais, em ordem de prioridade):**
1. **OAuth real do Instagram** — não há fluxo de login, token está hardcoded como secret global.
2. **Persistência por conta** — token, refresh, expiração, escopos por linha em `social_contas`.
3. **Sync real escrevendo no banco** — `social-sync` retorna JSON mas nunca grava em `social_posts` ou `social_metricas_snapshot`.
4. **RPC de dashboard** retorna apenas `total_contas/seguidores/posts` — UI espera estrutura `comparativo[]`, `totais{}` (incompatível).
5. **Schema desalinhado** — código TS espera campos como `nome_conta`, `identificador_externo`, `status_conexao`, `taxa_engajamento`, `tipo_post`, `engajamento_total`; tabelas têm `nome`, `identificador`, sem status, sem engajamento calculado.
6. **Webhooks** — ausente (mudanças em mídia/comentários só via polling manual).
7. **Cron de sync diária** — ausente.
8. **Alertas** — RPC retorna sempre vazio; sem regras (queda de seguidores, token expirando, sync falhando).

## Estratégia: 4 ondas, começando pelo Instagram

Mantenho a UI existente intacta na superfície e endureço camada de dados + integração. LinkedIn fica para depois — toda decisão de schema considera multi-plataforma mas só implementamos Instagram agora.

---

## Onda 1 — Schema alinhado + OAuth Instagram (esta entrega)

**Migration 1: alinhar `social_contas` ao contrato TS**
- `RENAME` `nome` → `nome_conta`, `identificador` → `identificador_externo`.
- `ADD` `status_conexao TEXT NOT NULL DEFAULT 'desconectado'` com `chk_status_conexao IN ('conectado','expirado','erro','desconectado')`.
- `ADD` `url_conta TEXT`, `escopos TEXT[] DEFAULT '{}'`, `ultima_sincronizacao TIMESTAMPTZ`.
- `ADD` `refresh_token TEXT`, `meta_user_id TEXT`, `facebook_page_id TEXT` (long-lived token Instagram precisa do par Page+IG).
- `chk_plataforma IN ('instagram_business','linkedin_page')`.
- Endurecer RLS: `social:visualizar` para SELECT, `social:configurar` para INSERT/UPDATE/DELETE via `has_permission()`.

**Migration 2: alinhar `social_posts` e `social_metricas_snapshot`**
- Posts: adicionar `plataforma`, `id_externo_post` (renomear), `titulo_legenda`, `url_post`, `tipo_post` com check, `salvamentos`, `cliques`, `engajamento_total` GENERATED `(curtidas+comentarios+compartilhamentos+salvamentos)`, `taxa_engajamento NUMERIC(8,4) GENERATED` (engajamento/alcance*100, com guard), `destaque BOOLEAN DEFAULT false`, `campanha_id UUID`.
- Snapshot: adicionar `seguidores_total`, `seguidores_novos`, `visitas_perfil`, `cliques_link`, `engajamento_total`, `taxa_engajamento`, `quantidade_posts_periodo`, `observacoes`. Manter compatibilidade renomeando antigos.
- Índices compostos `(conta_id, data_publicacao DESC)`.

**Migration 3: reescrever RPCs com payload que a UI já espera**
- `social_dashboard_consolidado(_data_inicio, _data_fim)` retorna `{ periodo, comparativo[], totais }` com agregação por plataforma a partir de `social_metricas_snapshot` (último snapshot do período por conta) + JOIN `social_contas`.
- `social_metricas_periodo(_conta_id, ...)` (RPC nova que `socialService` já chama mas não existe).
- `social_alertas_periodo` consulta tabela real (criar `social_alertas` com colunas do contrato TS: `tipo_alerta`, `titulo`, `descricao`, `severidade`, `resolvido`, `data_referencia`).
- `social_sincronizar_manual` apenas enfileira: insere row em `social_sync_jobs` (nova) e devolve job_id; quem executa é a edge function via cron/trigger HTTP.

**Edge function nova: `instagram-oauth`**
- `GET /instagram-oauth/start` — gera URL do Facebook Login com escopos `instagram_basic, instagram_manage_insights, pages_show_list, pages_read_engagement, business_management`, state assinado HMAC com `user_id + nonce`.
- `GET /instagram-oauth/callback` — troca `code` por short-lived token, depois faz exchange para long-lived (60d) via `/oauth/access_token?grant_type=fb_exchange_token`, lista Pages do usuário, para cada Page com IG vinculado cria/atualiza `social_contas` com `meta_user_id`, `facebook_page_id`, `identificador_externo` (IG business id), `access_token`, `token_expira_em = now()+60d`, `status_conexao='conectado'`.
- Secrets necessárias: `META_APP_ID`, `META_APP_SECRET`, `OAUTH_STATE_SECRET`, `ALLOWED_ORIGIN`. Pediremos ao usuário via `add_secret` antes de implantar.
- `verify_jwt = true` em `start`; `false` em `callback` (Meta não envia JWT).

**UI: `SocialContaModal` ganha botão "Conectar com Instagram"**
- Substitui o cadastro manual por redirect para `/functions/v1/instagram-oauth/start?return_to=/social`. Mantém modo "Adicionar manual" para LinkedIn (placeholder).

---

## Onda 2 — Sync real do Instagram (escrita no banco)

**Reescrita da edge function `social-sync`**
- Para cada conta `instagram_business` ativa (ou a especificada por `conta_id`):
  1. Verifica `token_expira_em`; se < 7 dias, faz refresh long-lived (`grant_type=ig_refresh_token`) e atualiza row.
  2. `GET /{ig_id}?fields=followers_count,media_count,name,username,profile_picture_url`.
  3. `GET /{ig_id}/insights?metric=impressions,reach,profile_views,website_clicks&period=day&since=&until=`.
  4. `GET /{ig_id}/media?fields=id,caption,media_type,media_product_type,timestamp,like_count,comments_count,permalink,thumbnail_url&limit=50`.
  5. Para cada media, `GET /{media_id}/insights?metric=impressions,reach,saved,shares` (engajamento real).
  6. Upsert em `social_posts` (chave `(conta_id, id_externo_post)`).
  7. Insere snapshot diário em `social_metricas_snapshot` (chave `(conta_id, data_referencia)` → upsert).
  8. Atualiza `social_contas.ultima_sincronizacao = now()`, `status_conexao='conectado'`.
  9. Em erro 401/190 (OAuthException), marca `status_conexao='expirado'` e cria alerta `severidade='alta'`.
- Tratamento de rate limit (Meta: x-app-usage header) — backoff exponencial.
- Logs estruturados no `logger`.

**Cron de sync diária**
- `pg_cron` invoca `social-sync` todo dia 06:00 BRT, sem `conta_id` (sincroniza todas as contas ativas).
- Migration via insert tool (não migration), pois contém URL+anon key.

**UI**
- `SocialContasTab`: pill de status (`conectado/expirado/erro`), botão "Sincronizar agora" por conta (chama `social-sync` com `conta_id`), botão "Reconectar" quando expirado (volta ao OAuth).
- Toast de progresso usando `useCrossModuleToast`.

---

## Onda 3 — Webhooks Instagram (eventos em tempo real)

Baseado em `fbsamples/graph-api-webhooks-samples`.

**Edge function nova: `instagram-webhooks`**
- `GET` — handshake `hub.mode=subscribe`, valida `hub.verify_token` contra secret `META_WEBHOOK_VERIFY_TOKEN`, devolve `hub.challenge`.
- `POST` — valida assinatura `X-Hub-Signature-256` com `META_APP_SECRET` (HMAC-SHA256 do raw body). Processa entries:
  - Campo `mentions` → cria alerta informativo "Sua conta foi mencionada".
  - Campo `comments` → upsert em `social_posts_comentarios` (tabela nova, leve) + alerta opcional se palavra-chave configurada.
  - Campo `story_insights` → atualiza snapshot.
- Sempre retorna 200 rapidamente (Meta corta após 5s).
- `verify_jwt = false`, `ALLOWED_ORIGIN` irrestrito (endpoint público para Meta).

**Configuração no Meta App** (instrução para o usuário, não código):
- App Dashboard → Webhooks → Instagram → Callback URL = `https://<project-ref>.supabase.co/functions/v1/instagram-webhooks`, Verify Token = secret.
- Subscrever campos: `comments`, `mentions`, `story_insights`, `live_comments`.
- Para cada conta IG conectada via OAuth, fazer `POST /{ig_id}/subscribed_apps?subscribed_fields=...` no callback do OAuth (já entra na Onda 1).

---

## Onda 4 — Alertas inteligentes + relatórios reais

- Trigger `AFTER INSERT ON social_metricas_snapshot` calcula deltas vs snapshot anterior; se queda de seguidores > 2% ou engajamento cai > 30%, insere `social_alertas`.
- Cron diário verifica `token_expira_em < now()+7d` → alerta `severidade='media'`.
- `SocialRelatoriosTab`: PDF mensal reusando padrão de `dashboardFiscalPdf.service.ts`, com gráfico de seguidores e top 10 posts por engajamento.
- Realtime: `ALTER PUBLICATION supabase_realtime ADD TABLE social_alertas` para badge na sidebar (reusa `useSidebarAlerts`).

---

## Detalhes técnicos

**Secrets a pedir antes de Onda 1:**
- `META_APP_ID` (Facebook App ID, público)
- `META_APP_SECRET` (Facebook App Secret)
- `META_WEBHOOK_VERIFY_TOKEN` (string aleatória definida pelo usuário)
- `OAUTH_STATE_SECRET` (gerada automaticamente, 32 bytes)

**Pré-requisitos do lado Meta** (informar ao usuário):
- App Meta tipo "Business", produto "Instagram Graph API" + "Facebook Login for Business" adicionados.
- Conta IG do tipo Business/Creator vinculada a uma Página Facebook.
- Em Dev Mode: usuários testers; em produção: App Review com `instagram_basic`, `instagram_manage_insights`, `pages_read_engagement`.

**Compatibilidade durante a migration**
- A view atual depende dos nomes antigos (`migrations/20260425212212_*.sql`); a migration vai recriar a view após o RENAME.
- `socialService.ts` já espera o contrato novo, então essas colunas farão a UI funcionar sem mudanças após a migration.

**Arquivos que serão criados/editados na Onda 1:**
- `supabase/migrations/<ts>_social_schema_alignment.sql`
- `supabase/migrations/<ts>_social_rpcs_v2.sql`
- `supabase/functions/instagram-oauth/index.ts`
- `supabase/functions/social-sync/index.ts` (refactor leve para preparar Onda 2)
- `src/components/social/SocialContaModal.tsx` (botão OAuth)
- `src/services/social.service.ts` (helper `iniciarOAuthInstagram`)
- `.lovable/memory/features/modulo-social-infraestrutura.md` (atualizar)

## Entrega desta resposta

Implementar **Onda 1 completa**: schema alinhado, RPCs reescritas, edge function `instagram-oauth` operacional e botão de conexão na UI. Após sua aprovação, peço os 3 secrets do Meta e sigo.
