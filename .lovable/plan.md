

## Revisão estrutural — Módulo Administração

Diagnóstico real:
- **Branding/identidade fragmentado**: `empresa_config` guarda CNPJ/endereço/logo_url/regime_tributario; `app_configuracoes['geral']` guarda nomeFantasia/site/whatsapp/responsavel/corPrimaria/corSecundaria — campos de identidade institucional misturados em duas tabelas, com risco de divergência (`empresa.razao_social` vs `geral.empresa`).
- **`auditoria_logs` quase vazia para Admin** (0 entradas administrativas — 1 INSERT total). Não há trigger gravando alterações em `app_configuracoes`/`empresa_config`/`user_roles`/`user_permissions`. Há `permission_audit` separada, usada **apenas** pela edge function `admin-users`, com schema mínimo (`alteracao jsonb` sem campos estruturados de motivo/action_type/permission_diff).
- **Modelo de overrides incompleto**: `user_permissions` não tem `motivo`, `granted_by`, `granted_at` (created_at não basta — não diferencia conceder de revogar), `revoked_by`, `revoked_at`, `expires_at`. `allowed=false` permanece como linha — mas não há quem/quando da revogação.
- **`replaceUserPermissions` apaga e reinsere**: a edge function destrói histórico ao trocar permissões; perde rastro individual de quando uma permissão extra foi concedida pela primeira vez.
- **Matriz visual mostra 6 de 20 ações** (`MATRIX_ACTIONS = visualizar/criar/editar/excluir/exportar/aprovar`), comunicando recorte como se fosse o todo. Modos como `confirmar`, `importar_xml`, `admin_fiscal`, `gerar`, `sincronizar`, `gerenciar_alertas` estão escondidos.
- **Dashboard de Segurança usa métricas semânticamente erradas**: "Logins Antigos +30 dias" conta `auditoria_logs` com `acao='auth:login'` (que ninguém grava — 0 hoje) — não é sessão ativa, não é último login do usuário. "Logins Falhos 24h" depende de `acao='LOGIN_FAILED'` igualmente não gravado.
- **Guards coerentes mas com sutileza**: `AdminRoute` usa `isAdmin` (role check) e `useVisibleNavSections` esconde o item `administracao` para não-admin — alinhados. Porém `PermissionRoute` para `administracao:visualizar` nunca é usado — qualquer não-admin com `administracao:visualizar` (raro, mas possível via override) **não acessaria** porque `AdminRoute` exige role `admin`. Inconsistência estrutural admin-vs-permissão.
- **Ausência de `ativo` em `profiles`**: ativação de usuário usa `auth.users.banned_until` (correto), mas estado não fica replicado em `profiles` para queries simples sem service_role.
- **Configurações sem versionamento**: `app_configuracoes` upsert sobrescreve sem snapshot anterior — perde-se visibilidade de "quando trocaram CFOP padrão".

Plano: alinha estrutura sem reinventar. Reaproveita `permission_audit` (renomeando conceitualmente para "audit administrativo") e `auditoria_logs` para mudanças de configuração, fortalece `user_permissions` com governança e reorganiza a fronteira branding/sistêmico.

---

### 1) Fronteira oficial — institucional vs sistêmico

Definição canônica:

**`empresa_config`** (1 linha, identidade fiscal/jurídica) — adiciona campos hoje em `geral`:
- `nome_fantasia` ✓ (já existe)
- `site text`, `whatsapp text`, `responsavel text`, `inscricao_municipal text` (novos)
- `cor_primaria text`, `cor_secundaria text` (novos — branding visual)

**`app_configuracoes`** (chave-valor, parâmetros sistêmicos) — mantém apenas:
- `email`, `fiscal`, `financeiro`, `usuarios`, `cep_empresa`, `compras.limite_aprovacao`, `frete:caixas_embalagem`, `theme_primary_color`, `theme_secondary_color`
- **Remove de `geral`**: `nomeFantasia`, `inscricaoMunicipal`, `site`, `whatsapp`, `responsavel`, `logoUrl`, `corPrimaria`, `corSecundaria` (migrados para `empresa_config`)
- Mantém em `geral` apenas chaves operacionais residuais que não pertencem ao perfil da empresa (se houver).

Migration `admin_fronteira_branding`:
- ALTER TABLE empresa_config ADD COLUMN site/whatsapp/responsavel/inscricao_municipal/cor_primaria/cor_secundaria (text, nullable).
- Backfill: copia de `app_configuracoes.valor->>'…'` (chave `geral`) para a única linha de `empresa_config`. Mantém backup numa coluna `geral_legacy jsonb` em `empresa_config` por 1 sprint para conferência.
- **Não** apaga `geral` da `app_configuracoes` no DB — apenas marca campos migrados como deprecated no front; serviço passa a ler/escrever em `empresa_config`.

