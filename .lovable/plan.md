

# Revisão Profunda — Conjunto de Configurações

Análise baseada exclusivamente em `src/pages/Configuracoes.tsx` (1040 LOC, arquivo único), `src/contexts/AppConfigContext.tsx`, `src/hooks/useUserPreference.ts`, `src/components/theme/ThemeProvider.tsx`, `src/components/auth/SessionExpiryWarning.tsx`, `src/pages/Perfil.tsx` e `src/App.tsx` (rota `/configuracoes` atrás de `ProtectedRoute`).

> Observação factual: **não existem** `src/pages/configuracoes/*`, `src/pages/configuracoes/components/*` nem `src/utils/configuracoes.ts`. Toda a página é um único componente React com `switch (activeSection)`. Configurações globais (Email, Integrações, Notificações, Backup) **não vivem aqui** — vivem em `src/pages/Administracao.tsx` e seções `src/pages/admin/sections/*`.

---

## 1. Visão geral do módulo

- Rota `/configuracoes` (e alias `/perfil` que redireciona via `Perfil.tsx`) protegida apenas por `ProtectedRoute` (qualquer usuário autenticado).
- Página com 3 abas horizontais hardcoded: **Meu Perfil**, **Aparência**, **Segurança**. Sem `?tab=` na URL — estado em `useState` local, perdido ao recarregar.
- Banner superior "Escopo pessoal" + atalho condicional para `/administracao?tab=empresa` quando `isAdmin`.
- **Meu Perfil**: card resumo (avatar/iniciais, badges de role/cargo/status), `update profiles` em `nome`/`cargo`, leitura de e-mail/perfil de acesso.
- **Aparência**: tema (`next-themes` + pref `ui_theme`), densidade (`ui_density` + `data-density` no `<html>`), tamanho de fonte (`ui_font_scale` + CSS var `--base-font-size`), menu compacto (`sidebar_collapsed` em `AppConfigContext`), reduzir animações (`ui_reduce_motion` + classe `reduce-motion`), keepalive de sessão (`session_keepalive`), aviso de expiração (`session_warn_minutes`), modo do menu lateral (`sidebar_mode`: dynamic/fixed-expanded/fixed-collapsed) e bloco read-only de cores institucionais lidas direto de `empresa_config`.
- **Segurança**: dados de acesso (e-mail/status), formulário de troca de senha com re-autenticação via `signInWithPassword` + `updateUser`, força e checklist de critérios, bloco estático de "boas práticas".

Persistência: `useUserPreference` (tabela `user_preferences`, fila offline `syncQueue`, fallback `localStorage` namespaced). Branding lido direto de `empresa_config` via `supabase.from(...).maybeSingle()` no `useEffect`.

---

## 2. Problemas encontrados

### 2.1 Arquitetura e organização

1. **1040 LOC em arquivo único, 3 sub-telas inline em `switch`.** Mesmo problema padrão denunciado pelo `mem://constraints/diretrizes-de-desenvolvimento` ("decompor god components"). Sem `src/pages/configuracoes/sections/*`, sem hook `useAppearancePreferences`, sem `useChangePassword`. Reproduz exatamente o anti-padrão que `Administracao.tsx` acabou de eliminar (Fase 5).
2. **Diretórios anunciados pelo escopo não existem.** `src/pages/configuracoes/`, `.../components/` e `src/utils/configuracoes.ts` não estão no repositório — toda lógica está acoplada à página.
3. **Estado da aba é local e não persiste em URL.** `?tab=` não é lido nem escrito. Deep-link para "Segurança" impossível; F5 sempre cai em "Meu Perfil". Diverge da convenção de `Administracao.tsx` que usa `useSearchParams`.
4. **Branding institucional é buscado três vezes em paralelo** no boot: `ThemeProvider` (`cor_primaria, cor_secundaria`), `AppConfigContext` (`cep, logo_url, simbolo_url, marca_texto, marca_subtitulo`), `useBranding` (mesmas colunas + `nome_fantasia`) e mais uma vez em `Configuracoes.tsx` (`cor_primaria, cor_secundaria`). Confirmado nos network logs: `empresa_config` é solicitado 3x no carregamento. Sem cache compartilhado.
5. **`AppConfigContext` carrega CEP/branding sem dependência do `user`** mas usa `useUserPreference(user?.id, ...)`. Se `user` mudar (signin/signout em outra aba), o `useEffect` de branding **não** re-dispara (deps `[]`), embora as preferências se reconectem.

