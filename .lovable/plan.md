# Sistema de Ajuda e Tour Guiado

Solução em duas camadas integradas: **(1) Manual da tela** sempre acessível por botão no header, e **(2) Tour guiado interativo** opcional, disparado automaticamente no primeiro acesso de cada tela.

## Visão geral

```text
┌─ AppHeader ──────────────────────────────────────────────┐
│  ...           [🔍 Busca]  [? Ajuda ▾]  [🔔]  [👤]        │
└──────────────────────┬───────────────────────────────────┘
                       │ clique
        ┌──────────────┴──────────────┐
        │  📖 Manual desta tela       │ → abre HelpDrawer (lateral)
        │  ▶  Iniciar tour guiado      │ → ativa Coach overlay
        │  ⌨  Atalhos do teclado       │ → reaproveita dialog atual
        │  ─────                       │
        │  📚 Central de ajuda        │ → /ajuda (índice geral)
        └─────────────────────────────┘
```

No **primeiro acesso** de uma tela com tour configurado, aparece um toast discreto: *"Primeira vez aqui? **Fazer tour (30s)** · Pular"*. Decisão fica salva em `user_preferences`.

## Arquitetura

### 1. Registry central de conteúdo

Um único módulo declarativo descreve a ajuda de cada rota — sem espalhar texto por todos os componentes.

`src/help/registry.ts`
```ts
export interface HelpTourStep {
  target: string;              // seletor CSS ou data-help-id
  title: string;
  body: string;
  placement?: 'top'|'bottom'|'left'|'right'|'auto';
}
export interface HelpEntry {
  route: string;               // ex: '/comercial/orcamentos'
  title: string;
  summary: string;             // 1-2 linhas
  sections: { heading: string; body: string; bullets?: string[] }[];
  shortcuts?: { keys: string; desc: string }[];
  related?: { label: string; to: string }[];
  tour?: HelpTourStep[];       // opcional
  version: number;             // bump quando o conteúdo muda relevantemente
}
export const HELP_REGISTRY: Record<string, HelpEntry> = { ... };
```

Lookup faz match por rota mais específica (ex.: `/comercial/orcamentos/novo` cai em `/comercial/orcamentos` se não houver entry própria).

### 2. Botão e menu de ajuda no header

`src/components/help/HelpMenu.tsx` — DropdownMenu com ícone `HelpCircle`, integrado ao `AppHeader` (entre busca e notificações). Oculto em rotas públicas (login, orçamento público).

Atalho global: **`?`** ou **`Shift+/`** abre o drawer da tela atual (registrar em `useGlobalHotkeys`).

### 3. HelpDrawer — o "manual"

`src/components/help/HelpDrawer.tsx` — usa `Sheet` (lado direito, largura `sm:max-w-md`). Renderiza `HelpEntry` com:
- Título + resumo
- Seções (markdown leve via `react-markdown`, já presente no projeto se usado em chat; senão renderização simples com headings/listas)
- Atalhos de teclado da tela
- Links relacionados (navegação interna)
- Botão **"Iniciar tour guiado"** (se `tour` existe)
- Rodapé: "Esta página foi útil?" 👍/👎 → grava em `help_feedback` (tabela nova) para priorizarmos melhorias.

Fallback elegante quando a rota não tem entry: card "Ajuda em construção para esta tela" + link para central.

### 4. Tour guiado (Coach)

`src/components/help/CoachTour.tsx` — overlay próprio (sem dependência externa pesada), usando `Popover` do projeto + um backdrop com recorte (clip-path) ao redor do alvo.

Funcionamento:
- Recebe `steps: HelpTourStep[]`.
- Cada step localiza o alvo via `document.querySelector('[data-help-id="..."]')` (preferimos data-attr por estabilidade contra refactors de classe).
- Scroll suave até o alvo, destaca com ring + sombra, mostra popover com Anterior/Próximo/Pular/Concluir e contador `2/6`.
- `Esc` fecha; foco preso dentro do popover (acessibilidade).
- Se um alvo sumir (ex.: tab diferente), mostra step "fantasma" centralizado pedindo para ativar a área correta, com `actionLabel` opcional.

Marcações nas telas são mínimas: adicionamos `data-help-id="orcamentos.novoBtn"` em poucos elementos-chave por tela (botão Novo, filtros, kpi principal, tabela). **Não** cria-se conteúdo de ajuda dentro dos componentes — só âncoras.

### 5. Primeiro acesso — disparo automático

`src/hooks/useFirstVisitTour.ts`:
- Lê `seen_tours` (array de `route@version`) de `user_preferences`.
- Na montagem da rota, se houver `tour` e a chave não estiver registrada, dispara um **toast não-bloqueante** (sonner) com ações *Fazer tour* / *Agora não* / *Não mostrar mais*.
- Decisões persistem; se "Agora não" só registra na sessão, voltará no próximo login.
- Bump de `version` no registry reativa o toast (anuncia mudanças de UX).

