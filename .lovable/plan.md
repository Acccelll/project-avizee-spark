## Objetivo

Eliminar a etapa "Confirmar NF" como ação manual: ao **salvar** uma NF (qualquer origem — manual, XML, DistDFe), o ERP **confirma automaticamente** (movimenta estoque + gera financeiro) na mesma operação, desde que pré-requisitos estejam atendidos. Quando não for possível auto-confirmar (faltam condições financeiras), a NF fica em `pendente` com aviso explícito.

Mudança puramente de fluxo de aplicação — não altera a RPC `confirmar_nota_fiscal` nem a máquina de estados subjacente.

---

## Comportamento alvo

**Salvar uma NF (modo create) executa em sequência:**

1. Pré-validações (já existentes hoje no `handleSaveAndConfirm`):
   - número, fornecedor (entrada) ou cliente (saída) obrigatórios
   - todos os itens com `produto_id` vinculado
   - totais consistentes
2. `upsertNotaFiscalComItens` → grava cabeçalho + itens (status inicial `pendente`)
3. Registro do evento fiscal (`importacao_xml` / `criacao`)
4. **Geração de financeiro** (atual lógica do bloco linhas 902–1001):
   - XML com duplicatas → `gerar_financeiro_nfe_entrada` / `gerar_financeiro_nfe_saida`
   - Entrada manual com cartão → `gerar_financeiro_nfe_entrada` com plano de parcelas
   - Casos restantes → tenta usar `forma_pagamento` + `condicao_pagamento` informados no editor; se ausentes, **não confirma**
5. **Auto-confirmação** via `confirmar_nota_fiscal` (já hoje aplica estoque + financeiro pendente) — somente se o passo 4 ficou OK
6. Toast unificado: "NF salva e confirmada — estoque e financeiro atualizados"

**Quando NÃO auto-confirmar (fica `pendente`, sem estoque movimentado):**

- XML sem duplicatas E sem condição manual preenchida
- Item sem produto vinculado (já bloqueia o salvar hoje)
- Falha na RPC de financeiro
- Em todos os casos: toast amarelo "NF salva como pendente — informe a condição financeira para concluir" + abre a NF editável

**DistDFe (caminho automático):**

O hook `useAutoCienciaDistDFe` apenas faz manifestação de ciência. A criação da NF a partir do XML do DistDFe usa o mesmo `useNFeXmlImport` → cai no novo fluxo de salvar+confirmar. Sem mudanças adicionais necessárias ali.

---

## Mudanças de UI

**Esconder a ação manual "Confirmar NF" como CTA principal**, preservando-a apenas como fallback para NFs que ficaram `pendente`:

- `src/pages/Fiscal.tsx` (linhas 1487–1495): botão "Confirmar NF" continua, mas só aparece quando `canConfirmFiscal(n.status)` E `n.status === 'pendente'` (já é o caso hoje — apenas trocamos o label para "Concluir lançamento" para reforçar que é exceção)
- `src/components/fiscal/NotaFiscalEditModal.tsx`: botão "Salvar e Confirmar" some; permanece só "Salvar" (que agora já confirma)
- `src/components/fiscal/NotaFiscalDrawer.tsx`: `canConfirmar` continua governando o botão; sem mudança de lógica
- Toasts revistos para deixar claro o que aconteceu (confirmada vs. pendente)

---

## Arquivos a alterar

| Arquivo | Mudança |
|---|---|
| `src/pages/Fiscal.tsx` | Em `handleSave` (modo `create`): após bloco de financeiro (l.902–1001), chamar `confirmarMutation.mutateAsync({ nfId, tipoDocumento })` quando financeiro foi gerado com sucesso OU a NF não precisa de financeiro (`gera_financeiro=false`). Caso contrário, manter `pendente` com toast warning. Remover `handleSaveAndConfirm` (linha 585) — vira código morto. Atualizar `INVALIDATION_KEYS.fiscalLifecycle` invalidate. |
| `src/pages/Fiscal.tsx` | Botão "Confirmar NF" na lista (l.1487): renomear label para "Concluir lançamento" e ajustar tooltip ("NF pendente — informe a condição financeira para concluir"). |
| `src/components/fiscal/NotaFiscalEditModal.tsx` | Remover botão "Salvar e Confirmar". |
| `src/components/fiscal/NotaFiscalDrawer.tsx` | Sem mudança de lógica; eventualmente alinhar labels do drawer ao novo discurso ("Concluir lançamento"). |
| `mem://features/faturamento-fiscal` (memória) | Anotar nova regra: "Salvar = confirmar; status `pendente` só persiste quando faltar condição financeira." |

**Não muda:**
- RPCs `confirmar_nota_fiscal`, `gerar_financeiro_nfe_*`, `salvar_nota_fiscal`
- Máquina de estados (`canConfirmFiscal`, `canEstornarFiscal`)
- Lógica de estorno (continua manual, com motivo)
- `useNFeXmlImport` (parser e match permanecem iguais)

---

## Riscos & mitigação

1. **NF importada via XML do DistDFe sem cadastro completo de fornecedor/produto** → segue a regra hoje: salvar falha. Mensagem clara.
2. **Falha na geração de financeiro após NF gravada** → NF fica `pendente`, sem efeito de estoque. Botão "Concluir lançamento" permite retomar.
3. **Usuário acostumado a clicar "Confirmar"** → label "Concluir lançamento" só aparece em pendentes; toasts explicam.
4. **Testes de smoke fiscal** (`src/tests/integration/fluxo-fiscal.test.ts`) precisarão refletir o novo fluxo — incluir ajuste.

---

## Itens de execução (ordem)

1. Refatorar `handleSave` em `Fiscal.tsx`: extrair função `tryAutoConfirmar(nfId, financeiroOk)` e chamá-la ao final do bloco `create`.
2. Remover `handleSaveAndConfirm` e o botão "Salvar e Confirmar" do `NotaFiscalEditModal`.
3. Renomear botão "Confirmar NF" da lista para "Concluir lançamento" + ajustar tooltip e mensagem do dialog.
4. Atualizar toasts e copy.
5. Atualizar teste de fluxo fiscal.
6. Atualizar memória `features/faturamento-fiscal`.