### 2.2 Separação pessoal × global

6. **`menuCompacto` (sidebar_collapsed) e `sidebarMode` (sidebar_mode) são dois controles concorrentes** que descrevem a mesma intenção. `sidebarMode='fixed-collapsed'` deveria implicar `sidebarCollapsed=true`. Hoje o usuário pode marcar "Sempre expandido" e ter o switch "Menu compacto" ligado ao mesmo tempo — produzem estados visuais inconsistentes e ambos são exibidos lado a lado na mesma aba.
7. **Atalho "Ir para configurações globais" leva a `?tab=empresa`**, mas tanto `useBranding` quanto `ThemeProvider` consideram que **só admin gerencia branding** — usuários não-admin recebem só um `Badge` "Somente administradores alteram configurações globais", sem listar quais configurações globais existem nem a quem pedir. UX não-administrativa fica órfã.
8. **Cores institucionais aparecem na aba "Aparência" como bloco informativo**, misturando preferência pessoal (densidade/fonte) com branding global numa mesma tela. O layout sugere "essas cores são minhas" ainda que o copy diga o contrário.
9. **`/perfil` redireciona para `/configuracoes`**, mas `MobileMenu.tsx` ainda navega para `/perfil` em uma entrada e para `/configuracoes` em outra (item 144 do search). Duplicidade que confunde — entrada de menu que rebota.

### 2.3 Confiabilidade e correção de fluxo

10. **`themePref` vs `theme` cria loop potencial.** `useEffect(...,[themePref, theme, setTheme])`: ao logar, `themePref` carrega e chama `setTheme(themePref)`. `next-themes` atualiza `theme` → o effect re-roda; igualdade `theme !== themePref` evita loop, mas o `theme` inicial é `undefined` (SSR/hydration), o que dispara `setTheme(themePref)` mesmo se o usuário tiver mudado pela toggle no header. Se `useUserPreference` reload assíncrono trouxer um valor antigo (cache local desatualizado), sobrescreve a escolha do usuário.
11. **`densidadePref` aplica via `setDensidade(...)` mas não atualiza `document.documentElement.dataset.density`** no `useEffect` inicial — só atualiza no `onValueChange`. Recarregar a página com densidade `compacta` salva carrega como `confortavel` visual até `ThemeProvider.applyLocalUiPreferences` rodar — e este lê do `localStorage`, não do DB. Resultado: densidade visual e densidade salva podem divergir até a próxima troca manual.
12. **`ThemeProvider.applyLocalUiPreferences` lê `localStorage` (`:ui_density`/`:ui_font_scale`/`:ui_reduce_motion`) por *string includes*** e ignora completamente o valor remoto em `user_preferences`. Em um navegador novo (sem localStorage), o usuário sempre começa com `confortavel`/16px/animações ligadas — mesmo que tenha salvo o oposto. Inconsistência cross-device garantida.
13. **`saveFontScale`/`saveDensidade`/`saveReduceMotion` aplicam o efeito DOM no `onChange`**, mas se a persistência falhar (toast vermelho), o DOM permanece alterado e o estado React mostra a nova preferência. Próximo F5 reverte por causa do `localStorage` antigo. Sem rollback visual.
14. **`handleResetAppearance` chama `await save...` em sequência (5 awaits)** sem `Promise.all`. Em rede ruim, demora 5×8s teóricos. Cada um pode falhar isoladamente, deixando estado parcial (tema reset, mas fonte não).
15. **`handleChangePassword` re-autentica com `signInWithPassword`** — isso **rotaciona o `access_token`/`refresh_token` da sessão atual**. Outras abas abertas vão ver `TOKEN_REFRESHED` ou perder sessão dependendo do storage. Não há aviso ao usuário disso.
16. **`handleChangePassword` não invalida sessões antigas após sucesso.** Quem trocou senha continua logado em outros dispositivos com tokens antigos válidos até expirarem (1h). Não há `signOut({ scope: 'others' })`.
17. **Senha nova não passa por validador server-side.** Frontend exige 8 caracteres + caso + dígito; Supabase Auth pode estar configurado com política diferente. Erro retorna em `getUserFriendlyError(err)` genérico.
18. **`useEffect(() => { if (profile && !profileAppliedRef.current)...`** aplica perfil só uma vez. Se o `profile` for atualizado externamente (admin renomeou via `admin-users`), a tela do usuário continua mostrando o nome antigo até F5.
19. **`profileDirty` compara `nome.trim()` com `(profile?.nome || '').trim()`** — se profile vier como `"Maria  Silva"` (dois espaços), a comparação após trim diverge do estado original e o botão fica habilitado sem mudança real do usuário.

