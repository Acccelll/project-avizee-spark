

# Diagnóstico técnico — Overlays do sistema

## Inventário

| Tipo | Wrapper/Componente | Uso |
|---|---|---|
| Modal de formulário | `FormModal` (sobre `Dialog`) | cadastros (Funcionarios, Unidades, etc.) |
| Modal genérico | `Dialog` direto | ~30 lugares (ad-hoc) |
| Quick add | `QuickAddClientModal` | orçamento |
| Confirm | `ConfirmDialog` (sobre `AlertDialog`) | DataTable, ProdutoView, etc. |
| Confirm Promise-based | `useConfirmDialog` | 12+ páginas (descartar dirty) |
| Drawer detalhe | `ViewDrawerV2` (sobre `Sheet`) + `RelationalDrawerStack` | views de registro |
| Bottom-sheet mobile | `Drawer` (vaul) | MobileMenu, Notifications |
| Popover | `MultiSelect`, calendário, `Relatorios.saveNameOpen` | filtros, datas |
| Dropdown | `RowActions`, AppHeader, sidebar | menus de ação |
| Autocomplete inline | `AutocompleteSearch`, `ProductAutocomplete`, `FiscalAutocomplete` | seletores |
| Command Palette | `GlobalSearch` (CommandDialog) | busca global |

## Problemas reais encontrados

### 1. `window.confirm()` ainda em produção — bloqueia o thread
`Fiscal.tsx:262, 277` — duas chamadas nativas. UX inconsistente, ignora tema, não acessível, bloqueia o event loop. Resto do sistema migrou para `useConfirmDialog`.

### 2. `useConfirmDialog` perde a Promise se desmontado
Se a página desmontar enquanto o dialog está aberto, `resolverRef.current` nunca é chamado → Promise pendurada para sempre. Falta cleanup no unmount que rejeite/resolva como `false`.

### 3. `useConfirmDialog` não suporta loading async
A API resolve `boolean` imediatamente no clique; quem chamou faz a operação **depois**. Não há como manter o dialog aberto com spinner enquanto roda. `ConfirmDialog` aceita `loading`, mas o hook nunca expõe. Resultado: dialog fecha → ação roda em background → se falhar, usuário já navegou.

### 4. `ConfirmDialog` não trava ESC/click-outside durante loading
`onOpenChange={onClose}` (linha 39) chama `onClose` mesmo com `loading=true`. AlertDialog do Radix permite fechar por ESC, e `onClose` dispara abort sem cancelar a promessa real.

### 5. `FormModal.onClose` é chamado em qualquer mudança (incluindo abrir)
`<Dialog open={open} onOpenChange={onClose}>` — `onOpenChange` recebe boolean. Hoje o handler ignora o valor e sempre chama `onClose()`. Funciona por sorte (Radix só dispara em fechar), mas é frágil — basta o pai re-renderizar com prop nova para acionar fechamento espúrio. Padrão correto: `onOpenChange={(o) => { if (!o) onClose(); }}` (já usado em ContaContabilEditModal, ViewDrawerV2, etc — inconsistência).

### 6. FormModal não checa `isDirty` ao fechar
A pílula "Alterações não salvas" aparece, mas ESC/click-outside fecha sem confirmação. Cada página re-implementa isso manualmente (`useConfirmDialog` + handler customizado). Lógica de "guard dirty" deveria viver no FormModal via prop opcional `confirmOnDirty`.

### 7. Autocompletes inline com `setTimeout(setOpen(false), 200)` — race condition clássica
`ProductAutocomplete.tsx:42`, `FiscalAutocomplete.tsx:33`. Padrão antigo para "esperar o click acontecer antes do blur fechar". Quebra quando: (a) o usuário clica fora rápido (200ms é arbitrário), (b) o componente desmonta no meio (timer pendente vaza), (c) há scroll com touch (blur dispara mais cedo). Solução: usar `onMouseDown={e.preventDefault()}` no item da lista (já feito em ProductAutocomplete, mas não em FiscalAutocomplete) + click-outside listener (como `AutocompleteSearch` faz corretamente).

### 8. Dropdowns de overlay dentro de Dialog/Drawer perdem foco
Casos como `RowActions` dentro de drawer + popover de filtros aninhados: cada Radix root cria seu próprio focus-trap. Quando o nested fecha, o foco volta para o `body` (não para o trigger). Sem `restoreFocus` explícito, a navegação por teclado quebra.

### 9. Conflito Z-index / Portal entre overlays empilhados
`FormModal` usa `z-50` no overlay, `Dialog` aninhado também usa `z-50`. Quando há 3+ camadas (drawer → modal → confirm → toast), a ordem visual é determinada pela ordem de portal — frágil se um modal abre antes do outro. Não há sistema de stack-order centralizado.

### 10. `RelationalDrawerStack` mistura AlertDialog e Sheets sem coordenação
O `pendingPush` AlertDialog renderiza sempre que `pendingPush !== null`. Se o usuário já está com 2 drawers abertos e dispara um terceiro, o AlertDialog aparece **acima** de tudo (bom), mas ESC nele fecha o AlertDialog **e** o drawer top simultaneamente (Radix propaga keydown). Falta `onEscapeKeyDown={e.preventDefault()}` no AlertDialog enquanto ele está aberto.

### 11. Quick-add modal não usa `useSubmitLock`
`QuickAddClientModal` usa `useState(saving)` manual. Sem ref síncrona → duplo clique no submit cria 2 clientes. Padrão já existe (`useSubmitLock`) mas não foi adotado.

