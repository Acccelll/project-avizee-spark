---
name: Administração mobile
description: Padrão mobile para o módulo /administracao — sidebar via Sheet, matriz read-only, sticky save, touch targets ≥44px
type: design
---

# Administração — Padrão Mobile (<lg)

## Navegação
- `AdminSidebar` em desktop (>=lg): coluna fixa `w-60`.
- Em mobile (<lg): renderizada dentro de `<Sheet side="left">` controlado por `Administracao.tsx`.
- Header sticky `top-0 z-20` com botão "Menu" + ícone+nome da seção ativa (resolve "onde estou").
- `inSheet` prop expande items para `py-3 min-h-11` e ícones `h-4 w-4`.

## Edição complexa = bloqueada em mobile
- `PermissionMatrix`: força `effectiveReadOnly = readOnly || isMobile` + Alert orientando uso em desktop.
- `PerfisCatalogoSection` aba "Matriz": Alert em mobile, sem render do grid cross-table. Aba "Por perfil" continua acessível.

## Listas e ações
- `UserRow`: card inteiro tappable em mobile (button absoluto z-0 + conteúdo z-10 pointer-events-none/auto). Botão Edit dedicado oculto em mobile. `⋯` com `h-11 w-11` (≥44px).
- `UserFilters`: search inline `h-11` + botão "Filtros (n)" abre `Sheet side="bottom"` com inputs full-width `h-11` e safe-area.
- `ToggleStatusDialog`/`ConfirmDialog`: já bottom-sheet via `max-sm:` no `ConfirmDialog`.

## Formulários longos
- `SectionShell`: barra Salvar com layout dual:
  - Desktop: inline no fim do conteúdo.
  - Mobile: `fixed bottom-0 z-30` com `pb-[max(0.5rem,env(safe-area-inset-bottom))]` e `min-h-11`. Container do shell ganha `max-sm:pb-24` para o conteúdo não ficar atrás.
- `UserFormModal`: stepper mobile (4 passos em edit, 3 em create) com indicador sticky no topo (Passo X de N + dots de progresso). Footer com Voltar/Próximo/Salvar `min-h-11`. Em desktop mantém scroll único + Cancelar/Salvar. Cada bloco usa `hidden` para ficar isolado por passo em mobile.
- `IntegracoesSection` SEFAZ: Textarea `rows={3}` em mobile (vs 4 desktop), `text-[11px] leading-snug`. Botão "Mostrar/Ocultar conteúdo" `w-full min-h-11` em mobile, alinhado abaixo da legenda em vez de inline.

## KPIs e skeletons
- `DashboardAdmin`: SummaryCards `grid-cols-2 sm:grid-cols-2 lg:grid-cols-4`.
- `UsuariosTab`: KPIs já em `grid-cols-2`. Loading = `Skeleton` (4 KPIs + 5 rows). Card de orientação `hidden md:block`.
- `PerfisCatalogoSection`: loading = `Skeleton`s (substitui `Loader2 + texto`).

## Touch targets
- Mínimo `min-h-11` (44px) em: sidebar items mobile, ⋯ menu, filtros sheet, save bar, modal footer, tabs.

## Não pode
- Editar matriz de permissões em mobile (forçado read-only).
- Renderizar `PermissaoMatrix` cross-table em mobile (Alert).
- Touch targets <40px em fluxos críticos.
