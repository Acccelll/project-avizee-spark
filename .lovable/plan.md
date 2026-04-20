

## Revisão estrutural — Configurações

### Diagnóstico real

1. **Módulo paralelo morto**: `src/pages/configuracoes/*` (Geral, Email, Notificacoes, Integracoes, Backup) **não está roteado** em lugar nenhum do app — duplica conceitualmente a Administração (que é a fonte real) e introduz semântica enganosa (ex.: "você recebe notificações" para um config global).
2. **Mistura pessoal × global em `Configuracoes.tsx`**:
   - Tela pessoal grava `theme_primary_color` / `theme_secondary_color` direto em `app_configuracoes` (global), com gate `isAdmin` apenas no front — sem trilha em `auditoria_logs`, sem passar pelo fluxo do `Administracao.tsx`.
   - `menuCompacto` está em `app_configuracoes['sidebar_collapsed']` via `AppConfigContext`, mas é **preferência pessoal** (cada usuário deveria ter o seu) — hoje o valor é compartilhado entre todos.
3. **Branding fragmentado**: cores em `app_configuracoes['theme_primary_color'/'theme_secondary_color']`, logo/CNPJ/endereço em `empresa_config`. Sem unificação.
4. **Segredos em texto puro**: `smtp_senha`, `gateway_secret_key`, `sefaz_senha_certificado` vivem como JSON em `app_configuracoes.valor` sem mascaramento, sem segregação. RLS protege a leitura mas qualquer admin enxerga texto plano.
5. **Auditoria parcial**: `Administracao.tsx` salva sem audit log explícito; `configuracoes.service.ts` (do módulo morto) tem audit, mas ninguém o chama em produção.

---

### Decisões estruturais

#### 1. Eliminar o módulo paralelo
- **Remover** `src/pages/configuracoes/{Geral,Email,Integracoes,Notificacoes,Backup}.tsx` e seus hooks/services órfãos. O canônico para configuração global é `src/pages/Administracao.tsx` (já roteado, com guards e abas).
- Manter `src/pages/Configuracoes.tsx` como **única tela de preferências pessoais** (perfil, aparência pessoal, segurança).

#### 2. Fronteira oficial pessoal × global

| Domínio | Tabela | Quem altera |
|---|---|---|
| Tema (light/dark/system), densidade, font-scale, reduce-motion, **menu compacto**, dismissed-notifications | `user_preferences` (via `useUserPreference`) | Próprio usuário |
| Branding institucional: logo, cores primária/secundária, nome fantasia, site, contatos | `empresa_config` (colunas dedicadas) | Admin via `Administracao.tsx` |
| Parâmetros sistêmicos: email/SMTP, fiscal, financeiro, dashboard_metas, frete, cep_empresa | `app_configuracoes` (kv com JSON) | Admin |
| Segredos: senhas SMTP, API keys, senhas de certificado | **Supabase Vault** + RPC `SECURITY DEFINER` | Admin |

#### 3. Branding consolidado em `empresa_config`
- Migration: adicionar colunas `cor_primaria text`, `cor_secundaria text` em `empresa_config` (já tem `logo_url`).
- Migrar valores atuais de `app_configuracoes['theme_primary_color'/'theme_secondary_color']` para as novas colunas.
- Deletar as duas chaves de `app_configuracoes` após migração.
- `ThemeProvider` e `Configuracoes.tsx` passam a ler de `empresa_config`. `Administracao.tsx` (aba Empresa) ganha os controles de cor — removidos da tela pessoal.

#### 4. `menuCompacto` vira preferência pessoal
- `AppConfigContext.sidebarCollapsed` deixa de chamar `useUserPreference` com a chave global atual e passa a usar de fato `user_preferences/sidebar_collapsed` por usuário (já está usando `useUserPreference`, só precisa garantir que **não** está sendo lido de `app_configuracoes` em outro lugar).
- Verificação: o context já usa `useUserPreference` — ok. Apenas remover qualquer fallback que o leia de `app_configuracoes`.

#### 5. Notificações
- **Decisão**: notificações operacionais (novo pedido, pagamento, estoque baixo, push, frequência de resumo) são **preferências pessoais**.
- Persistência: `user_preferences/notificacoes` por usuário, via `useUserPreference`.
- Nada disso fica em `app_configuracoes` (a chave atual `notificacoes`, se existir, é descartada).
- A UI de notificações pessoais será **adicionada como nova aba em `src/pages/Configuracoes.tsx`** ("Notificações"), reusando os campos do `Notificacoes.tsx` morto antes de removê-lo.

#### 6. Segredos via Vault
- Migration cria RPCs `SECURITY DEFINER` (`set_secret_smtp_password`, `get_secret_smtp_password`, equivalentes para gateway/sefaz) que escrevem em `vault.secrets` e expõem apenas a referência (`secret_id`) para `app_configuracoes`.
- Estrutura em `app_configuracoes['email']`:
  ```json
  { "smtp_host": "...", "smtp_porta": 587, "smtp_usuario": "...", "smtp_senha_secret_id": "uuid", "smtp_ssl": true, ... }
  ```
- Edge functions (`test-smtp`, `process-email-queue`) leem o secret via RPC, nunca diretamente. UI mostra `••••••••` e botão "Substituir senha".
- Aplica-se a `gateway_secret_key`, `sefaz_senha_certificado`. Campos não-sensíveis (`gateway_api_key` público, `sefaz_ambiente`) ficam em texto.

