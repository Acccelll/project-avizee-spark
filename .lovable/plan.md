

# Diagnóstico visual — Overlays

## Inventário visual

| Tipo | Largura | Padding | Header | Footer |
|---|---|---|---|---|
| `Dialog` (shadcn) | `max-w-lg` | `p-6` uniforme | título sem divisor | sem divisor |
| `AlertDialog` | `max-w-lg` | `p-6` | sem ícone, sem divisor | botões espaçados c/ `space-x-2` |
| `FormModal` | `sm/md/lg/xl` | header `px-6 pt-5 pb-3`, body `px-6 py-4`, footer `px-6 py-3` | divisor border-b ✓, dirty pill | divisor border-t ✓ |
| `Popover` | `w-72` fixo | `p-4` | — | — |
| `DropdownMenu` | `min-w-[8rem]` | `p-1` | — | — |
| `RowActions` Dropdown | `w-48` | `p-1` | — | — |

## Problemas reais

### 1. `DialogContent` sem zonas (header/body/footer fluidos)
~30 dialogs ad-hoc usam `Dialog` direto + `gap-4` + `p-6` em todo o bloco. Header, conteúdo e footer ficam visualmente colados (sem hairlines), e quando há scroll interno (`max-h-[85vh] overflow-y-auto`), header e footer **scrollam junto** — perdendo contexto e ações fora da viewport.

### 2. `AlertDialog` não tem ícone semântico
Confirms destrutivos (excluir, descartar) e neutros (avisos) usam o mesmo visual: título sólido + texto cinza. Falta um ícone de alerta (warning/destructive) ao lado do título para acelerar leitura. Padrão Linear/Notion: ícone colorido `h-5 w-5` + título.

### 3. `AlertDialogFooter` separa botões com `space-x-2` (8 px) — pouco peso
Cancelar (outline) e Confirmar (destructive) ficam grudados. Em decisões irreversíveis, a separação visual deveria ser maior (`gap-3`) e a ação destrutiva deveria ter prioridade visual clara (já tem `bg-destructive`, mas o cancel outline desaparece ao lado).

### 4. `DialogFooter` justifica à direita em desktop, mas ações destrutivas no canto
Quando há ação destrutiva + cancelar + confirmar no mesmo modal (ex: BaixaParcialDialog), tudo encosta à direita. Falta padrão "destrutiva à esquerda, primária à direita" (já implementado no `DrawerStickyFooter`, mas não no `DialogFooter`).

### 5. `Popover` largura fixa `w-72` (288 px)
Conteúdo curto sobra ar; conteúdo longo (filtros multi-select) é apertado. Falta variação por uso. Usado em `MultiSelect`, calendário, `Relatorios.saveNameOpen`.

### 6. `Popover` padding `p-4` muito generoso para listas
Quando o popover contém uma lista (calendar, MultiSelect), o `p-4` cria margem interna que compete com o padding dos itens. Padrão melhor: `p-0` quando há lista interna; `p-4` apenas para forms/info.

### 7. `DropdownMenuItem` com altura inconsistente
`px-2 py-1.5` (24 px de altura útil) — itens com ícone parecem apertados. Padrão Notion/Linear: `py-2` (32 px) com `gap-2` entre ícone e texto. Em `RowActions`, ícone usa `mr-2` (margin) em vez de `gap` — irregular quando item não tem ícone.

### 8. `RowActions` dropdown `w-48` arbitrário
Largura fixa quebra labels longos ("Duplicar para outro mês"). Deveria ser `min-w-[12rem]` + auto.

### 9. Botão fechar do `DialogContent` ocupa o canto direito (`right-4 top-4`) e colide com título
Em modais com título longo, o `<X>` fica em cima da última palavra. Falta `pr-10` no header ou recuo do botão.

### 10. `FormModalFooter` usa `justify-between` mesmo sem dirty/saving
Quando não há status, o lado esquerdo fica vazio e os botões ficam comprimidos no canto direito. Em telas md+, dá impressão de footer desbalanceado.

### 11. `AlertDialogTitle` é `text-lg` (igual ao body do modal)
Sem hierarquia visual entre título e descrição em alguns temas. Padrão: título `text-base font-semibold` + descrição `text-sm text-muted-foreground` com `mt-1.5` apertado, ou aumentar título para `text-[17px]`.

### 12. `DialogContent` sem `max-h` por padrão
Modais ad-hoc precisam declarar `max-h-[85vh] overflow-y-auto` manualmente. Quem esquece quebra em laptops 720p. Default deveria proteger.

