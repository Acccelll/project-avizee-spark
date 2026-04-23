

# Revisão transversal — ERP mobile (estado real)

Análise consolidada com base nas 7 revisões mobile já feitas (Comercial, Compras, Estoque/Logística, Financeiro, Fiscal, Relatórios, Administração, Configurações), no shell global (`AppLayout`, `MobileBottomNav`, `MobileMenu`), nos contratos doutrinários (`contrato-de-status`, `contrato-de-periodos`, `quando-drawer-quando-pagina`) e no estado atual do código.

---

## 1. O sistema é utilizável no mobile hoje?

**Sim, com escopo bem definido.** O ERP atingiu um patamar **operacional em mobile** para 80% dos fluxos do dia a dia comercial/operacional, mas **não substitui o desktop** para tarefas de configuração e análise profunda.

**Fluxos plenamente viáveis no celular hoje:**
- Comercial: criar orçamento, aprovar, gerar pedido, faturar (com sticky footer + ações primárias contextuais).
- Financeiro: dar baixa em título, conciliar OFX simples, ver vencimentos do dia (banner + calendário sheet).
- Fiscal: confirmar NF, emitir DANFE, registrar devolução simples.
- Estoque: ajuste rápido via bottom-sheet a partir do banner "Abaixo do mínimo".
- Logística: rastrear entrega, registrar recebimento.
- Compras: avaliar propostas e selecionar fornecedor.
- Cadastros: visualizar e editar dados simples de cliente/fornecedor/produto.

**Fluxos que ainda exigem desktop (intencionalmente bloqueados):**
- Edição da matriz de permissões (`PermissionMatrix` é `readOnly` em mobile por design).
- Edição complexa de itens de orçamento/pedido com muitos itens (vai para página, não drawer).
- Workbook gerencial e apresentação de slides (densidade Excel).
- Configuração de SMTP/A1/SEFAZ (textareas longas, certificados).

**Conclusão:** o sistema é hoje um **"ERP mobile-capable", não mobile-first**. Um vendedor/gestor consegue rodar a operação inteira do celular; um administrador/contador ainda precisa do desktop em momentos pontuais.

---

## 2. Principais bloqueios críticos restantes

| # | Bloqueio | Onde | Impacto |
|---|---|---|---|
| **B1** | Tabelas legadas sem `mobileStatusKey/mobilePrimaryAction` | Cadastros (Produtos, Transportadoras, Funcionários, Sócios, Formas Pagamento, Grupos Econômicos), Plano de Contas, Contas Bancárias | Card mobile vira lista cinza sem hierarquia nem ação rápida |
| **B2** | Páginas de **edição com itens dinâmicos** sem padronização mobile | `OrcamentoEdit`, `PedidoEdit`, `PedidoCompraEdit`, `NotaFiscalEdit` (rota `:id/editar`) | Forms longos sem stepper, sticky footer ausente em algumas, botões de ação dispersos |
| **B3** | Dashboard inicial (`/`) sem revisão mobile dedicada | `Index.tsx` | Provável KPIs empilhados, gráficos largos, scroll excessivo |
| **B4** | `Auditoria` e `Migração` (módulos externos linkados pela Administração) sem revisão | `/auditoria`, `/migracao` | Tabelas longas com filtros laterais, exportação |
| **B5** | Módulo **Social** sem revisão (mesmo com feature flag) | `/social/*` | Feeds e métricas — UX desktop puro |
| **B6** | `RelationalDrawerStack` empilha drawers em mobile sem indicador de profundidade | shell global | Usuário se perde após 2-3 níveis de drill (cliente → orçamento → NF) |
| **B7** | Hotkeys e Global Search sem equivalente mobile real | `GlobalSearch`, `useGlobalHotkeys` | Atalho `Cmd+K` é o ponto de entrada primário no desktop; em mobile só via header |

---

## 3. Principais padrões problemáticos recorrentes

1. **Tabelas sem props mobile** — 16 arquivos usam `mobileStatusKey/mobilePrimaryAction`, mas existem **dezenas** de `<DataTable>` sem essas props (todos os cadastros simples). Quando faltam, o card vira lista vertical de label:value cinza, ilegível.