### 2.4 Segredos, conexão e auditoria

20. **Não há aba "Notificações pessoais", "E-mail pessoal", "Integrações pessoais"** nem "Backup" pessoal. Os pontos de atenção do escopo (Geral / Email / Integrações / Notificações / Backup, testes de conexão, segredos) **não estão em `Configuracoes.tsx`** — vivem em Administração. A revisão precisa contemplar esse fato: o módulo Configurações é estritamente pessoal.
21. **Sem teste de conexão para nada.** Nem para "salvar perfil" (faz `update profiles` direto), nem para troca de senha (faz `signInWithPassword` sem timeout próprio — depende do `withTimeout` interno de `useUserPreference` que aqui não é aplicado).
22. **Sem registro em `permission_audit` quando o próprio usuário muda nome/cargo/senha**. `update profiles` e `auth.updateUser` não disparam triggers de auditoria nessa página. Mudança de senha não fica em log algum visível ao admin (apenas em `auth.audit_log_entries` do Supabase, fora do alcance da UI).
23. **`empresa_config` é lido por `Configuracoes.tsx` com a chave anônima** — o RLS da tabela hoje libera SELECT para `authenticated` (visível nos logs: vendedores também conseguiriam consultar logo/cores). É correto para branding, mas a query inclui `cep` no `AppConfigContext` (CEP não é branding) e poderia vazar dados de endereço se a política mudar.
24. **Sem indicação visual de "salvo no servidor" vs "salvo localmente (offline)"** na aba Aparência. `useUserPreference` faz fila offline; o usuário vê toast amarelo genérico, mas o `appearanceSavedAt` é setado como se tivesse persistido remotamente.

### 2.5 Dívidas técnicas e UI

25. **Cores hardcoded `bg-yellow-500`, `bg-emerald-500`, `text-emerald-600`, `text-emerald-400`** (linhas 88-89, 284-287, 730, 758, 866, 924, 954) — viola design system (deveria usar tokens `success`/`warning`).
26. **`APPEARANCE_DEFAULTS.theme = 'system'` mas `ThemeProvider` usa `defaultTheme="light"`.** Restaurar padrão coloca tema em "system", mas se `next-themes` ainda não tiver hidratado, a UI mostra "light". Inconsistência conceitual.
27. **`APPEARANCE_DEFAULTS.densidade = 'confortavel'` (sem acento), mas o `Select` envia `'compacta'`/`'confortavel'`** e o `applyLocalUiPreferences` compara com `'compacto'/'compacta'` (linha 38 do ThemeProvider) — uma forma masculina, outra feminina. Funciona por coincidência (`includes` cobre os dois), mas é frágil.
28. **`menuCompacto` (sidebar_collapsed) default em `useUserPreference` é `true`**, mas `APPEARANCE_DEFAULTS.menuCompacto` também é `true`. OK, mas o copy diz "padrão: desligado" para o aviso de sessão (linha 570) — termo "padrão" é usado de duas formas opostas na mesma tela.
29. **Cores institucionais mostradas como swatches `style={{ backgroundColor: corPrimaria }}`** sem `aria-describedby` indicando o valor hex. Acessibilidade: leitor de tela apenas anuncia "Cor primária atual" sem o valor.
30. **`AlertDialog` de "Restaurar padrão"** não diz explicitamente que vai resetar `sidebar_mode` (o block "Comportamento do menu lateral" não é incluído no reset, mas o usuário não sabe disso até testar).
31. **`getUserFriendlyError`** mascara o erro real do Supabase em todos os catches; não há `console.error` estruturado distinguindo erro de rede × validação × RLS.

