---
name: roles-cumulativos
description: Roles secundários cumulativos no UserFormModal e admin-users edge function — permissões somam padrão + secundários
type: feature
---
# Roles secundários cumulativos

- Tabela `user_roles` (user_id, role) suporta múltiplos roles por usuário (UNIQUE composta).
- `buildPermissionSet(roles[], extra)` em `src/lib/permissions.ts` já soma permissões herdadas.
- AuthContext lê TODOS os roles via `fetchAuthRoles` — efeito cumulativo automático.
- UI: `UserFormModal` distingue "role padrão" (Select) e "roles adicionais" (checkboxes em /configuracoes → Usuários).
- Edge function `admin-users` grava `[padrao, ...secundarios]` em `user_roles` via `replaceUserRoles`. Primeiro inserido = padrão; admin vence como padrão se presente.
- `admin` nunca é secundário (UI esconde; EF normaliza removendo).
- `UserRow` mostra badge `+N` ao lado do role padrão quando há secundários, com tooltip.
- Auditoria: `roles_secundarios` no payload de `permission_audit` em create/update.
- Migration: NÃO necessária — schema já suportava.
