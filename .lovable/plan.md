

# Corrigir menu mobile — restaurar acesso a todos os submódulos

## Problema

Hoje o `MobileMenu` filtra **três seções inteiras** (`comercial`, `cadastros`, `financeiro`) porque elas já aparecem no bottom nav. Mas o bottom nav só leva para **uma rota direta por seção** — os demais submódulos ficam **inacessíveis** no mobile.

**Submódulos invisíveis hoje no menu mobile:**
- **Cadastros** (bottom nav vai para `/clientes`): Produtos, Fornecedores, Transportadoras, Formas de Pagamento, Grupos Econômicos, Funcionários, Sócios
- **Comercial** (bottom nav vai para `/orcamentos`): Pedidos
- **Financeiro** (bottom nav vai para `/financeiro?tipo=receber`): Fluxo de Caixa, Contas Bancárias, Plano de Contas, Conciliação

Total: **~12 telas críticas inacessíveis** sem digitar URL na mão.

## Solução

**`src/components/navigation/MobileMenu.tsx`**:
1. **Remover o filtro `BOTTOM_TAB_KEYS`** — o menu agora exibe **todas** as seções visíveis (`filteredSections` deixa de existir, usa `visibleSections` direto).
2. Manter a ordem natural de `navSections` (Cadastros, Comercial, Compras, Suprimentos, Financeiro, Fiscal, Social, Relatórios, Administração).
3. **Marcar as seções já presentes no bottom nav com badge sutil** ("• também na barra inferior") usando `text-[10px] text-muted-foreground/70` — sinaliza redundância sem esconder.

## Por que essa abordagem (e não outra)

- **Não dá para "expandir" o bottom nav**: ele tem 4 slots fixos (Início + 3 + Menu) por restrição de ergonomia mobile.
- **Bottom nav continua com link único por seção** (rota mais usada de cada módulo) — isso é correto e não muda.
- **Menu drawer é a navegação completa** — deve listar tudo, igual à sidebar desktop. A duplicação Cadastros/Comercial/Financeiro entre drawer e bottom nav é **intencional e padrão** (mesmo padrão do iOS/Android: Home está no dock e no app drawer).

## Arquivos

| Arquivo | Mudança |
|---|---|
| `src/components/navigation/MobileMenu.tsx` | Remover `BOTTOM_TAB_KEYS` e `filteredSections`; iterar `visibleSections` diretamente |

## Sem mudança

- Bottom nav (`MobileBottomNav.tsx`): continua igual.
- Permissões (`useVisibleNavSections`): inalterado.
- Estrutura de seções (`navigation.ts`): inalterada.
- Desktop sidebar: inalterada.

## Resultado esperado

Após o ajuste, ao tocar em "Menu" no mobile o usuário verá **todas** as seções com **todos** os submódulos respeitando suas permissões — igual à sidebar desktop, sem buracos.

