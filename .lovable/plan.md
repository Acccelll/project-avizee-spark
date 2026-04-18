

# Diagnóstico visual — Autenticação, Permissões e Administração

## Inventário visual

| Tela / Estado | Estado atual |
|---|---|
| `/login` | Card centralizado, logo, 2 inputs com ícones, botão "Entrar" + botão dev (dashed). Limpo, mas erros aparecem só como texto vermelho 12px abaixo do input + toast. |
| `/signup` | Existe, padrão similar ao login. |
| `/forgot-password` | Existe; feedback "verifique seu e-mail" via toast. |
| `/reset-password` | Funcional após Fase 10; sem destaque para "sessão de recuperação ativa". |
| Loading de sessão | `FullPageSpinner label="Carregando sessão..."` — texto genérico, sem branding. |
| `AccessDenied` (rota) | `DetailEmpty` com `ShieldOff` warning + título + msg + botão "Voltar ao início". OK, mas mensagem técnica ("módulo (financeiro)"). |
| `AccessDenied` (admin) | Mesma base, mas título "Área administrativa". |
| Botões sem permissão | Padrão atual: **escondidos** (não renderizam). Usuário não sabe que existe a ação — sem tooltip "você não tem permissão". |
| `PermissaoMatrix` (admin) | Tabela read-only com banner amarelo. Sem busca, sem highlight de overrides. |
| Toast de logout | Sonner `info` "Sessão encerrada" — sem destaque. |
| Toast de erro de login | Genérico "E-mail ou senha inválidos" — sem ícone, sem ação de recovery inline. |

## Problemas reais

### 1. Login sem hierarquia de feedback
- Erros de validação (12px texto vermelho) competem com toast (canto). Usuário recebe 2 sinalizações para o mesmo erro.
- Sem **alert inline** persistente para erros do servidor (ex: "credenciais inválidas") — toast some em 4s.
- "Esqueceu a senha?" como link discreto ao lado do label de senha — invisível em foco.
- Sem indicação visual de "Caps Lock ativo" no campo senha (causa real de erro).
- Botão dev (`Preencher como Dev`) sempre visível em dev — ok, mas em produção fica escondido sem aviso ao desenvolvedor que esqueceu de configurar `VITE_DEV_*`.

### 2. Loading de sessão "morto"
`FullPageSpinner label="Carregando sessão..."` em fundo `bg-background` plano. Nenhum branding (logo). Usuário recarrega a página e por 1-3s vê só um spinner cinza — parece app quebrado.

### 3. AccessDenied tecnicista
Mensagem default: *"Você não tem permissão para acessar este módulo (financeiro). Solicite acesso ao administrador."*
- Mostra o slug interno `financeiro` em vez de "Financeiro".
- "Solicite acesso ao administrador" sem CTA real (mailto, link, copiar contato).
- Mesmo visual para 3 contextos (rota / admin / inline) — não diferencia "área restrita" de "ação restrita".

### 4. Ações bloqueadas viram fantasmas
Padrão hoje (Fase 4): se `!can(...)`, o componente retorna `null`. Resultado:
- Vendedor vê tela de Pedidos sem botão "Excluir". Pode achar que a feature não existe.
- Sem distinção entre **indisponível** (estado: pedido faturado não pode ser cancelado) e **proibido** (você não tem permissão).
- Suporte recebe ticket "como excluo pedido?" sem saber que é permissão.

### 5. Sessão expirada sem ritual
`onAuthStateChange` SIGNED_OUT mostra toast "Sessão encerrada" e redireciona. Se a sessão expirar enquanto o usuário escreve um formulário, ele perde tudo sem aviso prévio.

### 6. Reset password sem confirmação visual de "modo recovery"
Após Fase 10, a página valida `getSession`. Mas visualmente é igual à tela "definir senha" comum — usuário não sabe se está num fluxo seguro de recovery.

### 7. PermissaoMatrix denso e sem hierarquia
- Tabela `recursos × ações` com checkmarks. Sem busca por recurso.
- Banner "read-only definido em código" amarelo grande no topo — ocupa espaço.
- Não destaca overrides individuais (allow/deny) com cores distintas.
- Não mostra **resumo** "este usuário tem X permissões a mais que o role base".

