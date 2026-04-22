

# Revisão Profunda — Módulo Administração

Análise feita exclusivamente sobre o código real: `src/pages/Administracao.tsx` (1932 linhas), `src/components/usuarios/UsuariosTab.tsx` (1280 linhas), `src/pages/admin/components/DashboardAdmin.tsx`, `src/pages/admin/components/PermissaoMatrix/index.tsx`, `src/lib/permissions.ts`, `src/contexts/AuthContext.tsx`, `src/hooks/useCan.ts`, `src/hooks/useIsAdmin.ts`, `src/hooks/useVisibleNavSections.ts`, `src/components/AdminRoute.tsx`, `src/components/PermissionRoute.tsx`, `src/hooks/useAuthGate.ts`, `supabase/functions/admin-users/index.ts`, `src/App.tsx`.

---

## 1. Visão geral do módulo

A rota `/administracao` é guardada por `AdminRoute` (admin-only puro, ignora `administracao:visualizar` no guard) e renderiza `Administracao.tsx`, uma página sidebar+conteúdo com 4 grupos: Empresa, Acesso & Segurança, Configurações, Dados & Auditoria. Estado da seção persiste em `?tab=`.

Os submódulos efetivamente entregues hoje:

- **Empresa** — formulário sobre `empresa_config` + chave `geral` em `app_configuracoes` (campos auxiliares).
- **Dashboard de Segurança** — 4 SummaryCards (sessões ativas, inativos +30d, admins, eventos admin 24h) consumindo `admin-sessions` (metrics) e queries diretas em `user_roles`/`permission_audit`.
- **Usuários e Permissões** — wrapper com Tabs internas `usuarios` (CRUD via edge function `admin-users`) e `permissoes` (catálogo `PermissaoMatrix` read-only). `UsuariosTab` traz por sua vez **outro** par de Tabs internas: `usuarios` + `roles`.
- **Configurações** (e-mail, integrações, notificações, backup, fiscal, financeiro) — todas escrevem em `app_configuracoes` via upsert `onConflict:'chave'` com metadados `_updatedAt`/`_updatedByName`.
- **Migração de dados** e **Auditoria** — itens da sidebar que apenas redirecionam (`navigate`) para `/migracao-dados` e `/auditoria`.

Modelo de permissão real:
- Roles canônicos = `admin | vendedor | financeiro | estoquista` (`APP_ROLES`); `LEGACY_ROLES` (`moderator`, `user`) são ignorados no `AuthContext`.
- Matriz padrão em `rolePermissionMatrix` (20 recursos × 20 ações, ~400 chaves possíveis; admin recebe todas via `flatMap`).
- Overrides individuais em `user_permissions(allowed boolean)`. `buildPermissionSet(roles, {allow, deny})` aplica `deny` por último, então revogação vence herança do papel.
- `admin-users.replaceUserPermissions` é não-destrutivo: marca `allowed=false` em vez de deletar (preserva auditoria).

---

## 2. Problemas encontrados

### 2.1 Coerência entre auth, navegação, guards e permissões

1. **`AdminRoute` ignora a permissão `administracao:visualizar`.** O guard chama apenas `useIsAdmin()` (`hasRole('admin')`). Já `useVisibleNavSections` calcula `canSeeAdmin = isAdmin || can('administracao:visualizar')` e aceita override individual. Resultado: um usuário não-admin que receba `administracao:visualizar` via `user_permissions` **vê** o item no menu mas leva 403 ("Área administrativa") ao clicar. Comentário no próprio `useVisibleNavSections.ts` confirma a intenção de aceitar override — o guard ficou para trás. Mesmo problema em `/auditoria` e `/migracao-dados`, ambos atrás de `AdminRoute`.

