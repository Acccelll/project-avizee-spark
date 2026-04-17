

# 1. RESUMO EXECUTIVO

O anexo é uma revisão de **prioridade crítica** cobrindo 11 arquivos: `Index.tsx` (chamado de App.tsx), `AuthContext.tsx`, `ProtectedRoute.tsx`, `AdminRoute.tsx`, `SocialRoute.tsx`, `ErrorBoundary.tsx`, `AppLayout.tsx`, `AppSidebar.tsx`, `navigation.config.ts`, `supabase/client.ts`, `integrations/supabase/types.ts`, `useSupabaseCrud.ts` (teste), `lib/permissions.ts`, `utils/permissions.ts`, `supabase/config.toml` e 4 migrations recentes. Total de ~75 pontos.

Após cruzar com o código real:

- **Confirmados (aplicáveis hoje)**: ~18 — concentrados em `Index.tsx` (cast `as unknown as`, hook não memoizado, JSX da saudação), `AuthContext.tsx` (catches silenciosos, lista duplicada de roles, `hasRole`/`can`/`signOut` sem `useCallback`, dep array `[]` no efeito principal), `permissions.ts`/`utils/permissions.ts` (ambiguidade pseudo-permissão `admin`, `Set<string>` frouxo, sem testes).
- **Parciais**: ~22 — sugestões válidas mas com ressalvas (unificar guards, mover `LazyInViewWidget`, `entrypoint` em `config.toml`, `ON DELETE SET NULL` em `empresa_config.updated_by`).
- **Já resolvidos / não aplicáveis**: ~20 — ex.: `useCan` já existe e já trata wildcards; `useDashboardData.loadData` já é estável; `permissionsLoaded` já documentado; muitos pontos de migrations passadas já foram tratados nas Rodadas 1–7.
- **Opcionais / cosméticos**: ~15 — Sentry, testes adicionais, `formatRelativeTime`, etc.

**Áreas de maior risco**: `AuthContext` (sessão, race conditions), `permissions.ts/utils/permissions.ts` (segurança), migrations já aplicadas (não se reescreve, só corrige adiante).

**Sensibilidade da etapa**: ALTA — toca em autenticação, guards e tipagem compartilhada.

# 2. MATRIZ DE TRIAGEM

| Arquivo / Área | Ponto do anexo | Situação | Severidade | Risco | Decisão |
|---|---|---|---|---|---|
| `Index.tsx` L220 | Cast `as unknown as Parameters<...>` em `EstoqueBlock` | Confirmado | Alta | Baixo | Tratar cedo |
| `Index.tsx` L92 | `useMemo` desnecessário p/ greeting | Confirmado | Baixa | Baixo | Tratar cedo |
| `Index.tsx` L141 | Template literal de vencimentos ilegível | Confirmado | Baixa | Baixo | Tratar cedo |
| `Index.tsx` L186/189 | Skeleton duplicado (LazyInView + Suspense) | Parcial | Baixa | Baixo | Não priorizar |
| `Index.tsx` extensão | Quebrar em GreetingBanner/KPISection/MainGrid | Opcional | Baixa | Médio | Não priorizar |
| `AuthContext` L67/82/99 | `catch {}` silencioso | Confirmado | Média | Baixo | Tratar cedo |
| `AuthContext` L76 | Lista `validAppRoles` duplicada do tipo | Confirmado | Média | Baixo | Tratar cedo |
| `AuthContext` L195 | `useEffect([])` sem deps mas safetyTimeout pode disparar pós-unmount | Parcial | Média | Médio | Tratar cedo |
| `AuthContext` L197/200/205 | `hasRole/can/signOut` sem `useCallback` | Confirmado | Média | Baixo | Tratar cedo |
| `AuthContext` L122 | `if (!supabase)` redundante | Confirmado | Baixa | Baixo | Tratar cedo |
| `AuthContext` realtime de roles | Subscription para mudanças de role | Opcional | Baixa | Alto | Não priorizar |
| `ProtectedRoute` | Remover `<>{children}</>` | Confirmado | Baixa | Baixo | Tratar cedo |
| `ProtectedRoute` | Extrair `FullPageLoader` | Parcial | Baixa | Baixo | Tratar depois |
| `AdminRoute` | Toast antes de redirect; unificar guards | Parcial | Baixa | Médio | Tratar depois |
| `SocialRoute` | `useMemo` em `getSocialPermissionFlags`; toast | Parcial | Baixa | Baixo | Tratar depois |
| `ErrorBoundary` | Reset com `key` para remontar filhos | Parcial | Média | Médio | Validar antes |
| `AppLayout` | Jump visual em `collapsedLoading` | Confirmado | Baixa | Baixo | Tratar cedo |
| `AppLayout` | `mobileOpen={false}` dummy no desktop | Confirmado | Baixa | Médio | Tratar depois |
| `AppSidebar` | `as any` em `can(resource as any, ...)` | Confirmado | Média | Baixo | Tratar cedo |
| `AppSidebar` | `h-4.5 w-4.5` (Tailwind não suporta) | Confirmado | Baixa | Baixo | Tratar cedo |
| `AppSidebar` | `eslint-disable` em `useMemo` | Parcial | Baixa | Médio | Validar antes |
| `permissions.ts` | Pseudo-perm `admin` ambígua → usar `*` | Confirmado | Alta | **Alto** | Validar antes |
| `permissions.ts` | `AppRole` importado de `AuthContext` (ciclo conceitual) | Confirmado | Média | Médio | Tratar depois |
| `utils/permissions.ts` | `Set<string>` frouxo → `Set<PermissionKey>` | Confirmado | Média | Baixo | Tratar cedo |
| `utils/permissions.ts` | Sem testes unitários | Confirmado | Média | Baixo | Tratar cedo |
| `supabase/client.ts` | `VITE_SUPABASE_ANON_KEY` legado | Já resolvido | Baixa | Baixo | Não priorizar |
| `useSupabaseCrud.ts` | Anexo confunde com arquivo de teste | Não se aplica | — | — | Ignorar |
| `config.toml` | Adicionar `entrypoint_path`/`import_map` | Opcional | Baixa | Baixo | Não priorizar |
| Migration `app_role_enum` | Usar `ADD VALUE IF NOT EXISTS` | Já aplicada | — | — | Ignorar (corrigir só se reaparecer) |
| Migration `user_permissions_rls` | Faltam policies INSERT/UPDATE/DELETE | Validar | Alta | Médio | Validar antes |
| Migration `empresa_config` | `updated_by` sem `ON DELETE SET NULL` | Confirmado | Média | Baixo | Tratar depois (nova migration) |
| Migration `financeiro_rpc_fluxos` | Validar `conta_bancaria_id`; perm `has_role` na RPC | Parcial | Média | Médio | Validar antes |

