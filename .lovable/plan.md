## Objetivo

Permitir cadastrar um novo fornecedor diretamente do autocomplete "Fornecedor" do formulário de Nova Nota Fiscal (entrada), seguindo o mesmo padrão usado em `OrcamentoForm` (botão "Cadastrar novo" dentro do `AutocompleteSearch` via prop `onCreateNew`, abrindo o `QuickAddSupplierModal` já existente).

## Escopo

- Apenas o campo **Fornecedor** do formulário de NF (entrada). Cliente fica fora desta entrega (não foi solicitado).
- Vale tanto para o modal `NfeCreateFormModal` quanto para a página `NotaFiscalForm`, pois ambos usam `NfeFormBody`.

## Mudanças

1. `src/pages/fiscal/components/NfeFormBody.tsx`
   - Adicionar prop opcional `onCriarFornecedorQuick?: () => void`.
   - Passar `onCreateNew={onCriarFornecedorQuick}` + `createNewLabel="Cadastrar novo fornecedor"` no `AutocompleteSearch` do Fornecedor.

2. `src/pages/fiscal/components/NfeCreateFormModal.tsx`
   - Repassar a nova prop `onCriarFornecedorQuick` para `NfeFormBody`.

3. `src/pages/Fiscal.tsx`
   - Reutilizar o `QuickAddSupplierModal` que já existe no arquivo (hoje só é aberto pelo fluxo de import XML).
   - Novo handler `handleAbrirQuickFornecedor()` que limpa `quickFornecedorDefaults` (cadastro em branco) e faz `setQuickFornecedorOpen(true)`.
   - No `onCreated` existente do modal, ampliar o comportamento: além do fluxo de XML (que continua intacto via `pendingXmlImport`), quando não houver `pendingXmlImport`, atualizar `form.fornecedor_id` com o id recém-criado e mostrar toast de sucesso.
   - Passar `onCriarFornecedorQuick={handleAbrirQuickFornecedor}` para `<NfeCreateFormModal>`.

4. `src/pages/fiscal/NotaFiscalForm.tsx` (página standalone usada na rota `/fiscal/novo` e `/fiscal/:id/editar`)
   - Mesma integração: estado local para abrir o `QuickAddSupplierModal`, passar `onCriarFornecedorQuick` ao `NfeFormBody`, e no `onCreated` atualizar `form.fornecedor_id` + refetch da lista de fornecedores.

## Critérios de aceite

- No formulário de NF de entrada, ao digitar no campo Fornecedor e não encontrar resultado, aparece o botão "Cadastrar novo fornecedor" (mesmo visual de Orçamentos).
- Ao clicar, abre o `QuickAddSupplierModal` em branco. Após salvar, o fornecedor recém-criado vira o selecionado no formulário, sem fechar a NF em edição.
- Fluxo de import de XML (que também usa o mesmo modal) continua funcionando idêntico.