Front:
- `Administracao.tsx` aba "Empresa": usa `useEmpresaConfig` para todos os campos institucionais (incluindo cores, site, whatsapp).
- `useAppConfig('geral')` continua existindo, mas a UI principal de empresa não escreve mais lá.
- `useThemeColors` (se existe) lê de `empresa_config` com fallback em `app_configuracoes['theme_primary_color']`.

### 2) Governança de overrides — `user_permissions` reforçada

Migration `admin_user_permissions_governance`:
- ALTER TABLE user_permissions ADD COLUMN:
  - `granted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL`
  - `granted_at timestamptz NOT NULL DEFAULT now()` (renomeia conceitualmente `created_at`; mantém `created_at` por compat)
  - `motivo text` (justificativa textual)
  - `expires_at timestamptz` (suporte a permissões temporárias — opcional, sem cron, apenas filtro em `useCan`)
  - `updated_at timestamptz NOT NULL DEFAULT now()`
  - `updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL`
- Trigger `trg_user_permissions_audit AFTER INSERT OR UPDATE OR DELETE`: grava em `permission_audit` com `tipo` derivado (`grant`, `revoke`, `update`, `delete`) e diff antes/depois. Captura `auth.uid()` como `user_id` (ator).

`useCan` em `src/hooks/useCan.ts`: ignora overrides com `expires_at < now()` (filtro no `buildPermissionSet` ou no fetch de `user_permissions`).

### 3) `permission_audit` enriquecida — auditoria administrativa canônica

Migration `admin_permission_audit_v2`:
- ALTER TABLE permission_audit ADD COLUMN:
  - `tipo_acao text NOT NULL DEFAULT 'legacy'` — canônico: `user_create`, `user_update`, `user_status_change`, `role_grant`, `role_revoke`, `permission_grant`, `permission_revoke`, `config_update`, `branding_update`, `logo_upload`.
  - `entidade text` (`user`, `role`, `permission`, `app_config`, `empresa_config`)
  - `entidade_id text` (uuid ou chave de config)
  - `motivo text`
  - `ip_address text`, `user_agent text` (capturados na edge function quando possível)
- Backfill: tenta extrair `tipo` de `alteracao->>'tipo'` para `tipo_acao` em registros existentes.
- View `v_admin_audit_unified`: UNION de `permission_audit` + `auditoria_logs` filtrado para tabelas administrativas (`app_configuracoes`, `empresa_config`, `user_roles`, `user_permissions`, `profiles`), normalizando colunas para a UI de auditoria.

### 4) Triggers de auditoria em config

Migration `admin_audit_triggers_config`:
- Trigger `trg_audit_app_configuracoes AFTER INSERT/UPDATE/DELETE ON app_configuracoes`: insere em `auditoria_logs` com `tabela='app_configuracoes'`, `acao` ('CONFIG_UPDATE' / 'CONFIG_INSERT' / 'CONFIG_DELETE'), `dados_anteriores`/`dados_novos` em jsonb. Usa `auth.uid()` para `usuario_id`.
- Trigger `trg_audit_empresa_config AFTER INSERT/UPDATE` idem.
- Trigger `trg_audit_user_roles AFTER INSERT/UPDATE/DELETE ON user_roles`: grava em `permission_audit` com `tipo_acao='role_grant'/'role_revoke'`, `entidade='role'`, `entidade_id=role`.
- Não cria trigger em `user_permissions` aqui (já tratado no item 2).

### 5) Edge function `admin-users` — preserva governança

`supabase/functions/admin-users/index.ts`:
- `replaceUserPermissions` deixa de ser destrutivo: calcula diff (atual vs desejado), faz `INSERT` apenas das novas, `UPDATE allowed=false` para revogadas (em vez de DELETE) — preserva `granted_by`/`granted_at` originais. DELETE só quando override é totalmente removido (e nesse caso o trigger grava em `permission_audit`).
- Aceita `motivo` em `payload` (`update`, `toggle-status`) e propaga para `user_permissions.motivo` e `permission_audit.motivo`.
- `insertAudit` passa a popular `tipo_acao`/`entidade`/`entidade_id` (não só `alteracao` jsonb solto).

### 6) Matriz de permissões — cobertura real

