# Plano — UX Navegação AviZee

Aplicar as 3 superfícies do brief mantendo design system (paleta coral/off-white, tokens semânticos, border-radius). Implementação em **4 fases** por prioridade. Cada fase é entregável independente.

---

## Fase 1 — Correções rápidas de alto impacto 🔴

**1.1. Stat cards Fiscal (mobile) — item 2.4**
- `src/pages/Fiscal.tsx`: forçar `grid-cols-3` mesmo no mobile (atualmente quebra em 2+1).
- Criar `src/utils/formatCurrencyCompact.ts` com regra `< 1k`, `≥ 1k → R$ 1,2k`, `≥ 1M → R$ 1,4M`.
- Aplicar em SummaryCards do Fiscal; cor semântica: pendentes → `warning`, confirmadas → `success`, total → padrão.
- Substituir label `Confirma...` por `Confirmadas` (font-size 11px caso necessário).

**1.2. Sidebar — Configurações duplicada — item 3.3**
- `src/lib/navigation.ts` (ou `src/config/navigation.config.ts`): remover entrada "Configurações" da seção `administracao`. Mantém apenas o link no `SidebarFooter`.

**1.3. Sidebar — truncamento de labels — item 3.2**
- Reduzir indent dos sub-itens em `SidebarSectionItem.tsx` (`px-2` → `pl-1.5 pr-2`) e/ou ajustar `--sidebar-w-expanded` em `index.css` de ~230px para 248px. Escolher a menor mudança que resolva os 5 labels.
- Validar visualmente sem afetar densidade de outros módulos.

**1.4. Topbar Fiscal mobile — título + bottom-sheet importar — itens 2.1, 2.2, 2.3, 2.7**
- `AppHeader.tsx`: garantir título completo (sem truncar para "N.. E..."); remover avatar no mobile (mantém back, título, search, sino).
- `FiscalToolbarActions.tsx`: substituir os 3 botões inline (`chave`, `QR/Código`, `XML`) por **um botão "Importar"** que abre um bottom-sheet (Sheet shadcn `side=bottom`) com 3 opções em grid. Botão "+ Nova" continua inline (variant primary coral).
- Corrigir placeholder da busca para `"Número, chave de acesso…"`.
- Garantir que rota `/fiscal?tipo=saida` exibe o mesmo cabeçalho com título "Notas de Saída" + subtítulo (atualmente ausente).

---

## Fase 2 — Reorganização estrutural de navegação 🟠

**2.1. Sidebar accordion — apenas seção da rota ativa aberta — item 3.1**
- `useNavigationState.ts`: persistir estado em `localStorage["avizee_sidebar_state"]` como `Record<sectionKey, boolean>`.
- Default: tudo fechado, exceto seção que contém a rota ativa (forçar abrir ao navegar, sem sobrescrever a preferência manual da sessão).

**2.2. MobileMenu accordion + persistência — itens 1.2, 1.4, 1.6, 1.7**
- `MobileMenuSection.tsx`: cada seção vira accordion controlado, com chevron animado (`transition-transform 200ms`).
- Estado em `localStorage["avizee_menu_section_state"]`. Ao abrir o sheet, força a seção da rota ativa aberta.
- Seções com >4 itens: mostrar 3 + botão "Ver mais X itens" (expand inline). Afeta Fiscal, Financeiro, Cadastros.
- Remover labels "• também na barra inferior" dos cabeçalhos (Cadastros, Comercial, Financeiro). Substituir por tooltip de onboarding `first-visit` (flag em localStorage).
- Renomear: "Backlog faturamento" → "Fila de Faturamento"; "Histórico DistDF-e" → "Distribuição NF-e (DF-e)".

**2.3. Card de nota Fiscal mobile redesenhado — item 2.5**
- Componente do card (em `src/pages/fiscal/components/`): novo layout com header (número + tipo muted + status badge), corpo (nome cliente/fornecedor, data, valor formatado), footer com ações (DANFE, ação principal contextual conforme status, menu `...`).
- Ação principal por status: pendente → "Confirmar", confirmada → "Ver XML", rejeitada → "Reenviar".
- Status badges com `flex-wrap`, lado a lado.

**2.4. Empty state com "Limpar filtros" inline — item 2.6**
- Quando há filtros ativos no Fiscal e o resultado é vazio, renderizar `EmptyState` com botão "Limpar filtros" abaixo da descrição.

---

## Fase 3 — Badges, ícones e atalhos 🟡

