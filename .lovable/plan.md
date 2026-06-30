## Escopo confirmado

- Páginas afetadas: `/` (Dashboard, `src/pages/Index.tsx` + `src/pages/dashboard/*`) e o Shell global (`AppLayout`, Sidebar, Topbar, `PageShell`, `ModulePage`).
- Liberdade: reestruturar layout (Bento Grid no Dashboard, refino do Shell sem mudar navegação).
- Paleta: **manter** as cores institucionais atuais (#b2592c / #690500 + sand) — apenas estender tokens (níveis de superfície, sombras, gradientes).
- Tipografia: trocar Montserrat → **Space Grotesk (display)** + **DM Sans (body/UI)**, via `@fontsource`.
- Dark/Light: tratados com prioridade igual; ambos passam por contraste WCAG AA.
- Nada de mudanças de lógica/negócio: só camada visual e de motion.

## Plano de execução

### Etapa 1 — Tokens & arquitetura CSS (impacto global controlado)
Editar `src/index.css` e `tailwind.config.ts`:
- Introduzir escala de **superfícies** (`--surface-0/1/2/3`) derivadas de `--background` para empilhar cards no Bento sem cinza chapado; espelhar no dark.
- Adicionar tokens premium: `--shadow-soft`, `--shadow-elevated`, `--shadow-glow-primary`, `--gradient-hero`, `--gradient-card`, `--ring-focus`, `--border-strong`, `--border-subtle`.
- Curva de motion única: `--ease-emphasized: cubic-bezier(0.22, 1, 0.36, 1)`, `--ease-standard: cubic-bezier(0.4, 0, 0.2, 1)`; durações `--dur-1/2/3` (120/200/360 ms).
- Atualizar `fontFamily` no Tailwind: `display: ['Space Grotesk', ...]`, `sans: ['DM Sans', ...]`. Manter Montserrat apenas como fallback do PDF de orçamento (já self-hosted) — não tocar em `html2canvas`.
- Escala tipográfica fluida (`clamp(...)`) para `text-display`, `text-h1..h4`, e ajuste de `letter-spacing` em headings (-0.01em a -0.02em).
- Instalar fontes: `bun add @fontsource/space-grotesk @fontsource/dm-sans` e importar em `src/main.tsx`.

### Etapa 2 — Shell global (AppLayout / Sidebar / Topbar)
- **Sidebar**: fundo `--surface-1` com hairline `--border-subtle`; item ativo com pill arredondada (`rounded-lg`), barra acent à esquerda 2px no primário, `bg-primary/8` no light e `/12` no dark; ícones com transição `transform`+`color` em 200ms.
- Grupo colapsado: micro-tooltip refinado (Radix), sem jump de layout.
- **Topbar**: altura 56px, `backdrop-blur-md`, `bg-background/70`, hairline inferior; busca global com ring sutil no focus; avatar com anel `--ring-focus` no hover.
- **PageShell**: header sticky já existe — refinar com `border-b/40`, espaçamento 8pt e título em `font-display`.

### Etapa 3 — Dashboard em Bento Grid (`src/pages/Index.tsx` + componentes)
Reorganizar a home como mosaico responsivo de 12 colunas / linhas variáveis:

```text
┌───────────────────────────────┬──────────────────┐
│  HERO KPI (faturamento mês)   │  Saúde sistema   │
│  col-span-8 row-span-2        │  col-span-4 r-1  │
│                               ├──────────────────┤
│                               │  Ações rápidas   │
├───────────────┬───────────────┴──────────────────┤
│ KPI cards x3  │   Gráfico vendas (col-span-8)    │
│ col-span-4    │                                  │
├───────────────┼──────────────────────────────────┤
│ Pendências    │  Últimos orçamentos / pedidos    │
│ col-span-4    │  col-span-8                      │
└───────────────┴──────────────────────────────────┘
```

- `DashboardCard` ganha variantes `tone="hero" | "default" | "muted"` e `density="comfortable" | "compact"`; hero usa `--gradient-card` + `--shadow-elevated`.
- `QuickActions` vira grade 2x3 com hover lift (`translate-y-[-2px]` + shadow-soft), ícone em pill `--surface-2`.
- Charts (Recharts) consomem `chartColors.ts` (já existe) — só ajustar grid lines para `--border-subtle` e tooltip com glass.
- Skeletons substituídos por shimmer baseado em `--surface-1 → --surface-2`.
- Breakpoints: 1 coluna < md, 6 colunas md, 12 colunas lg+.

### Etapa 4 — Micro-interações & motion
- Utilitários novos em `src/index.css`: `.hover-lift`, `.press-down`, `.glass-panel`, `.focus-ring`.
- Entradas escalonadas na home: wrapper `StaggerOnMount` (CSS-only via `animation-delay` calculado por índice) aplicado aos cards do Bento — sem dependência nova.
- Botões shadcn: ajustar variant `default` para incluir `transition-[transform,background,box-shadow] duration-200 ease-[var(--ease-emphasized)]` e leve `active:scale-[0.98]`.
- Respeitar `prefers-reduced-motion` (já há suporte no tailwind animate; adicionar guarda nos utilitários novos).

### Etapa 5 — Pixel polish & acessibilidade
- Grid 8pt: varrer Dashboard + Shell e padronizar paddings/margens em múltiplos de 4/8.
- Focus visible consistente (`--ring-focus`) em todos os interativos (sidebar, topbar, cards clicáveis).
- Contraste: validar combinações novas com `src/utils/contrast.ts`; ajustar `--muted-foreground` no dark se necessário.
- Verificar `min-h-11` em alvos toque (já há `scripts/lint-touch-targets.mjs` — rodar).

### Etapa 6 — Verificação
- `bun run build` + `tsgo`.
- Playwright: screenshots de `/` em light e dark (mobile 390px, tablet 768px, desktop 1440px) salvos em `/tmp/browser/dash/screens/` para comparação antes/depois.
- Rodar `scripts/lint-touch-targets.mjs` e `bun test` (smoke do dashboard).

## O que NÃO será alterado
- Lógica de dados, hooks `useDashboard*`, services, RLS, permissões.
- Roteamento, navegação e rótulos.
- Paleta institucional (`--primary`, `--secondary`) — só extensão por superfícies/sombras/gradientes.
- Montserrat permanece carregada para o PDF do orçamento.

## Detalhes técnicos relevantes
- Fonts via `@fontsource` (sem CDN, sem `<link>` no `index.html`).
- Tokens só em `index.css` + `tailwind.config.ts`; nenhum `text-white`/`bg-[#...]` hardcoded em componentes.
- Dark mode usa as mesmas variáveis com valores em `.dark { ... }`.
- Sem novas libs de animação — apenas Tailwind animate (já presente) + CSS.
- Memórias relevantes a respeitar: `tech/design-system-tokens`, `tech/design-system-fontes-canonicas`, `produto/a11y-mobile-checklist`.

Aprovando este plano, mudo para build mode e executo etapa por etapa, fazendo verificação visual ao final.