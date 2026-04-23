

# Revisão Profunda — Fluxos de Autenticação e Acesso

Análise baseada **exclusivamente** no estado real: `Login.tsx` (242 LOC), `Signup.tsx` (255 LOC), `ForgotPassword.tsx` (90 LOC), `ResetPassword.tsx` (164 LOC), `AuthContext.tsx` (252 LOC), `SessionExpiryWarning.tsx` (133 LOC), `ProtectedRoute.tsx`, `AdminRoute.tsx`, `PermissionRoute.tsx`, `SocialRoute.tsx`, `useAuthGate.ts`, `App.tsx`, e migration `20260409205921_*.sql` (trigger `handle_new_user`).

> **Fato central**: a infraestrutura é sólida (gate único, splash com branding, `PermissionRoute` granular, `SessionExpiryWarning` com keepalive opt-in), mas **três incoerências grandes**: (1) cadastro cria conta no banco mas **não atribui role nenhum** — usuário fica logado e bate em 100% das telas com `AccessDenied`; (2) regras de senha **divergem entre 3 telas** (login=6, reset=6, change=8 + força); (3) **não há integração com o admin** após signup nem fluxo de aprovação, apesar do `INVITE_ONLY` existir.

---

## 1. Visão geral do módulo

- **Rotas públicas**: `/login`, `/signup`, `/forgot-password`, `/reset-password`, `/orcamento-publico`. Todas envoltas em `LazyPage` com `ContentSpinner`.
- **Provedores de auth ativos**: somente **email + senha** via `supabase.auth.signInWithPassword`. Nenhum `signInWithOAuth` no código — Google/Apple não estão habilitados, embora `cloud-auth-and-security` recomende como default.
- **`AuthContext`** é fonte única: mantém `user`, `session`, `loading`, `permissionsLoaded`, `profile`, `roles`, `extraPermissions`, `deniedPermissions`. Faz fetch paralelo de `profiles` + `user_roles` + `user_permissions` em `INITIAL_SESSION`. Tem timeout de segurança (5s) que força `loading=false`. Detecta `SIGNED_OUT` involuntário via `manualSignOut` ref e dispara toast "Sessão expirou".
- **Guards (4 níveis)**:
  - `ProtectedRoute` — só sessão.
  - `AdminRoute` — sessão + (role admin OR `administracao:visualizar`).
  - `PermissionRoute` — sessão + `(resource:action)` granular, com `AccessDenied` `fullPage`.
  - `SocialRoute` — sessão + flags do `getSocialPermissionFlags`.
  - Todos consomem `useAuthGate` (loading | unauthenticated | authenticated) e exibem `AuthLoadingScreen` com branding.
- **Trigger DB**: `handle_new_user` cria automaticamente `profiles(id, nome, email)`. **Não cria nenhuma linha em `user_roles`.**
- **Reset de senha**: `ForgotPassword` chama `resetPasswordForEmail` com `redirectTo: ${origin}/reset-password`. `ResetPassword` valida sessão via `getSession()` e chama `updateUser({ password })`. Aceita também sessão ativa (não só recovery) — usado também para troca voluntária.
- **Sessão**: `SessionExpiryWarning` lê `session.expires_at`, agenda warn (default 5 min) + dialog bloqueante na expiração. Keepalive opt-in via `useUserPreference('session_keepalive')` faz refresh a cada 30 min se a aba estiver visível.
- **Pós-login**: `Login.handleLogin` faz `navigate('/', { replace: true })`. **Sempre para `/`**, ignorando deep-link de origem.
- **`INVITE_ONLY`**: flag client-side (`VITE_INVITE_ONLY`). Bloqueia UI do `Signup` se `?invite=` ausente, mas **não há validação server-side**: chamar `supabase.auth.signUp` direto via API ignora a flag.

---

## 2. Problemas encontrados

### 2.1 Onboarding quebrado: signup não atribui role

