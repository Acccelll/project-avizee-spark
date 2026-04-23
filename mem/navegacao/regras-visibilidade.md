---
name: Regras de visibilidade do menu × permissões
description: Contrato "se aparece no menu, o usuário pode entrar"; mapeamento de seções para recursos canônicos em useVisibleNavSections
type: feature
---

## Contrato

Toda rota visível no menu (sidebar, mobile bottom nav, mobile drawer) DEVE ser
acessível ao usuário que a vê. O inverso também: rotas com `PermissionRoute`
granular DEVEM ter sua seção marcada em `sectionResourcesMap` para aparecer
no menu.

## Fonte única

`src/hooks/useVisibleNavSections.ts` mantém `sectionResourcesMap`. Ao adicionar
nova rota com `PermissionRoute resource="X"`, atualize a seção correspondente:

- `cadastros`: produtos, clientes, fornecedores, transportadoras, formas_pagamento, socios, usuarios
- `comercial`: orcamentos, pedidos
- `compras`: compras
- `estoque`: estoque, logistica
- `financeiro`: financeiro, socios
- `fiscal`: faturamento_fiscal
- `relatorios`: relatorios, workbook, apresentacao
- `administracao`: administracao, auditoria
- `social`: handled separately via getSocialPermissionFlags

## Bottom tabs mobile

`MobileBottomNav` valida o destino padrão de cada tab via `TAB_PATH_PERMISSIONS`.
Se o usuário não pode acessar o destino padrão, recai no primeiro item da seção
que ele pode acessar (via `PATH_PERMISSION_MAP`). Nunca exibe tab que leva
a `AccessDenied`.

## Quick actions

Cada `QuickAction` em `lib/navigation.ts` carrega `requires?: PermissionKey`.
`AppHeader`, `MobileQuickActions` e `MobileMenu` filtram via `useCan` antes
de renderizar — atalhos sem permissão simplesmente não aparecem.

## Hotkeys Cmd+1..9

`useGlobalHotkeys.QUICK_NAV_ROUTES` atrela cada slot numérico a uma permissão.
Se o usuário não tem a permissão, a hotkey é silenciosamente ignorada.