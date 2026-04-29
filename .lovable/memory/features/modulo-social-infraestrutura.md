---
name: Módulo Social — infraestrutura
description: Schema alinhado, OAuth Instagram (Facebook Login for Business), RPCs reais e flag VITE_FEATURE_SOCIAL
type: feature
---

# Módulo Social

## Visibilidade
- Sidebar e quick-search escondem `/social` quando `VITE_FEATURE_SOCIAL !== 'true'` (`src/lib/navigation.ts`).
- Permissões: `social:visualizar` (admin/vendedor/financeiro), `social:configurar`, `:sincronizar`, `:exportar`, `:gerenciar_alertas`. Deny no `user_permissions` vence sempre.

## Schema (Onda 1, 2026-04-29)
- `social_contas`: campos canônicos `nome_conta`, `identificador_externo`, `status_conexao` (chk: conectado/expirado/erro/desconectado), `escopos[]`, `url_conta`, `ultima_sincronizacao`, `refresh_token`, `meta_user_id`, `facebook_page_id`, `access_token`, `token_expira_em`. UNIQUE `(plataforma, identificador_externo)`. RLS: SELECT authenticated, INSERT/UPDATE/DELETE apenas admin via `has_role`.
- `social_posts`: `id_externo_post`, `tipo_post` (chk: feed/reels/story/video/artigo/carousel), `engajamento_total` e `taxa_engajamento` GENERATED, `salvamentos`, `cliques`, `destaque`. UNIQUE `(conta_id, id_externo_post)` para upsert.
- `social_metricas_snapshot`: `seguidores_total`, `seguidores_novos`, `visitas_perfil`, `cliques_link`, `engajamento_total`, `taxa_engajamento`, `quantidade_posts_periodo`. UNIQUE `(conta_id, data_referencia)`.
- `social_alertas`: `tipo_alerta`, `titulo`, `descricao`, `severidade` (chk baixa/media/alta/critica), `resolvido`. RLS: SELECT auth, ALL admin.
- `social_sync_jobs`: fila leve com `status` (pendente/em_execucao/concluido/erro), `resultado` JSONB. RLS admin para escrita.

## RPCs (todas SECURITY DEFINER + search_path = public)
- `social_dashboard_consolidado(_data_inicio, _data_fim)` → `{ periodo, comparativo[], totais }`.
- `social_metricas_periodo(_conta_id, _ini, _fim)` → SETOF snapshot.
- `social_alertas_periodo(_ini, _fim)` → SETOF alertas.
- `social_posts_filtrados(_ini, _fim, _conta_id?)` → join com `social_contas` retornando contrato TS.
- `social_sincronizar_manual(_conta_id?)` → enfileira em `social_sync_jobs`, devolve `{ job_id }`.

## Edge function `instagram-oauth`
- `verify_jwt = false` (Meta callback não envia JWT). `start` valida o bearer manualmente.
- `GET /start` (com Authorization Bearer): assina state HMAC com `OAUTH_STATE_SECRET`, devolve `authorize_url` para `https://www.facebook.com/v19.0/dialog/oauth`.
- `GET /callback`: short-lived → long-lived (60d) → `/me/accounts` com `instagram_business_account{id,username}`. Faz upsert em `social_contas` (chave UNIQUE `plataforma+identificador_externo`) com `access_token = page.access_token` (necessário p/ Insights IG) e `token_expira_em`. Subscreve webhooks `comments,mentions,story_insights` (best-effort).
- Secrets necessários: `META_APP_ID`, `META_APP_SECRET`, `OAUTH_STATE_SECRET`, `ALLOWED_ORIGIN`.
- Helper `iniciarOAuthInstagram(returnTo)` em `src/services/social.service.ts`. Botão "Conectar com Instagram" em `SocialContaModal`.

## Próximas ondas
- Onda 2: reescrever `social-sync` para escrever em `social_posts`/`social_metricas_snapshot`, refresh long-lived, cron diário.
- Onda 3: edge function `instagram-webhooks` (handshake + assinatura X-Hub-Signature-256).
- Onda 4: trigger de alertas, PDF mensal, realtime na sidebar.