2. **Discrepância matriz-canônica × matriz-do-formulário.** `PermissaoMatrix` (catálogo) cobre 20 ações com toggle "ações avançadas". Já o `PermissionMatrix` dentro de `UserFormModal` (UsuariosTab) usa `UI_ACTIONS = ['visualizar','editar']` apenas. Logo, **é impossível conceder/revogar pela UI** ações como `criar`, `excluir`, `aprovar`, `cancelar`, `exportar`, `confirmar`, `importar_xml`, `admin_fiscal`, `gerar`, `download`, `editar_comentarios`, `gerenciar_templates`, `configurar`, `sincronizar`, `gerenciar_alertas`, `baixar`, `reenviar_email`, `visualizar_rentabilidade` para um usuário específico. Toda a infraestrutura de override granular existe no DB, no backend e em `useCan`, mas só 10% do espaço fica acessível na UI.

3. **`PermissionMatrix` (form) só permite ALLOW; não há revogação (deny) na UI.** O componente trabalha com `value: string[]` = lista de extras concedidas, e cliques apenas alternam entradas em `extra_permissions`. A linha do banco com `allowed=false` é gerada implicitamente pelo backend quando uma permissão é "removida" do array — porém a UI **não consegue revogar uma permissão herdada do role** (células herdadas estão `disabled`). O texto na tela ainda promete "Permissão revogada (deny) remove acesso herdado do role padrão" (`PERMISSION_HELP_TEXT.permissaoRevogada`), criando expectativa que a tela não cumpre.

4. **`extraPermissions` enviado a `getSocialPermissionFlags` ignora `deniedPermissions`.** `useVisibleNavSections` chama `getSocialPermissionFlags(roles, extraPermissions)` sem passar denies. Se um admin/financeiro tiver `social:visualizar` revogado individualmente, a flag continua positiva e a seção Social aparece (depois `useCan` corretamente bloqueia o conteúdo, mas o item no menu fica órfão).

5. **`PermissaoMatrix` esconde colunas vazias mas conta 100% como "cobertura".** O cálculo `matrixCoverage = round(visibleActions/totalActionsCount*100)` mostra "Cobertura desta visualização: X%", o que se confunde com cobertura de produto. Como `visibleActions` filtra ações que algum role usa, a métrica é tautológica e não reflete saúde do RBAC.

6. **`fetchProfile` no AuthContext faz `.single()` sem `maybeSingle`.** Se o profile ainda não foi criado pelo trigger, `single()` lança erro 406. O catch silencia — mas `profile` permanece null e o nome amigável usado em metadados (`updatedByName = profile?.nome ?? user?.email`) cai para email, criando metadados inconsistentes.

### 2.2 Mistura entre configurações, segurança e governança

7. **Sidebar mistura natureza dos itens.** "Auditoria" e "Migração de dados" não são seções da página — são links externos que redirecionam, mas visualmente são botões idênticos aos demais e o `setSearchParams` chega a registrar `?tab=auditoria` antes do redirect. O ícone `ArrowUpRight` ajuda mas não basta — não há `target="_blank"` nem separação visual clara.

8. **`?tab=auditoria` faz redirect dentro do `renderContent`.** Quando o usuário cola um link com `?tab=auditoria`, a página é montada, valida a tab, monta o card de fallback E dispara `navigate('/auditoria', { replace: true })` durante o render — efeito colateral em render, anti-pattern React (deveria ser `useEffect`). Causa um flash do card "Redirecionando para o módulo de auditoria…".

9. **Bloco "Backup" promete política mas só salva metadata.** Os campos (`frequencia`, `retencaoDias`, `destino`, `ultimaExecucao`, `ultimoStatus`) são apenas persistidos em `app_configuracoes['backup']`. Não há cron, nem job, nem worker que efetivamente execute o backup configurado. Mesmo padrão em "Notificações globais" (toggles puramente declarativos). É config sem efeito — risco de usuário acreditar que algo está agendado.

10. **"Parâmetros financeiros" tem aviso explícito de não-uso.** O próprio código admite (`Bloco 3` do `renderFinanceiro`): *"esses valores são parâmetros armazenados e ainda não são consumidos automaticamente por todos os módulos financeiros"*. Honesto, mas indica dívida estrutural: a configuração existe, está validada, salva metadados, **mas não é lida em lugar nenhum**. Mesmo risco para `fiscal.cfopPadraoVenda/cstPadrao/ncmPadrao/gerarFinanceiroPadrao`.