# 3. LEITURA CRÍTICA DO ANEXO

**Bem aderentes**: pontos de tipagem (`as unknown as`, `Set<string>`, `as any`), catches silenciosos, `useCallback` em `AuthContext`, ambiguidade da pseudo-permissão `admin`, classe inválida `h-4.5`, fragment desnecessário nos guards.

**Parcialmente aderentes**: unificação de guards (vale a pena, mas não é crítica), reset do `ErrorBoundary` por `key` (corretíssimo, mas precisa testar bloco-a-bloco), `ON DELETE SET NULL` (correto mas exige nova migration).

**Desatualizados**: o anexo trata `useSupabaseCrud.ts` como arquivo de teste — no projeto real é o **hook real** (memória `padroes-de-desenvolvimento`). Sugestões sobre testes de mock simplesmente não se aplicam ao arquivo. Também sugere adicionar `useCan` que **já existe** (`src/hooks/useCan.ts`).

**Excessivos para o momento**: integração com Sentry, testes E2E completos, refactor de `Index.tsx` em 4 subcomponentes, realtime de roles, abstração `PermissionRoute` genérica.

**Corretos mas dependentes de contexto**: revisão das policies RLS de `user_permissions` (precisa rodar `supabase--linter` antes), `has_role` exigindo permissão em RPCs financeiras (depende de definição de quem pode chamar).

# 4. PLANO POR FASES

**FASE A — Saneamento de tipagem e correções triviais (baixo risco)**
- Objetivo: eliminar casts perigosos e código morto sem mudar comportamento.
- Escopo: `Index.tsx` (remover `useMemo` greeting; extrair `formatVencimentos`; remover cast `as unknown as` ajustando tipo de `estoqueBaixo` no hook ou na prop de `EstoqueBlock`); `AppSidebar.tsx` (`as any` → `ErpResource[]`; `h-4.5` → `h-[18px]`); `ProtectedRoute`/`AdminRoute`/`SocialRoute` (remover `<>{children}</>`); `utils/permissions.ts` (tipar `Set<PermissionKey | "*">`).
- Dependências: nenhuma.
- Riscos: baixos — só validar build TS e smoke da home/sidebar.
- Critério: `tsc --noEmit` verde, dashboard renderiza sem regressão visual, sidebar mostra mesmas seções.