2. **Forms longos sem sticky footer** — padrão "sticky save quando dirty" foi aplicado em Configurações, Administração (SectionShell) e Comercial (OrcamentoForm), mas **não está difundido** em: Plano de Contas, Contas Bancárias, Formas de Pagamento, Grupos Econômicos, Funcionários, edição de Produtos.

3. **AlertDialog/Dialog em mobile sem virar bottom-sheet** — Comercial, Financeiro, Fiscal, Compras já migraram. Faltam: confirmações genéricas espalhadas em cadastros, dialogs de import (XML, CSV), confirmação de exclusão em vários módulos.

4. **Touch targets <44px** — `h-8`, `h-9`, ícones `h-3.5/h-4` em ações inline aparecem em pelo menos 30% dos componentes de listagem fora do escopo já refatorado.

5. **`Tabs` horizontais sem overflow indicator** — só Configurações tem o gradiente. Outras telas com 4+ tabs (Logística 3, Estoque 4+, Administração 7+ via sidebar, FluxoCaixa abas) carecem.

6. **Filtros como barra horizontal vs bottom-sheet** — Financeiro, Comercial, Fiscal, Relatórios, Administração migraram. Faltam: Estoque, Logística, Compras (UserFilters do tipo legado), Cadastros.

7. **Skeletons inconsistentes** — `Loader2 + texto` ainda aparece em vários lugares apesar do `Skeleton` shadcn estar disponível.

8. **Bottom nav só leva à rota principal de cada módulo** — corrigido recentemente removendo o filtro do MobileMenu, mas a redundância visual ("• também na barra inferior") é um sintoma de que **a separação bottom-nav vs drawer poderia ser repensada** (ex: bottom nav contextual por módulo ativo).

9. **`PeriodFilter` não está em todo módulo com data** — contrato existe (`contrato-de-periodos`), mas Estoque/Movimentações, Auditoria, Social ainda usam date pickers ad-hoc.

10. **`Status` como texto cinza em vez de pill** — contrato de status existe, mas DataTable mobile sem `mobileStatusKey` faz fallback errado.

---

## 4. Componentes que precisam ser repensados globalmente

### 4.1 `DataTable` → `MobileCardList`
**Problema:** props mobile são opcionais. Quando ausentes, o card mobile não tem hierarquia.
**Proposta:** introduzir um **modo "auto"** que:
- Detecta automaticamente a coluna de status (heurística: nome `status|situacao|tipo|criticidade` + componente `StatusBadge`).
- Detecta o identificador (1ª coluna textual não-numérica).
- Falha de forma audível em dev (`console.warn`) quando uma DataTable >5 colunas roda em mobile sem props mobile.

### 4.2 `RelationalDrawerStack`
**Problema:** drawers empilhados em mobile cobrem 100% da tela e perdem contexto de profundidade.
**Proposta:** breadcrumb sticky no topo do drawer ativo mostrando a pilha (`Cliente / Orçamento #123 / NF 4567`) com tap em qualquer nível voltando ao drawer correspondente. Limite efetivo `MAX_DRAWER_DEPTH=3` em mobile (já é 5 hoje).

### 4.3 `FormModal` / `Dialog` / `AlertDialog`
**Problema:** convenção atual exige checar `useIsMobile()` e aplicar classes `max-sm:` manualmente em cada uso.
**Proposta:** wrapper `<ResponsiveDialog>` que:
- Em desktop renderiza `Dialog`.
- Em mobile renderiza `Sheet side="bottom"` com sticky footer + safe-area embutidos.
- API uniforme: `header`, `body`, `primaryAction`, `secondaryAction`, `destructiveAction`.
Deprecar uso direto de `AlertDialog` em fluxos com decisão (mantém só para erros bloqueantes).

### 4.4 `MobileBottomNav` + `MobileMenu`
**Problema:** bottom nav é estático (Início + Comercial + Cadastros + Financeiro + Menu) e duplica o que está no drawer.
**Proposta:** **bottom nav contextual** — quando o usuário está em "Financeiro", os 3 slots viram "Receber / Pagar / Fluxo"; em "Comercial" viram "Orçamentos / Pedidos / Novo". Slot "Início" e "Menu" fixos. Reduz cliques drasticamente.

