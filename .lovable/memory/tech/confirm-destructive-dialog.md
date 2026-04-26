---
name: ConfirmDestructiveDialog
description: Quando usar ConfirmDestructiveDialog (ações terminais com motivo/efeitos colaterais) vs ConfirmDialog (confirmações simples)
type: design
---

# Confirmações destrutivas

Dois componentes, escolha pelo tipo de ação:

- **`ConfirmDialog` / `useConfirmDialog`** (`@/components/ConfirmDialog`):
  descartar form sujo, deletes triviais sem efeito colateral, confirmações genéricas.
  Sem campo de motivo, sem lista de efeitos.

- **`ConfirmDestructiveDialog` / `useConfirmDestructive`** (`@/components/ConfirmDestructiveDialog`):
  ações terminais que seguem `mem://produto/excluir-vs-inativar-vs-cancelar`.
  Exige `motivo` (default quando `verb="Cancelar"`), lista `sideEffects[]`,
  exibe badge "Ação terminal" e usa tom destructive.
  Verbos suportados: `Cancelar | Excluir | Estornar | Rejeitar | Inativar`.

Padrão para Pedido/Orçamento/NF/Remessa/Lançamento (cancelar com RPC):
```tsx
const { confirm, dialog } = useConfirmDestructive();
await confirm(
  {
    verb: "Cancelar",
    entity: `pedido #${pedido.numero}`,
    sideEffects: ["Estorno de estoque", "NF associada será cancelada na SEFAZ"],
  },
  (motivo) => pedidosService.cancelar(pedido.id, motivo),
);
```

Nunca usar `window.confirm` para ações terminais — perde motivo, perde aviso de efeitos.
