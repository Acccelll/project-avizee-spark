
# Diagnóstico técnico — Autenticação, Permissões e Administração de Acesso

## Inventário

| Camada | Implementação | Fonte de verdade |
|---|---|---|
| Sessão | `AuthContext` + `supabase.auth.onAuthStateChange` | Supabase Auth |
| Roles do usuário | `user_roles` (enum `app_role`) | DB |
| Permissões padrão por role | **Hard-coded** em `src/lib/permissions.ts` (`rolePermissionMatrix`) | Frontend |
| Permissões padrão por role (DB) | Tabela `role_permissions` + RPC `user_has_permission()` | DB — **não consumido pelo frontend** |
| Overrides por usuário | `user_permissions` (allowed=true só) | DB → AuthContext |
| Guards de rota | `ProtectedRoute`, `AdminRoute`, `SocialRoute` | OK |
| `can()` por ação | 2 implementações: `useAuth().can(resource, action)` (estrita) e `useCan().can(perm)` (com wildcard) | Inconsistente |
| Matriz visual no admin | `PermissaoMatrix` lê do hard-code, **read-only**, banner amarelo | Drift potencial |
| Edge fn `admin-users` | Cria/edita user, role, extra perms | OK |
| Sessões | `user_sessions` listagem/revoke | OK |
| Auditoria | `permission_audit` populada por `admin-users` | OK |

## Problemas reais

### A. Autenticação & sessão

#### A1. Credenciais hardcoded em `Login.tsx`
```tsx
const [email, setEmail] = useState("admin@avizee.com");
const [password, setPassword] = useState("admin123456");
```
Vazamento de credencial em produção. Substituir por strings vazias e usar apenas o botão "Preencher como Dev" (`VITE_DEV_EMAIL/PASSWORD`).

#### A2. `safetyTimeout` 5s em AuthContext pode encerrar `loading` antes do `INITIAL_SESSION` resolver em redes lentas
Resultado: `permissionsLoaded=false` mas `loading=false` → `ProtectedRoute` ainda espera (ok), mas componentes não-guardados podem renderizar com `roles=[]`. Aceitável, porém o aviso de console "Auth initialization timed out" deveria virar telemetria.

#### A3. `signOut` não navega para `/login`
Faz `supabase.auth.signOut()` e zera state, mas a navegação fica espalhada em cada caller (`MobileMenu`, etc.). Centralizar com `navigate('/login', { replace: true })` ou um `useEffect` em `ProtectedRoute` que reaja a `!user`. Hoje o redirect funciona via `<Navigate to="/login">` em `ProtectedRoute`, mas só depois do unmount.

#### A4. `ResetPassword` aceita `type=recovery` apenas no hash inicial
Se o usuário recarregar a página após o Supabase consumir o hash, `window.location.hash` fica vazio e o componente redireciona para `/login`, mas a sessão recovery já está ativa. Verificar via `supabase.auth.getSession()` em vez de só `window.location.hash`.

### B. Permissões — drift crítico entre frontend e DB

#### B1. Duas matrizes de permissão paralelas
- **Frontend**: `src/lib/permissions.ts` → `rolePermissionMatrix` (hard-coded)
- **DB**: tabela `role_permissions` + RPC `user_has_permission(_user_id, _resource, _action)`

`AuthContext.fetchPermissions` lê apenas `user_roles` + `user_permissions`. **Nunca consulta `role_permissions`**. Resultado:
- Admin altera `role_permissions` no DB → frontend ignora.
- O hard-code em `permissions.ts` é a verdade efetiva. A tabela DB é decoração.
- `PermissaoMatrix` mostra o hard-code com banner "Esta matriz é read-only" — inconsistente com a presença real da tabela e do RPC no banco.

**Decisão necessária**: ou eliminar `role_permissions` da arquitetura, ou tornar a tabela a fonte canônica e o frontend consumi-la. (Ver Estratégia.)