11. **Certificado SEFAZ Base64 num textarea de configuração geral.** `renderIntegracoes` armazena o conteúdo Base64 do certificado A1 diretamente em `app_configuracoes['integracoes'].sefazCertificadoBase64` (categoria=`integracoes`, sensibilidade=`sensivel`), com toggle "mostrar/ocultar". A `mem://security/gestao-de-segredos-vault` exige que credenciais sensíveis fiquem no Vault via SECURITY DEFINER RPCs — aqui o segredo está numa coluna `valor jsonb` legível por qualquer um com `select` na tabela. Risco de privacidade alto.

### 2.3 Gestão de usuários

12. **Duas abas chamadas "Usuários".** A página `Administracao` cria Tabs (`usuarios`/`permissoes`); dentro de `UsuariosTab` há outras Tabs (`usuarios`/`roles`). Quando o admin entra em "Usuários e Permissões > Usuários", aparece outra aba "Usuários" lado a lado com "Perfis e Permissões". Conflita com a aba "Matriz de Permissões" do nível superior — dois locais para a mesma informação (`RolesCatalog` e `PermissaoMatrix`), com layouts diferentes (cards expansíveis vs tabela).

13. **Senha temporária em `toast`.** Quando `admin-users.create` retorna `tempPassword`, a UI mostra a senha por 20s num toast (`toast.success(\`Senha temporária: ${result.tempPassword}\`)`). Toast pode ser screencaptured, fica em logs do navegador, e não há botão de copiar nem máscara. O `recoveryLink` vai para `console.info` — admin precisa abrir DevTools para usar.

14. **`role_padrao` é singular mas o DB suporta múltiplos.** `replaceUserRole` faz DELETE + INSERT de uma única role. Se um usuário tinha duas roles legadas, ambas são apagadas. Já `roleMap` em `listUsers` aceita array (`AppRole[]`) e devolve `roleMap.get(userId)?.[0] ?? "vendedor"` — silenciosamente descarta a 2ª role no fallback. UI assume singular sem documentar.

15. **Fallback default `vendedor` em vez de "sem role".** Se um usuário existe em `auth.users` mas não tem linha em `user_roles`, ele aparece como "Vendedor" na lista — mascarando estado inválido. Deveria sinalizar "Sem perfil" para o admin agir.

16. **Guard "último admin" só compara `role_padrao`.** `isLastAdmin` checa `u.role_padrao === 'admin' && u.ativo`. Se houver dois usuários admin mas só um ativo, ainda assim passa (correto). Porém, se um admin inativo for **reativado** num pop-up paralelo (race), o guard pode bloquear injustamente. Falta confirmação server-side no edge function para esse caso.

17. **Edição não permite trocar o e-mail.** Campo desabilitado com tooltip "O e-mail não pode ser alterado aqui." Não há fluxo alternativo para corrigir um e-mail digitado errado, exceto inativar e recriar — perda de histórico em `permission_audit` (que referencia `target_user_id`).

18. **`UserRow` não mostra `last_sign_in`.** O backend devolve `last_sign_in`, mas a linha só lista cargo + role + status. Para um admin auditando, falta visibilidade rápida do último acesso (existe no modal, mas só ao editar).

### 2.4 Dashboard de segurança

19. **Card "Eventos admin (24 h)" conta tudo de `permission_audit`, não só "admin".** A query é `count('permission_audit') WHERE created_at > now()-24h`. Como triggers gravam mudanças em `app_configuracoes`, `empresa_config`, `user_roles` e `user_permissions`, qualquer save em qualquer aba conta como "evento admin". Subtítulo "Mudanças em usuários, papéis e permissões" descreve de menos.

20. **Threshold "admins > 3 → warning" é arbitrário.** Empresa pequena pode ter 5 admins legítimos. Threshold deveria ser configurável ou baseado em proporção (% do total).

21. **Sem tendência temporal.** Os 4 SummaryCards têm `variationType="neutral"` — não há comparação semana/mês. Para um dashboard que diz "Monitoramento de Segurança", a ausência de séries temporais ou top-N (quem mais alterou? que recursos mais mudaram?) é uma lacuna grande.