### 12. ConfirmDialog do DataTable mistura confirm + checkbox como children
`DataTable.tsx:780-784` injeta o checkbox "não perguntar novamente" como children do ConfirmDialog. Funciona, mas mistura responsabilidades. O checkbox grava no localStorage no momento do toggle, não no momento do confirmar — se usuário marcar e depois cancelar, a pref já foi salva.

### 13. Múltiplos padrões de `onOpenChange` para o mesmo objetivo
Coexistem 4 padrões para "fechar quando o boolean for false":
- `onOpenChange={onClose}` (FormModal, ConfirmDialog) — ignora valor
- `onOpenChange={(o) => !o && onClose()}` (ViewDrawerV2, SefazRetornoModal)
- `onOpenChange={(v) => { if (!v) { setOpen(false); ... } }}` (Clientes, Produtos)
- `onOpenChange={setOpen}` (MultiSelect, CommandDialog) — controlado direto

Falta padrão único + utilitário `closeOnly(onClose)` ou similar.

### 14. Selects/Calendars dentro de modais perdem scroll lock
`Popover` aberto dentro de `Dialog` faz Radix instalar dois `body { overflow: hidden }` simultaneamente. Quando o Popover fecha, ele restaura o scroll **antes** do Dialog fechar — o background scrolla brevemente. Visível em formulários longos com Calendar.

### 15. Notificações Drawer (vaul) renderiza mesmo desmontado
`NotificationsPanel.tsx:182-183` envolve `<div onClick=…>{trigger}</div>` + Drawer. Toda re-render do pai re-monta o Drawer. Vaul guarda animation state internamente — pode ficar travado em "closing".

### 16. Falta tipagem central para handlers de overlay
Cada overlay define seu próprio `{ open, onClose }` ou `{ open, onOpenChange }`. Sem tipo `OverlayProps` compartilhado → impossível fazer wrappers genéricos.

## Estratégia de correção

### Fase 1 — `useConfirmDialog` v2 (corrige #1, #2, #3, #4)
1. Adicionar suporte a Promise async no confirm: `confirm(opts, asyncAction?)` — se `asyncAction` for passada, mantém dialog aberto com `loading=true` até resolver, fecha no sucesso, mantém aberto + toast no erro.
2. Cleanup no `useEffect` de unmount que rejeita resolver pendente.
3. Bloquear ESC/click-outside enquanto `loading=true` (passar `loading` para `ConfirmDialog` + `onOpenChange={(o) => { if (!o && !loading) onClose(); }}`).
4. Substituir os 2 `window.confirm` em `Fiscal.tsx`.

### Fase 2 — `FormModal` com guard de dirty (corrige #5, #6)
1. Padronizar `onOpenChange={(o) => { if (!o) handleClose(); }}` no FormModal.
2. Aceitar prop opcional `confirmOnDirty?: boolean` (default false). Quando true e `isDirty`, intercepta o close e dispara `useConfirmDialog` interno antes de chamar `onClose`.
3. Remover guards manuais redundantes nos consumidores (próxima fase, fora deste escopo).

### Fase 3 — Padronizar autocompletes inline (corrige #7)
1. Migrar `ProductAutocomplete` e `FiscalAutocomplete` para o padrão de `AutocompleteSearch`: click-outside listener + `onMouseDown` preventDefault no item, sem setTimeout.
2. Não unificar componentes (escopos diferentes), apenas remover o anti-pattern.

### Fase 4 — Helper `closeOnly` + tipagem (corrige #5, #13, #16)
1. Criar `src/lib/overlay.ts` exportando:
   ```ts
   export type OverlayProps = { open: boolean; onClose: () => void };
   export const closeOnly = (onClose: () => void) => (open: boolean) => { if (!open) onClose(); };
   ```
2. Aplicar em FormModal, ConfirmDialog, ViewDrawerV2 (mantém compat).

### Fase 5 — `useSubmitLock` no QuickAddClientModal (corrige #11)

### Fase 6 — DataTable: corrigir momento de salvar pref (corrige #12)
Mover `localStorage.setItem('datatable:skip-delete-confirm', ...)` para dentro do `onConfirm`, não no toggle.

### Fase 7 — Fix RelationalDrawerStack ESC (corrige #10)
Adicionar `onEscapeKeyDown={(e) => { e.preventDefault(); cancelPendingPush(); }}` no AlertDialogContent.

## Fora do escopo
- Não unificar Dialog vs Drawer vs Sheet — propósitos distintos.
- Não migrar todos os consumidores de FormModal para `confirmOnDirty` (refactor amplo, próxima requisição).
- Não tocar em GlobalSearch (CommandDialog) e MobileMenu (vaul) — comportamento OK.
- Z-index global / stack manager: complexo demais para esta passada (item #9 fica como nota técnica).

## Critério de aceite
- Zero `window.confirm` no código.
- `useConfirmDialog` aceita ação async com loading anti-fechamento.
- Cleanup no unmount evita Promise pendurada.
- Autocompletes sem `setTimeout` arbitrário.
- FormModal expõe `confirmOnDirty` (opt-in).
- Quick-add cliente protegido contra duplo clique.
- DataTable salva pref "não perguntar" só após confirmar.
- ESC no AlertDialog do drawer-stack não fecha drawer abaixo.
- Build OK (`tsc --noEmit`); zero regressão funcional.

## Entregáveis
Resumo final por tipo: confirm dialogs, form modals, autocompletes inline, quick-add, drawer-stack, DataTable.