#### B2. `useCan` (`Permission`) e `useAuth().can(resource, action)` são APIs paralelas
- `useAuth().can("orcamentos", "criar")` — assinatura tipada estrita.
- `useCan().can("orcamentos:criar" | "orcamentos:*")` — string com wildcard.
- Ambas reconstroem o `permissionSet` com `buildPermissionSet`. Duplicação de cache.
- `useAuth().can` **não trata wildcards** (`orcamentos:*`). Se um override for inserido como `orcamentos:*`, ele só funciona via `useCan`.

#### B3. `useAuth().can` retorna `false` antes de `permissionsLoaded`?
Não — `can` consulta `mergedPermissions` direto. Se o roles ainda não carregou, retorna `false` silenciosamente. Componentes que checam `can()` em primeira render e escondem botões podem flickerar. `useCan` corrige isso (`if (!permissionsLoaded) return false`), mas a inconsistência entre as duas APIs é a raiz.

#### B4. `extraPermissions` só carrega rows com `allowed=true`
`fetchExtraPermissions` filtra `eq("allowed", true)`. Não há mecanismo de **revogação** de permissão herdada do role no frontend (allowed=false é ignorado). Mas o RPC `user_has_permission` no DB **respeita o override** (override.allowed precede base.allowed). Mais um drift: se um admin no DB inserir `user_permissions(user_id, 'financeiro', 'editar', allowed=false)` para um financeiro, o backend bloqueia, o frontend continua mostrando o botão.

#### B5. `orcamentos:visualizar_rentabilidade` não está em `ERP_ACTIONS`
`src/lib/orcamentoInternalAccess.ts` checa `extraPermissions.includes("orcamentos:visualizar_rentabilidade" as PermissionKey)` — cast forçado. A action `visualizar_rentabilidade` não consta no enum `ERP_ACTIONS`. Permissão "fantasma" que só funciona se inserida manualmente via SQL/edge fn. Ou adicionar à enum, ou criar lista separada `ORCAMENTO_GRANULAR_PERMS`.

#### B6. Lista `ERP_ACTIONS` poluída e não auditada por recurso
17 ações (`importar_xml`, `gerar`, `editar_comentarios`, `gerenciar_templates`, ...). Várias só fazem sentido em 1-2 recursos específicos. Sem mapeamento "que actions são válidas para que resource", o tipo `PermissionKey` permite combinações inválidas (`dashboard:importar_xml`).

#### B7. Permissão `usuarios:*` existe mas não é checada
`ERP_RESOURCES` inclui `"usuarios"`, mas o gate de admin é via `isAdmin` em todos os lugares (`AdminRoute`, edge fn `admin-users` checa `has_role(admin)`). A permissão `usuarios:visualizar` nunca é consultada — pode ser concedida a um vendedor sem efeito. Remover do enum ou implementar gate baseado em permissão.

### C. Guards & coerência menu-rota-ação

#### C1. Quase toda rota é `ProtectedRoute` (apenas autenticação)
`/produtos`, `/financeiro`, `/fiscal`, `/relatorios`, etc. — qualquer usuário logado acessa via URL direta. O menu (`useVisibleNavSections`) filtra por `can(resource, 'visualizar')`, mas digitar `/financeiro` na URL como `vendedor` carrega a página inteira. **Bloqueio de menu sem bloqueio de rota = falsa proteção**.

#### C2. RLS no DB é o único bloqueio real
Vendedor abrindo `/financeiro` → RLS provavelmente retorna 0 rows e mensagem "lista vazia", sem indicar "sem permissão". UX ruim e revela existência da rota. Faltam guards baseados em `useCan`.

#### C3. Botões de ação inconsistentes
Apenas `Orcamentos.tsx` (aprovar) e `Logistica.tsx` (editar) checam permissão para esconder/desabilitar ação. Demais módulos confiam no DB. Exemplos:
- "Excluir Pedido" sempre visível, mesmo para `vendedor` sem `pedidos:excluir`.
- "Exportar PDF" em Relatórios visível para todos.