### 4.5 `PeriodFilter` global no header mobile
**Proposta:** quando uma página tem `PeriodFilter`, ele aparece como **chip único no AppHeader mobile** (após o título) — toque abre bottom-sheet com presets. Hoje cada módulo posiciona em local diferente.

### 4.6 `ItemsGrid` (componente de itens dinâmicos)
**Problema:** padrão "cards mobile + tabela desktop" replicado em Orçamento, Pedido, Cotação, Pedido Compra, NF — mas com pequenas variações.
**Proposta:** consolidar em `<ItemsGrid>` único (já existe para Compras) e migrar Comercial e Fiscal para o mesmo componente.

### 4.7 `AdvancedFilterBar`
**Problema:** em desktop é uma barra ótima; em mobile não existe convenção única (cada módulo virou para Sheet de forma diferente).
**Proposta:** prop `mobilePresentation="sheet" | "drawer" | "inline"` no próprio componente, com sheet bottom como default.

---

## 5. Sugestão de abordagem mobile-first (próxima fase)

Hoje a arquitetura é "desktop-first com remendos mobile". Para evoluir para mobile-first sem refazer tudo:

### Princípios
1. **"Mobile é o piso, desktop é o teto"** — todo componente novo deve ser concebido para 360px primeiro, com `md:` adicionando densidade no desktop. O inverso (`max-sm:`) vira exceção justificada.
2. **"Uma ação primária por tela"** — mobile não comporta 5 CTAs no header. Identifique a ação esperada (Aprovar, Gerar Pedido, Confirmar NF, Baixar) e promova-a a sticky/full-width.
3. **"Tabelas são desktop-only por padrão"** — em mobile, **sempre** Card. Tabela só com opt-in explícito (`forceTable`) e raríssimo.
4. **"Edição complexa = página, não drawer"** (já doutrinado em `quando-drawer-quando-pagina`) — reforçar com lint de PR.
5. **"Bottom nav é contextual, não global"** — adapta-se ao módulo ativo, reduzindo profundidade de navegação.
6. **"Uma mão, polegar direito"** — todo CTA primário fica no terço inferior da tela; ações destrutivas no menu ⋯ ou no canto superior esquerdo.
7. **"Drawer responsivo = bottom-sheet em mobile"** — sem exceções; abolir `Dialog` em mobile para fluxos de decisão.

### Métricas-alvo
- Tempo de "abrir orçamento → aprovar" em mobile: **≤3 toques**.
- Tempo de "abrir título → baixar pago": **≤3 toques**.
- Tempo de "ver KPI dashboard → drill em conta": **≤2 toques + 1 scroll**.
- Touch target mínimo 100% das ações primárias: **≥44px** (lint).
- 100% das DataTables com `mobileStatusKey` quando há coluna de status (lint).

---

## 6. Lista de prioridades de correção (impacto × esforço)

### Tier S — Bloqueios sistêmicos (maior alcance)
- **S1.** Componente `<ResponsiveDialog>` único + migrar Dialog/AlertDialog críticos.
- **S2.** Auditoria sistemática de `<DataTable>` sem props mobile e correção em massa (16 já têm; mapear quantas faltam — provavelmente 20+).
- **S3.** `Index.tsx` (dashboard) revisão mobile dedicada — é a primeira tela.
- **S4.** Wrapper de tabela legada → `mobile auto-mode` com warn em dev.

### Tier A — Padrões recorrentes
- **A1.** Sticky footer "salvar quando dirty" generalizado em forms de Cadastros.
- **A2.** Filtros em bottom-sheet padronizado em Estoque, Logística, Compras.
- **A3.** `RelationalDrawerStack` com breadcrumb de profundidade em mobile.
- **A4.** `Tabs` horizontais com overflow indicator em todo o sistema.
- **A5.** Skeletons reais substituindo `Loader2 + texto` em loops residuais.

