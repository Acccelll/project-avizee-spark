---
name: Webhooks de saída
description: Infraestrutura de webhooks outbound — pgmq + dispatcher edge + UI admin com HMAC SHA-256
type: feature
---

# Webhooks de saída

## Arquitetura

- **Triggers de domínio** em `notas_fiscais`, `orcamentos`, `ordens_venda`,
  `pedidos_compra` enfileiram payload em `pgmq.webhook_events` via
  `webhooks_enqueue(evento, payload)` (SECURITY DEFINER, search_path=public).
- **Edge function `webhooks-dispatcher`** (cron 1min via pg_net) lê a fila com
  `pgmq.read(vt=30s)`, busca endpoints ativos com array `eventos` contendo o
  evento, faz POST com header `X-AviZee-Signature: sha256=<hmac>` e persiste
  cada tentativa em `webhooks_deliveries`.
- Retry exponencial: 30s → 2min → 8min → 30min → 2h. Após 5 tentativas, marca
  `status='falha'`. Pendentes são reprocessadas pelo mesmo dispatcher numa
  passada secundária (`retryPendingDeliveries`).
- Cron job `webhooks-dispatcher-tick` registrado em `cron.job` chama
  `https://<projeto>.supabase.co/functions/v1/webhooks-dispatcher?action=run`.

## Segurança

- Tabelas `webhooks_endpoints` / `webhooks_deliveries` com RLS admin-only
  (`has_role(uid, 'admin')`). Service-role bypassa no dispatcher.
- Secret HMAC: gerado por `webhooks_create_endpoint(...)` (SECURITY DEFINER),
  retornado em texto puro **uma única vez** via dialog de "reveal". O banco
  guarda apenas `secret_hash`. Convenção: a chave HMAC usada pelo dispatcher
  é o próprio `secret_hash` (determinístico, nunca exposto). Quem valida do
  outro lado armazena o mesmo hash que o admin colou no dialog.
- Rotação via `webhooks_rotate_secret(p_endpoint_id)` — mesmo fluxo de
  reveal one-shot.

## Eventos suportados

Catálogo central em `src/services/webhooks.service.ts → WEBHOOK_EVENTOS`:

- `nota_fiscal.{criada,emitida,autorizada,cancelada,rejeitada}`
- `orcamento.{enviado,aprovado,recusado,convertido}`
- `ordem_venda.{criada,status_alterado}`
- `pedido_compra.{criado,status_alterado}`

Para adicionar novos eventos: editar trigger correspondente + atualizar
`WEBHOOK_EVENTOS` (constraint client-side; o banco aceita texto livre no
array `eventos`).

## UI

`/administracao?tab=webhooks` (`WebhooksSection`):
- KPIs: endpoints ativos, deliveries pendentes, falhas 24h, fila pgmq.
- Tabela de endpoints com Switch ativo/inativo inline, contadores de
  sucesso/falha, ações: editar, rotacionar segredo, remover (com confirm).
- Tabela das últimas 100 entregas com filtro por endpoint.
- Botão "Disparar agora" invoca a edge function manualmente.
- Cada linha de delivery em `falha`/`cancelado` tem botão "Send" que chama
  `webhooks_replay_delivery(uuid)` para reenfileirar imediatamente
  (zera tentativas e seta `proxima_tentativa_em = now()`).

## Hooks/Service

- `useWebhookEndpoints` / `useWebhookDeliveries` / `useWebhookMetrics` /
  `useWebhookMutations` em `src/pages/admin/hooks/useWebhooks.ts`.
- `src/services/webhooks.service.ts` concentra acesso ao Supabase (sem
  RPCs raw em componentes).

## Métricas

RPC `webhooks_metrics()` (admin-only) devolve `endpoints_ativos`,
`deliveries_pendentes`, `falhas_24h`, `fila_total` e
`fila_oldest_age_seconds`. Já integrada ao painel de saúde
(`SaudeSistemaSection` → cartão "Webhooks de saída"). Limites de
classificação:
- `down`: ≥10 falhas em 24h ou ≥200 mensagens na fila.
- `degraded`: ≥1 falha em 24h ou ≥50 na fila.
- `unknown`: nenhum endpoint ativo.
- `healthy`: caso contrário.