---
name: Onboarding e atribuição de roles
description: Fluxo de signup com status pendente, validação server-side de convites e notificação ao admin
type: feature
---

## Fluxo de cadastro

1. **Signup** (`/signup`) cria conta via `supabase.auth.signUp` com metadata `{ nome, full_name, invite_token? }`.
2. **Trigger `handle_new_user`** cria `profiles` com `nome` correto (fallback `full_name` → email) e `status = 'pendente'`.
3. **Nenhum role** é atribuído automaticamente — usuário fica em estado "pendente" e admin precisa ativar via `/administracao/usuarios`.

## Validação de convites

- Tabela `public.invites` (token, email, role, expires_at, used_at) — apenas admins podem CRUD via RLS.
- Edge function `validate-invite` (verify_jwt=false) valida o token antes do `signUp`. Retorna `{ valid, role, reason }`.
- Razões de falha: `not_found | already_used | expired | email_mismatch`.
- Flag client `VITE_INVITE_ONLY=true` força token obrigatório no formulário; a validação server-side **sempre** roda quando há token.

## Notificação ao admin

- Edge function `notify-admin-new-signup` (verify_jwt=false) é chamada fire-and-forget após signup bem-sucedido.
- Enfileira via RPC `queue_email` (pgmq) consumida por `process-email-queue`.
- Destinatário: `ADMIN_EMAIL` (env var), padrão `admin@avizee.com.br`.

## Política de senha (única)

- `src/lib/passwordPolicy.ts` é a fonte única: mínimo 8 caracteres, mistura de maiúsculas/minúsculas, dígito.
- HIBP habilitado via `configure_auth` — senhas vazadas são rejeitadas pelo Supabase.
- Componente `PasswordStrengthIndicator` usado em Signup, ResetPassword e Configurações → Segurança.

## Sessão e redirect

- Guards (`ProtectedRoute`, `AdminRoute`, `PermissionRoute`, `SocialRoute`) passam `state.from` no `<Navigate>` para login.
- `Login.handleLogin` lê `location.state?.from` ou `?next=` para retornar ao deep-link após autenticar.
- `useIsAdmin` aceita role `admin` OU permissão `administracao:visualizar` (alinhado com `AdminRoute`).
- `SessionExpiryWarning` revalida no `visibilitychange` (corrige throttling de timer em laptops suspensos).