### Tier B — Módulos pendentes de revisão dedicada
- **B1.** Auditoria mobile.
- **B2.** Migração mobile.
- **B3.** Social mobile (feed, métricas, agenda).
- **B4.** Edição de itens dinâmicos (`OrcamentoEdit`, `PedidoEdit`, `NotaFiscalEdit` rota página).

### Tier C — Evoluções estruturais (mobile-first)
- **C1.** Bottom nav contextual por módulo ativo.
- **C2.** `PeriodFilter` global no header mobile.
- **C3.** Consolidar `ItemsGrid` para uso transversal (Comercial + Fiscal + Compras).
- **C4.** `AdvancedFilterBar` com `mobilePresentation` prop.

### Tier D — Polimento
- **D1.** Touch targets <44px residuais em ações inline de cards.
- **D2.** Tipografia mínima `text-xs` (12px) — eliminar `text-[10px]/[11px]` em conteúdo (manter só metadata).
- **D3.** Toasts longos truncados em mobile.

---

## 7. Roadmap de execução

### Fase 1 — Bloqueios sistêmicos (1 sprint)
| # | Etapa | Esforço |
|---|---|---|
| 1 | Auditoria de `<DataTable>` sem props mobile + matriz de cobertura | S |
| 2 | Adicionar `mobileStatusKey/mobileIdentifierKey` em todos os cadastros simples (Produtos, Transportadoras, Funcionários, Sócios, Formas Pgto, Grupos, Plano Contas, Contas Bancárias) | M |
| 3 | Criar `<ResponsiveDialog>` wrapper + migrar 3-5 dialogs de maior tráfego | M |
| 4 | Revisão mobile dedicada do `Index.tsx` (dashboard) | M |
| 5 | Documentar em `mem://produto/dashboard-mobile.md` + atualizar `mem://tech/design-system-fontes-canonicas.md` | XS |

### Fase 2 — Padrões recorrentes (1 sprint)
| # | Etapa | Esforço |
|---|---|---|
| 6 | Sticky footer "salvar dirty" em forms de Cadastros (8 telas) | M |
| 7 | Filtros bottom-sheet em Estoque, Logística, Compras | M |
| 8 | `RelationalDrawerStack` com breadcrumb de profundidade mobile + limite 3 níveis | S |
| 9 | `Tabs` overflow indicator global (helper `<ScrollableTabs>`) | S |
| 10 | Lint customizado: `DataTable` sem `mobileStatusKey` quando coluna de status existe + touch target <44px em ações primárias | S |

### Fase 3 — Módulos pendentes (1-2 sprints)
| # | Etapa | Esforço |
|---|---|---|
| 11 | Revisão mobile dedicada de `/auditoria` (filtros, exportação, tabela densa) | M |
| 12 | Revisão mobile de `/migracao` (steps de upload + validação) | M |
| 13 | Revisão mobile do módulo Social (feed, métricas, agenda de posts) | L |
| 14 | Padronização das páginas de edição de itens dinâmicos (`*Edit.tsx`) com sticky footer + stepper opcional | M |

### Fase 4 — Evolução mobile-first (2 sprints)
| # | Etapa | Esforço |
|---|---|---|
| 15 | `MobileBottomNav` contextual por módulo ativo + chip do módulo | L |
| 16 | `PeriodFilter` global no `AppHeader` mobile (autodetect via context) | M |
| 17 | Consolidar `<ItemsGrid>` único transversal (Comercial + Fiscal + Compras) | M |
| 18 | `AdvancedFilterBar` com `mobilePresentation` prop, default `sheet` | S |

### Fase 5 — Polimento (contínuo)
| # | Etapa | Esforço |
|---|---|---|
| 19 | Sweep de touch targets <44px residuais (lint guiado) | S |
| 20 | Sweep de tipografia `text-[10px]/[11px]` em conteúdo | XS |
| 21 | Toasts truncados + sweep de strings longas | XS |
| 22 | Memória `mem://produto/mobile-overview.md` consolidando contratos transversais | XS |

**Quick wins prioritários (próxima entrega):** 1, 2, 4, 9, 19.
**Estruturais de maior impacto:** 3, 8, 10, 15.
**Cobertura total dos módulos:** 11, 12, 13.

