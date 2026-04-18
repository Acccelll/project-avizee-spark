

# Diagnóstico técnico — Fluxos de Criação

## Inventário

| Fluxo | Local | Numeração | Padrão dirty | Lock submit | Defaults |
|---|---|---|---|---|---|
| Cliente | `Clientes.tsx` (modal) | — | manual `setIsDirty` | `setSaving` manual | `emptyCliente` |
| Cliente quick-add | `QuickAddClientModal.tsx` | — | — | `useSubmitLock` ✓ | `emptyForm` |
| Fornecedor | `Fornecedores.tsx` | — | manual | manual | similar a cliente |
| Funcionário | `Funcionarios.tsx` | — | `baselineForm` ad-hoc | `useSubmitLock` ✓ | `emptyForm` |
| Produto | `Produtos.tsx` | — | `useEditDirtyForm` ✓ | `useSubmitLock` ✓ | `emptyProduto` |
| Transportadora | `Transportadoras.tsx` | — | `useEditDirtyForm` ✓ | `useSubmitLock` ✓ | `emptyForm` |
| Conta Bancária | `ContasBancarias.tsx` | — | `useEditDirtyForm` ✓ | `useSubmitLock` ✓ | `emptyContaForm` |
| Forma Pagamento | `FormasPagamento.tsx` | — | `useEditDirtyForm` ✓ | `useSubmitLock` ✓ | `emptyForm` |
| Unidade | `UnidadesMedida.tsx` | — | `useEditDirtyForm` ✓ | `useSubmitLock` ✓ | `emptyForm` |
| Grupo Econ. | `GruposEconomicos.tsx` | — | manual | manual | `emptyForm` |
| Orçamento | `OrcamentoForm.tsx` (página) | RPC `proximo_numero_orcamento` (na carga) | RHF `isDirty` | `setSaving` manual | RHF `defaultValues` |
| Cotação Compra | `useCotacoesCompra` | RPC `proximo_numero_cotacao_compra` (em `openCreate`) | — | `setSaving` manual | `emptyForm` |
| Pedido Compra | `usePedidosCompra` | RPC `proximo_numero_pedido_compra` (em `handleSubmit`) | — | `setSaving` + ref `if (saving) return` | inline |
| Nota Fiscal | `Fiscal.tsx` | manual no input (`form.numero`) | — | `setSaving` manual | `emptyForm` |
| Remessa página | `RemessaForm.tsx` | — | baseline manual | `isSaving` do hook | `emptyForm` |
| Remessa modal | `Remessas.tsx` | — | — | `setSaving` manual | `emptyForm` |
| Lançamento Financeiro | `useFinanceiroActions` | — | — | `setSaving` manual + try/finally ✓ | `emptyForm` (`FluxoCaixa`) |
| Mov. Estoque | `Estoque.tsx` | — | — | `registrar` (mutation hook) | inline |
| Folha Pagamento | `Funcionarios.tsx` modal aninhado | — | — | sem lock | `folhaForm` inline |
| Baixa parcial | `BaixaParcialDialog` | — | — | manual try/finally ✓ | `dataBaixa` = hoje |
| Baixa em lote | `BaixaLoteModal` | — | — | manual | reset on `open` |
| Devolução | `DevolucaoDialog` | RPC dentro do service | — | `processing` manual | `dataDevolucao` = hoje |

## Problemas reais

### A. Padronização do "abrir criar" (openCreate)

#### A1. Três estilos de abertura para create
- `setMode + setForm({...empty}) + setSelected(null) + setModalOpen(true)` — 12+ telas
- `reset({...empty})` via `useEditDirtyForm` — 7 telas
- `RHF reset(defaultValues)` — `OrcamentoForm` (página dedicada)

Resulta em comportamento divergente em rerender, isDirty, e cleanup.

#### A2. `openCreate` síncrono vs assíncrono
- `useCotacoesCompra.openCreate` é `async` (busca número RPC) e abre modal **depois** do RPC.
- `usePedidosCompra` busca número **dentro** de `handleSubmit` (após validação).
- `Fiscal.openCreate` deixa numeração para input manual.
- `OrcamentoForm` busca em `useEffect` quando `!isEdit`.