22. **Sem `PermissionGate` nos CTAs do dashboard.** Os botões "Revisar usuários" e "Abrir auditoria" são exibidos sempre — mas a rota destino é `AdminRoute`. Como o dashboard só é mostrado dentro do `Administracao` (já admin-only), funciona — mas se o componente for reutilizado em outro lugar, expõe links 403.

### 2.5 UX de ações sensíveis

23. **Trocar role usa `confirmVariant="default"`.** `ConfirmDialog` para mudança de role abre com botão azul "Alterar role" — não destacando o impacto. Inativar usa `destructive` (correto). Trocar role pode ser igualmente destrutivo (remove permissões herdadas inteiras).

24. **Inativar não exige motivo nem auditoria visível.** Nenhum campo `motivo` no `ConfirmDialog` de inativar/reativar. Schema `permission_audit` tem coluna `motivo` (nullable) — campo aceita texto, mas a UI nunca pergunta. Dado de governança perdido por padrão.

25. **Salvar configurações sensíveis (integrações, backup, fiscal) não pede confirmação dupla.** Apenas chama `handleSave`. Mudar URL de webhook, secret, chave de API ou política de retenção não passa por `ConfirmDialog`.

### 2.6 Riscos estruturais e dívidas técnicas

26. **`Administracao.tsx` tem 1932 linhas e 11 estados de "lastSaved".** Cada seção replica o padrão `{at, by}`, com fetch e save inline. Não há hook tipo `useAdminConfig(section)`. Adicionar seção é copiar/colar grande.

27. **`UsuariosTab.tsx` tem 1280 linhas em um arquivo só.** Mistura tipos, helpers (`invokeAdminUsers`), 5 subcomponentes (`RoleBadge`, `StatusBadgeUser`, `PermissionMatrix`, `RolesCatalog`, `UserFormModal`, `UserRow`) e o componente principal. Difícil testar isoladamente.

28. **Fonte de verdade de labels duplicada.** `MODULE_LABELS` em `UsuariosTab.tsx` repete (com strings diferentes) o que já está em `RESOURCE_LABELS` de `lib/permissions.ts`. Mesmas chaves: "Cadastros › Produtos" vs "Produtos". Inconsistência visual entre matriz do formulário e catálogo.

29. **`getSaveMeta()` retorna o último `cta`/`message` de `financeiro` para qualquer seção não mapeada.** Se uma nova seção for adicionada sem entrada no switch, salvar mostra "Parâmetros financeiros atualizados". Bug latente.

30. **`useEffect` de carregamento usa `[]` como deps**, mas chama `setConfig`, `setEmailLastSaved` etc. sem cleanup. O `mounted` flag mitiga, mas refetch manual após save (`F5`) é a única forma de recarregar — não há `invalidateQueries` (não usa React Query nesse arquivo, ao contrário do dashboard).

31. **`DashboardAdmin` não usa `useVisibleNavSections` nem `useCan`.** Queries são feitas direto. Se as policies RLS de `user_roles` ou `permission_audit` mudarem, os cards podem retornar 0 silenciosamente sem alerta de erro de permissão (apenas `retry: 1`).

32. **`renderEmpresa` e outras `render*` são funções dentro do componente** — recriadas a cada render, definindo um sub-componente `ColorField` que perde estado interno se houvesse algum.

---

## 3. Problemas prioritários

| # | Problema | Severidade | Impacto |
|---|---|---|---|
| 1 | `AdminRoute` ignora `administracao:visualizar` (item 1) | Alta | Override de permissão promete acesso e entrega 403 |
| 2 | UI de override só cobre 2 das 20 ações (item 2) | Alta | RBAC granular existe mas é inutilizável |
| 3 | UI não permite revogar (deny) permissão herdada (item 3) | Alta | Texto promete; produto não entrega |
| 4 | Certificado SEFAZ em jsonb plain text (item 11) | Alta | Risco de exposição de credencial |
| 5 | Dashboard "Eventos admin" mensura tudo (item 19) | Média | Métrica enganosa |
| 6 | `?tab=auditoria` faz `navigate` em render (item 8) | Média | Anti-pattern, flash visual |
| 7 | Backup/notificações são config inerte (itens 9, 10) | Média | Falsa sensação de funcionalidade |
| 8 | Senha temporária em toast (item 13) | Média | Risco de vazamento, UX ruim |
| 9 | Tabs duplicadas "Usuários/Perfis" em 2 níveis (item 12) | Média | Confusão de produto |
| 10 | `Administracao.tsx` 1932 LOC + `UsuariosTab.tsx` 1280 LOC (itens 26, 27) | Média | Manutenção cara |

