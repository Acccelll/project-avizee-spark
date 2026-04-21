

# Ajustes em massa — Admin, sessão, financeiro, sidebar e UX

11 problemas independentes. Plano agrupado por área.

---

## 1. Menu lateral de Administração — visual

Hoje cada grupo (`Empresa / Acesso & Segurança / Configurações / Dados & Auditoria`) é um accordion sem hierarquia visual clara, a área "Empresa" só tem 1 item e o item ativo destaca o grupo inteiro com cor avermelhada. Refatorar `src/pages/Administracao.tsx`:

- Trocar accordions por **secções fixas com headers tipográficos** (caps, 11px, `text-muted-foreground`) — sem expand/collapse, todos os itens visíveis (são poucos).
- Item ativo: barra vertical primary à esquerda + bg `accent/40`, sem chip de cor inteiro.
- Ícones em quadradinho (24×24) com bg `muted/40`; `Dados da Empresa` deixa de ficar dentro de um card vermelho.
- Adicionar separador fino entre seções e largura fixa `w-60`.

## 2. Filtro de data personalizado bugado no Dashboard

`src/components/dashboard/DashboardHeader.tsx` usa `<Input type="date">` controlado direto pelo contexto. Cada keystroke (`2`, `20`, `202`…) dispara `setCustomStart` com data inválida e o `useMemo` do `range` recalcula imediatamente, retornando datas inválidas que quebram queries downstream.

- Manter estado local (`localStart`, `localEnd`) para digitação; só propagar via `setCustomStart/End` no `onBlur` ou quando a string completar 10 chars válidos (`/^\d{4}-\d{2}-\d{2}$/`).
- Validar `dateFrom <= dateTo`; se inválido, manter o range anterior e mostrar `aria-invalid` no input vermelho.
- Adicionar botão "Aplicar" explícito ao lado dos inputs para confirmar.

**Auditar mesmo padrão em**: `Auditoria.tsx`, `relatorios/.../FiltrosRelatorio.tsx`, `relatorios/.../PeriodoFilter.tsx` (usam o mesmo padrão `<Input type="date" onChange={direto}>`). Aplicar a mesma proteção via util novo `src/lib/safeDateInput.ts` (`useDebouncedDateInput`) reutilizável.

## 3. Timeout de sessão configurável (≥1h) + preferência

`SessionExpiryWarning` usa `WARN_BEFORE_MS = 5 min` e dispara o toast assim que a expiração nativa do Supabase se aproxima (~1h). O toast aparece muito cedo na UX.

- Adicionar preferência `session_keepalive` (`'on' | 'off'`, default `'on'`) e `session_warn_minutes` (`number`, default `60`) em `useUserPreference`.
- Se `keepalive='on'`: a cada 30 min, chamar `supabase.auth.refreshSession()` em background (silenciosamente). Isso renova a janela de 1h continuamente enquanto a aba estiver ativa (`document.visibilityState === 'visible'`).
- Toast "Renovar sessão" só aparece **N minutos antes** da expiração (configurável; default 5 min). Garante que nunca aparece se keepalive estiver ligado e a aba ativa.
- UI: nova seção "Sessão" em `src/pages/Configuracoes.tsx` (rota `/configuracoes`, é onde `/perfil` redireciona) com **Switch "Manter sessão ativa"** + **Slider/Select "Avisar X min antes de expirar"** (5/15/30/60).

## 4. Visual de "Ajuste Manual" do Estoque

`src/pages/Estoque.tsx` (aba `ajuste`): hoje é uma coluna estreita `max-w-lg` num fundo bege gritante, banner amarelo desproporcional, sem agrupamento.

- Wrapper em **2 colunas** (`grid lg:grid-cols-3 gap-6`): formulário ocupa 2/3, **lateral direita** mostra histórico recente do produto (últimos 5 ajustes via `vw_estoque_ultimos_ajustes` se existir, senão `estoque_movimentos` filtrado por `produto_id` e `tipo='ajuste'`).
- Banner de aviso: trocar fundo amarelo cheio por borda lateral `border-l-4 border-warning` + bg `warning/5` mais sutil.
- Cards segmentados (FormSection) para "Produto", "Operação" e "Justificativa" — cada um com header tipográfico claro.
- Preview do "Saldo Atual / Novo Saldo" vira um card destacado com tipografia maior (32px) e diff colorido (verde/vermelho) com seta.
- Botões de ação fixos no rodapé (sticky) do card.

## 5. `[object Object]` na coluna Descrição (Lançamentos)