Inconsistência: usuário em conexão lenta espera diferente para cada documento. Em `useCotacoesCompra`, número aparece no campo desde a abertura; em `usePedidosCompra`, só "aparece" no toast pós-save (sem feedback de qual número foi atribuído).

#### A3. Lookups disparados na abertura sobrecarregam create
`Clientes.openCreate` e `Funcionarios.openCreate` carregam dependências (transportadoras, folhas, lançamentos) **mesmo quando irrelevantes para create**:
```ts
setModalTransportadoras([]); setEnderecos([]); setComunicacoes([]); // create
setFolhas([]); setLancamentos([]); // create
```
São arrays vazios — ok, mas o modal renderiza tabs/seções "Endereços de Entrega", "Comunicações", "Folha", "Financeiro" no modo create que **não fazem sentido** sem id. Já há um banner "salve antes de adicionar" em `Clientes:1256`, mas a UX seria melhor escondendo/desabilitando essas seções.

### B. Numeração atômica

#### B1. Fallbacks ad-hoc espalhados
6 lugares diferentes com fallback `Date.now().slice(-6)`:
- `OrcamentoForm` (2x — load + duplicate)
- `Orcamentos.tsx` duplicar
- `useCotacoesCompra.openCreate` + gerarPedido
- `usePedidosCompra.handleSubmit`

Risco: se a RPC falhar silenciosamente, gera número **não-atômico** e duplicável (mesma data/segundo entre dois usuários). Memória do projeto (`numeracao-atomica-documentos`) define que numeração crítica deve vir **só** de SEQUENCES. O fallback é uma violação dessa diretriz.

Correção: em vez de fallback, fazer `throw` se RPC falhar (toast de erro e bloquear save).

#### B2. Quando buscar o número
- `useCotacoesCompra` busca em `openCreate` → consome número mesmo se usuário cancelar (gap na sequence).
- `usePedidosCompra` busca em `handleSubmit` → ideal: reserva apenas no save.
- `OrcamentoForm` busca em load → mesmo gap.

Recomendação: padronizar para "buscar no submit". Mas isso quebra UX (usuário não vê "Nº PC-001" antes de salvar). Alternativa: buscar em `openCreate` e aceitar o gap — comum em ERPs (Tiny/Bling fazem isso). O importante é **uniformizar**.

#### B3. Editar permite alterar número manualmente em alguns fluxos
- `Fiscal.tsx`: input `numero` editável em create + edit (até confirmar SEFAZ).
- `useCotacoesCompra`: bloqueia? — não vejo guard.
- `usePedidosCompra`: não tem campo numero no form (auto).

Inconsistência: número manual em NF é correto (vem do XML em importação), mas em cotação/pedido jamais deveria ser editável em edit.

### C. Validações frágeis

#### C1. Validação inline `if (!form.x) toast.error(...)`
Pelo menos 18 handlers seguem esse padrão (FluxoCaixa, Cotações, Pedidos, Fiscal, Remessas, Funcionarios, ContasBancarias, FormasPagamento, Estoque). Cada um valida diferente:
- alguns `!form.descricao` (aceita whitespace)
- outros `!form.nome.trim()` ✓
- outros `Number(form.valor) <= 0` vs `!form.valor` (zero passa)

Existe `validateForm(zodSchema, form)` em `Clientes`/`Fornecedores`/`Produtos` — adoção parcial.

Padronizar: schemas Zod centralizados (já existem `clienteFornecedorSchema`, `produtoSchema`, `nfeSchema`, `orcamentoSchema`) e helper `validateForm`. Migrar handlers inline.

#### C2. Defaults com side-effect oculto
`Fiscal.emptyForm` define `data_emissao: new Date().toISOString().split("T")[0]` no escopo do módulo → **valor é congelado no momento do bundle load**. Em sessões longas, "hoje" pode ser ontem.

Mesma armadilha em:
- `FluxoCaixa.emptyForm` (data_vencimento)
- `cotacaoCompraTypes.emptyForm` (data_cotacao)
- `PedidoCompraForm` initial state

