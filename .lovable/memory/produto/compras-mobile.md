---
name: Compras Mobile
description: Padrão mobile do módulo Compras — cotações, propostas, comparativo de fornecedores e pedidos
type: design
---

# Compras Mobile

## Listagens
- `CotacaoCompraTable` e `PedidoCompraTable` usam `mobileStatusKey="status"` para exibir o status como pill no canto do card mobile.

## Itens
- `CotacaoCompraItensTable` e `ItemsGrid` (`src/components/ui/ItemsGrid.tsx`) renderizam **cards verticais em `md:hidden`** e tabela em `hidden md:block`.
- Inputs em mobile: altura `h-11` (44px). Botão remover: `h-9 w-9` mínimo.
- Form de cotação (`CotacoesCompra.tsx`) usa blocos verticais por item em mobile (Autocomplete full-width, Qtd/Un em grid 2 colunas).

## Comparativo de fornecedores
- `ComparativoFornecedores` (em `CotacaoCompraPropostasPanel.tsx`) renderiza **cards verticais por fornecedor** em `md:hidden`, com pill "Menor total" no card vencedor. Tabela matriz só em `md:`.

## Propostas
- Cada proposta vira card vertical em mobile com botão **"Selecionar este fornecedor"** full-width 44px (substitui ícone 28px).
- Form de "Adicionar proposta" abre como **bottom-sheet** (`Sheet side="bottom"`) em mobile — inline em desktop.

## Drawers
- `CotacaoCompraDrawer` e `PedidoCompraDrawer`: `DrawerStickyFooter` com `className="max-sm:flex-col"` e botões `max-sm:h-11 max-sm:w-full`.
- Aba **Decisão**: cards verticais em mobile (`md:hidden`), tabela em desktop.

## Diálogos
- `RegistrarRecebimentoDialog` e `EstornarRecebimentoDialog` usam estilo bottom-sheet em `max-sm:` (mesmas classes do `CrossModuleActionDialog` do Comercial), footer empilhado com botões 44px.

## Form modal
- `PedidoCompraFormModal`: footer de totais em grid 2 colunas + linha destacada "Total"; botões Cancelar/Salvar empilhados com 44px em mobile.