### 6. Central de Ajuda `/ajuda`

Página simples que lista todas as `HelpEntry` agrupadas por seção da navegação, com busca local (já temos padrão de `Input` + filtro). Útil como índice e para usuários novos explorarem antes de entrar em cada tela.

### 7. Persistência

Migração nova:
```sql
-- coluna no user_preferences (jsonb existente) ou tabela dedicada:
create table public.help_progress (
  user_id uuid primary key references auth.users(id) on delete cascade,
  seen_tours text[] not null default '{}',
  disabled_first_visit boolean not null default false,
  updated_at timestamptz not null default now()
);
alter table public.help_progress enable row level security;
create policy "self read"  on public.help_progress for select using (auth.uid() = user_id);
create policy "self upsert" on public.help_progress for insert with check (auth.uid() = user_id);
create policy "self update" on public.help_progress for update using (auth.uid() = user_id);

create table public.help_feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  route text not null,
  helpful boolean not null,
  comment text,
  created_at timestamptz not null default now()
);
alter table public.help_feedback enable row level security;
create policy "self insert" on public.help_feedback for insert with check (auth.uid() = user_id);
create policy "admin read"  on public.help_feedback for select using (public.has_role(auth.uid(), 'admin'));
```

### 8. Configurações do usuário

Em `/configuracoes?tab=preferencias` (ou aba existente equivalente) adicionamos:
- ☐ Mostrar tours guiados em telas novas
- Botão **"Reiniciar todos os tours"** (limpa `seen_tours`)

## Rollout do conteúdo

Implementar a infra completa + conteúdo das telas mais usadas no primeiro lote, e ir preenchendo o registry incrementalmente:

**Lote 1 (com tour):** Dashboard, Orçamentos, Pedidos, Fiscal (NF-e), Estoque, Financeiro, Logística, Clientes, Produtos.
**Lote 2 (só manual):** Compras, Cotações, Contas Bancárias, Conciliação, Fluxo de Caixa, Relatórios, Workbook, Apresentação Gerencial.
**Lote 3:** Cadastros auxiliares (Transportadoras, Funcionários, Sócios, Formas de Pagamento, etc.) — manual curto, sem tour.
**Admin/Configurações:** manual focado em segurança e responsabilidade dos campos.

Cada entry leva ~10 minutos para escrever bem; podemos paralelizar por módulo.

## Detalhes técnicos

- **Sem libs novas pesadas.** Usamos `Sheet`, `Popover`, `DropdownMenu`, `Tooltip` já existentes. O recorte do backdrop do tour é CSS puro (`clip-path` calculado a partir do `getBoundingClientRect`).
- **Acessibilidade:** ARIA `role="dialog"`, `aria-labelledby`, foco preso, `Esc` fecha, contraste do anel respeita tokens do design system.
- **Mobile:** drawer já é responsivo; o tour adapta para sheet inferior em telas <640px (popover vira `Drawer` bottom). Botão de ajuda some do `AppHeader` mobile e aparece em `MobileQuickActions`.
- **i18n-ready:** registry é só strings — fácil migrar para chaves no futuro.
- **Telemetria leve:** registramos `tour_started/completed/skipped` em `help_feedback` (extensão futura) para entender adoção.
- **Performance:** registry é estático e tree-shakable; tour só carrega ao iniciar (lazy import do `CoachTour`).

## Arquivos a criar/editar

Novos:
- `src/help/registry.ts` + `src/help/entries/*.ts` (um por módulo)
- `src/components/help/HelpMenu.tsx`
- `src/components/help/HelpDrawer.tsx`
- `src/components/help/CoachTour.tsx`
- `src/components/help/FirstVisitToast.tsx`
- `src/hooks/useHelpEntry.ts`, `src/hooks/useFirstVisitTour.ts`, `src/hooks/useCoachTour.ts`
- `src/pages/Ajuda.tsx` + rota
- `supabase/migrations/<ts>_help.sql`

Editar:
- `src/components/navigation/AppHeader.tsx` (botão ajuda)
- `src/components/navigation/MobileQuickActions.tsx` (botão ajuda mobile)
- `src/components/AppLayout.tsx` (montagem do `CoachTour` provider e `FirstVisitToast`)
- `src/hooks/useGlobalHotkeys.ts` (atalho `?`)
- `src/App.tsx` (rota `/ajuda`)
- `src/pages/configuracoes/...` (toggle e botão reset)
- Marcações `data-help-id` em ~5 pontos por tela do Lote 1.

## Entregáveis desta primeira implementação

1. Infra completa (registry, drawer, tour, primeiro acesso, persistência, configurações).
2. Conteúdo do **Lote 1** (manual + tour guiado).
3. Página `/ajuda` com índice e busca.
4. Marcações `data-help-id` nas telas do Lote 1.

Lotes 2 e 3 (preenchimento do conteúdo) entram em iterações seguintes — a infra já estará pronta, basta adicionar entries no registry.
