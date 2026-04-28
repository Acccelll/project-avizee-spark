## Problema

O CoachTour resolve alvos via `[data-help-id="..."]`. Várias entries do registry referenciam IDs que **não existem no DOM**, fazendo o popover cair no modo "fantasma" centralizado com o aviso amarelo "Esta área não foi encontrada".

## Auditoria (entries × anchors no DOM)

| Entry | Target esperado | Existe no DOM? |
|---|---|---|
| dashboard | `header.global-period` | NÃO (seletor CSS sem match — é `GlobalPeriodChip`) |
| dashboard | `dashboard.comercial` | OK (`Index.tsx`) |
| dashboard | `dashboard.financeiro` | OK |
| dashboard | `dashboard.fiscal` | OK |
| orcamentos | `orcamentos.novoBtn` | NÃO |
| orcamentos | `orcamentos.filtros` | OK |
| orcamentos | `orcamentos.tabela` | OK |
| pedidos | `pedidos.filtros` / `.tabela` | OK |
| fiscal | `fiscal.tipoTabs` | NÃO |
| fiscal | `fiscal.novaBtn` | NÃO |
| fiscal | `fiscal.tabela` | OK (também `fiscal.filtros`) |
| estoque | `estoque.filtros` / `.tabela` | NÃO (página não tem anchors) |
| financeiro | `financeiro.tipoTabs` / `.tabela` | NÃO |
| logistica | `logistica.tabs` / `.tabela` | NÃO |
| clientes | `clientes.novoBtn` / `.tabela` | NÃO |
| produtos | `produtos.filtros` / `.tabela` | NÃO |

Resumo: **só Pedidos está 100% correto**. Dashboard, Orçamentos e Fiscal estão parcialmente; Estoque, Financeiro, Logística, Clientes e Produtos não têm nenhum anchor.

## Correções

### 1. Adicionar `data-help-id` nas páginas que faltam

Em cada página, envolver os elementos correspondentes (sem alterar layout/estilo) com `<div data-help-id="...">` ou aplicar o atributo direto no wrapper existente:

- **`src/pages/Estoque.tsx`** → `estoque.filtros` (AdvancedFilterBar) e `estoque.tabela` (DataTable)
- **`src/pages/Financeiro.tsx`** → `financeiro.tipoTabs` (Tabs Receber/Pagar) e `financeiro.tabela`
- **`src/pages/Logistica.tsx`** → `logistica.tabs` (TabsList) e `logistica.tabela`
- **`src/pages/Clientes.tsx`** → `clientes.novoBtn` (botão "Novo cliente" no PageHeader) e `clientes.tabela`
- **`src/pages/Produtos.tsx`** → `produtos.filtros` e `produtos.tabela`
- **`src/pages/Orcamentos.tsx`** → adicionar `orcamentos.novoBtn` no botão "Novo orçamento"
- **`src/pages/Fiscal.tsx`** → adicionar `fiscal.tipoTabs` (tabs NFe/NFCe/NFSe) e `fiscal.novaBtn` (botão "Nova NF")

### 2. Corrigir target inválido do dashboard

`src/components/navigation/GlobalPeriodChip.tsx` → adicionar `data-help-id="dashboard.globalPeriod"` no wrapper raiz do chip.
`src/help/entries/dashboard.ts` → trocar `target: 'header.global-period'` por `target: 'dashboard.globalPeriod'`.

### 3. Endurecer o resolver (defesa em profundidade)

`src/components/help/CoachTour.tsx` — `resolveTarget()`: a lógica atual tenta `querySelector(target)` quando o target contém `.` (ex.: `dashboard.fiscal` é um seletor CSS válido mas inválido sintaticamente, e cai no catch). Simplificar para:

```ts
function resolveTarget(target: string): Element | null {
  // 1. tenta como data-help-id (caso mais comum)
  const byAttr = document.querySelector(`[data-help-id="${CSS.escape(target)}"]`);
  if (byAttr) return byAttr;
  // 2. tenta como seletor CSS bruto (apenas se começa com [, #, ., :, * ou tag)
  if (/^[\[#.:*a-z]/i.test(target)) {
    try { return document.querySelector(target); } catch { /* noop */ }
  }
  return null;
}
```

### 4. Bump de versão

Subir `version: 2` em todos os entries alterados (dashboard, fiscal, estoque, financeiro, logistica, clientes, produtos, orcamentos) para reativar o first-visit toast e mostrar o tour funcional aos usuários que já o haviam descartado.

## Validação

Após aplicar, abrir cada rota, disparar o tour pelo `?` e confirmar que:
- Nenhum passo exibe o aviso amarelo "Esta área não foi encontrada".
- O anel de destaque (ring) cerca o elemento correto.
- O popover ancora abaixo (ou acima, se não couber) do alvo.

## Arquivos afetados

- 7 páginas: `Estoque`, `Financeiro`, `Logistica`, `Clientes`, `Produtos`, `Orcamentos`, `Fiscal`
- 1 componente: `GlobalPeriodChip.tsx`
- 1 utilitário: `CoachTour.tsx` (resolver)
- 8 entries de ajuda (bump de versão + correção do dashboard)