Correção: centralizar `getEmptyXForm()` como função, ou aplicar `data_X = new Date().toISOString().split("T")[0]` no momento do `openCreate`.

#### C3. Dependências entre campos sem clareza
- `Fiscal.handleSubmit`: validação de `fornecedor_id` por `tipo === "entrada"` ✓ — boa.
- `useFinanceiroActions`: validações condicionais para `status === "pago"` ✓ — boa.
- `Estoque.handleSubmit`: motivo obrigatório só checado por `.trim()`, mas `quantidade <= 0` aceita float ruim.

Padrão Zod com `.refine` resolveria todos no schema.

### D. Salvamento inicial

#### D1. Padrão `setSaving(true)` espalhado vs `useSubmitLock`
Adoção do `useSubmitLock`: 10 telas. Manual ainda em ~12 (Fiscal, Cotações, Pedidos, Clientes, Fornecedores, GruposEconomicos, Estoque, FluxoCaixa, Remessas modal, etc.).

O hook resolve:
- ref síncrona (anti duplo-clique)
- try/finally garantido
- toast padronizado

Custo de migração baixo. Já existe a abstração — não usá-la é dívida.

#### D2. Persistência em duas etapas sem atomicidade
- `Fiscal.handleSubmit`: insere NF → insere itens (sem RPC). Se itens falharem, NF fica órfã. Não há rollback.
- `usePedidosCompra.handleSubmit`: tem rollback manual (linha 414: `delete pedido` em erro de itens) ✓ mas **só em create**. Em edit, deleta itens e insere novos sem rollback.
- `useCotacoesCompra.handleSubmit`: edit faz `update + delete itens` em `Promise.all` — se update falhar, itens já foram apagados. Race condition séria.
- `OrcamentoForm` usa RPC `salvar_orcamento` ✓ — atômica, padrão correto.

Padrão alvo: RPC `salvar_X` para todo documento com itens (orçamento já tem; pedidos compra/cotações tem `replace_pedido_compra_itens` parcial; fiscal não tem). Memória `padroes-de-persistencia-transacional` confirma essa diretriz.

#### D3. Catch silencioso depois das correções recentes
Após auditoria anterior, `Fornecedores.tsx:213-214` ainda tinha catch sem toast (corrigido recentemente). Verificar `Clientes.tsx:522-524`:
```ts
} catch (err) {
  console.error('[clientes] erro ao salvar:', err);
}
```
**Sem toast**. `useSupabaseCrud` faz toast por dentro? Sim — então duplicação aqui é benigna mas inconsistente com `Fornecedores`. Padronizar.

#### D4. Navegação após criar inconsistente
- `OrcamentoForm`: `navigate(/orcamentos/${id})` ✓ leva à edição.
- `usePedidosCompra`: fecha modal e refaz lista (não navega).
- `useCotacoesCompra`: fecha modal e refaz lista.
- `Fiscal`: fecha modal e refaz lista.
- `RemessaForm`: `navigate("/logistica")` (volta à lista).
- `Funcionarios`: fecha modal.

Sem padrão. Para documentos longos (NF, Orçamento, Pedido), a UX típica é abrir em edit pós-create para conferir. Para cadastros leves (cliente, fornecedor), fechar é ok. Definir regra: **documentos com itens** → navegar para detalhe; **cadastros simples** → fechar.

### E. Diferença create vs edit

#### E1. Tela única para os dois modos com flags
Padrão dominante (`Fiscal`, `Cotações`, `Pedidos modal`, `Clientes`, `Funcionarios`) — concentra ~600 linhas mostrando seções condicionais. Resulta em:
- props enormes
- bugs onde modo create exibe info de edit (ex: contas vinculadas, histórico)
- difícil de testar

`OrcamentoForm`, `PedidoCompraForm`, `CotacaoCompraForm`, `RemessaForm` viraram páginas — bom padrão, mas só os "documentos pesados".

