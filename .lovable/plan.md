

# Revisão Profunda — Módulo Perfil

Análise baseada **exclusivamente** no estado real atual: `src/pages/Perfil.tsx` (19 LOC, redirect puro), `src/App.tsx` (rota `/perfil` registrada com lazy import + ProtectedRoute + Suspense), `src/lib/navigation.ts` (ícone + label de `/perfil` ainda no registry) e referências em `MobileMenu.tsx` e `AppHeader.tsx`.

> Fato central: **não existe mais um módulo "Perfil" funcional**. `/perfil` é um *shim* que monta um spinner e dispara `navigate("/configuracoes", { replace: true })` no `useEffect`. Toda a funcionalidade (avatar, nome, cargo, dados pessoais, segurança, preferências) foi consolidada em `Configuracoes.tsx` (abas `perfil`, `aparencia`, `seguranca`, `empresa`) e nos hooks `useProfileForm`/`useChangePassword`/`useAppearancePreferences` sob `src/pages/configuracoes/`.

---

## 1. Visão geral do módulo

- **Rota**: `/perfil` declarada em `App.tsx:159`, atrás de `ProtectedRoute` + `LazyPage` (Suspense com `ContentSpinner`).
- **Componente**: `Perfil.tsx` apenas executa `navigate("/configuracoes", { replace: true })` em um `useEffect` com `[navigate]` como dep, exibindo um `Loader2` enquanto isso.
- **Integração com AuthContext**: **nenhuma**. O arquivo não importa `useAuth`, não lê `profile`, `roles` nem `user`. Toda a leitura/escrita de perfil foi delegada a `MeuPerfilSection` (via `useProfileForm`, que faz `update profiles` + RPC `log_self_update_audit` + `refreshProfile()`).
- **Preferências do usuário**: nenhuma manipulação aqui. Vivem em `useAppearancePreferences` + `useUserPreference`.
- **Avatar/nome/cargo/dados pessoais**: editáveis em `Configuracoes?tab=perfil` (`MeuPerfilSection.tsx`). O avatar exibido é apenas iniciais (`AvatarFallback`) — **não há upload de imagem nem leitura de `avatar_url`** mesmo a coluna existindo na tabela `profiles` (visível no payload `"avatar_url":""` dos network logs).
- **Segurança**: vive em `Configuracoes?tab=seguranca` (`SegurancaSection` + `useChangePassword`).
- **Header e menu mobile**: `AppHeader` ("Meu perfil") e `MobileMenu` (item "Meu perfil") já navegam para `/configuracoes`, não para `/perfil`. **Nenhuma entrada de menu chama `/perfil` hoje.**

---

## 2. Problemas encontrados

### 2.1 Redirect e roteamento

1. **JSX malformado em `Perfil.tsx`** (linhas 13-17): abre `<>` na mesma linha de uma `<div>` filho (`<><div ...>`), fechando com `</>` depois de `</div>`. Funciona, mas é estilisticamente quebrado e foge do padrão do resto do projeto. Resíduo de edição apressada.
2. **Rota `/perfil` carrega bundle dedicado por nada.** `App.tsx:46` faz `lazy(() => import("./pages/Perfil"))` — o navegador baixa um chunk só para executar um redirect. Custo desnecessário em conexões lentas; um `<Navigate to="/configuracoes" replace />` inline em `App.tsx` evitaria o chunk e o flash de spinner.
3. **`Suspense` + `ContentSpinner` + `useEffect` produzem flash duplo.** O usuário vê: (a) spinner do `LazyPage` enquanto o chunk carrega, (b) spinner do próprio `Perfil` (`Loader2 animate-spin py-20`), (c) navegação para `/configuracoes`, (d) novamente spinner do `LazyPage` para `Configuracoes`. Quatro estados de loading para uma navegação que deveria ser instantânea.
4. **`useEffect` com `[navigate]` como dep**: `navigate` é estável em `react-router-dom@6+`, mas se o `Router` for remontado o effect roda de novo. Em SSR/hydration estranhos, o `replace: true` pode empurrar mais de um histórico. Baixo risco, mas é uma escolha frouxa para um shim.
5. **`/perfil` está atrás de `ProtectedRoute`**, não de `PermissionRoute`. Coerente com `/configuracoes` (que também é só `ProtectedRoute`), mas significa que qualquer usuário autenticado acessa o redirect — mesmo um futuro role sem acesso a configurações pessoais (hoje não existe, mas o acoplamento implícito é uma dívida).