### 8. Falta indicador de "sessão ativa" no header
Avatar do usuário no header não mostra role nem status de sessão. Admin trabalhando sem perceber que está logado como tal.

## Padrão-base visual proposto

### A. Login com alert inline + caps lock detector
- **Alert inline** acima do form para erros do servidor (`<Alert variant="destructive">`), persistente até nova tentativa.
- Remover toast de erro de credencial (manter só toast de erro de rede).
- Indicador discreto "Caps Lock ativo" abaixo do campo senha quando detectado (`onKeyDown` checa `getModifierState`).
- "Esqueceu a senha?" como botão `link` mais visível, posicionado abaixo do botão Entrar (separação clara das ações).
- Footer com link "Precisa de acesso? Fale com o administrador" (copiar email do `empresaConfig.email_admin` se disponível, senão mailto genérico).

### B. Loading de sessão com branding
Substituir `FullPageSpinner` em `ProtectedRoute`/`AdminRoute`/`PermissionRoute` por `<AuthLoadingScreen>` novo:
- Logo AviZee centralizada
- Spinner pequeno abaixo
- Label adaptativa: "Carregando sessão" / "Verificando permissões" / "Restaurando acesso"
- Fade-in suave (200ms)

### C. AccessDenied refinado em 3 variantes
Componente único, 3 modos via prop `variant`:
- **`route`** (full page): ícone grande, título "Acesso restrito", recurso humanizado ("Financeiro" não "financeiro"), CTA primária "Voltar ao início" + secundária "Solicitar acesso" (abre modal/mailto).
- **`action`** (inline pequeno): ícone ShieldOff inline + texto compacto. Para uso em painéis.
- **`feature`** (placeholder de seção): card cinza com ícone Lock, "Esta seção requer permissão X". Para áreas específicas dentro de uma página acessível.

Mapa `humanizeResource(slug)` em `permissions.ts` para nomes amigáveis.

### D. Botões bloqueados visíveis com tooltip
Novo componente `<PermissionGate resource action mode="hide" | "disable">`:
- **`hide`** (default atual): retorna null. Usar quando ação é raramente acessível.
- **`disable`**: renderiza children desabilitado + tooltip "Você não tem permissão para [ação]. Fale com o administrador."

Recomendação: usar `disable` em ações primárias (Editar, Excluir, Aprovar) e `hide` em ações administrativas raras (Configurar, Gerenciar templates).

Aplicar em: Pedidos (excluir), Orçamentos (aprovar), Financeiro (editar), Estoque (movimentar), Relatórios (exportar PDF).

### E. Aviso de sessão expirando
Hook `useSessionExpiryWarning()` que escuta `session.expires_at`:
- 5 min antes da expiração → toast persistente com botão "Renovar sessão" (refresh token).
- Expirou → modal bloqueante "Sessão expirada. Faça login novamente." + botão único "Ir para login".

### F. ResetPassword com banner de contexto
No topo da tela, banner verde discreto: "🔐 Você está em um fluxo seguro de redefinição de senha." Após sucesso, redireciona para login com toast "Senha alterada com sucesso. Faça login com a nova senha."

### G. PermissaoMatrix com busca + destaques
- Input de busca filtrando por recurso/ação no topo.
- Banner read-only colapsável (pequeno `Info` icon + tooltip).
- Linhas com override allow → bg verde sutil; override deny → bg vermelho sutil; herdado → sem fundo.
- Footer com resumo: "12 permissões herdadas · 3 adicionadas · 1 revogada".
- Legenda visual no rodapé com 3 swatches.

### H. Avatar do header com badge de role
- Avatar pequeno com badge dot colorido (admin=vermelho, financeiro=azul, vendedor=verde, estoquista=amarelo).
- Tooltip no avatar: "João Silva · Administrador · Online".
- Dropdown de conta abre com role visível ao lado do nome.

## Implementação

