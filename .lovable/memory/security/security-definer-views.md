---
name: Security Definer Views
description: Catálogo de views do banco que mantêm SECURITY DEFINER intencionalmente, com motivo. Demais analíticas usam security_invoker=on.
type: constraint
---
# SECURITY DEFINER Views — política

Padrão para **novas views**: criar com `WITH (security_invoker = on)`.

## Exceções permitidas (DEFINER intencional)

| View | Motivo |
|---|---|
| `empresa_config_public_view` | Expõe somente campos públicos para orçamento compartilhado (anônimo via token). |
| `orcamentos_public_view` | Leitura pública de orçamentos via token de compartilhamento. |
| `orcamentos_itens_public_view` | Leitura pública de itens via token de compartilhamento. |
| `v_admin_audit_unified` | Une `auditoria_logs + permission_audit`; `permission_audit` tem RLS restrita; acesso é controlado por `PermissionRoute` admin-only no client. |

Cada uma carrega `COMMENT ON VIEW` com a justificativa. Se for adicionar
uma quinta exceção, **registre o motivo nesta memória** e adicione o
COMMENT na própria view. Caso contrário, prefira `security_invoker=on`.

## O que NÃO fazer

- Não voltar `vw_workbook_*` ou `vw_apresentacao_*` para DEFINER —
  quando o sistema for multi-tenant, isso vazaria dados entre empresas.
- Não criar views novas em DEFINER por "facilidade" de testes locais.