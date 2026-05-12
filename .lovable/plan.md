# Reformulação do Menu Mobile — Pacote completo

Objetivo: transformar o `MobileMenu` de "lista infinita" em um hub navegável, contextual por perfil, com hierarquia visual forte e atalhos personalizáveis. Mantém o `MobileBottomNav` e o sidebar desktop intactos.

## Wave 1 — Estrutura e densidade (impacto alto, baixo risco)

**Accordion real (1 grupo aberto por vez)**
- Substituir o render flat por `Accordion` (shadcn) com `type="single" collapsible`. Estado controlado e persistido em `localStorage` (`erp:mobile-menu:open-section`) para reabrir o último grupo do usuário.
- Ícone do grupo + título + chevron + badge agregado (vem de `useSidebarBadges.moduleBadges`).

**Densidade −12% e drawer 86%**
- Reduzir altura de itens de `py-2.5` → `py-2`, gap `gap-3` → `gap-2.5`, tipografia `text-sm` para itens, `text-[11px] uppercase` para labels.
- Drawer: `max-h-[88vh]` + largura efetiva `w-[86vw]` (deixa overlay visível à direita, percepção de painel lateral, não modal).

**Destaque do módulo/item ativo**
- Item ativo: barra lateral 3px `bg-primary` + fundo `bg-primary/8` + ícone preenchido + texto `font-semibold`.
- Grupo que contém a rota ativa: aberto por padrão, label em `text-foreground` (não `muted`).

**Remover duplicidade com bottom-nav**
- Hoje seções `comercial/cadastros/financeiro` aparecem no menu com aviso "também na barra inferior". Mover para um bloco recolhido único `Atalhos da barra inferior >` (collapsed por default), eliminando ruído visual.

**Atalhos rápidos em grid 2×N**
- Atual: lista vertical com descrição. Novo: grid 2 colunas, card compacto (ícone + título), sem descrição (descrição vai pro `aria-label`).

## Wave 2 — Personalização e hub inteligente

**Atalhos personalizáveis por usuário**
- Nova `user_preference` `mobile_quick_actions` (array de `quickAction.id`).
- Botão "Editar atalhos" abre sheet com todos os `quickActions` permitidos + drag-to-reorder + toggle visível/oculto. Limite 6.
- Fallback: lista atual quando preferência ausente.

**Recentes (últimas 5 rotas visitadas)**
- Hook `useRecentRoutes` que escuta `useLocation` e mantém ring buffer de 5 em `localStorage` (`erp:recent-routes`), de-duplicado por path.
- Renderiza acima de "Favoritos" no menu. Cada item: ícone do `flatNavItems` + título.

**Favoritos no mobile**
- Reaproveitar `useFavoritos` (já existe, sincronizado via `user_preferences`). Estrela tappable em cada item leaf do menu para alternar.
- Render de "Favoritos" abaixo dos atalhos (acima dos Recentes).

**Badges operacionais nos grupos**
- Já temos `useSidebarBadges.moduleBadges`. Renderizar count colorido (`tone: danger|warning|info`) ao lado do título do grupo no accordion.
- Tooltip/aria-label com detalhamento ("12 vencendo hoje").

**Cabeçalho do menu como hub**
- Substituir "Menu" simples por bloco com: avatar, nome do usuário, cargo, empresa, indicador online (verde) e contador de notificações (link para `NotificationsPanel`).

## Wave 3 — Busca global e perfis operacionais

**Busca integrada ao menu**
- O botão "Buscar" no topo do `MobileMenu` já abre `GlobalSearch` (cmdk com fuzzy + entidades). Adicionar:
  - Atalhos de comando (`/orc novo` → ação criar orçamento) via prefix matching nos `quickActions`.
  - Recentes da busca já existem (`erp:global-search:recent`); expor no card vazio.
- Ajustes mobile: input maior (h-12), keyboard auto-focus opcional via prop.

**Perfis operacionais (modo de visão)**
- Nova `user_preference` `nav_profile`: `'completo' | 'comercial' | 'financeiro' | 'fiscal' | 'logistica' | 'diretoria'`.
- Tabela de mapeamento `PROFILE_SECTION_KEYS` em `src/lib/navigation/profiles.ts` (quais seções cada modo prioriza).
- `useVisibleNavSections` ganha filtro adicional: se `nav_profile !== 'completo'`, prioriza as seções do perfil e move o restante para um grupo recolhido `Outros módulos >`.
- Permissão (`useCan`) sempre prevalece — perfil só esconde, nunca expõe.
- Seletor no cabeçalho do menu (chip clicável → bottom sheet com radio).

**Ocultar admin avançado no mobile**
- Itens `Migração de Dados`, `Auditoria de Duplicidades`, `Auditoria` — só aparecem no mobile se `nav_profile === 'completo'` OU usuário expandiu "Mais opções >".

## Arquitetura técnica

```text
src/
  lib/navigation/
    index.ts                  # re-export do navigation.ts atual
    profiles.ts               # PROFILE_SECTION_KEYS + tipos
  hooks/
    useRecentRoutes.ts        # NOVO — ring buffer 5 itens
    useNavProfile.ts          # NOVO — wrap useUserPreference('nav_profile')
    useMobileQuickActions.ts  # NOVO — wrap useUserPreference('mobile_quick_actions')
    useFavoritos.ts           # já existe
    useSidebarBadges.ts       # já existe — reuso direto
  components/navigation/
    MobileMenu.tsx            # refactor para usar Accordion + sub-componentes
    mobile/
      MobileMenuHeader.tsx    # NOVO — hub com avatar/notif/perfil
      MobileQuickActionsGrid.tsx  # NOVO — grid 2×N + botão editar
      MobileQuickActionsEditor.tsx # NOVO — sheet de personalização
      MobileMenuFavorites.tsx # NOVO — reuso do useFavoritos
      MobileMenuRecents.tsx   # NOVO
      MobileMenuSection.tsx   # NOVO — AccordionItem por seção
      MobileNavProfileChip.tsx # NOVO — chip + bottom sheet de troca
```

`MobileMenu.tsx` final fica < 120 linhas (orquestrador). Sub-componentes ≤ 80 linhas cada.

## Migração de banco

Nenhuma — `user_preferences` já existe e suporta JSON livre por `(user_id, module_key)`. Novas chaves: `mobile_quick_actions`, `nav_profile`. Sem alteração de schema.

## Critérios de aceite

- Mobile (375px): menu abre em < 200ms, scroll vertical reduzido em ≥ 40% no usuário admin (todos os módulos visíveis).
- Apenas 1 accordion aberto por vez; estado persiste entre sessões.
- Trocar `nav_profile` para "Financeiro" reduz seções renderizadas no menu (admin geral mantém acesso completo via "Outros módulos").
- Atalhos personalizados persistem entre dispositivos do mesmo usuário.
- Favoritos e recentes funcionam offline (localStorage para recents, fallback de favoritos para guest).
- Permissões continuam fonte de verdade — perfil nunca abre acesso, só oculta.
- `useSidebarBadges` mostra contadores nos grupos (financeiro, fiscal, comercial, estoque, administracao).
- Lighthouse mobile do `/` permanece ≥ score atual (sem regressão de TTI).

## Fora do escopo

- Sidebar desktop (mantido como está).
- Refator do `MobileBottomNav` (já tem tabs contextuais).
- Mudanças no `GlobalSearch` além de polimento mobile (input maior, atalhos de comando como item futuro).
- "Hub KPI" embutido no menu além das badges agregadas (KPIs detalhados ficam no Dashboard).