---

## 4. Melhorias de UI/UX

- **Sidebar**: mover "Auditoria" e "Migração de Dados" para um grupo visualmente distinto ("Atalhos") com separador, ou removê-los do componente sidebar e expor como cards de atalho na home `/administracao`. Eliminar o `?tab=auditoria` que apenas redireciona.
- **Card "Sobre permissões"** (linhas 1052-1069 de UsuariosTab) está acima da lista; promover para acordeão fechado por padrão — ocupa muito espaço e repete texto que já está no modal.
- **Linha de usuário** (`UserRow`): adicionar coluna `last_sign_in` formatada ("há 3 dias" / "nunca acessou"). Adicionar dot vermelho em "nunca acessou + criado há +7d".
- **Chip de exceções**: clicar no chip "X exceções" deveria abrir o modal já na seção de permissões. Hoje só abre normalmente.
- **`PermissionMatrix` do form**: adicionar coluna "Ações" expansível por recurso (acordeão), mostrando todas as ações cabíveis para aquele recurso (não fixar em `visualizar`/`editar`). Tri-state: herdado / extra-allow / extra-deny / sem acesso. Visual: ✓ cinza (herdado), ✓ azul (allow extra), ✗ vermelho (deny), vazio.
- **Dashboard de segurança**: trocar threshold fixo `admins > 3` por proporção; adicionar mini-gráfico de eventos/dia (últimos 7d) usando `permission_audit.created_at`; quebrar "Eventos admin" em 4 categorias (usuário, role, permissão, config).
- **Confirmação de troca de role**: usar `confirmVariant="destructive"` quando troca rebaixa permissões (admin→qualquer). Listar no diálogo as permissões que serão perdidas vs ganhas.
- **Inativar/reativar/role-change**: campo opcional `motivo` (textarea curto) gravado em `permission_audit.motivo` — coluna já existe.
- **Senha temporária**: substituir toast por `Dialog` com botão "Copiar senha", "Copiar link de redefinição", e checkbox "Já anotei" para fechar. Auto-clear do clipboard depois de 60s, se possível.
- **Salvar integrações/backup/fiscal**: `ConfirmDialog` quando o campo alterado for "sensível" (gateway secret, webhook secret, retenção).
- **`PermissaoMatrix` (catálogo)**: remover métrica "Cobertura desta visualização: X%" (enganosa) e substituir por "Mostrando N de M ações disponíveis".

---

## 5. Melhorias estruturais