#### C4. `getSocialPermissionFlags` ignora `extraPermissions`
Decide visibilidade do módulo Social puramente por `roles` (admin/vendedor/financeiro). Override individual `social.visualizar` em `user_permissions` não tem efeito. Inconsistente com o resto do sistema.

#### C5. `SocialRoute` renderiza `AccessDenied` quando flag desligada via env
`VITE_FEATURE_SOCIAL` controla menu (em `navigation.ts`), mas a rota `/social` continua registrada em `App.tsx`. URL direta com flag off → guard checa permissão → admin vê página normalmente. OK funcionalmente, mas a flag não esconde a rota como se espera.

#### C6. `AdminRoute` e `SocialRoute` divergem em loading
- `AdminRoute`: `if (authLoading || roleLoading)` — usa `useIsAdmin()` que combina ambos.
- `SocialRoute`: `if (loading || !permissionsLoaded)`.
- `ProtectedRoute`: `if (loading || (user && !permissionsLoaded))`.
Três jeitos de aguardar a mesma coisa.

### D. Estrutura de código — duplicação & acoplamento

#### D1. 3 módulos derivam permissão da mesma fonte
- `useAuth().can` (AuthContext)
- `useCan().can` (hooks/useCan.ts)
- `getOrcamentoInternalAccess(roles, extra)`, `getSocialPermissionFlags(roles)` — funções pure que ignoram a engine principal.

Cada uma reimplementa "como decidir". Falta um único `evaluatePermission(resource, action, ctx)`.

#### D2. `usuarios.service.ts` (legado) ainda no codebase
O próprio comentário diz "@legacy ... não reutilizar". Confunde leitor. Mover para `_legacy/` ou remover.

#### D3. `perfis.service.ts` paralelo a `admin-users` edge fn
`atribuirPerfil`/`removerPerfil` usam supabase client direto (gravam em `user_roles`). RLS provavelmente bloqueia para não-admins, mas o caminho canônico é a edge fn. Manter as duas convida bugs (chamou client → edge fn não auditou em `permission_audit`).

#### D4. `rolePermissions.service.ts` exportado mas não usado
`fetchAllRolePermissions`, `setRolePermission`, `userHasPermission` (RPC) — não há caller no frontend (busca: zero matches). Código morto que sugere "isto está implementado" sem estar.

#### D5. `LEGACY_ROLES = {moderator, user}` filtrado no AuthContext
Defesa boa, mas o enum `app_role` no DB ainda tem `"user"` e `"viewer"` (visto em `types.ts`: `app_role: "admin" | "user" | "viewer" | ...`). Limpar enum no DB ou documentar a coexistência.

#### D6. Tipos `Permission`/`PermissionKey` divergem
- `PermissionKey` (lib/permissions): `${ErpResource}:${ErpAction}` — estrito.
- `Permission` (utils/permissions): `PermissionKey | "${string}:*" | "*" | "admin"` — permissivo.
- Refatorar para um único tipo, com parsing definido (`parsePermission(input) → { resource, action, isWildcard }`).

#### D7. `checkPermission` aceita string `"admin"` como wildcard global
Alias legado documentado. Mas isso permite gravar `user_permissions(resource='admin', action='??')` que ninguém saberia interpretar. Remover suporte e fazer migration.

### E. Coerência sistêmica menu/rota/ação (varredura)

| Item | Menu filtra? | Rota bloqueia? | Ação bloqueia? |
|---|---|---|---|
| `/produtos` | ✓ (can produtos:visualizar) | ✗ ProtectedRoute apenas | ✗ |
| `/financeiro` | ✓ | ✗ | ✗ |
| `/relatorios` | ✓ | ✗ | ✗ exporta livre |
| `/administracao` | ✓ (isAdmin) | ✓ AdminRoute | — |
| `/social` | ✓ (flag+role) | ✓ SocialRoute | parcial |
| Excluir orçamento | — | ✗ | ✗ |
| Aprovar orçamento | — | ✗ | ✓ (isAdmin) |
| Aprovar PC | — | ✗ | ✓ (drawerPermissions) |

