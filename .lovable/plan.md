

# Diagnóstico técnico — telas de edição

Mapeei 17 telas/modais de edição. Agrupei por tipo e levantei problemas reais (não cosméticos).

## Inventário por categoria

**A. Cadastro simples (modal único, FormModal)**
`UnidadesMedida` (296L), `FormasPagamento` (816L), `Funcionarios` (941L), `ContasBancarias` (471L), `GruposEconomicos` (1056L)

**B. Cadastro complexo com sub-entidades (FormModal grande)**
`Produtos` (1162L — composição + fornecedores), `Clientes` (1648L — endereços + comunicações + transportadoras), `Fornecedores` (830L), `Transportadoras` (1022L — vínculos cliente)

**C. Cadastro técnico em modal próprio**
`ContaContabilEditModal` (537L)

**D. Operacional/transacional**
`Financeiro` (343L delegado a `useFinanceiroActions`), `Fiscal`/`NotaFiscalEditModal` (1086L)

**E. Página dedicada (rota `/:id`)**
`OrcamentoForm` (1271L), `PedidoForm` (271L), `PedidoCompraForm` (421L), `CotacaoCompraForm` (471L), `RemessaForm` (329L)

## Problemas concretos identificados

### 1. Inconsistência de dirty-state e descarte de alterações
| Tela | Tem `isDirty`? | Confirma descarte? |
|---|---|---|
| Clientes | ✅ | ✅ |
| Fornecedores | ✅ | ✅ |
| GruposEconomicos | ✅ (calculado) | ✅ |
| Produtos | ❌ | ❌ — perde alterações silenciosamente |
| Transportadoras | ❌ | ❌ |
| Funcionarios | ❌ | ❌ |
| FormasPagamento | ❌ | ❌ |
| ContasBancarias | ❌ | ❌ |
| UnidadesMedida | ❌ | ❌ |
| ContaContabilEditModal | ❌ | ❌ |

→ **9 de 10 telas de cadastro** podem fechar com `Esc`/clique-fora e perder dados sem aviso.

### 2. Validação fragmentada e inconsistente
- **Clientes/Fornecedores** usam zod (`clienteFornecedorSchema`) com `formErrors` por campo.
- **Produtos** tem `produtoSchema` definido em `validationSchemas.ts` mas **não usa** — valida com `if/toast` hardcoded.
- **Transportadoras/Funcionarios/FormasPagamento/UnidadesMedida/ContasBancarias** validam só com `if/toast.error` sem schema, sem erros por campo.
- **Fiscal/Financeiro** validam dentro de hooks/services.

### 3. Prevenção de duplo envio (saving lock) inconsistente
- **Funcionarios** usa `submitting`, **Produtos/Clientes/Fornecedores/Transportadoras/UnidadesMedida** usam `saving`, **FormasPagamento/ContasBancarias/Financeiro** delegam.
- **FormasPagamento** **não tem `saving`** no submit — botão pode ser clicado N vezes.
- **GruposEconomicos** valida sem flag de saving estável.

### 4. `openEdit` repetido + propenso a esquecer reset
Cada cadastro complexo tem 15-25 linhas de `setForm({...})` mapeando campo a campo. Isso é frágil:
- Quando adiciona-se campo novo no DB, esquece-se de mapear → bug silencioso.
- `Clientes.openEdit` reseta `setEnderecos([])` e dispara `loadEnderecos()` em paralelo — race condition se usuário fechar antes do load.

### 5. Reset incompleto entre create/edit
- **Produtos.openCreate** **não reseta** `setForm` para `emptyProduto` antes — sim reseta, ok. Mas **não reseta `setMargemLucro`** na rotina padrão para um valor de "create" claro (aparece 30 hardcoded).
- **Funcionarios.openEdit** não reseta `folhas/lancamentos` → drawer pode mostrar dados do registro anterior por instante.
- **Transportadoras.openEdit** reseta contadores mas não reseta `editingFornecedor`/listas internas.

### 6. Side-effects em `openEdit` sem cancelamento
- `Clientes.openEdit` dispara 3 fetches em `Promise.all` sem `cancelled` flag. Trocar registro rápido ⇒ overwrite com dados antigos.
- `Fornecedores.openEdit` chama `loadFornContext(f.id)` sem cancel.
- `Funcionarios.openView` mesmo problema.

### 7. Fluxo `editId` URL → race com `openEdit`
Em `Clientes`/`Fornecedores`/`Produtos`, o `useEffect` busca o registro por `editId` e chama `openEdit`. Como `openEdit` em Clientes faz `Promise.all` sem await/cancel, navegar para 2 ids consecutivos pode misturar dados.

### 8. Estados duplicados / fora de lugar
- **Clientes** mantém `formasPagamento`, `enderecos`, `comunicacoes`, `modalTransportadoras` no componente raiz → re-render da lista inteira a cada digitação no modal.
- **Produtos** mantém `editComposicao`, `editFornecedores`, `margemLucro`, `editingProduct` separados de `form` → estado dividido, fácil de dessincronizar.
- **NotaFiscalEditModal** recebe 18 props para estado pertencente ao modal.