#### 7. Estrutura `app_configuracoes` — contrato mínimo
- Mantém `chave + valor jsonb`, mas adiciona colunas de governança:
  - `categoria text` (`fiscal`, `email`, `financeiro`, `dashboard`, `compras`, `frete`, `usuarios`)
  - `sensibilidade text check (sensibilidade in ('publico','interno','sensivel'))` default `interno`
  - `updated_by uuid references auth.users(id)`
  - `updated_at timestamptz default now()` (já existe)
- Trigger `trg_app_configuracoes_audit` (já temos padrão) preenche `updated_by` e grava em `auditoria_logs` (categoria + diff).

#### 8. Auditoria
- Centralizar trilha em `auditoria_logs` via triggers de banco (`empresa_config`, `app_configuracoes`, `vault.secrets` reference) — front não precisa registrar manualmente.
- Payload normalizado: `{ chave, categoria, sensibilidade, diff, atualizado_por }`.
- Para segredos: registrar **apenas o evento** (`secret:rotated`), nunca o valor.

#### 9. Backup
- Manter como configuração declarativa em `app_configuracoes['backup']` (categoria `infra`, sensibilidade `interno`).
- **Não** criar tabela de execução agora — fora de escopo desta sprint. Documentar na UI que é apenas declarativo até existir job real (`pg_cron` + edge function).

#### 10. Testes de integração — semântica explícita
- `TestConnectionButton` (sobrevive na nova aba admin) ganha enum de profundidade: `validacao_form`, `reachability`, `handshake`, `funcional`. O service retorna `{ nivel, sucesso, mensagem }`.
- SMTP: `funcional` (já chama `test-smtp`).
- Gateway/SEFAZ: `validacao_form` (declarado na resposta — sem fingir que é handshake real).
- URL/webhook: `reachability` (HEAD com timeout).

---

### Plano de execução

#### Migrations
1. `add_branding_to_empresa_config.sql` — colunas `cor_primaria`, `cor_secundaria`; copia de `app_configuracoes`; deleta as duas chaves antigas.
2. `app_configuracoes_governance.sql` — colunas `categoria`, `sensibilidade`, `updated_by`; backfill por chave conhecida; trigger de auditoria + `updated_by`.
3. `secrets_vault_rpcs.sql` — RPCs `SECURITY DEFINER` para set/get de senhas SMTP/gateway/SEFAZ; substitui campos sensíveis em `app_configuracoes['email'/'integracoes']` por `*_secret_id`.

#### Frontend
4. **Mover branding** (cores) de `Configuracoes.tsx` → `Administracao.tsx` aba "Empresa". `ThemeProvider` passa a ler `empresa_config`.
5. **Adicionar aba "Notificações"** em `Configuracoes.tsx` (pessoal, via `useUserPreference/notificacoes`).
6. **Adaptar `Administracao.tsx`** (aba Sistema → Email/Integrações) para usar as novas RPCs do Vault para segredos; UI mostra `••••••••` + "Substituir".
7. **Deletar** `src/pages/configuracoes/{Geral,Email,Integracoes,Notificacoes,Backup}.tsx`, `hooks/`, `services/configuracoes.service.ts`, `components/{ConfigSection,ConfigHistoryDrawer,ApiKeyInput,TestConnectionButton}` órfãos. Migrar `TestConnectionButton` para `src/pages/admin/components/` antes da deleção.
8. **Remover** os testes órfãos (`src/services/__tests__/configuracoes.test.ts`) ou recolocá-los na nova localização canônica.

#### Edge functions
9. `test-smtp`, `process-email-queue`, `sefaz-proxy`: ler senha via `get_secret_*` RPC ao invés de receber em texto.

---

### Entregáveis

| # | Item | Saída |
|---|---|---|
| 1 | Tabelas alteradas | `empresa_config` (+cor_primaria, +cor_secundaria), `app_configuracoes` (+categoria, +sensibilidade, +updated_by), `vault.secrets` (uso novo) |
| 2 | Pessoal × global | Tabela acima — `user_preferences` para tudo pessoal, `empresa_config` para branding, `app_configuracoes` para sistêmico |
| 3 | Branding | Unificado em `empresa_config`; gerenciado só por admin em `Administracao.tsx` |
| 4 | Notificações | Pessoais; nova aba em `Configuracoes.tsx`; chave `user_preferences/notificacoes` |
| 5 | Segredos | Vault + RPCs SECURITY DEFINER; UI mascarada |
| 6 | `app_configuracoes` | Mantém kv, ganha categoria + sensibilidade + updated_by + trigger de auditoria |
| 7 | Auditoria | Trigger único em DB; payload `{categoria, sensibilidade, diff}`; segredos apenas evento |
| 8 | Compatibilidade front | `ThemeProvider` muda fonte; `Administracao.tsx` ganha cores; `Configuracoes.tsx` perde cores e ganha aba notificações; `AppConfigContext.sidebarCollapsed` já era pessoal — só validar |
| 9 | Revisão manual | Confirmar que nenhum cliente externo lê `app_configuracoes['theme_*']` antes do delete; rotacionar manualmente as senhas atuais ao migrar para Vault (não dá para ler texto plano sem o segredo original); validar que `pg_cron` pode ser usado se quiser ativar backup real depois |

### Fora de escopo
- Execução real de backup (apenas declarativo).
- Versionamento histórico de branding (auditoria já cobre).
- 2FA / MFA (Supabase Auth setup separado).
- Migração das senhas SMTP existentes — exigirá re-cadastro pelo admin (texto plano não pode ser lido após criptografia no Vault).