`src/pages/admin/components/PermissaoMatrix/index.tsx`:
- `MATRIX_ACTIONS` deixa de ser lista hardcoded; passa a derivar dinamicamente de `ERP_ACTIONS` agrupadas em duas faixas:
  - **Núcleo** (sempre visível): `visualizar`, `criar`, `editar`, `excluir`, `exportar`, `aprovar`, `cancelar`.
  - **Avançado** (toggle "Mostrar ações avançadas"): `confirmar`, `importar_xml`, `admin_fiscal`, `gerar`, `download`, `editar_comentarios`, `gerenciar_templates`, `configurar`, `sincronizar`, `gerenciar_alertas`, `baixar`, `reenviar_email`, `visualizar_rentabilidade`.
- Cada recurso só renderiza ações **aplicáveis** (filtra ações que existem na matriz canônica para qualquer role) — evita coluna `confirmar` em recursos onde nenhum role usa.
- Banner informativo passa a indicar nº de ações exibidas / nº total + link para alternar visão.

### 7) Dashboard de Segurança — métricas estruturalmente honestas

`src/pages/admin/components/DashboardAdmin.tsx` substitui as 3 métricas atuais por 4 confiáveis:

| Card | Fonte real | Semântica |
|---|---|---|
| Sessões ativas | `admin-sessions` edge function (já existe) → conta usuários com `last_sign_in_at` nos últimos 30 min | sessão real |
| Usuários inativos (>30 dias) | `auth.users.last_sign_in_at < now() - 30d` via `admin-sessions` | última atividade |
| Administradores | `user_roles WHERE role='admin'` | igual hoje |
| Eventos administrativos (24h) | `permission_audit` count nas últimas 24h | trilha real |

Card removido: "Logins Falhos 24h" (não há captura) e "Logins Antigos" (semântica errada). Quando `LOGIN_FAILED` for capturado no futuro (via Supabase Auth Hooks ou edge function de login), retorna como métrica.

Hook novo `useSessoesMetricas` (em `src/pages/admin/hooks/`) chama `admin-sessions` com `action='metrics'`. Edge function ganha esta action retornando `{ ativas, inativasMais30d, totalUsuarios }`.

### 8) Modelo de usuário administrável — `profiles.ativo`

Migration `admin_profile_ativo`:
- ALTER TABLE profiles ADD COLUMN `ativo boolean NOT NULL DEFAULT true`.
- Backfill: marca `ativo=false` para perfis cujo `auth.users.banned_until` está no futuro (executado pela edge function manualmente via script ou no próximo `update_user`).
- Edge function `admin-users` passa a sincronizar `profiles.ativo` quando muda `ban_duration`.
- Frontend (lista de usuários) lê `ativo` direto de `profiles` em vez de depender de chamada à edge function para flag simples.

RLS: `profiles.ativo` continua visível pelo próprio usuário e admins (já coberto).

### 9) Coerência guards Admin vs Permissão

- `AdminRoute` continua exigindo role `admin` (caminho canônico para área administrativa completa).
- Para sub-recursos administrativos que **possam** ser delegados (futuro: ex.: financeiro acessar config financeira sem ser admin), `PermissionRoute resource="administracao" action="configurar"` fica disponível sem mudança. Hoje não há rota usando isso — apenas formaliza a porta.
- `useVisibleNavSections`: condiciona seção `administracao` a `isAdmin || can('administracao:visualizar')` (em vez de só `isAdmin`). Backwards-compat: como apenas admin tem `administracao:visualizar` na matriz canônica, comportamento atual preservado; mas overrides individuais passam a funcionar.

### 10) Storage de logo — governança

Bucket `dbavizee` já é usado. Adiciona:
- Path canônico `empresa/logo.{ext}` (substitui timestamp/aleatório); upload faz `upsert: true` para preservar URL estável.
- Trigger de auditoria já cobre `empresa_config.logo_url` (item 4); upload em si fica logado na `auditoria_logs` via chamada explícita do front (`tipo_acao='logo_upload'`).

---

### Migrations (idempotentes, `SET search_path=public`)

1. `admin_fronteira_branding` — adiciona colunas em `empresa_config`, backfill de `app_configuracoes.geral`.
2. `admin_user_permissions_governance` — colunas + trigger `trg_user_permissions_audit`.
3. `admin_permission_audit_v2` — colunas estruturadas + view `v_admin_audit_unified`.
4. `admin_audit_triggers_config` — triggers em `app_configuracoes`, `empresa_config`, `user_roles`.
5. `admin_profile_ativo` — coluna `ativo` em `profiles`.

Sem DROP destrutivo. RLS preservada (admin-only mantida em todas).

### Arquivos editados / criados

**Banco**: 5 migrations.