### 13. Ícones de ações no DropdownMenu sem opacidade
Em `RowActions`, ícones ficam com mesmo peso visual do texto. Padrão melhor: ícone `text-muted-foreground` (ou `opacity-70`), texto sólido — guia o olho para o label.

### 14. Animação `zoom-in-95` + `slide-from-top-[48%]` exagerada
Modais entram com salto perceptível. ERPs maduros usam `zoom-in-[0.98]` + `fade` apenas. O slide vertical de 48% causa flash no laptop.

## Padrão-base proposto

### Dialog (modal genérico)
- `gap-0` no Content (zonas próprias controlam espaçamento)
- `p-0` no Content; header `px-6 pt-5 pb-4 border-b`, body `px-6 py-5 overflow-y-auto`, footer `px-6 py-3.5 border-t bg-muted/20`
- `max-h-[85dvh]` por padrão; corpo flex-1 com scroll
- Header com `pr-10` para reservar espaço do `<X>`
- Animação: `zoom-in-[0.98] fade-in` (sem slide vertical)

### AlertDialog (confirm)
- Header com slot de ícone opcional: `<Icon className="h-5 w-5 text-destructive">` para destructive, `text-warning` para warn, `text-primary` para neutro
- Título `text-[17px] font-semibold tracking-tight`
- Descrição `text-sm text-muted-foreground mt-1.5 leading-relaxed`
- Footer com `gap-3` (não `space-x-2`); destructive ganha sombra leve `shadow-sm`
- Animação suave (igual Dialog)

### Popover
- Default `w-72 p-4` mantido
- Adicionar variant implícita: quando filho é `<Command>` ou lista, autor passa `p-0` (já é prática, só documentar)
- Sombra `shadow-lg` (em vez de `shadow-md`) para destacar do conteúdo

### DropdownMenu
- Item: `px-2.5 py-2 gap-2.5` (em vez de `py-1.5 mr-2`)
- Ícone `h-4 w-4 text-muted-foreground`
- Separador `bg-border/60` (mais sutil)
- Min-width `min-w-[12rem]` em vez de `w-48` fixo

### FormModalFooter
- `justify-end` quando não há dirty/saving; `justify-between` apenas quando há status
- Mantém pílula de dirty atual

## Arquivos afetados

- `src/components/ui/dialog.tsx` — content: `p-0 gap-0 max-h-[85dvh] flex-col`; X com `top-3.5`; animação suave
- `src/components/ui/alert-dialog.tsx` — content idem; novo prop `tone?: 'destructive'|'warning'|'info'` no AlertDialogHeader (ou aceitar `icon` slot); footer `gap-3`
- `src/components/ui/popover.tsx` — `shadow-lg`
- `src/components/ui/dropdown-menu.tsx` — item `py-2 gap-2.5`, ícone com `text-muted-foreground` via class auto (ou no consumidor)
- `src/components/ConfirmDialog.tsx` — usar ícone semântico baseado em `confirmVariant`
- `src/components/FormModal.tsx` — ajustar paddings ao novo padrão (header já tem border-b ✓; alinhar valores)
- `src/components/FormModalFooter.tsx` — `justify-end` quando não há status; `gap-3` entre cancel e primary
- `src/components/list/RowActions.tsx` — `min-w-[12rem]`, `gap-2.5` (ou ajustar via item)

## Fora do escopo
- Não tocar em `Sheet`/`Drawer` (vaul) — recém-revisados.
- Não migrar 30 dialogs ad-hoc para `FormModal` (refactor amplo).
- Não criar componente "ConfirmDialog tipado por tom" novo — apenas estender o existente.
- Não mexer em `CommandDialog` (GlobalSearch) — tem padrão próprio OK.

## Critério de aceite
- Header/footer de Dialog e AlertDialog com hairlines e padding consistente.
- Body com scroll isolado (header/footer ficam fixos quando o conteúdo é longo).
- AlertDialog destrutivo com ícone + cor.
- Botões do AlertDialog com `gap-3` e ação destrutiva com peso visual claro.
- DropdownMenu com altura confortável e ícones em `text-muted-foreground`.
- Animação de entrada mais sóbria.
- Build OK; zero regressão funcional.

## Entregáveis
Resumo final por categoria: Dialog, AlertDialog/ConfirmDialog, Popover, DropdownMenu/RowActions, FormModalFooter.