Resumo: o **único módulo com proteção em 3 camadas é Administração**.

## Estratégia de correção (escopo desta passada)

### Decisão fundamental — B1
Optar por um dos dois caminhos antes de iniciar:
1. **Tabela canônica (recomendado)**: `role_permissions` é a verdade, `permissions.ts` vira seed/bootstrap. AuthContext lê `role_permissions` via uma view materializada ou `user_has_permission` RPC por necessidade. Permite admin alterar permissões em tempo real.
2. **Hard-code canônico (mais simples)**: remover `role_permissions` e o RPC `user_has_permission` da arquitetura. Manter só `user_permissions` para overrides individuais.

Sugestão: **(2)** para esta passada — menor risco, alinha realidade com código. Migration: `DROP TABLE role_permissions`, `DROP FUNCTION user_has_permission`, atualizar `PermissaoMatrix` para deixar claro que é definido em código.

### Fase 1 — Limpar credenciais hardcoded (A1)
`Login.tsx`: state inicial `""` para `email`/`password`.

### Fase 2 — Unificar API de permissões (B2, D1, D6)
- Remover `useAuth().can` (mantém apenas state).
- `useCan` vira a única API: `can(perm: Permission)`.
- Atualizar callers (`Logistica.tsx` e quaisquer outros descobertos) para `useCan`.
- Deprecate `Permission`/`PermissionKey` separados — unificar em `Permission` com helper `toPermission(resource, action)`.

### Fase 3 — Honrar `allowed=false` em overrides (B4)
- `fetchExtraPermissions`: remover filtro `eq("allowed", true)`. Buscar tudo.
- Estender `buildPermissionSet` para aceitar `{ allow: PermissionKey[]; deny: PermissionKey[] }`. `deny` remove do set após merge dos roles.
- Documentar precedência: deny override > role default.

### Fase 4 — Adicionar guards de rota por permissão (C1, C2, C3)
Criar componente `PermissionRoute({ resource, action, children })` que reusa `useCan`. Aplicar em rotas-chave:
- `/financeiro`, `/contas-bancarias`, `/fluxo-caixa`, `/conciliacao`, `/contas-contabeis-plano` → `financeiro:visualizar`
- `/fiscal`, `/fiscal/:id` → `faturamento_fiscal:visualizar`
- `/produtos`, `/estoque` → respectivos
- `/relatorios/*` → `relatorios:visualizar`

Sem guard → fallback `<AccessDenied fullPage />`.

### Fase 5 — Unificar guards loading (C6)
Helper `useAuthGate()` que retorna `{ status: 'loading' | 'unauthenticated' | 'authenticated', user }`. Os 3 guards consomem.

### Fase 6 — Plug `getSocialPermissionFlags` na engine (C4)
Refatorar para também consultar `extraPermissions` (`social:visualizar`, etc.) — paridade com `useCan`. Ou eliminar o helper e usar `can` direto com novas keys.

### Fase 7 — Decidir sobre `role_permissions`/`user_has_permission` (B1, D4)
Migration drop (caminho 2). Remover `rolePermissions.service.ts`. Atualizar `PermissaoMatrix` para reforçar "definido em código".

### Fase 8 — Limpeza de serviços legados (D2, D3)
- Mover `usuarios.service.ts` para `src/services/admin/_legacy/` ou deletar (callers? `useUsuarios` legado).
- Remover `perfis.service.ts` ou marcar funções não-canônicas como `@deprecated` real (lint warning).

### Fase 9 — Adicionar `usuarios` action ao gate (B7)
Substituir `isAdmin` checks em `admin-users` edge fn por `user_has_permission` ou consolidar: `usuarios` resource passa a ser checado via `can('usuarios', 'editar')`. Reduz acoplamento "admin = tudo".