1. **`handle_new_user` cria `profiles` mas não insere em `user_roles`.** Resultado: usuário recém-cadastrado loga, `AuthContext.roles=[]`, `useCan` retorna false para tudo, `useVisibleNavSections` filtra todas as seções — sidebar fica vazia, dashboard carrega mas `/produtos`, `/clientes`, etc. caem em `AccessDenied`. Onboarding é uma armadilha sem aviso.
2. **Sem fluxo de aprovação/notificação ao admin.** O cadastro é livre (mesmo com `INVITE_ONLY=false`), mas não existe edge function ou trigger que avise o admin via `permission_audit` ou e-mail. Admin só descobre via lista de usuários.
3. **`invite_token` é gravado em `raw_user_meta_data` e ignorado.** Nenhuma edge function consome o token; nenhuma tabela `invites` existe. Funcionalidade prometida pela UI, ausente no backend.
4. **`INVITE_ONLY` é só client-side.** Usuário malicioso (ou Postman com a `anon key` que está em `client.ts`) cria conta sem convite. A flag dá falsa sensação de segurança.

### 2.2 Inconsistência das regras de senha

5. **Mínimo de senha varia por tela**:
   - `Login.tsx` (linha 42): `password.length < 6` "Mínimo 6 caracteres"
   - `Signup.tsx` (linha 37): `password.length < 6` "Mínimo 6 caracteres"  
   - `ResetPassword.tsx` (linha 47): `password.length < 6` "Mínimo 6 caracteres"
   - `useChangePassword.ts` (linha 38): **8 caracteres + maiúscula/minúscula + dígito**
   
   Usuário cria conta com senha de 6 chars, troca via `/reset-password` para 6 chars, mas em `Configurações → Segurança` é exigido 8+complexa. Quem trocar via link de e-mail nunca atinge a regra "forte" — política impossível de auditar.
6. **Indicador de força só no Signup.** Nem em `ResetPassword` nem em `Configurações` (este último bate na regra dura, mas sem barra visual). UX inconsistente.
7. **Sem HIBP / leaked password protection.** Não há configuração `password_hibp_enabled`. Recomendação explícita do guia da plataforma ignorada.

### 2.3 Login: redirect e UX

8. **Pós-login sempre vai para `/`.** Se o usuário estava em `/produtos/123`, foi expulso para `/login` (sessão expirou) e logou de novo, **perde o contexto**. `ProtectedRoute` faz `<Navigate to="/login" replace />` sem `state={{ from: location }}` — Login não tem como retornar.
9. **`useEffect` que detecta usuário já logado redireciona para `/`** mesmo quando o usuário chegou em `/login?next=/produtos`. Sem suporte a query param `next`.
10. **Sem mensagem de "muitas tentativas".** Erro de rate limit do Supabase cai no `error.message` cru (em inglês). Lista de mapeamento manual cobre só "Invalid login credentials" e "Email not confirmed" — qualquer outro erro vaza string técnica.
11. **`authLoading` mostra spinner full-screen sem branding** (`Loader2` simples), enquanto guards mostram `AuthLoadingScreen` com logo. Inconsistência visual no mesmo fluxo.
12. **Toast "Login realizado com sucesso!"** dispara *antes* do `navigate('/')`. Em conexões lentas, toast aparece mas a rota ainda não trocou — pisca confusamente.
13. **Botão Dev Login** (`showDevButton`) tree-shaka em prod, mas **vaza email/senha de dev** se alguém der `console.log(import.meta.env)` em build de dev. Aceitável, mas vale comentar.

### 2.4 Signup: validações e UX

14. **`handle_new_user` lê `raw_user_meta_data->>'full_name'`** mas o `Signup.tsx` envia `data: { nome }` (não `full_name`). Resultado: trigger usa **fallback `NEW.email`** como nome, e o nome digitado pelo usuário só é gravado depois pelo `useProfileForm` — se o usuário nunca abrir Configurações, fica com nome = email.
15. **Sem confirmação de senha.** Único lugar com 2 campos é `/reset-password`. Signup permite typo silencioso.
16. **`emailRedirectTo: window.location.origin`** redireciona para `/` após confirmação de e-mail. Como `/` é `ProtectedRoute`, o usuário recém-confirmado pode ver flicker de loading antes do `AuthContext` perceber a sessão.
17. **`success` screen** mostra apenas "Verifique seu e-mail". Sem opção de reenviar e-mail de confirmação se não chegar. `supabase.auth.resend({ type: 'signup', email })` está disponível e não é usado.
18. **`error.message` do Supabase é genericado**: qualquer falha (e-mail já existe, senha fraca, captcha) vira "Erro ao criar conta. Tente novamente." Usuário perde diagnóstico — caso comum "User already registered" deveria sugerir login.
19. **Caps Lock indicator no Login, ausente no Signup e ResetPassword.** Inconsistência.

