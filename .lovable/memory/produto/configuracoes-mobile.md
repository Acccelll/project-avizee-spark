---
name: configuracoes-mobile
description: Padrões mobile do módulo Configurações — accordion para sections com 4+ grupos, sticky save em forms pessoais, tappable card-toggle pattern, lista dl compacta para read-only
type: design
---
# Configurações Mobile (`/configuracoes`)

## Tabs
- 4 tabs com `overflow-x-auto`, label curta em <640px (`shortLabel`), `min-h-11`
- Indicador de overflow: gradient à direita (`bg-gradient-to-l from-background`) em `sm:hidden`
- `tabIndex={isActive ? 0 : -1}` para navegação por teclado

## Card "Escopo pessoal"
- Mobile: linha compacta com `Popover` (badge "Escopo pessoal" + Info) + atalho "Globais" se admin
- Desktop: card explicativo completo

## Pattern: Sticky save bar mobile
Quando há `dirty=true` (forms pessoais — Perfil, Segurança):
```tsx
{isMobile && dirty && (
  <>
    <div className="h-20" aria-hidden /> {/* spacer */}
    <div className="fixed bottom-0 left-0 right-0 z-30 border-t bg-background px-4 py-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] shadow-[0_-4px_8px_-4px_rgba(0,0,0,0.08)]">
      <Button className="w-full min-h-11">Salvar</Button>
    </div>
  </>
)}
```
Botão desktop original fica `hidden md:flex`.

## Pattern: Accordion para sections com 4+ grupos
Sections longas (Aparência tem 6 grupos) viram `Accordion type="multiple"` em mobile,
com primeiros itens (`defaultValue`) expandidos. Desktop mantém layout linear com `Separator`.

## Pattern: Tappable card-toggle
Switches em cards inteiros: o card é um `<button>` que alterna o estado. O `Switch`
fica visível com `pointer-events-none tabIndex={-1}` (decorativo).
```tsx
<button onClick={toggle} className="flex w-full items-center justify-between rounded-lg border p-4 min-h-11" aria-pressed={value}>
  <div>...</div>
  <Switch checked={value} className="pointer-events-none" tabIndex={-1} />
</button>
```

## Slider de fonte
Substituído `<Input type="range">` nativo por `Slider` shadcn (Radix), com `className="py-2"` para área tocável >40px.

## Eye/EyeOff senhas
Botão com `min-h-11 min-w-11` posicionado `right-0` (não `right-3`) para área tocável total.
Input com `pr-12` para folgar o ícone.

## Inputs de senha mobile
`w-full md:max-w-sm` — em mobile ocupa toda a largura, em desktop fica `max-w-sm`.

## EmpresaInfoSection — lista dl mobile
Mobile: `<dl class="divide-y rounded-lg border">` com label/value inline (label esquerda, value direita).
Desktop: `grid sm:grid-cols-2`.
Tipografia mínima `text-xs` (12px), nunca `text-[11px]`.

## Admin contacts (não-admin)
Cards inteiros tappable como `<a href="mailto:">` com `min-h-11`, em vez de link pequeno.

## AlertDialog → Drawer no mobile
"Restaurar padrão" e ações destrutivas/confirmações usam `Drawer` (bottom-sheet)
em mobile via `useIsMobile()`, mantendo `AlertDialog` no desktop.

## Branding global em Aparência
Mobile: 1 linha compacta — 2 swatches `h-7 w-7` lado a lado + botão "Editar" (admin).
Desktop: bloco completo com descrição + códigos hex.