### 9. Cálculos derivados como `useState` (deveriam ser `useMemo`)
- **Produtos** `margemLucro` é state mas é função de `form.preco_venda/preco_custo` — duplica fonte de verdade.
- **GruposEconomicos** `isDirty` é calculado em render sem memo — recomputa toda renderização.

### 10. Tratamento de erro inconsistente no `handleSubmit`
- Algumas telas usam `try/finally` (Funcionarios), outras `try/catch` com `console.error` (Produtos), outras nenhum (`UnidadesMedida` — `setSaving(false)` fora do `finally` ⇒ se `create()` der throw síncrono o botão fica travado).
- **Produtos** tem `setSaving(false)` no `finally` mas o `setModalOpen(false)` no `try` é seguido de side-effects de fornecedores que podem falhar silenciosamente sem reverter.

### 11. NotaFiscalEditModal — orquestração externa frágil
Estado vive em `Fiscal.tsx` (form, items, itemContaContabil, itemFiscalData, parcelas). Modal não controla seu próprio ciclo. Trocar de NF sem fechar/reabrir pode contaminar estado anterior.

### 12. Páginas de form dedicadas (OrcamentoForm/PedidoCompraForm) — boas, mas falta padronização
- `OrcamentoForm` tem dirty-state via `useConfirmDialog`, mas `PedidoCompraForm`/`CotacaoCompraForm`/`RemessaForm` validam via `if`+`toast` e não bloqueiam saída suja.
- `PedidoCompraForm.handleSave` faz `delete + insert` de itens sem transação → falha entre as duas etapas deixa pedido sem itens.

## Estratégia de correção

Vou padronizar **sem reescrever fluxos**, criando 2 hooks compartilhados e aplicando-os de forma cirúrgica.

### Fase 1 — Infraestrutura compartilhada
Criar 2 hooks pequenos e focados:

**`useEditDirtyForm<T>`** (`src/hooks/useEditDirtyForm.ts`)
```ts
function useEditDirtyForm<T>(initial: T) {
  // gerencia: form, isDirty (auto via deepEqual c/ baseline),
  // updateForm(patch), reset(next), confirmCloseIfDirty()
}
```
Uso (substitui ~40 linhas de boilerplate por tela):
```ts
const { form, setForm, updateForm, isDirty, reset, confirmCloseIfDirty } = useEditDirtyForm(emptyForm);
```

**`useSubmitLock()`** (`src/hooks/useSubmitLock.ts`)
Wrapper minúsculo que garante: `saving`, prevenção de duplo envio, `try/finally` correto, opcional `toast` em erro.
```ts
const { saving, submit } = useSubmitLock();
await submit(async () => { ... }); // saving=true → false garantido
```

**`useCancelableLoad()`** (já existe padrão `cancelled` em FormasPagamento) — extrair em hook `useEffect`-friendly para `openEdit` em Clientes/Fornecedores/Funcionarios.

### Fase 2 — Aplicação cirúrgica (10 telas)

| Tela | Mudanças concretas |
|---|---|
| `Produtos` | Adotar `useEditDirtyForm` + `useSubmitLock`; usar `produtoSchema` (já existe); `margemLucro` vira `useMemo`; envolver fornecedores em try/catch que reverta `produtoId` em criação se falhar |
| `Clientes` | `openEdit` com cancellation flag para `loadTransportadoras/loadEnderecos/loadComunicacoes` |
| `Fornecedores` | Mesmo tratamento + cancellation em `loadFornContext` |
| `Transportadoras` | Adicionar `isDirty`+confirmDiscard; adotar `useSubmitLock` |
| `Funcionarios` | `isDirty`+confirmDiscard; `openView` com cancellation; usar `useSubmitLock` |
| `FormasPagamento` | Adicionar `saving` lock (atualmente ausente!); `isDirty`+confirmDiscard |
| `ContasBancarias` | `isDirty`+confirmDiscard; `useSubmitLock` |
| `UnidadesMedida` | `isDirty`+confirmDiscard; mover `setSaving(false)` para `finally` |
| `GruposEconomicos` | Memoizar `isDirty` |
| `ContaContabilEditModal` | `isDirty`+confirmDiscard interno; `useSubmitLock` |
| `PedidoCompraForm` (page) | `useEditDirtyForm` + confirmDiscard ao sair; itens via RPC `replace_pedido_compra_itens` (criar) ou wrap em transação |
| `CotacaoCompraForm`/`RemessaForm` | dirty-state + saving lock |

**Fora do escopo desta rodada** (mantenho como estão por estabilidade):
- `OrcamentoForm` — já tem dirty-state robusto
- `Financeiro`/`Fiscal` — já delegam a hooks dedicados; só revisar se aparecer bug em testes
- `NotaFiscalEditModal` — refator estrutural maior; deixar para depois

### Fase 3 — Resumo de saída
Ao final entrego tabela `tela | problemas encontrados | correções aplicadas | pendências`.

## Critério de aceite
- Build OK (`tsc --noEmit`)
- Todas as 10 telas de cadastro têm: dirty-state + confirmDiscard + saving lock consistentes
- `openEdit` em telas com sub-fetches usa cancellation
- `Produtos` usa `produtoSchema` zod
- `PedidoCompraForm` itens transacionalmente seguros
- Sem regressão em fluxos existentes (validações, salvar, cancelar, ações por tipo)