### 2.6 Coerência com Administração

32. **Aba "Empresa" da Administração e bloco "Branding" da Aparência leem as mesmas colunas, mas com timing diferente**: Administração usa `useSectionConfig` (queryClient cache), Configurações usa `supabase.from(...).maybeSingle()` direto. Após admin alterar, usuário precisa recarregar a página para ver as cores novas.
33. **`Configuracoes.tsx` não usa `useAdminConfig`/`useSectionConfig`** introduzidos na refatoração da Administração — não há reuso do padrão.
34. **`SessionExpiryWarning.tsx` lê `session_keepalive`/`session_warn_minutes` direto via `useUserPreference`**, sem passar pelo `AppConfigContext`. Acoplamento duplicado: a fonte de verdade dessas prefs vive em dois consumidores que precisam se manter sincronizados na mão.

---

## 3. Problemas prioritários

| # | Problema | Severidade | Impacto |
|---|---|---|---|
| 1 | `ThemeProvider` ignora `user_preferences` e lê só `localStorage` (item 12) | Alta | Inconsistência cross-device garantida |
| 2 | `menuCompacto` e `sidebarMode` concorrentes na mesma tela (item 6) | Alta | Estados visuais contraditórios |
| 3 | `empresa_config` consultado 3-4x no boot sem cache (item 4) | Alta | Latência inicial e custo desnecessário |
| 4 | Troca de senha não invalida sessões em outros dispositivos (item 16) | Alta | Risco de segurança |
| 5 | Densidade/fonte aplicam ao DOM antes da confirmação remota (item 13) | Média | Estado divergente no F5 |
| 6 | Estado de aba não persiste em `?tab=` (item 3) | Média | Sem deep-link, F5 perde contexto |
| 7 | 1040 LOC sem decomposição (item 1) | Média | Manutenção cara, divergência do padrão da Administração |
| 8 | `MobileMenu` ainda referencia `/perfil` em paralelo (item 9) | Baixa | Redundância confusa |
| 9 | Cores institucionais sem hex visível para leitor de tela (item 29) | Baixa | Acessibilidade |
| 10 | Cores hardcoded fora do design system (item 25) | Baixa | Inconsistência visual |

---

## 4. Melhorias de UI/UX

- **Persistir aba em `?tab=`** seguindo o padrão da Administração (`useSearchParams`), permitindo deep-link tipo `/configuracoes?tab=seguranca`.
- **Unificar "Menu compacto" e "Comportamento do menu lateral"** em um único controle de 3 estados (Sempre expandido / Sempre recolhido / Dinâmico). Eliminar `sidebar_collapsed` da UI ou derivá-lo automaticamente do modo escolhido.
- **Mover bloco "Branding" para fora da aba Aparência** ou para um collapsible "Branding institucional (visualização)" ao final, com label claro "Definido pela empresa".
- **Banner de escopo no topo** poderia listar 3 ações comuns para admins ("Branding", "Email", "Backup") em vez de só um link genérico.
- **Indicador "salvo localmente (offline) — sincronizando"** distinto do "salvo" verde, lendo o estado da `syncQueue`.
- **Toast pós-troca de senha** com botão "Encerrar sessões em outros dispositivos" (chama `supabase.auth.signOut({ scope: 'others' })`).
- **Mostrar valor hex ao lado de cada swatch** de cor institucional (`#690500`, `#b2592c`).
- **Substituir `bg-yellow-500`/`bg-emerald-500` por tokens `warning`/`success`** já presentes no design system.
- **Botão "Pré-visualizar"** ao mudar fonte/densidade antes de salvar, em vez de aplicar imediatamente.
- **Esconder banner "Somente administradores alteram configurações globais"** se o usuário não tem nenhuma config global passível de visualização — ou trocar por algo acionável (link para suporte).

---

## 5. Melhorias estruturais