### 2.5 Forgot/Reset password

20. **`ForgotPassword` exibe sempre tela de sucesso** mesmo quando `resetPasswordForEmail` falha — código (linhas 30-33): se `err`, dispara toast e **retorna sem `setSent`**, mas não há feedback visual no botão (volta a "Enviar link"). Comportamento errático: toast some, usuário tenta de novo.
21. **`ResetPassword.useEffect`** roda `getSession()` **antes** de aguardar o Supabase consumir o hash de recovery. Em refreshes ou navegações estranhas, `getSession()` pode retornar null antes do parser do hash terminar — então o usuário é jogado para `/login` mesmo com link válido. Mitigação parcial via `hashHasRecovery`, mas hash é apagado pelo Supabase após primeira leitura.
22. **`updateUser({ password })` não revalida que é sessão de recovery.** Se um atacante rouba a sessão (XSS) e abre `/reset-password`, troca a senha sem fornecer a antiga. `useChangePassword` cobre isso; `ResetPassword` não. Aceitável para fluxo de recovery, mas reset voluntário deveria seguir para `/configuracoes?tab=seguranca`.
23. **Sucesso vai para `/` via "Acessar o sistema"**, mas a sessão de recovery é tecnicamente válida e o usuário pula a re-autenticação. Para recuperação isso é por design; o problema é que **não há toast/aviso recomendando logout em outros dispositivos** — `useChangePassword` tem essa funcionalidade (`signOutOthers`), `ResetPassword` não.
24. **Link expira em "1 hora" (texto na UI)** — número hardcoded na cópia, não vem do Supabase. Se a config do projeto mudar para 24h, a UI mente.

### 2.6 AuthContext, sessão e race conditions

25. **`safetyTimeout` de 5s força `loading=false`** sem `setUser(null)`. Se o Supabase realmente travar, o app monta `ProtectedRoute` com `user=null` e cai em `Navigate to="/login"`. Sem toast/erro — usuário vê tela de login do nada.
26. **`onAuthStateChange` faz `await Promise.all([fetchProfile, fetchPermissions])` em `INITIAL_SESSION`** — se `user_roles` ou `user_permissions` retornar lento, **toda a aplicação espera**. Seria razoável mostrar dashboard com permissões otimistas + skeleton de menu.
27. **`fetchProfile` falha silenciosamente** (`catch` só loga). Profile pode ficar `null`, e o header mostra "Usuário" — sem retry, sem aviso.
28. **`SIGNED_OUT` involuntário dispara toast** — bom — mas **não limpa `manualSignOut`** se o evento chegar duplicado. `manualSignOut.current = false` é resetado *toda* invocação, então um logout manual seguido de evento duplicado pode disparar toast indevido.
29. **`signOut` faz `window.location.assign('/login')`** — perde React Router state. Para deep-link "voltar para onde estava após login", inviabiliza o fluxo (combinado com problema 8).

### 2.7 SessionExpiryWarning

30. **Warn aparece ~55 min em sessão de 1h** (default Supabase). Para usuários com `session_keepalive=true`, o keepalive renova silenciosamente e o warn nunca dispara — bom. Para os que não têm, o warn aparece sem contexto de qual aba/rota está ativa.
31. **Dialog bloqueante após expirar** desabilita pointer-down e ESC, mas o **Sonner toast** continua acima. Não há trava em interações com a página atrás — o usuário ainda pode clicar em links via teclado (TAB → Enter) antes de ver o dialog se a renderização for lenta.
32. **`expireTimerRef`** dispara um `setTimeout` baseado em `Date.now() - expires_at`. Se a aba ficou suspensa (laptop fechado), o timer não dispara no momento certo — `setTimeout` é throttled. Não há recheck no `visibilitychange`.

### 2.8 Coerência guards × menu × deep-link