**Causa raiz confirmada** (consulta no DB): 363 registros em `financeiro_lancamentos` têm a string literal `"[object Object]"` em `descricao`. Foram gravados por um bug antigo (provavelmente `String(objetoPlanoContas)` sem `.descricao`). O FK `conta_contabil_id` está correto e `contas_contabeis.descricao` tem o nome.

**Correção em duas frentes:**

1. **Migration SQL — backfill**: 
   ```sql
   UPDATE financeiro_lancamentos l
   SET descricao = cc.descricao
   FROM contas_contabeis cc
   WHERE l.conta_contabil_id = cc.id AND l.descricao = '[object Object]';
   ```
   Para os que não tiverem `conta_contabil_id`, fallback para "Lançamento sem descrição".

2. **Render defensivo** em `src/pages/financeiro/config/financeiroColumns.tsx` (linha 55) e `src/pages/FluxoCaixa.tsx` (linha 277):
   - Helper `displayDescricao(l)`: se `descricao === '[object Object]'` ou for objeto, retorna `l.contas_contabeis?.descricao ?? '—'`.

## 6. Baixa em lote com edição individual por título

Hoje `BaixaLoteModal` aplica forma de pagamento + conta + data **uniformemente** a todos. Não dá pra editar cada título.

Refatorar `src/components/financeiro/BaixaLoteModal.tsx`:

- Cada linha da tabela ganha um botão "✏️ Editar" que **substitui a linha** por um formulário inline (mesmos campos do `BaixaParcialDialog`: data baixa, forma pgto, conta bancária, valor pago, observação).
- Edição salva em estado local `perItemOverrides: Record<id, BaixaConfig>` — a baixa final usa o override quando presente, senão os defaults da seção superior.
- Linha editada mostra ícone ✓ e resumo dos overrides.
- Botão "Voltar" reverte a linha ao modo readonly mantendo overrides.
- Atualizar `processarBaixaLote` em `src/services/financeiro.service.ts` para aceitar `overrides?: Record<string, Partial<BaixaConfig>>` e aplicar por item; quando há override, gera 1 INSERT em `financeiro_baixas` com os valores específicos.

## 7. `[object Object]` em "Movimentos" do Fluxo de Caixa

Mesmo bug do item 5 (já coberto pelo backfill SQL). Adicionar o mesmo `displayDescricao` helper em `src/pages/FluxoCaixa.tsx:277`.

## 8. Primeira coluna do grid: só "Visualizar"

`src/components/DataTable.tsx` `renderActions` (linhas 430-481) mostra hoje **Visualizar + Editar + Duplicar + Excluir** todos juntos.

- Modificar `renderActions` para mostrar **apenas o botão "Visualizar"** quando `onView` está presente.
- Os botões `onEdit`, `onDuplicate`, `onDelete` continuam disponíveis via prop, mas só são renderizados **dentro do drawer** (não na grid).
- `ViewDrawerV2` já é onde o usuário clica em "Visualizar" — adicionar slot de `headerActions` com Editar/Duplicar/Excluir lá. Hoje cada drawer (`FinanceiroDrawer`, `EstoqueDrawer`, etc.) já tem seus próprios botões; padronizar via `ViewDrawerV2.headerActions` prop.
- Mobile (`renderMobileActions`): mantém `MoreVertical` dropdown como hoje (caso de uso diferente — touch).

## 9. Click no avatar/perfil sem ação

Pelo print (`image-12`) o avatar está sendo renderizado mas o `DropdownMenu` parece não abrir. Inspeção do código `AppHeader.tsx` mostra que o trigger está envolto em `<Tooltip>` *dentro* do `DropdownMenuTrigger asChild`, o que pode estar quebrando a propagação do click no Radix (conflito entre dois `asChild` aninhados).

- Reordenar: colocar `<Tooltip>` **fora** do `DropdownMenuTrigger` (envolvendo o botão como wrapper, não dentro dele), ou separar tooltip e trigger em elementos distintos.
- Validar manualmente que o menu abre.
- Conteúdo do menu já existe e tem "Meu perfil → /perfil → /configuracoes", "Configurações", "Tema", "Sair" — mantém esses 4 itens.

## 10. Erro ao criar usuário em Administração

Suspeitas, em ordem:
1. `inviteUserByEmail` requer SMTP configurado no projeto Supabase. Sem SMTP, falha com mensagem genérica.
2. `ALLOWED_ORIGIN` env var não setada no edge function rejeita o request com 500.
3. Trigger `handle_new_user` no Postgres tentando inserir em tabelas com colunas obrigatórias.