1. **Decompor `Configuracoes.tsx` em `src/pages/configuracoes/`** com `MeuPerfilSection.tsx`, `AparenciaSection.tsx`, `SegurancaSection.tsx`, igual ao que foi feito em Administração (Fase 5). Página principal vira orquestrador (~120 LOC) com `useSearchParams`.
2. **Hooks dedicados**: `useProfileForm()`, `useChangePassword()`, `useAppearancePreferences()` (consolida theme + densidade + fonte + reduceMotion + sessões em uma API única).
3. **Hook `useBrandingPreview()`** centralizando a leitura de `empresa_config` (cores + logos), com cache via React Query e `staleTime` de 5 min. Substitui as 3 chamadas concorrentes (`ThemeProvider`, `AppConfigContext`, `useBranding`, `Configuracoes`).
4. **`ThemeProvider` deve ler `user_preferences` quando houver sessão** (não só `localStorage`). Hidrata a partir do remoto e salva no `localStorage` como cache, não como fonte.
5. **Encerrar sessões antigas após troca de senha**: `supabase.auth.signOut({ scope: 'others' })` + UI de confirmação.
6. **Logging de auditoria mínimo** quando usuário troca senha/cargo/nome — gravar em `permission_audit` com `tipo_acao='self_update'` (já existe a coluna `motivo` para registrar `"alteração pelo próprio usuário"`).
7. **Rollback visual** quando `useUserPreference.save` falhar: reverter `document.documentElement.dataset.density` e CSS var ao valor anterior.
8. **Reset com `Promise.all`** em `handleResetAppearance`.
9. **Refresh do `profile` no AuthContext** quando `Configuracoes` salva (ex: invalidar query do `useAuth` ou setState após `update profiles`), evitando que o nome no header continue antigo.
10. **Eliminar duplicidade `/perfil` em `MobileMenu`** — manter só `/configuracoes` (alias `/perfil` continua para back-compat de URL externa).
11. **Esquema de "Configurações globais" para não-admins**: tela read-only listando branding atual + e-mail de suporte/admin (consulta `user_roles` para nome do admin).
12. **Token de design para cores semânticas** (`success`, `warning`, `destructive` já existem no Tailwind config) — varrer e substituir as ocorrências hardcoded.

---

## 6. Roadmap de execução

| Fase | Entrega | Dependências | Esforço | Impacto |
|---|---|---|---|---|
| 1 | **`?tab=` na URL + alinhar `/perfil`** removendo duplicidade no `MobileMenu` | Nenhuma | S | Quick win |
| 2 | **Unificar `menuCompacto` e `sidebarMode`** em controle único de 3 estados | Nenhuma | S | Elimina contradição |
| 3 | **`useBrandingPreview` com React Query** + remoção das leituras duplicadas em `ThemeProvider`/`AppConfigContext`/`useBranding`/`Configuracoes` | Nenhuma | M | Performance e consistência |
| 4 | **`ThemeProvider` lê `user_preferences` quando há sessão** + hidratação correta | Fase 3 | M | Cross-device |
| 5 | **`signOut({ scope: 'others' })` opcional pós-senha** + UI de confirmação | Nenhuma | S | Segurança |
| 6 | **Decompor `Configuracoes.tsx`** em `pages/configuracoes/sections/*` + hooks `useProfileForm`/`useChangePassword`/`useAppearancePreferences` | Fases 1-2 | L | Manutenibilidade |
| 7 | **Rollback visual em falhas de save** + indicador "offline / sincronizando" | Fase 6 | M | Confiabilidade |
| 8 | **Auditoria self-update** em `permission_audit` (nome/cargo/senha) | Backend liberado | S | Governança |
| 9 | **Refresh do `profile` no AuthContext após save** | Fase 6 | S | UX |
| 10 | **Substituir cores hardcoded por tokens semânticos** + hex visível em swatches | Nenhuma | S | Design system |
| 11 | **Tela read-only "Configurações da empresa" para não-admins** com contato do admin | Fase 3 | M | Coerência produto |
| 12 | **Validar política de senha server-side** + mensagens explícitas baseadas no erro do Supabase | Nenhuma | S | UX |

**Quick wins (1 PR cada)**: 1, 2, 5, 8, 10, 12.
**Refatoração estrutural**: 3, 4, 6, 7, 9.
**Evolução de produto**: 11.