33. **`PermissionRoute` falha com `AccessDenied`** mas **`useVisibleNavSections` esconde o item do menu**. Resultado: usuário sem permissão **nunca clica** num link, mas se cola URL, vê uma tela de "Acesso restrito" com `RequestAccessDialog`. Coerente, mas o título "Acesso restrito" + chip do recurso poderia explicar melhor "este recurso existe, peça acesso".
34. **`AdminRoute` aceita role admin OR `administracao:visualizar`**, mas **`useIsAdmin` retorna isAdmin=false** para quem só tem `administracao:visualizar`. UI em telas que usam `useIsAdmin` (ex: badges, gating de seções) será inconsistente com o que o guard libera.
35. **Guards diferentes mostram telas de loading diferentes**: `ProtectedRoute` → `mode="session"`, `AdminRoute`/`PermissionRoute`/`SocialRoute` → `mode="permissions"`. Diferença sutil, mas o usuário vê copy diferente no mesmo flicker.

### 2.9 Riscos estruturais

36. **Trigger `handle_new_user` não tem `INSERT INTO user_roles`** — toda nova conta é "fantasma" do ponto de vista de RBAC.
37. **Sem fluxo de "reativar/desativar"** para usuários — `profiles` não tem coluna `ativo`, `signOut` global não desativa sessões. Se admin remove um usuário do `user_roles`, ele continua logado até expirar.
38. **`auth.users.email` × `profiles.email`**: trigger criado na fase 9 do roadmap Configurações sincroniza, mas se trigger for desabilitado, divergência reaparece. Sem validação periódica.
39. **`emailRedirectTo` é `window.location.origin`** — em ambientes preview vs prod, gera URLs diferentes. Se o usuário abre o link de signup em outro device, falha.
40. **`SessionExpiryWarning` confia em `session.expires_at`** sem verificar drift de relógio cliente/servidor. Em laptops com horário desconfigurado, warn pode disparar 30 min cedo ou tarde.

---

## 3. Problemas prioritários

| # | Problema | Severidade | Impacto |
|---|---|---|---|
| 1 | Signup não cria role nenhum (item 1) | **Crítica** | Onboarding inutilizável sem intervenção de admin |
| 2 | `INVITE_ONLY` puramente client-side (item 4) | **Crítica** | Falsa segurança, cadastro livre via API |
| 3 | Regra de senha divergente entre 3 telas (item 5) | **Alta** | Política inauditável, usuário com senha 6 não passa em Configurações |
| 4 | Pós-login não respeita rota de origem (itens 8-9, 29) | **Alta** | Sessão expirada = perda de contexto |
| 5 | `handle_new_user` lê `full_name` mas form envia `nome` (item 14) | **Alta** | Todo usuário novo aparece com nome=email |
| 6 | `error.message` cru em signup ("já registrado") (item 18) | Média | Usuário não sabe que deveria fazer login |
| 7 | `ForgotPassword` falha sem feedback visual (item 20) | Média | Usuário re-clica sem entender |
| 8 | `safetyTimeout` joga para login sem aviso (item 25) | Média | UX de queda do Supabase = "fui deslogado?" |
| 9 | `useIsAdmin` × `AdminRoute` divergem (item 34) | Média | Inconsistência permissão visual vs guard |
| 10 | Sem HIBP / sem reenvio de confirmação (itens 7, 17) | Baixa | Política de senha fraca + UX de recovery faltando |

---

## 4. Melhorias de UI/UX

- **Login**: passar `state={{ from: location }}` no `<Navigate>` do `ProtectedRoute`; ler `location.state?.from?.pathname || '/'` no `handleLogin`. Suportar também `?next=`.
- **Login**: trocar `Loader2` full-screen por `AuthLoadingScreen` com branding (consistência com guards).
- **Login**: aguardar `navigate` antes de toast, ou eliminar o toast (redirecionamento já é confirmação).
- **Signup**: campo "Confirmar senha" + indicador de força aplicado também a `/reset-password` e `/configuracoes/seguranca`.
- **Signup**: tratar `error.message.includes('already registered')` → CTA "Já tem conta? Fazer login" inline.
- **Signup**: adicionar botão "Reenviar e-mail de confirmação" na tela de sucesso, com cooldown de 60s.
- **Signup**: `CapsLockIndicator` no campo de senha (paridade com Login).
- **ForgotPassword**: estado de erro inline (não só toast); manter campo preenchido; mensagem "Se o e-mail existir, enviaremos o link" (evita user enumeration).
- **ResetPassword**: ler "expira em X" do projeto (ou remover número da cópia); oferecer "Encerrar outras sessões" pós-sucesso (paridade com `useChangePassword`).
- **AuthLoadingScreen**: unificar copy "Carregando sessão" entre `ProtectedRoute` (mode=session) e `Login.authLoading` (que hoje usa Loader2).
- **AccessDenied** em `PermissionRoute`: trocar título para "Sem acesso a {recurso}" com CTA "Solicitar acesso ao admin" mais visível.