**FASE B — Robustez do AuthContext (sensível)**
- Objetivo: reduzir ruído de erro, evitar warnings de unmount e estabilizar funções expostas.
- Escopo: trocar `catch {}` por `console.error("[auth] ...", err)`; envolver `hasRole`/`can`/`signOut` em `useCallback`; usar `isMountedRef` para o `safetyTimeout`; derivar `validAppRoles` de `APP_ROLES as const` (mover constante para `lib/permissions.ts` para evitar import cíclico de `AuthContext`).
- Dependências: Fase A (tipagem de `AppRole` consolidada).
- Riscos: MÉDIOS — qualquer regressão derruba o login. Não tocar na ordem de eventos `INITIAL_SESSION`/`SIGNED_OUT`/`TOKEN_REFRESHED`.
- Critério: login, refresh de página, logout e expiração de sessão funcionam idênticos; nenhum warning novo no console.

**FASE C — Pseudo-permissão `admin` → `*` (segurança)**
- Objetivo: eliminar ambiguidade entre o **role** `admin` e a **permission key** `"admin"`.
- Escopo: introduzir `"*"` como wildcard global em `utils/permissions.ts` mantendo retrocompatibilidade temporária com `"admin"`; auditar todos os usos via `code--search_files` antes de remover; atualizar testes.
- Dependências: Fase A.
- Riscos: **ALTOS** — quem grava `extraPermissions` no banco pode estar usando a string `admin`. Exige inspeção da tabela `user_permissions` antes.
- Critério: usuários admin continuam acessando tudo; usuários com permissões pontuais não perdem acesso.

**FASE D — Migrations cirúrgicas e validação RLS**
- Objetivo: tratar pontos sensíveis de banco sem reescrever histórico.
- Escopo: nova migration adicionando `ON DELETE SET NULL` em `empresa_config.updated_by`; rodar `supabase--linter` e revisar policies de `user_permissions` (INSERT/UPDATE/DELETE devem ser admin-only); adicionar `IF NOT EXISTS (SELECT FROM contas_bancarias WHERE id = p_conta_bancaria_id)` em RPCs financeiras se ainda não houver.
- Dependências: aprovação do usuário antes de cada migration.
- Riscos: MÉDIOS — toca produção.
- Critério: linter limpo no escopo, RPC continua autorizando baixas válidas.

**FASE E — Pequenos polimentos de UX/layout (opcional)**
- Escopo: estabilizar `collapsed` enquanto carrega (`AppLayout`); toast em `AdminRoute`/`SocialRoute` ao negar; `formatRelativeTime` no sidebar.
- Riscos: baixos.

**Por que essa ordem**: A não bloqueia ninguém e dá confiança; B só depois de A para reaproveitar tipos; C exige a base de B (catches logam falhas reais); D em paralelo a B/C porque é puro SQL; E por último porque é estético.

# 5. MUDANÇAS CANDIDATAS DE BAIXO RISCO

1. **Remover cast `as unknown as` em `Index.tsx` L220** — alinhar tipo de `estoqueBaixo` no `useDashboardData` com `EstoqueBlock['itensBaixoMinimo']`. Validar: nenhum outro consumidor depende do shape atual.
2. **Tipar `Set<PermissionKey | "*">` em `utils/permissions.ts`** — `buildPermissionSet` já retorna isso. Validar: nenhum chamador externo passa strings cruas.
3. **Remover fragments `<>{children}</>` nos 3 guards** — puramente sintático.
4. **Trocar `as any` por `ErpResource[]` em `AppSidebar`** — checar se `sectionResourcesMap` realmente só contém recursos válidos.
5. **Corrigir `h-4.5 w-4.5`** — usar `h-[18px] w-[18px]`.
6. **Adicionar `console.error` aos catches do `AuthContext`** — não muda fluxo, melhora diagnóstico.
7. **Extrair `formatVencimentos` e remover `useMemo` da saudação** — pura legibilidade.

# 6. MUDANÇAS SENSÍVEIS

1. **Pseudo-permissão `admin` → `*`** (Fase C). Sensível porque: (a) `extraPermissions` no banco pode ter strings literais `"admin"`; (b) toda a matriz RBAC depende. Verificar antes: `SELECT DISTINCT resource, action FROM user_permissions` e contagem de quem usa `admin`. Risco: revogação acidental de acesso administrativo.

2. **`useCallback` em `hasRole`/`can`/`signOut`**. Sensível: muitos componentes têm essas funções em deps de `useEffect`. Estabilizá-las pode reduzir refetches que hoje encobrem bugs. Verificar: lista de consumidores via grep antes.

