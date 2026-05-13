## Objetivo

Hoje a edição de **forma/condição/parcelas** de uma NF vive em dois lugares:

1. **NotaFiscalEditModal** (botão "Editar" do drawer / grid) — já tem a seção *Pagamento*, mas a trava quando a NF está estruturalmente bloqueada (confirmada/importada), exibindo só leitura.
2. **EditarPagamentoNotaModal** — modal extra disparado pelo botão *"Editar pagamento"* dentro do drawer, exclusivamente para regenerar lançamentos pós-confirmação via RPC `atualizar_financeiro_nota`.

Vamos consolidar tudo no fluxo principal de edição da NFe.

## Mudanças

### 1. `NotaFiscalDrawer.tsx`
- Remover o botão *"Editar pagamento"* da seção Pagamento (linhas 323–330) e seu estado `editarPagamentoOpen`.
- Remover o render do `<EditarPagamentoNotaModal />` no final do componente e o import.
- Manter o botão *"Editar"* já existente no header do drawer (abre a edição completa da NFe — onde o pagamento agora poderá ser alterado).

### 2. `NotaFiscalEditModal.tsx` — seção *Pagamento*
- Quando `rules.isStructurallyLocked` for `true` **e** a NF não estiver `cancelada / cancelada_sefaz / inativada`, deixar a seção **editável** (forma, condição, nº parcelas) em vez de read-only.
- Acima da seção, exibir um `Alert` informativo: *"NF confirmada: alterar o pagamento substitui os lançamentos em aberto. Parcelas já baixadas (pagas/parciais) impedem a alteração — estorne antes."* (mesmo texto do modal antigo).
- Quando `condicao_pagamento === "a_prazo"`, embutir o `<ParcelasFiscalEditor />` (já usado no modal antigo) para permitir definir vencimentos/valores; o estado do plano fica no `form` (ex.: `form.parcelas_plano`).
- Demais campos estruturais (itens, parceiro, datas, etc.) seguem travados pelas regras atuais.

### 3. Submit (`Fiscal.tsx`, handler do EditModal)
- Detectar se a NF está confirmada (`isFiscalStructurallyLocked`) **e** se algum campo de pagamento mudou (forma, condição, parcelas/plano). Se sim:
  - chamar `atualizarFinanceiroNota({ notaId, formaPagamento, condicaoPagamento, parcelas })` em vez/depois do `upsertNotaFiscalComItens` (que só persistiria observações).
  - exibir o toast *"Pagamento atualizado e lançamentos regenerados."*.
- Caso a NF esteja em `rascunho/pendente/rejeitada`, mantém o fluxo atual de upsert (que já grava forma/condição/parcelas).

### 4. Limpeza
- Excluir `src/components/fiscal/EditarPagamentoNotaModal.tsx`.
- `rg` por `EditarPagamentoNotaModal` para garantir que não há outros consumidores.

## Fora de escopo

- RPC `atualizar_financeiro_nota` permanece inalterada.
- Drawer e EditModal mantêm visual atual; apenas a seção *Pagamento* do EditModal ganha o editor de parcelas + alert quando NF confirmada.
- Nenhuma mudança em permissões, rotas ou status fiscal.

## Resultado esperado

- Um único ponto de entrada para qualquer alteração de pagamento da NF: botão *Editar* → seção *Pagamento* (com alerta quando NF já confirmada).
- Drawer fica mais enxuto, sem ação duplicada.
