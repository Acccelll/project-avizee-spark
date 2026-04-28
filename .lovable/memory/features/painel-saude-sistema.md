---
name: Painel Saúde do Sistema
description: Aba "Saúde do sistema" em /administracao agrega indicadores de integração (e-mail, fila pgmq, sefaz-proxy, auditoria, permissões) usando v_admin_audit_unified + email_send_log + email_send_state + email_queue_metrics() + ping leve à edge function sefaz-proxy
type: feature
---

# Painel "Saúde do sistema"

Acesso: `/administracao?tab=saude` → grupo **Dados & Auditoria**.

## Componentes
- Seção: `src/pages/admin/sections/SaudeSistemaSection.tsx`
- Hook: `src/pages/admin/hooks/useSaudeSistema.ts`

## Fontes (sem RPC nova)
| Indicador                   | Fonte                                    |
|-----------------------------|------------------------------------------|
| Eventos por módulo 24h/7d   | `v_admin_audit_unified` (group by entidade) |
| Envio de e-mail 24h         | `email_send_log` (count + count `<> 'sent'`) |
| Backoff de envio            | `email_send_state.retry_after_until`     |
| Profundidade fila pgmq      | RPC `email_queue_metrics()` (admin-only, SECURITY DEFINER, lê `pgmq.q_*`) |
| Sefaz proxy disponível      | `supabase.functions.invoke('sefaz-proxy', { action: 'health' })` |

## Regras de classificação (HealthBadge)
- **E-mail**: backoff ativo → `down`. Sem envios → `unknown`. Erro ≥ 25% → `down`. ≥ 5% → `degraded`. < 5% → `healthy`.
- **Fila pgmq**: qualquer mensagem em DLQ → `down`. ≥200 pendentes ou idade ≥1h → `down`. ≥50 pendentes ou idade ≥15min → `degraded`. Caso contrário → `healthy`.
- **Sefaz**: erro/timeout → `down`. `hasPfxPassword=false` → `degraded`. OK → `healthy` com latência em ms.
- **Auditoria/Permissões**: sem eventos no período → `unknown`. Caso contrário → `healthy`.

## Refresh
- `staleTime: 60s`, `refetchInterval: 5min`. Botão "Atualizar" força refetch.

## Edge function `sefaz-proxy` — action `health`
- Não requer PFX nem SOAP; apenas valida JWT e devolve `{ ok, hasPfxPassword, timestamp }`.
- Mantém o painel responsivo mesmo quando o certificado não está configurado.