#### E2. Defaults divergentes entre criar e duplicar
`OrcamentoForm.handleDuplicate` repete o payload completo da função `onSubmit`, com pequenas diferenças (status forçado a "rascunho", validade=null). Risco: um campo novo no schema é adicionado em onSubmit e esquecido em duplicate.

Padrão alvo: helper `buildOrcamentoPayload(form, override?)`.

#### E3. Drawer "ver" em modal "edit" em create
`Funcionarios`, `Clientes`: o mesmo modal serve para "criar/editar". Em create, sub-tabs (folha, financeiro, transportadoras, endereços) ficam visíveis mas vazias com banner "salve para adicionar". Pode confundir. Solução leve: `tabsVisiveis = mode === "edit" ? ["dados", "endereços", ...] : ["dados"]`.

### F. Estrutura de código

#### F1. Tamanho dos hooks/páginas de create
- `Clientes.tsx` — 1633 linhas (modal create+edit no mesmo file)
- `useCotacoesCompra.ts` — 519 linhas
- `usePedidosCompra.ts` — 615 linhas
- `Fiscal.tsx` — 886 linhas
- `OrcamentoForm.tsx` — 1264 linhas
- `Produtos.tsx` — 1226 linhas

Memória `diretrizes-de-desenvolvimento` cita decomposição de god components. Esses passaram do limite. Refactor amplo é fora do escopo desta passada — anotar.

#### F2. Tipos `*FormData` espalhados
Cada tela define `interface XForm`. `cotacaoCompraTypes.ts` e `pedidoCompraTypes.ts` já existem como abstração. Estender padrão: extrair tipos `XForm` para `src/pages/<modulo>/types.ts`.

#### F3. Duplicação de validação inline
Opção: criar helper `validateRequired(form, fields, labels)` para os 18 lugares que fazem 2-5 `if (!form.x) toast.error(...)`. Mas Zod resolve melhor.

## Estratégia de correção (esta passada)

### Fase 1 — Datas frescas (corrige C2)
Substituir `new Date().toISOString().split("T")[0]` em **escopo de módulo** por:
- helper `todayISO()` em `src/lib/dateUtils.ts` (se não existir)
- chamada **dentro** de `openCreate`/`handleSubmit`

Arquivos: `Fiscal.tsx`, `FluxoCaixa.tsx`, `cotacaoCompraTypes.ts`, `PedidoCompraForm.tsx` initial state, `RemessaForm.tsx` (já dinâmico ✓).

### Fase 2 — Numeração: remover fallbacks `Date.now().slice` (corrige B1)
Em vez de `numero || \`PC-${Date.now()}...\``, fazer:
```ts
if (!rpcNumero) {
  toast.error("Não foi possível gerar número. Tente novamente.");
  setSaving(false);
  return;
}
```
Arquivos: `usePedidosCompra.ts`, `useCotacoesCompra.ts` (openCreate + gerarPedido), `OrcamentoForm.tsx` (load + duplicate), `Orcamentos.tsx` duplicar.

### Fase 3 — Migrar setSaving manual para useSubmitLock (corrige D1)
Migrar 4 hotspots críticos com problema real (não todos):
- `useCotacoesCompra.handleSubmit` — sem ref síncrona, atomicidade fraca em edit.
- `usePedidosCompra.handleSubmit` — tem `if (saving) return` manual mas pode usar o hook.
- `Fiscal.handleSubmit` — `setSaving` esquecido em catch interno.
- `Clientes.handleSubmit` — alinhar com Fornecedores (já corrigido).

### Fase 4 — Validação Zod em handlers críticos (corrige C1, C3)
Migrar 4 handlers para `validateForm(schema, form)`:
- `Fiscal.handleSubmit` — usar `nfeSchema` existente.
- `useCotacoesCompra.handleSubmit` — criar `cotacaoCompraSchema` simples (numero, data_cotacao, itens > 0, sem duplicado).
- `usePedidosCompra.handleSubmit` — criar `pedidoCompraSchema`.
- `RemessaForm.handleSubmit` — schema mínimo.

Demais (FluxoCaixa, Estoque, ContasBancarias, FormasPagamento) ficam para próxima passada.

