---
name: Auto-confirm NF
description: Salvar NF (qualquer origem) auto-confirma quando há condição financeira; pendente é fallback explícito.
type: feature
---

Ao salvar uma NF nova (`mode === "create"` em `src/pages/Fiscal.tsx`), o ERP:

1. Gera o financeiro (gerar_financeiro_nfe_entrada/saida) quando o XML traz duplicatas
   ou quando o usuário escolheu cartão de crédito.
2. Para NFs manuais sem cartão, deixa `confirmar_nota_fiscal` gerar o financeiro a partir
   de `condicao_pagamento` + `parcelas` do payload.
3. **Auto-confirma** chamando `confirmar_nota_fiscal` quando há condição financeira completa
   (a_vista; ou a_prazo com plano de parcelas completo; ou `gera_financeiro=false`).
4. Quando falta condição (XML sem duplicatas, sem forma_pagamento, plano de parcelas incompleto)
   a NF fica `pendente` com toast amarelo orientando a usar **"Concluir lançamento"**.

O botão antigo "Confirmar NF" foi renomeado para **"Concluir lançamento"** e só aparece para
NFs em status `pendente` (fallback). O botão "Salvar e Confirmar" do `NotaFiscalEditModal` e a
função `handleSaveAndConfirm` em `Fiscal.tsx` foram removidos.

A RPC `confirmar_nota_fiscal` e a máquina de estados (`canConfirmFiscal`,
`canEstornarFiscal`) não foram alteradas — a mudança é puramente de fluxo na camada de aplicação.