### 2.2 Resíduos de UI/registry apontando para `/perfil`

6. **`src/lib/navigation.ts:293,299`** ainda registra ícone (`User`) e label (`Meu Perfil`) para `/perfil`. Isso é consumido por `headerIcons` em `AppHeader` para renderizar o ícone do título da página. Como `/perfil` redireciona em milissegundos, esse ícone só aparece no flash inicial — efetivamente **dead code** que cria a falsa impressão de um módulo.
7. **`AppBreadcrumbs`/`resolvePageTitle`** podem mostrar "Meu Perfil" no breadcrumb durante o flash, depois trocar para "Configurações" — pisca-pisca confuso para o usuário.
8. **Comentário do arquivo** (`/perfil is kept as a compatibility alias`) **não diz por quê** nem por quanto tempo. Sem prazo de remoção, sem referência a links externos legados que justificariam manter. Convite a virar dívida permanente.

### 2.3 Fronteira "Perfil" × "Configurações" × "Preferências"

9. **Não existe fronteira real entre Perfil e Configurações.** A consolidação eliminou Perfil como conceito de produto, mas `MobileMenu.tsx:142` e `AppHeader.tsx:54` ainda **rotulam** o item como "Meu perfil" — apontando para `/configuracoes` (que abre na aba `perfil` por default). Usuário clica em "Meu perfil" e vê uma página intitulada "Configurações" com 4 abas. Discrepância de nomenclatura: o produto fala em "Perfil", a tela fala em "Configurações".
10. **Aba "Meu Perfil" dentro de Configurações divide responsabilidades em três blocos** (resumo, dados editáveis, dados corporativos read-only) — isso é coerente com o domínio "perfil", mas o título da página segue sendo "Configurações". Não há `<title>` dinâmico nem `document.title` por aba.
11. **`/perfil` não preserva `?tab=`**: chamar `/perfil?tab=seguranca` é descartado — o redirect é hardcoded para `/configuracoes` sem repassar `searchParams`. Qualquer link externo legado para `/perfil?tab=algo` cai em "Meu Perfil" mesmo querendo "Segurança".
12. **`avatar_url` existe na tabela `profiles`** (confirmado nos network logs: `"avatar_url":""`) mas **nenhuma tela** lê ou escreve essa coluna. `MeuPerfilSection` usa só `AvatarFallback` com iniciais. Funcionalidade prometida pelo schema, ausente no produto.
13. **`profile.email` é exibido em `MeuPerfilSection`** lendo de `user?.email` (auth) e a coluna `profiles.email` é redundante e pode divergir (após mudança de e-mail via Supabase Auth, `profiles.email` permaneceria desatualizado — não há trigger sincronizando).

### 2.4 Salvamento, validações e UX (em `MeuPerfilSection`/`useProfileForm`, já que é o que `/perfil` entrega)

14. **Sem validação de tamanho/formato de `nome` e `cargo`.** Aceita string vazia (`profileDirty` compara trimmed, mas `save` envia `''`). Resultado: usuário pode salvar nome em branco, e o header passa a mostrar "Usuário" como fallback.
15. **Sem trim no save.** `save()` envia `{ nome, cargo }` sem `.trim()`. "  Maria  " com espaços vai para o DB — divergente do que o `dirty check` usa para comparar (que faz trim). Pequena inconsistência: salvar, recarregar, e o botão pode reaparecer "sujo".
16. **Sem feedback de qual campo está sujo.** `dirty` é booleano global da página; usuário não sabe se foi nome ou cargo que mudou. Em formulários de 2 campos é tolerável, mas piora se evoluir.
17. **`refreshProfile()` é chamado depois de `save()`**, mas se a query do `AuthContext` falhar silenciosamente, o header continua exibindo o nome antigo enquanto a section mostra o novo. Sem rollback nem indicador de sincronização.
18. **`log_self_update_audit` é fire-and-forget** dentro do `save`: se a RPC falhar, o `update profiles` já passou — auditoria pode ficar com buraco. Não há transação envolvendo as duas operações.