1. **Unificar guard admin**: refatorar `AdminRoute` para usar `useCan('administracao:visualizar') || isAdmin`. Aplicar consistência em `useVisibleNavSections`. Decidir uma única semântica.
2. **Eliminar duplicação de labels**: `UsuariosTab.MODULE_LABELS` deve ser substituído por `humanizeResource()` de `lib/permissions.ts`. Caso seja necessário um label hierárquico ("Cadastros › Produtos"), criar `RESOURCE_PATH_LABELS` em `lib/permissions.ts`.
3. **Cobrir todas as ações no editor de overrides**: nova versão do `PermissionMatrix` (form) consumindo `ERP_ACTIONS` filtradas por relevância por recurso (mapa `resourceActionsMap`), com tri-state allow/deny.
4. **Persistência de overrides com deny explícito**: enviar para `admin-users` um shape `{allow: string[], deny: string[]}` em vez de só `extra_permissions`. Backend já suporta `allowed=false`; basta o frontend produzir.
5. **Hook único `useAdminConfig(chave)`**: encapsular load/save/last-saved/validate por seção. Substituir os 11 `useState({at, by})` em `Administracao.tsx`.
6. **Decompor `Administracao.tsx`**: 1 arquivo por seção (`sections/EmpresaSection.tsx`, `EmailSection.tsx`, etc.) e o `Administracao.tsx` vira orquestrador (~150 LOC).
7. **Decompor `UsuariosTab.tsx`**: extrair `RoleBadge`, `StatusBadgeUser`, `PermissionMatrix`, `RolesCatalog`, `UserFormModal`, `UserRow` em arquivos próprios em `src/components/usuarios/`.
8. **Tirar certificado SEFAZ do jsonb**: mover para Vault (memória `mem://security/gestao-de-segredos-vault`); UI passa a salvar via RPC `set_secret('sefaz_cert_a1', base64)` e nunca mais lê o conteúdo em GET.
9. **Quebrar "Eventos admin (24h)"**: 4 contadores separados via `permission_audit.entidade` (`user`, `role`, `permission`, `config`).
10. **Remover ou implementar Backup/Notificações**: ou cria os jobs (cron Supabase) que efetivamente respeitam essas configs, ou marca explicitamente como "Em breve" + desabilita inputs com aviso visual de "configuração inerte".
11. **Substituir `getSaveMeta` switch implícito** por `Record<SectionKey, SaveMeta>`, garantindo erro de tipo ao adicionar nova seção sem CTA.
12. **Mover redirect `/auditoria` e `/migracao`** do `renderContent` para um `useEffect([activeSection])` — fora do ciclo de render.
13. **Adicionar React Query** em todas as configs do `Administracao.tsx` (cache, invalidate após save, refetch após reativação).

---

## 6. Roadmap de execução

| Fase | Entrega | Dependências | Esforço | Impacto |
|---|---|---|---|---|
| 1 | **Alinhar `AdminRoute` com `useCan('administracao:visualizar')`** + corrigir flag `social` para considerar `deniedPermissions` | Nenhuma | S | Alto — fim do "menu mostra, rota nega" |
| 2 | **Mover redirect `auditoria/migracao` para `useEffect`** + remover `?tab=auditoria` da sidebar | Nenhuma | S | Quick win — elimina anti-pattern |
| 3 | **Editor de overrides com todas as ações + tri-state allow/deny** + payload `{allow, deny}` para edge function | Backend já pronto | M | Alto — destrava RBAC granular real |
| 4 | **Unificar `MODULE_LABELS` com `humanizeResource()` + label hierárquico em lib/permissions** | Fase 3 | S | Consistência |
| 5 | **Decompor `Administracao.tsx`** em sections + hook `useAdminConfig(chave)` + React Query | Nenhuma | L | Manutenibilidade |
| 6 | **Decompor `UsuariosTab.tsx`** em 6 arquivos + adicionar `last_sign_in` em `UserRow` | Nenhuma | M | Manutenibilidade + UX |
| 7 | **Diálogo dedicado para senha temporária** (copiar senha, copiar link, confirmar leitura) | Nenhuma | S | Segurança + UX |
| 8 | **Campo `motivo` em ConfirmDialog** de inativar/role-change → grava `permission_audit.motivo` | Nenhuma | S | Governança |
| 9 | **Mover certificado SEFAZ para Vault** via RPC `set_secret`/`get_secret_metadata` | Vault RPC | M | Segurança |
| 10 | **Refinar Dashboard de Segurança**: 4 cards de eventos por entidade + sparkline 7d + threshold proporcional | Fase 1 | M | Produto |
| 11 | **Decisão sobre Backup/Notificações**: implementar cron Supabase ou marcar "Em breve" e travar inputs | Produto | M-L | Honestidade do produto |
| 12 | **Eliminar Tabs duplicadas** "Usuários" — promover `RolesCatalog` e `PermissaoMatrix` a uma única visão "Perfis e Catálogo" | Fase 6 | S | UX |

**Quick wins (1 PR cada)**: 1, 2, 4, 7, 8.
**Refatoração estrutural**: 3, 5, 6, 9.
**Evolução de produto**: 10, 11, 12.

