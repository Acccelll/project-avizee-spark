

# Diagnóstico visual — Navegação (sidebar, submenus, mobile, breadcrumbs)

## Inventário visual atual

| Superfície | Estado |
|---|---|
| Sidebar desktop | Header logo + busca + Favoritos + Dashboard + 9 seções + Footer Configurações |
| Sidebar colapsada (72px) | Apenas ícones, com badge de módulo flutuante |
| Submenu expandido | Indentação `ml-3 + border-l`, items `text-[13px]`, ativo `bg-primary/10 text-primary` |
| Item ativo módulo | Apenas `text-primary` (sem fundo, sem barra) |
| Item ativo Dashboard/Footer | `bg-primary text-primary-foreground` (sólido — destoa) |
| Mobile bottom nav | 4 tabs + Menu |
| Mobile drawer (MobileMenu) | Cards com `border` por seção |
| Breadcrumbs | Sempre visíveis no AppHeader desktop |

## Problemas visuais reais encontrados

### 1. **Hierarquia ativo confusa — 3 estilos coexistem**
- Dashboard / Configurações usam `.sidebar-item-active` = **fundo primary sólido + texto branco** (chamativo, parece "principal").
- Header de seção ativo usa apenas `text-primary` (sem fundo, sem barra lateral) → **subutilizado, mal sinalizado**.
- Item de submenu ativo usa `bg-primary/10 text-primary` (suave).
- Favorito ativo usa `bg-primary/10 text-primary`.

Resultado: Dashboard sempre "grita" mesmo quando não é o foco; o header de seção (módulo atual) quase desaparece.

### 2. **Sem indicador de seção ativa quando o submenu está aberto**
Quando o usuário está em `/clientes` (Cadastros aberto), o **header "Cadastros"** muda só a cor do texto. Falta um indicador permanente (barra lateral, fundo sutil) que diga "este é o módulo atual".

### 3. **Item ativo do submenu sem barra lateral**
A border-l do container é uniforme/cinza. O item ativo só ganha pill colorido. Em ERPs maduros, a barra lateral colorida acompanha o item ativo, ancorando visualmente "você está aqui".

### 4. **Densidade desbalanceada**
- `.sidebar-item` (Dashboard/Config): `py-2.5`
- Header de seção: `py-2`
- Item de submenu: `py-1.5`
- Favorito: `py-1.5`
Diferenças visíveis. O Dashboard fica mais alto que tudo.

### 5. **Ícones sem peso consistente**
- Headers de seção: `h-[18px]`
- Dashboard/Config (sidebar-item): `h-5 w-5`
- Favorito: `h-3`
- Submenu: sem ícone
Tamanhos pulam de 12px a 20px sem padrão.

### 6. **Submenu sem ícones secundários**
Itens de submenu (Clientes, Produtos, Orçamentos…) **não têm ícone**, apenas texto. Em sidebars de ERP, ícones discretos de 14px ajudam o scan rápido. Hoje a leitura é puramente textual.

### 7. **Favoritos: estrela ocupa o espaço do ícone**
`<Star className="h-3 w-3 fill-warning">` — a estrela é tanto marcador "favorito" quanto faz papel de ícone do item. O usuário perde o vínculo visual com o módulo de origem (Cliente vs Produto vs Orçamento parecem iguais na lista de favoritos).

### 8. **Star button atrapalha alinhamento**
O botão de favoritar usa `opacity-0 group-hover:opacity-100` e fica **fora** do botão principal. Empurra o badge para a esquerda, gera reflow visual no hover.

### 9. **Header da sidebar pesado**
Logo (36px) + título "AviZee" + chip "ERP" + botão chevron — 4 elementos numa barra de 64px. Pode-se simplificar (logo + título; chevron menor).

### 10. **Search button visualmente solto**
`border bg-background` num bloco isolado entre logo e nav. Parece um input de formulário no meio da sidebar. Faltam linhas-guia (ou virar item parte do header).

### 11. **Badge inconsistente entre módulo e item**
- Módulo: `h-5 min-w-5 rounded-full text-[10px] font-bold`
- Item: `h-5 min-w-5 rounded-full text-[10px] font-semibold`
- Colapsado: `h-4 min-w-4 text-[9px]` flutuando no canto
Pequenas mas notáveis. Padronizar em um único token.

### 12. **Footer sem separação clara**
Apenas `border-t`. Texto "Última sincronização" ocupa espaço sem hierarquia. Botão Configurações usa o estilo "ativo agressivo" do Dashboard.

### 13. **Mobile MobileMenu — cards excessivos**
Cada seção é um `rounded-2xl border bg-card/70 p-4`. Resultado: muitos retângulos empilhados, parece lista de cards de produto, não menu. Hierarquia visual perdida; rolagem cansativa.

### 14. **MobileBottomNav — texto pequeno e ícones genéricos**
4 tabs com label `text-[11px]` (verificar). Sem indicador de tab ativo que respire (geralmente uma pill ou underline).

### 15. **Breadcrumbs no AppHeader sem ícone do módulo**
Mostra "Dashboard / Cadastros / Clientes" puro texto. O ícone do módulo (Users) ajuda muito a ancorar. Hoje só aparece como "page icon" do header (à parte).

### 16. **Tipografia tracking muito agressiva nos headers de seção**
`tracking-[0.2em]` + `text-[10px]` uppercase em "Favoritos" e nos títulos de grupo dentro do submenu. Em sidebar densa fica ilegível, parece código.

## Estratégia visual

**Princípio:** Reorganizar a hierarquia ativo (sutil → forte) e padronizar densidade/ícones. Sem refazer arquitetura.

### Fase 1 — Sistema de estados ativo (novo padrão)

Reescala em 3 níveis bem definidos:

| Nível | Onde | Visual |
|---|---|---|
| **Item folha ativo** | Submenu / Favorito / Dashboard / Config | Barra lateral 2px primary à esquerda + `bg-primary/10` + `text-primary font-medium` |
| **Seção ativa (header de módulo)** | Header de uma seção que contém a rota atual | `bg-primary/5` + `text-primary` + ícone primary |
| **Hover** | Qualquer item | `bg-accent text-foreground` |

Resultado: Dashboard e Configurações **deixam de usar fundo sólido primary** (que parecia "selecionado de menu superior"); ganham o mesmo tratamento dos demais itens-folha. Hierarquia coerente.

### Fase 2 — Densidade e tipografia padronizadas

- Todos os itens (header de seção, item folha, dashboard, config, favorito): `py-2 px-3`, `text-sm`
- Tokens de label de grupo: `text-[11px] font-semibold uppercase tracking-wider` (não `0.2em`)
- Ícones de header de seção: `h-[18px] w-[18px]`
- **Adicionar ícones de leaf** (`h-4 w-4 text-muted-foreground`) a cada item de submenu, derivados de `headerIcons`/`item.icon`
- Estrela do favorito: vira **botão lateral pequeno**, item mantém ícone do módulo

### Fase 3 — Submenu refinado

- Manter `border-l` mas com cor mais suave (`border-border/50`)
- Item ativo: **a border-l** se torna primary nesse trecho (via pseudo-elemento ou box-shadow inset). Cria a "barra de ancoragem" típica de ERP.
- Indentação reduzida: `ml-2 pl-3` (hoje `ml-3 pl-3` deixa muito profundo)
- Group label só aparece se a seção tem 2+ grupos (já é regra; manter)

### Fase 4 — Header e footer da sidebar

- Header: logo 32px + "AviZee" mono + chevron menor (`h-3.5`). Remover chip "ERP" (redundante).
- Search: virar item integrado, sem borda extra; usar `bg-muted/40` para parecer "campo discreto"
- Favoritos com label `text-[11px] uppercase tracking-wider` (mesmo do grupo de submenu)
- Footer: separador mais sutil; "Última sincronização" como `text-[10px] text-muted-foreground/70` com ponto de status colorido (verde se < 60s)

### Fase 5 — Sidebar colapsada (rail 72px)

- Tooltip nativo via `title` já existe; adicionar **chip flutuante mais polido** ao hover (já há `aria-label`)
- Indicador de seção ativa colapsada: barra vertical 3px primary à esquerda do ícone (em vez de só `text-primary`)
- Badge de módulo: padronizar como dot 8px (sem número) quando colapsado e número grande quando expandido — reduz ruído visual

### Fase 6 — Mobile

**MobileMenu (drawer):**
- Remover cards individuais; usar lista única com section headers `text-[11px] uppercase tracking-wider text-muted-foreground` + divider sutil
- Item: `flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-accent`
- Mantém ícone do módulo + label + chevron `→` à direita
- Atalhos rápidos: trocar cards coloridos por lista simples em destaque (ou manter no topo, mais compacta)

**MobileBottomNav:**
- Tab ativa: ícone preenchido + label + barra superior 2px primary OU pill background `bg-primary/10` no ícone
- Label `text-[10px] font-medium`
- Espaçamento vertical mais aerado

### Fase 7 — Breadcrumbs

- Adicionar ícone do módulo antes do nome do módulo (segundo item)
- Separador `chevron-right` mais sutil (`text-muted-foreground/40`)
- Último item (página atual) em `text-foreground font-medium`

## Componentes/arquivos afetados

- `src/index.css` — adicionar `.sidebar-item-leaf-active` e `.sidebar-section-active`, ajustar `.sidebar-item`
- `src/components/sidebar/SidebarSection.tsx` — header com novo estado ativo, padding/typography
- `src/components/sidebar/SidebarSectionItem.tsx` — adicionar ícone leaf, barra ativa, reorganizar star
- `src/components/sidebar/SidebarFavorites.tsx` — usar ícone do módulo (não estrela)
- `src/components/sidebar/SidebarFooter.tsx` — visual mais sutil + dot de status
- `src/components/AppSidebar.tsx` — header simplificado, search refinado, Dashboard usando estilo leaf
- `src/components/navigation/MobileMenu.tsx` — remover cards, lista unificada
- `src/components/navigation/MobileBottomNav.tsx` — tab ativa com pill/barra
- `src/components/navigation/AppBreadcrumbs.tsx` — ícone do módulo + separador sutil
- `src/lib/navigation.ts` — expor `icon` por leaf (já existe `headerIcons`; passar para `flatNavItems`)

## Fora do escopo
- Não alterar lógica de `useNavigationState`, permissões, rotas
- Não tocar drawers de detalhe (RelationalDrawerStack)
- Não mexer em `Administracao.tsx` interno
- Não alterar tokens de cor globais (`--primary`, `--secondary`, etc.) — reusa o que existe

## Critério de aceite
- 3 níveis de ativo claros e consistentes em todas as superfícies
- Dashboard e Configurações deixam de "gritar" como botões selecionados primários
- Header de seção do módulo atual fica visualmente ancorado
- Item folha ativo tem barra lateral primary acompanhando o `border-l`
- Submenu ganha ícones discretos e leitura mais rápida
- Favoritos mostram ícone do módulo (não estrela como ícone)
- Mobile drawer parece menu, não lista de cards
- Bottom nav com tab ativa evidente
- Breadcrumb com ícone do módulo
- Build OK; sem regressão funcional

## Entregáveis
Resumo final por superfície (sidebar desktop, sidebar colapsada, submenu, favoritos, footer, mobile drawer, bottom nav, breadcrumbs).