### 2.5 Consistência visual e semântica

19. **`Loader2 h-6 w-6 py-20` no shim** não usa o `ContentSpinner` padrão do projeto (usado por `LazyPage`). Dois spinners diferentes em sequência durante o redirect — estética inconsistente.
20. **`text-muted-foreground` no `Loader2`** sem `aria-label` ou `role="status"`. Leitores de tela anunciam nada durante o redirect; usuário com NVDA/JAWS pode ficar perdido por ~300ms.
21. **`Perfil.tsx` não tem `<title>` nem `<meta>` `og:` nem comentário JSDoc explicando o contrato com `/configuracoes`** — divergente do padrão de outras pages do projeto que documentam o propósito no topo.

### 2.6 Riscos estruturais

22. **Documentação de memória desatualizada**: `mem://index.md` não tem nenhuma entrada sobre "Perfil" como módulo separado. Novos contribuidores podem reintroduzir lógica em `Perfil.tsx` sem perceber que ela deveria ir em `MeuPerfilSection`.
23. **Risco de drift**: nada impede um PR futuro de adicionar lógica a `Perfil.tsx` (ex: "vou mostrar o avatar aqui"), criando duas fontes de verdade para a mesma tela. Sem teste/lint que force `Perfil.tsx` a ser apenas redirect.
24. **`headerIcons['/perfil']` e `extraRouteLabels['/perfil']`** (em `navigation.ts`) consomem manutenção sempre que a tabela é tocada, sem entregar valor.

---

## 3. Problemas prioritários

| # | Problema | Severidade | Impacto |
|---|---|---|---|
| 1 | `/perfil` baixa chunk dedicado para um redirect (item 2) | Média | Performance + flash duplo de spinner |
| 2 | `?tab=` perdido no redirect (item 11) | Média | Deep-links externos quebram |
| 3 | Rótulo "Meu perfil" no menu leva a tela "Configurações" (item 9) | Média | Discrepância de nomenclatura |
| 4 | `avatar_url` no schema sem UI (item 12) | Média | Funcionalidade prometida não entregue |
| 5 | Sem validação/trim em `nome`/`cargo` (itens 14-15) | Média | Permite salvar nome vazio |
| 6 | JSX malformado em `Perfil.tsx` (item 1) | Baixa | Estilo inconsistente |
| 7 | `headerIcons`/`extraRouteLabels` referenciando `/perfil` (item 6) | Baixa | Dead code no registry |
| 8 | `profile.email` redundante vs `auth.users.email` (item 13) | Baixa | Risco de divergência |
| 9 | `log_self_update_audit` sem garantia transacional (item 18) | Baixa | Buraco de auditoria possível |
| 10 | Acessibilidade do `Loader2` (item 20) | Baixa | Leitor de tela silencioso |

---

## 4. Melhorias de UI/UX