**3.1. Atalhos rápidos mobile — grid de chips 3×2 — item 1.1**
- `MobileQuickActionsGrid.tsx`: substituir lista vertical por grid `grid-cols-3 gap-2`. Chip = ícone 24px + label 10px. Altura alvo ~80px total.
- Mapear atalhos: Orçamento, Cliente, Produto, Pedido, NF-e, Baixa (ícones lucide equivalentes aos `ti-*` do brief).

**3.2. Sidebar — ícones distintos e sub-grupos visuais em Fiscal — item 3.4**
- `src/lib/navigation.ts`: trocar ícones de cada item Fiscal (mapeamento do brief → lucide).
- Suportar `groupLabel` opcional em `NavGroup`: render como label uppercase 9px sem interação. Sub-grupos: Emissão / Entrada / Gestão.

**3.3. Badges no MobileMenu — item 1.3**
- `MobileMenuSection.tsx`: usar `useSidebarBadges()` para mostrar badge no cabeçalho (visível mesmo fechado). Mover o "84" do leaf Financeiro para o cabeçalho da seção. Tons: warning para pendência, danger para vencido/rejeitado.

**3.4. Tooltip e expansão de badges — itens 3.6, 3.7**
- `SidebarSection.tsx` / `SidebarSectionItem.tsx`: adicionar `title` descritivo nos badges ("X lançamentos aguardando baixa", "X orçamentos aguardando aprovação", etc).
- Estender `useSidebarAlerts.ts` / `useSidebarBadges.ts` para cobrir Pedidos de Compra (aguardando recebimento) e Notas de Entrada (pendentes). Usar consultas existentes onde possível; criar contagens novas via `head:true, count:'exact'` no Supabase.

---

## Fase 4 — Polimento 🟢

**4.1. User bar compacta no rodapé do MobileMenu — item 1.5**
- Refatorar `MobileNavProfilePicker.tsx` para uma barra horizontal: avatar 32 + nome/papel + ícones (lua = toggle tema, settings = navega `/configuracoes`, logout = vermelho com confirmação).

**4.2. Remover Social "EM BREVE" do sidebar — item 3.5**
- `useVisibleNavSections.ts` ou `navigation.ts`: ocultar item `social` quando `VITE_FEATURE_SOCIAL` desabilitado (já existe flag). Confirmar se o badge "EM BREVE" some completamente até lançamento.

**4.3. Texto "Sincronizado" granular — item 3.8**
- `SidebarFooter.tsx`: trocar render por função pura — `<5s` → "agora"; `5–59s` → "há Xs"; `≥60s` → "há Xmin"; `!online` (do `useOnlineStatus`) → "Sem conexão" + dot vermelho.

**4.4. Reorganizar Cadastros — item 3.9** *(opcional, validar com usuário)*
- Mover Grupos Econômicos, Funcionários, Sócios para sub-grupo "Empresa" dentro de Cadastros (não para Administração, para preservar permissões atuais).

---

## Detalhes técnicos

- **Não introduzir novas libs.** Usar shadcn `Sheet` (bottom-sheet), `Collapsible`/`Accordion`, `Tooltip` já presentes.
- **Persistência** via `useSyncedStorage` (já existe) para estados de sidebar/menu.
- **Tokens** — manter `bg-warning/text-warning-foreground`, `bg-destructive`, `text-success`. Nada de cores hardcoded.
- **Tipagem** — qualquer novo campo em `NavSection`/`NavGroup` (ex.: `groupLabel`) tipado em `src/lib/navigation.ts`.
- **Memória do projeto** — registrar nova entrada em `mem://produto/sidebar-acordeon-persistente` e `mem://produto/mobile-menu-acordeon` ao final, documentando chaves de localStorage (`avizee_sidebar_state`, `avizee_menu_section_state`) e regra "rota ativa abre automaticamente".

## Aceitação por fase

- **F1**: stat cards 3 colunas com valores compactos, Configurações apenas no rodapé, labels não mais truncados, "Notas de Entrada/Saída" completos no topbar com botão "Importar" único.
- **F2**: sidebar e menu mobile abrem fechados (exceto rota ativa), persistem entre sessões; cards de nota com novo layout; empty state com "Limpar filtros".
- **F3**: chips 3×2 no MobileMenu, ícones distintos + sub-grupos em Fiscal, badges com tooltip e expandidos para outros módulos.
- **F4**: user bar compacta, Social removido, texto de sync granular, Cadastros opcionalmente reorganizado.
