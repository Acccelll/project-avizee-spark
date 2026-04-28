---
name: Notificações Proativas no Sidebar
description: Badges no sidebar agregam alertas operacionais (financeiro vencido/a vencer, estoque baixo, orçamentos pendentes, NF rejeitada, DLQ de e-mail) com realtime e fallback admin-only para fila pgmq
type: feature
---

# Notificações proativas — sidebar

## Pipeline
1. `fetchSidebarAlertsRaw({ isAdmin })` em `src/services/sidebarAlerts.service.ts`
   consulta em paralelo: financeiro_lancamentos (vencidos/a vencer), RPC
   `count_estoque_baixo`, orcamentos pendentes, notas_fiscais rejeitadas e
   (apenas admin) RPC `email_queue_metrics()` para somar mensagens em DLQ.
2. `useSidebarAlerts` cacheia (`staleTime 60s`, `refetchInterval 90s`) e
   inclui `{ isAdmin }` na queryKey — assim a fila DLQ aparece/some sem
   reload manual quando a role muda.
3. `useSidebarBadges` mapeia para `moduleBadges` e `itemBadges`:
   - `financeiro` → vencidos+vencer (danger se há vencidos)
   - `estoque` / `/estoque` → estoque baixo (danger)
   - `comercial` / `/orcamentos` → orçamentos pendentes (warning)
   - `fiscal` / `/fiscal` → NF rejeitadas (danger)
   - `administracao` / `/administracao` → DLQ de e-mail (danger)

## Realtime
Canal singleton `sidebar-alerts-shared` (`src/lib/realtime/alertsChannel.ts`)
escuta `postgres_changes` em `financeiro_lancamentos`, `orcamentos` e
`notas_fiscais`. Estoque/DLQ caem no `refetchInterval` por não terem trigger
leve disponível.

## RLS / segurança
- `email_queue_metrics()` exige `has_role(auth.uid(),'admin')`; o service só
  invoca quando `useIsAdmin().isAdmin === true`. Para os demais papéis, o
  contador DLQ permanece em 0 e o badge admin não aparece.
- Alertas financeiros/estoque/orçamentos respeitam RLS single-tenant atual.

## Tons (BadgeTone)
- `danger` (destructive) — exige ação imediata: vencidos, estoque baixo,
  NF rejeitada, DLQ.
- `warning` — pendência de revisão (orçamentos).
- `info` — informativo (financeiro a vencer sem atrasados).