### Fase 5 — Helper `buildOrcamentoPayload` (corrige E2)
Extrair construção do payload de `OrcamentoForm.onSubmit` para função reutilizada por `handleDuplicate`. Reduz risco de divergência.

### Fase 6 — Atomicidade em edit (corrige D2 parcial)
Não criar RPCs novas (fora do escopo). Mas:
- `useCotacoesCompra.handleSubmit` (edit): trocar `Promise.all([update, delete])` por `await update; await delete` sequencial; envolver itens insert em try/catch e reverter status se falhar.
- Anotar dívida: criar RPC `salvar_cotacao_compra` e `salvar_nota_fiscal` em passada futura.

### Fase 7 — Catches uniformes (corrige D3)
- `Clientes.handleSubmit` catch: adicionar `toast.error(getUserFriendlyError(err))`.
- Verificar e padronizar `Fornecedores`, `GruposEconomicos`, `FormasPagamento` (rápida varredura).

### Fase 8 — Esconder seções inválidas em create (corrige A3)
- `Clientes` modal: `mode === "create"` esconde tabs "Endereços de Entrega", "Transportadoras", "Comunicações" (já há banner; remover seções vazias).
- `Funcionarios` modal: mesmo para "Folha" e "Financeiro".

Mudança visual mínima — funcional.

## Fora do escopo (anotado para passadas futuras)
- Refatorar `Clientes.tsx`, `Fiscal.tsx`, `OrcamentoForm.tsx`, `Produtos.tsx` em sub-componentes (>1000 linhas).
- Criar RPCs `salvar_cotacao_compra`, `salvar_pedido_compra`, `salvar_nota_fiscal` para atomicidade real.
- Migrar `Clientes`/`Funcionarios` de modal único para páginas dedicadas como `OrcamentoForm`.
- Extrair tipos `*Form` de todas as telas para `pages/<modulo>/types.ts`.
- Migrar todos os handlers inline restantes para Zod.
- Padronizar navegação pós-create (decisão de produto: documentos pesados → detalhe).
- Mover `openCreate` async (busca de número) para padrão único.

## Critério de aceite
- Datas em emptyForm convertidas para função/dinâmico.
- Fallbacks `Date.now()` removidos da numeração; toast de erro se RPC falhar.
- 4 handlers críticos migrados para `useSubmitLock`.
- 4 handlers usando `validateForm(zodSchema)`.
- `OrcamentoForm` com `buildOrcamentoPayload` compartilhado entre save e duplicate.
- `useCotacoesCompra` edit sequencial, sem race.
- Clientes/Funcionarios modal: tabs irrelevantes ocultas em create.
- Build OK; zero regressão funcional.

## Arquivos afetados
- `src/lib/dateUtils.ts` — helper `todayISO()` (criar/estender)
- `src/pages/Fiscal.tsx` — datas, numeração? (manual ok), useSubmitLock, validateForm
- `src/pages/FluxoCaixa.tsx` — datas dinâmicas
- `src/components/compras/cotacaoCompraTypes.ts` — datas dinâmicas
- `src/pages/PedidoCompraForm.tsx` — datas dinâmicas no initial
- `src/hooks/useCotacoesCompra.ts` — useSubmitLock, validateForm, edit sequencial, fallback
- `src/hooks/usePedidosCompra.ts` — useSubmitLock, fallback removido
- `src/pages/OrcamentoForm.tsx` — fallback removido + buildPayload helper
- `src/pages/Orcamentos.tsx` — fallback removido
- `src/pages/Clientes.tsx` — toast em catch + tabs hidden em create
- `src/pages/Funcionarios.tsx` — tabs hidden em create
- `src/lib/cotacaoCompraSchema.ts` — **novo** schema Zod
- `src/lib/pedidoCompraSchema.ts` — **novo** schema Zod
- `src/pages/RemessaForm.tsx` — validateForm minimal

## Entregáveis
Resumo final por categoria: datas frescas, numeração atômica, lock de submit, validação Zod, atomicidade edit, navegação pós-create, modal create/edit (tabs).