- **Substituir `Perfil.tsx` por `<Navigate to="/configuracoes" replace />`** declarado direto em `App.tsx`, eliminando spinner duplo, chunk extra e o JSX malformado de uma vez.
- **Repassar `?tab=` no redirect** se decidir manter um componente: `navigate(\`/configuracoes${location.search}\`, { replace: true })`. Garante que `/perfil?tab=seguranca` continue funcional.
- **Renomear item "Meu perfil" para "Conta" ou "Minha conta"** em `AppHeader` e `MobileMenu`, alinhando com a página de destino "Configurações" (ou inverter: chamar a página de "Minha Conta"/"Perfil" no `<title>` quando a aba ativa for `perfil`). O ponto é eliminar o desencontro semântico.
- **Adicionar upload e exibição de avatar** em `MeuPerfilSection` (Storage bucket `dbavizee` já existe), para aproveitar `profiles.avatar_url`.
- **Validação de `nome` mínimo (2 chars não-whitespace) e `cargo` máx 80 chars**, com `.trim()` no save e mensagem inline.
- **`document.title` dinâmico** no `Configuracoes` por aba ativa (`Meu Perfil · AviZee` etc.), para que abas do navegador reflitam o contexto.
- **Banner de "essa URL mudou"** se vier de `/perfil` (via `state` no navigate) — opcional, mas ajuda usuário a memorizar a nova rota.

---

## 5. Melhorias estruturais

1. **Eliminar `Perfil.tsx` e o `lazy import`**. Trocar a Route por `<Route path="/perfil" element={<Navigate to="/configuracoes" replace />} />` direto em `App.tsx`. Remove arquivo, chunk, spinner duplo e a categoria de problemas 2.1 inteira.
2. **Limpar `src/lib/navigation.ts`** removendo `'/perfil'` de `headerIcons` e `extraRouteLabels` (itens 6 e 24).
3. **Decidir e documentar a nomenclatura final** ("Configurações" vs "Minha Conta" vs "Perfil"): atualizar copy de menus, breadcrumbs e comentários. Salvar a decisão em memória (`mem://features/perfil-x-configuracoes`) para evitar regressão.
4. **Sincronizar `profiles.email`** via trigger `on auth.users update` ou eliminar a coluna e ler sempre de `auth.users` via `useAuth`.
5. **Mover `log_self_update_audit` para dentro de uma RPC `save_user_profile`** que faz `update profiles` + `insert permission_audit` na mesma transação. Garante auditoria atômica.
6. **Adicionar teste de smoke** que falhe se `Perfil.tsx` crescer além de N linhas ou se um novo `useEffect`/`useState` for introduzido — congela o shim como contrato.
7. **Atualizar memória** (`mem://index.md`) com uma entrada explicando que `/perfil` é alias e que a tela canônica é `/configuracoes?tab=perfil`.

---

## 6. Roadmap de execução

| Fase | Entrega | Dependências | Esforço | Impacto |
|---|---|---|---|---|
| 1 | Substituir `Perfil.tsx` por `<Navigate>` inline em `App.tsx` + remover arquivo + remover lazy import | Nenhuma | S | Quick win — elimina chunk, spinner duplo e JSX malformado |
| 2 | Repassar `searchParams` no redirect (caso fase 1 mantenha um componente intermediário) | Fase 1 | S | Preserva deep-links |
| 3 | Limpar `'/perfil'` de `headerIcons` e `extraRouteLabels` em `navigation.ts` | Fase 1 | S | Remove dead code |
| 4 | Decidir e padronizar nomenclatura ("Meu perfil" vs "Configurações") em `AppHeader`, `MobileMenu`, breadcrumbs e `<title>` | Nenhuma | S | Coerência de produto |
| 5 | Validação/trim em `useProfileForm.save` + mensagens inline | Nenhuma | S | Evita nome vazio |
| 6 | RPC transacional `save_user_profile` (update + audit) | Fase 5 | M | Auditoria atômica |
| 7 | Upload de avatar em `MeuPerfilSection` usando bucket `dbavizee` | Nenhuma | M | Aproveita `avatar_url` |
| 8 | `document.title` dinâmico por aba em `Configuracoes` | Nenhuma | S | UX dos tabs |
| 9 | Sincronizar `profiles.email` via trigger ou remover a coluna | Decisão de produto | M | Elimina divergência |
| 10 | Atualizar `mem://index.md` com entrada sobre o alias `/perfil` | Fase 1 | S | Governança |

**Quick wins (1 PR cada)**: 1, 3, 4, 5, 8, 10.
**Refatoração estrutural**: 6, 7, 9.

