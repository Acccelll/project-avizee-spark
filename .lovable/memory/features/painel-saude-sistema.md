---
name: Painel Saúde do Sistema
description: Aba "Saúde do sistema" em /administracao agrega indicadores de integração (e-mail, auditoria, permissões) usando v_admin_audit_unified + email_send_log + email_send_state
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

## Regras de classificação (HealthBadge)
- **E-mail**: backoff ativo → `down`. Sem envios → `unknown`. Erro ≥ 25% → `down`. ≥ 5% → `degraded`. < 5% → `healthy`.
- **Auditoria/Permissões**: sem eventos no período → `unknown`. Caso contrário → `healthy`.

## Refresh
- `staleTime: 60s`, `refetchInterval: 5min`. Botão "Atualizar" força refetch.