**Edge functions**:
- `supabase/functions/admin-users/index.ts` — `replaceUserPermissions` não-destrutivo, propagação de `motivo`, escrita estruturada em `permission_audit`.
- `supabase/functions/admin-sessions/index.ts` — nova action `metrics`.

**Front (editados)**:
- `src/pages/Administracao.tsx` — aba Empresa lê/escreve em `empresa_config` para branding, remove duplicação com `geral`.
- `src/pages/admin/components/DashboardAdmin.tsx` — substitui métricas por sessões reais + eventos administrativos.
- `src/pages/admin/components/PermissaoMatrix/index.tsx` — toggle "ações avançadas", filtro de ações aplicáveis, contador real.
- `src/pages/admin/hooks/useEmpresaConfig.ts` — adiciona campos novos.
- `src/pages/admin/hooks/useUsuarios.ts` — propaga `motivo`.
- `src/components/usuarios/UsuariosTab.tsx` — campo `motivo` opcional ao editar permissões.
- `src/services/admin/perfis.service.ts` — `concederPermissao`/`revogarPermissao` aceitam `motivo`, `granted_by`.
- `src/hooks/useCan.ts` — filtra overrides expirados (`expires_at`).
- `src/hooks/useVisibleNavSections.ts` — `administracao` por `isAdmin || can('administracao:visualizar')`.

**Front (criados)**:
- `src/pages/admin/hooks/useSessoesMetricas.ts` — wrapper do `admin-sessions?action=metrics`.
- `src/pages/admin/hooks/useAdminAuditUnificada.ts` — consulta a `v_admin_audit_unified` para a aba Auditoria.

**Documentação**:
- `docs/administracao-modelo.md` (novo): fronteira branding/sistêmico, modelo de overrides com governança, eventos auditados, política de Dashboard de Segurança, matriz canônica vs visual.

### Estratégias declaradas

- **Overrides individuais auditáveis**: `user_permissions` ganha `granted_by/at`, `motivo`, `expires_at`, `updated_by`; trigger grava `permission_audit` com diff e ator. Edge function não-destrutiva preserva histórico.
- **Matriz visual fiel**: ações nucleares por padrão + toggle avançado + filtro por aplicabilidade — nada do modelo real fica escondido sem indicação.
- **Dashboard de segurança**: deixa de inferir sessão a partir de log; passa a consumir `admin-sessions` (Auth Admin API) e contagem de eventos administrativos reais. Cards com semântica enganosa removidos.
- **Auditoria administrativa**: triggers cobrem todas as tabelas administrativas; `permission_audit` ganha campos estruturados (`tipo_acao`, `entidade`, `entidade_id`, `motivo`); view unificada simplifica a UI.
- **Branding institucional**: tudo que define a empresa (jurídico + visual + contato) vive em `empresa_config`. `app_configuracoes` fica com parâmetros operacionais (e-mail, fiscal, financeiro, limites). Backfill preserva dados existentes.

### Compatibilidade com front atual

- `useAppConfig('geral')` continua respondendo durante transição (campos legados ainda presentes em `app_configuracoes` por 1 sprint via backfill espelhado opcional, ou simplesmente não usados).
- `useEmpresaConfig` ganha campos novos sem quebrar consumers existentes (campos opcionais).
- Edge function `admin-users` mantém contrato (`action='list'/'create'/'update'/'toggle-status'`); apenas `payload` aceita `motivo` adicional.
- Matriz visual sem mudança de API — novos toggles internos.
- Dashboard de segurança troca conteúdo dos cards mas mantém `<DashboardAdmin />` exportado.

### Pontos para revisão manual

- Decidir se `app_configuracoes['geral']` será apagado depois do backfill (sugestão: manter 1 sprint, depois migration de cleanup).
- Configurar captura de `LOGIN_FAILED`/`auth:login` (Auth Hooks) se quiser ressuscitar essas métricas — fora deste escopo.
- Usuários com múltiplas roles (raro hoje): edge function `replaceUserRole` continua substituindo; rever se é desejado.
- Logo legado armazenado fora do path canônico permanece acessível via URL antiga; novos uploads vão para `empresa/logo.{ext}`.

### Fora de escopo

- 2FA real (campo `exigir2fa` em `app_configuracoes['usuarios']` permanece declarativo — Supabase MFA é setup separado).
- Cron de expiração de overrides (`expires_at` é checado em leitura, sem job de limpeza).
- Captura de IP/UA em todos os fluxos (apenas onde a edge function tem acesso ao request).
- Dashboard de auditoria com gráficos temporais (apenas tabela na aba Auditoria).