3. **Consolidar `validAppRoles` a partir de `APP_ROLES as const`**. Toca o import de `AppRole` que hoje vive em `AuthContext`. Mover para `lib/permissions.ts` evita ciclo, mas exige atualizar ~20 imports.

4. **Policies RLS de `user_permissions`** (Fase D). Sensível: política frouxa permite escalonamento. Antes: rodar `supabase--linter` + listar todas as policies da tabela.

5. **`safetyTimeout` com `isMountedRef`**. Sensível: alterar a inicialização de auth pode produzir flash de tela em conexões lentas. Validar: testar com throttling.

6. **Validação de `conta_bancaria_id` na RPC financeira**. Sensível: RPC já está em produção e foi tocada nas Rodadas 4/5. Verificar: idempotência da nova validação.

7. **`empresa_config.updated_by ON DELETE SET NULL`**. Sensível: mudar FK em produção. Antes: confirmar que não há registros órfãos.

# 7. NÃO PRIORIZAR NESTA ETAPA

- Quebrar `Index.tsx` em `GreetingBanner`/`KPISection`/`MainGrid`/`DashboardDrawer` — refactor estético, sem ganho mensurável.
- Mover `LazyInViewWidget` para `@/components/` — só se for reutilizado.
- Integrar Sentry — fora de escopo agora.
- Realtime subscription para mudanças de roles — overkill.
- Abstração `PermissionRoute` / `AuthGuard` unificado — duplicação atual é tolerável; refactor amplo sem retorno claro.
- Sugestões para `useSupabaseCrud.ts` (anexo confunde com teste) — **não se aplica**.
- Reescrever migrations já aplicadas — só nova migration corretiva quando necessário.
- Adicionar `ADD VALUE IF NOT EXISTS` retroativamente — migration já rodou.
- `formatRelativeTime` no sidebar — cosmético.

# 8. ORDEM IDEAL DE TRATAMENTO

1. **Saneamento trivial** (Fase A): casts, `as any`, `h-4.5`, fragments, `formatVencimentos`. → diff pequeno, alta confiança.
2. **Logs nos catches do AuthContext** (parte de B): isolado, sem mudar fluxo.
3. **`useCallback` + `isMountedRef` no AuthContext** (resto de B): exige verificação de consumidores.
4. **Consolidar `APP_ROLES`** (final de B): leva a refactor controlado de imports.
5. **Validação prévia da pseudo-permissão `admin`** (precondição de C): `SELECT` na tabela.
6. **Migração para `"*"`** (Fase C): com fallback.
7. **Migration corretiva `empresa_config.updated_by`** (D1): isolada.
8. **Linter + revisão de policies `user_permissions`** (D2).
9. **Polimentos de layout/UX** (Fase E).

# 9. CRITÉRIOS DE ACEITAÇÃO DO PLANEJAMENTO

- Cada fase é **auto-contida** e validável por build + smoke manual.
- Nenhuma mudança em `AuthContext` altera ordem de eventos `INITIAL_SESSION`/`TOKEN_REFRESHED`/`SIGNED_OUT`.
- Pseudo-permissão `admin` só é depreciada **após** auditoria do banco.
- Nenhuma migration nova reescreve histórico.
- `tsc --noEmit` verde após cada fase.
- Sidebar e dashboard renderizam o mesmo conjunto de seções/cards para os mesmos roles antes e depois.
- Pontos não aplicáveis (anexo desatualizado) ficam explicitamente registrados, não silenciosamente ignorados.

# 10. SAÍDA FINAL CONSOLIDADA

**Prioridades da etapa**: (1) eliminar casts perigosos no dashboard e sidebar; (2) instrumentar logs no AuthContext; (3) preparar a migração da pseudo-permissão `admin` → `*`; (4) corrigir `empresa_config.updated_by`.

**Cautelas da etapa**: não tocar na máquina de estados do `AuthContext`; auditar `user_permissions` antes da Fase C; rodar `supabase--linter` antes da Fase D; validar consumidores de `hasRole`/`can`/`signOut` antes de memoizá-los.

**Sequência futura sugerida**: Fase A → B (em duas subetapas: logs primeiro, memoização depois) → auditoria SQL → C → D → E.

**Validar antes de avançar**:
- Conteúdo atual de `user_permissions` (existem chaves `admin:*` literais?).
- Quem chama `useAuth().can/hasRole` em deps de efeito.
- Linter do Supabase para `user_permissions` e `empresa_config`.
- Tipo real esperado por `EstoqueBlock['itensBaixoMinimo']` vs retorno de `useDashboardData`.

