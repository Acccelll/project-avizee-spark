## Objetivo

Aproximar visualmente o `MobileMenu` da referência: header enxuto (só "Menu" + X), grid 3×N de atalhos com card vertical (ícone topo, label embaixo), seções em UPPERCASE sem ícone com badge à direita ("N itens" ou colorido por alerta), e rodapé fixo com avatar + tema/configurações/sair. Modo de visão e Favoritos/Recentes ficam preservados funcionalmente, ocultos por padrão.

## Escopo

Apenas o menu mobile (`MobileMenu.tsx` + componentes em `src/components/navigation/mobile/`). Sem alterar permissões, hooks de dados ou outros módulos.

## Mudanças

### 1. `MobileMenuHeader` → simplificar
- Remove avatar, nome, role e chip "Modo: …" do topo.
- Vira só **título "Menu"** à esquerda + botão **X** à direita (usa o close nativo do `Sheet` ou um `SheetClose` explícito alinhado).
- Sem notificações no header (já existem no `AppHeader`).

### 2. `MobileQuickActionsGrid` → grid 3 colunas, card vertical
- `grid-cols-3 gap-2`.
- Cada card: `flex-col items-center justify-center`, altura ~76px, ícone grande no topo (`h-5 w-5`) dentro de um quadrado `bg-primary/10 rounded-md`, label `text-[11px] text-center mt-1.5`.
- Usa o **ícone real** do `quickAction` (hoje todos usam `Plus` placeholder). Adicionar campo `icon?: LucideIcon` em `quickActions` (`src/lib/navigation.ts`) ou mapear por `id` localmente — preferir mapear para evitar tocar fora.
- Botão "Editar" continua, mas como link discreto (`text-[10px]`) acima do grid à direita.
- Limite visual de 6 mantém compatível com referência (2 linhas × 3).

### 3. `MobileMenuSection` → uppercase, sem ícone, contador
- Trigger: remove ícone do módulo. Texto `text-xs font-semibold uppercase tracking-wider`.
- Lado direito: 
  - se houver `BadgeInfo` com `count>0` → pill colorido (mantém `BADGE_TONE_CLASS`) com texto `"N pendentes"` (warning/danger) ou `"N alertas"` (info).
  - senão → contador neutro `"N itens"` em `text-[11px] text-muted-foreground`.
- Chevron menor (`h-3 w-3`).
- Itens internos: mantém atual (com favoritar via star).
- Direct-link sections (sem itens): mesmo trigger uppercase, mas sem accordion — clicável direto.

### 4. `MobileMenu` (rewrite parcial)
- Layout em 3 zonas: **header sticky** / **scroll content** / **footer sticky**.
- **Header** (top, `border-b`): "Menu" + X.
- **Scroll content**:
  - Busca compacta (mantém).
  - "ATALHOS RÁPIDOS" label + grid 3-col.
  - Favoritos e Recentes: **renderizados apenas dentro de um `Collapsible` "Mais" colapsado por padrão** (preserva Wave 2 sem poluir). Se ambos vazios, omite o Collapsible.
  - Accordion de módulos (mantém lógica de partition por perfil; agora com novo header). "Outros módulos" colapsado mantém-se quando perfil ≠ completo.
  - Toggle "Mostrar opções avançadas" continua.
- **Footer sticky** (`border-t bg-background`): linha única com:
  - Avatar redondo (iniciais) + `nome` + `cargo` à esquerda (truncado).
  - Botões icon-only à direita: Modo de visão (ícone `LayoutGrid`/`Compass`), Tema (`Sun`/`Moon`), Configurações (`Settings`), Sair (`LogOut` em `text-destructive`).
- Modo de visão acionado pelo ícone do footer abre o `MobileNavProfilePicker` existente.
- "Minha conta" e "Aparência" deixam de ter linhas próprias — substituídos pelos ícones do footer (Configurações cobre ambos via `/configuracoes`).

### 5. `quickActions` ícones
- Mapeamento local em `MobileQuickActionsGrid` (não tocar em `lib/navigation.ts`):
  - `nova-cotacao` → `FileText`
  - `novo-cliente` → `UserPlus`
  - `novo-produto` → `Package`
  - `novo-pedido-compra` → `ClipboardList`
  - `nova-nota-saida` → `Receipt`
  - `baixa-financeira` → `Wallet`
- Fallback `Plus` quando `id` desconhecido.

## Fora de escopo

- Sidebar desktop, `MobileBottomNav`, `GlobalSearch`.
- Mudanças em `useFavoritos`, `useRecentRoutes`, `useNavProfile`, `useMobileQuickActions`, `useSidebarBadges` — só consumidos.
- Personalização do footer (ordem de ícones).

## Critérios de aceitação

- Em 530×620 (viewport atual), o menu reproduz: header "Menu" + X / busca / "ATALHOS RÁPIDOS" + grid 3×2 / seções uppercase com contadores / footer com avatar + 4 ícones.
- Favoritos e Recentes acessíveis via "Mais" (oculto por padrão, sem regressão funcional).
- Modo de visão acessível via ícone no footer.
- Badges coloridos aparecem nas seções com alerta (ex.: COMERCIAL "N pendentes").
- Nenhum hook ou tipo novo; só ajustes em componentes mobile existentes.