### Fase 10 — `ResetPassword` valida via `getSession` (A4)
Trocar checagem de `window.location.hash` por `supabase.auth.getSession()` no `useEffect` inicial; só redirect se não houver sessão.

### Fase 11 — `signOut` centraliza navegação (A3)
Após `signOut()`, fazer `window.location.assign('/login')` ou expor `signOutAndRedirect()` no contexto que aceita `navigate` injetado por callers.

### Fase 12 — Granular `orcamentos:visualizar_rentabilidade` (B5)
Adicionar `"visualizar_rentabilidade"` em `ERP_ACTIONS` e remover cast `as PermissionKey` em `orcamentoInternalAccess.ts`.

## Fora do escopo
- Refatorar enum `app_role` no DB para remover `user`/`viewer` legados (migration arriscada, requer auditoria de rows).
- Implementar tabela `permission_audit_log` para mudanças em `user_permissions` (já existe `permission_audit` para edge fn — manter).
- Multi-tenant / hierarquia de roles.
- 2FA / MFA.
- SSO/OAuth (Google, etc.) — flag separada.
- Refazer `getOrcamentoInternalAccess` como puro `useCan` (mantém função pura por enquanto, só corrige tipo).
- Rate-limit de login no edge.
- Migração de todos os ~25 botões espalhados sem `can()` (Fase 4 cobre rotas; ações ficarão para passada própria).

## Critério de aceite
- `Login.tsx` sem credenciais hardcoded.
- Apenas uma API `useCan` no codebase, com suporte a wildcard.
- `user_permissions.allowed=false` revoga acesso herdado do role no frontend.
- `PermissionRoute` aplicado em todas as rotas autenticadas com mapeamento `path → resource`.
- Guards de loading consolidados via `useAuthGate`.
- `getSocialPermissionFlags` consulta `extraPermissions`.
- `role_permissions` e RPC `user_has_permission` removidos OU explicitamente consumidos pelo AuthContext (escolher 1 caminho).
- `usuarios.service.ts` legado movido/removido.
- `orcamentos:visualizar_rentabilidade` listado em `ERP_ACTIONS`.
- `ResetPassword` valida sessão via `getSession()`.
- `signOut` redireciona para `/login` consistentemente.
- Build OK, smoke tests passam.

## Arquivos afetados
- `src/pages/Login.tsx` — credenciais
- `src/pages/ResetPassword.tsx` — checagem de sessão
- `src/contexts/AuthContext.tsx` — fetch overrides allowed=false, signOut redirect, remover `can`
- `src/hooks/useCan.ts` — única API
- `src/utils/permissions.ts` — suporte a deny, simplificar tipos
- `src/lib/permissions.ts` — adicionar `visualizar_rentabilidade`, doc "fonte canônica"
- `src/lib/orcamentoInternalAccess.ts` — remover cast
- `src/types/social.ts` — `getSocialPermissionFlags` plug em extra
- `src/components/ProtectedRoute.tsx`, `AdminRoute.tsx`, `SocialRoute.tsx` — `useAuthGate`
- `src/components/PermissionRoute.tsx` (novo)
- `src/hooks/useAuthGate.ts` (novo)
- `src/App.tsx` — aplicar PermissionRoute nas rotas
- `src/services/admin/usuarios.service.ts` — mover/remover
- `src/services/admin/perfis.service.ts` — depreciar funções
- `src/services/admin/rolePermissions.service.ts` — remover (se Fase 7 caminho 2)
- `supabase/migrations/<novo>.sql` — drop `role_permissions` + `user_has_permission` (se caminho 2)
- `src/pages/admin/components/PermissaoMatrix/index.tsx` — reforçar copy
- Componentes que usam `useAuth().can` — migrar para `useCan`

## Entregáveis
Resumo final por categoria: credenciais limpas, `useCan` unificado, deny override funcional, `PermissionRoute` + mapa rota→permissão, guards de loading consolidados, social plug-in, decisão sobre `role_permissions`, limpeza de serviços legados, granular permission tipada, reset password robusto, signOut com redirect.