### Componentes novos
1. **`src/components/auth/AuthLoadingScreen.tsx`** — Branding + spinner + label adaptativa.
2. **`src/components/auth/SessionExpiryWarning.tsx`** — Toast/modal de expiração; hook `useSessionExpiryWarning` interno.
3. **`src/components/auth/CapsLockIndicator.tsx`** — Pequeno hint reativo abaixo do input senha.
4. **`src/components/PermissionGate.tsx`** — Wrapper para ações com modo `hide`/`disable` + tooltip explicativo.
5. **`src/components/RequestAccessDialog.tsx`** — Modal com mailto pré-preenchido para "Solicitar acesso".

### Componentes ajustados
6. **`src/components/AccessDenied.tsx`** — Adicionar prop `variant: 'route' | 'action' | 'feature'`, prop `resourceLabel?` (humanizado), CTA secundária "Solicitar acesso".
7. **`src/lib/permissions.ts`** — Adicionar `RESOURCE_LABELS: Record<ErpResource, string>` e helper `humanizeResource(slug)`.
8. **`src/components/PermissionRoute.tsx`** — Passar `resourceLabel={humanizeResource(resource)}` ao `AccessDenied`.
9. **`src/components/AdminRoute.tsx`** — Usar `AuthLoadingScreen` em vez de `FullPageSpinner`.
10. **`src/components/ProtectedRoute.tsx`** — Idem.
11. **`src/components/SocialRoute.tsx`** — Idem.
12. **`src/pages/Login.tsx`** — Alert inline para erro de servidor, CapsLockIndicator, footer "Precisa de acesso?", reorganizar "Esqueceu a senha?".
13. **`src/pages/ResetPassword.tsx`** — Banner verde "fluxo seguro", success toast claro.
14. **`src/components/navigation/AppHeader.tsx`** — Badge de role no avatar + role no dropdown.
15. **`src/contexts/AuthContext.tsx`** — Inicializar listener de expiração via `<SessionExpiryWarning />` em algum ponto top-level (App.tsx).
16. **`src/App.tsx`** — Montar `<SessionExpiryWarning />` dentro do `AuthProvider`.
17. **`src/pages/admin/components/PermissaoMatrix/index.tsx`** — Busca, banner colapsável, destaques de override, footer resumo, legenda.

### Pontos de uso de `PermissionGate` (ondas)
- Onda inicial nesta passada: Pedidos (excluir/cancelar), Orçamentos (aprovar/excluir), Financeiro (editar/excluir lançamento). Demais módulos continuam com `hide` atual e migram em passada futura.

## Fora do escopo
- Refazer fluxo de signup (raramente usado, admin cria usuários).
- 2FA / MFA (feature nova).
- Onboarding wizard pós-primeiro-login.
- Refazer visual do dropdown da conta inteiro (apenas adicionar role).
- Trocar Sonner por sistema de notificação custom.
- Migrar todos os botões do app para `PermissionGate disable` (apenas onda inicial).
- Refazer `/signup` e `/forgot-password` visualmente.

## Critério de aceite
- Login com alert inline persistente para erro de credencial (sem toast duplicado) + indicador de Caps Lock + footer de contato.
- `AuthLoadingScreen` com logo aparece em ProtectedRoute/AdminRoute/PermissionRoute/SocialRoute.
- `AccessDenied` em 3 variantes; rota mostra nome humanizado do recurso e botão "Solicitar acesso".
- `PermissionGate` disponível com modos `hide`/`disable`; aplicado em Pedidos/Orçamentos/Financeiro nas ações primárias.
- Aviso de sessão expirando 5min antes; modal ao expirar.
- ResetPassword com banner de contexto e success toast claro.
- PermissaoMatrix com busca, destaques de override, banner colapsável e resumo no rodapé.
- Avatar do header com dot de role + role no dropdown.
- Build OK; nenhum guard ou fluxo de auth quebrado.

## Entregáveis
Resumo final por categoria: login com alert + capslock + contato, loading com branding, AccessDenied humanizado em 3 variantes, PermissionGate para ações bloqueadas visíveis com tooltip, aviso de sessão expirando, ResetPassword com contexto, PermissaoMatrix com busca/destaques/resumo, avatar com role.

