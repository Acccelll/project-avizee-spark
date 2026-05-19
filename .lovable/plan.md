## Diagnóstico

O formulário **Novo/Editar Lançamento** (`FinanceiroLancamentoForm`) é renderizado em `src/pages/Financeiro.tsx` (linha 665) **sem** a prop `cartoes`. Como a prop tem default `cartoes = []`, o bloco "Cartão *" sempre cai no fallback "Nenhum cartão cadastrado" — mesmo quando há cartões ativos cadastrados. É exatamente o estado da tela enviada.

Os cartões já são carregados corretamente em `useFinanceiroAuxiliares` → `fetchFinanceiroAuxiliares` (via `listCartoesAtivos`) e são repassados para `BaixaParcialDialog` (linha 744). Só faltou repassar para o `FinanceiroLancamentoForm`.

### Problemas correlatos identificados na revisão

1. **`useFinanceiroActions.handleSubmit` — modo `edit` ignora resolução de fatura.** A condição `mode === "create"` (linha 53) impede que ao editar um lançamento e trocar/atribuir cartão a `cartao_fatura_id` seja recalculada. Resultado: lançamento fica com `cartao_id` mas sem `cartao_fatura_id`, quebrando a agregação de fatura.
2. **Path "parcelado" não grava `cartao_fatura_id` na base passada à RPC `gerar_parcelas_financeiras`** (linhas 101-119): a RPC resolve fatura por parcela, OK, mas o objeto `base` não inclui `cartao_fatura_id` (a RPC tolera, mas mantém-se o ponto: o caminho não-parcelado resolve no client e o parcelado delega — comportamento divergente é aceitável; sem mudança aqui).
3. **`updateField("cartao", sel?.nome ?? "")` grava o nome do cartão na coluna legada `cartao` (texto livre).** Isso é redundante com `cartao_id` e pode gerar inconsistência se o cartão for renomeado. Manter por compatibilidade (ainda exibido em filtros/colunas), mas documentar.
4. **No modo `edit`, ao abrir um lançamento que já é cartão de crédito, o select mostra o cartão atual via `value={form.cartao_id}`** — funciona desde que a prop `cartoes` seja passada (fix #1). Sem o fix, o usuário vê o aviso "nenhum cartão" mesmo num lançamento que já está vinculado a um cartão.

## Plano de correção

### 1) Fix principal — passar `cartoes` para o form (`src/pages/Financeiro.tsx`)

Adicionar `cartoes={cartoes}` na renderização de `<FinanceiroLancamentoForm>` (próximo à linha 672, junto com `fornecedores` e `clientes`).

### 2) Fix do modo edit — resolver fatura também em update (`src/pages/financeiro/hooks/useFinanceiroActions.ts`)

Remover a restrição `mode === "create"` da condição que resolve `cartao_fatura_id`/`resolvedVencimento` (linhas 50-74). Passa a aplicar também em `edit`, desde que:
- `forma_pagamento === "cartao_credito"`,
- `cartao_id` presente,
- `cartao_fatura_id` ainda não estiver definido **ou** o `cartao_id`/`data_vencimento` tenha mudado em relação ao `selected` original.

Para evitar recalcular vencimento à toa em edições simples, comparar com `selected.cartao_id` e `selected.data_vencimento`; só resolver quando algum dos dois mudou ou quando `cartao_fatura_id` estiver null.

### 3) Validação visual no edit (sem código novo, só verificar)

Após o fix #1, abrir um lançamento existente "Cartão de Crédito" deve exibir o cartão selecionado no `Select` ao invés do alerta. Esta validação é apenas QA, sem mudança de código.

## Validação

- Abrir `/financeiro` → "Novo Lançamento" → Forma "Cartão de Crédito" → deve listar os cartões ativos cadastrados.
- Selecionar cartão + data de vencimento → salvar → conferir no DB que `cartao_id` e `cartao_fatura_id` foram persistidos e `data_vencimento` foi ajustada para o vencimento da fatura.
- Editar um lançamento "Cartão de Crédito" sem cartão atribuído → atribuir cartão → salvar → conferir que `cartao_fatura_id` foi resolvido (fix #2).
- Mobile (375px): seção "Pagamento" colapsada — abrir, selecionar cartão de crédito → select de cartões aparece e funciona.

## Arquivos afetados

- `src/pages/Financeiro.tsx` (1 linha)
- `src/pages/financeiro/hooks/useFinanceiroActions.ts` (~5 linhas)