---

## 5. Melhorias estruturais

1. **Atualizar `handle_new_user`** para inserir role default (`vendedor`?) ou colocar usuário em "pendente" (nova coluna `profiles.status='pendente'`) e bloquear no `AuthContext` até admin ativar.
2. **Criar tabela `invites(token, email, role, expires_at, used_at)`** + edge function `validate-invite` consumida no `signUp`. Deprecar `INVITE_ONLY` puramente client-side.
3. **Centralizar regra de senha** em `src/lib/passwordPolicy.ts` com `MIN_LENGTH`, `requireMixedCase`, `requireDigit`, `validatePassword(value)`. Importar em Login/Signup/Reset/Change. Renderizar `PasswordStrengthIndicator` componente único.
4. **Trocar `handle_new_user`** para ler `raw_user_meta_data->>'nome'` (case correto) ou mudar `Signup.tsx` para enviar `full_name`. Padronizar.
5. **Habilitar `password_hibp_enabled`** via `configure_auth`.
6. **Edge function `notify-admin-new-signup`** (acionada pelo trigger) que enfileira e-mail via pgmq para `ADMIN_EMAIL`.
7. **Remover `window.location.assign` em `signOut`** quando não houver dependência do refresh (limpar contextos manualmente já feito; usar `navigate('/login', { replace: true })`).
8. **Recheck de expiração no `visibilitychange`** em `SessionExpiryWarning` — se a aba volta visível e `expires_at < now`, dispara `setExpired(true)` imediatamente.
9. **`fetchProfile` com retry** (1 retry após 1s) e fallback explícito no `AuthContext` para registrar erro em logger.
10. **Atualizar `mem://auth/sincronizacao-sessao-inicial.md`** com o contrato pós-trigger.

---

## 6. Roadmap de execução

| Fase | Entrega | Dep. | Esforço | Impacto |
|---|---|---|---|---|
| 1 | Trigger `handle_new_user` insere role default ou marca `profiles.status='pendente'` | — | M | **Resolve crítico 1** |
| 2 | Trigger lê `nome` (não `full_name`) ou Signup envia `full_name` | — | S | Nome real grava no signup |
| 3 | `src/lib/passwordPolicy.ts` + componente `PasswordStrengthIndicator` único; aplicar em Login/Signup/Reset/Change | — | M | Política unificada |
| 4 | `ProtectedRoute` passa `state.from`; `Login` lê e redireciona; `signOut` opcionalmente preserva path | — | S | Recupera contexto pós-expiração |
| 5 | `Signup`: confirmar senha, reenviar e-mail, mensagem amigável "User already registered" → CTA login | Fase 3 | M | UX de cadastro decente |
| 6 | `ForgotPassword` com mensagem neutra (anti-enumeration) e estado inline de erro | — | S | UX + segurança |
| 7 | `ResetPassword`: oferecer "Encerrar outras sessões" pós-sucesso; remover número "1 hora" hardcoded | — | S | Paridade com Change Password |
| 8 | `useIsAdmin` aceitar `administracao:visualizar` (alinhar com `AdminRoute`) | — | S | Coerência guard × hook |
| 9 | `SessionExpiryWarning` recheck no `visibilitychange` | — | S | Não vaza pós-suspend |
| 10 | Tabela `invites` + edge function `validate-invite` server-side; depreca `INVITE_ONLY` flag | Fase 1 | L | **Resolve crítico 2** |
| 11 | `password_hibp_enabled=true` via configure_auth | — | S | Segurança baseline |
| 12 | Edge function `notify-admin-new-signup` (pgmq) | Fase 1 | M | Admin sabe de cadastros novos |
| 13 | `Login.authLoading` usa `AuthLoadingScreen` (branding consistente) | — | S | Coerência visual |
| 14 | `mem://auth/onboarding-e-roles.md` documentando o novo fluxo | Fases 1, 10 | S | Governança |

**Quick wins (1 PR cada)**: 2, 4, 6, 7, 8, 9, 11, 13.
**Refatoração estrutural**: 1, 3, 5, 12, 14.
**Evolução de produto**: 10.