**Plano de correção:**
- Adicionar `console.log` detalhado em cada etapa de `supabase/functions/admin-users/index.ts` action `create` (já tem `console.error` no catch).
- Trocar `inviteUserByEmail` por `createUser` com `email_confirm: true` e `password: random` quando SMTP não está configurado, depois usar `generateLink({ type: 'recovery' })` para enviar reset de senha. Mostra senha temporária na UI como fallback.
- Mostrar mensagem de erro real no toast (já passa via `data.error`); auditar `getUserFriendlyError` para não mascarar a causa.
- Após reproduzir o erro com logs, aplicar fix específico.

## 11. Sidebar dinâmico (recolhido por padrão, expande no hover)

Hoje sidebar tem só dois estados (recolhido fixo / expandido fixo) controlados por `sidebarCollapsed` em `useUserPreference`.

- Adicionar terceiro modo: **`sidebar_mode: 'fixed-expanded' | 'fixed-collapsed' | 'dynamic'`** (default `'dynamic'`).
- Modo `dynamic`: sidebar fica recolhido (72px) por padrão; ao `onMouseEnter` no `<aside>`, expande para 240px com transição; ao `onMouseLeave`, recolhe. Usar overlay (sidebar com `position: fixed` já está, pode crescer sem empurrar conteúdo no modo dinâmico).
- Modo `fixed-collapsed`: sempre 72px, conteúdo `md:ml-[72px]`.
- Modo `fixed-expanded`: sempre 240px, conteúdo `md:ml-[240px]`.
- Botão de toggle no sidebar abre um pequeno menu com os 3 modos (radio).
- Garantir navegação completa quando recolhido: `SidebarSection` no modo collapsed já mostra ícones; revisar se hover-popout dos submenus funciona (já existe `onExpandRail`); ajustar para não auto-expandir o rail no modo `fixed-collapsed`.
- Persistir em `useUserPreference('sidebar_mode')` em `AppConfigContext`.
- Adicionar UI em `Configuracoes` (mesma seção de preferências do item 3) com 3 opções visuais (cards com ícone explicativo).

---

## Detalhes técnicos

**Arquivos a editar**
- `src/pages/Administracao.tsx` — refatorar `sideNavGroups` rendering (item 1).
- `src/components/dashboard/DashboardHeader.tsx` + novo `src/lib/safeDateInput.ts` — fix data personalizada (item 2). Aplicar nos 3 outros lugares.
- `src/components/auth/SessionExpiryWarning.tsx` + `src/pages/Configuracoes.tsx` — keepalive + preferências (item 3).
- `src/pages/Estoque.tsx` (bloco da aba "ajuste", linhas 508-680) — redesign visual (item 4).
- `src/pages/financeiro/config/financeiroColumns.tsx`, `src/pages/FluxoCaixa.tsx`, novo `src/lib/displayLancamento.ts` — helper de descrição (itens 5 e 7).
- `src/components/financeiro/BaixaLoteModal.tsx` + `src/services/financeiro.service.ts` — overrides por título (item 6).
- `src/components/DataTable.tsx` (`renderActions`) + `src/components/ViewDrawerV2.tsx` — só Visualizar na grid (item 8).
- `src/components/navigation/AppHeader.tsx` — Tooltip/DropdownMenu fix (item 9).
- `supabase/functions/admin-users/index.ts` — logs + fallback createUser (item 10).
- `src/components/AppSidebar.tsx` + `src/components/AppLayout.tsx` + `src/contexts/AppConfigContext.tsx` — modo dinâmico (item 11).

**Migrations SQL** (1 arquivo)
- Backfill `descricao = '[object Object]'` → `contas_contabeis.descricao` (item 5/7).

**Sem mudança de schema** em nenhum item. Sem novas dependências.

**Compatibilidade**
- Sidebar: usuários atuais (preferência `sidebar_collapsed: true/false`) migram automaticamente para `fixed-collapsed`/`fixed-expanded` na primeira leitura, então nada quebra.
- Sessão: keepalive `'on'` por padrão preserva a UX atual mas sem o toast precoce.

**Fora de escopo**
- Reescrita do `BaixaParcialDialog` para reutilizar componentes do BaixaLote (item 6 reusa via composição).
- 2FA / SAML em criação de usuário (item 10 fica só em invite/create).
- Persistir histórico de ajustes em tabela nova (item 4 reusa `estoque_movimentos`).

