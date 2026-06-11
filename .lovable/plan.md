# Plano — 3 correções

## 1. Número do orçamento "some" após salvar

**Diagnóstico:** Em `src/pages/OrcamentoForm.tsx`, ao salvar um novo orçamento:
1. `salvar_orcamento` (RPC) gera o número server-side e retorna o `orcId`.
2. O código faz um `select numero` e `setValue("numero", row.numero)`.
3. Em seguida navega para `/orcamentos/:id?created=1`, o que muda `isEdit` para true e dispara o `useEffect` de `loadData`, que faz `reset({...})` com `orc.numero` retornado por `getOrcamentoById`.

O `reset` corre logo após o navigate; se `getOrcamentoById` (que usa `select`/`maybeSingle`) retornar a linha **antes** do trigger/replicação atualizar o campo `numero`, ou se o serviço pega um shape onde `numero` está vazio (alias), o campo aparece em branco. Há ainda o caso em que o usuário pressiona Salvar uma 2ª vez sem fechar o form — `buildOrcamentoPayload` força `numero: ""` quando `!isEdit`, mas após o save bem-sucedido a tela já navegou; nesse caso o sintoma vem de `reset` sobrescrever um `setValue` recente.

**Correção:**
- Em `OrcamentoForm.tsx` `handleSave`:
  - Buscar o `numero` definitivo do `salvar_orcamento` (já feito) e **navegar somente após confirmar** que `row.numero` veio preenchido. Se vier `null`, retentar 1x.
- Em `loadData` (ramo `isEdit`):
  - Se `orc.numero` vier vazio/null mas o form já tem um `numero` setado (caso recém-criado), **preservar** o valor atual em vez de sobrescrever com vazio: usar `reset({ ...orc, numero: orc.numero || getValues('numero') })`.
- Adicionar log de telemetria curta (`logger.warn`) quando `orc.numero` voltar vazio para diagnóstico futuro.

## 2. Máscara CNPJ em todos os campos + busca tolerante

**Diagnóstico:** Já existe `cnpjMask`/`cpfCnpjMask` em `src/utils/masks.ts` e `MaskedInput` em `src/components/ui/MaskedInput.tsx`. Vários formulários ainda usam `<Input>` puro para `cpf_cnpj` (ex.: `Fornecedores`, `Transportadoras`, `Clientes`, `RemessaForm`, `QuickAdd*Modal`, `EmpresaInfoSection`, etc.). Buscas atuais comparam strings literais — pesquisar "12.345.678/0001-99" não acha registros salvos como dígitos puros (e vice-versa).

**Correção:**
- **Inputs de CNPJ/CPF:** trocar `<Input>` por `<MaskedInput mask="cnpj">` (ou `mask="cpfcnpj"` quando o campo aceita ambos) nos formulários listados. Manter store/DB **somente dígitos** (normalização no `onChange`/submit).
- **Helper de busca:** criar `src/utils/searchMatch.ts` com:
  - `normalizeDocSearch(value)` → remove tudo que não for dígito.
  - `matchesDoc(haystack, needle)` → compara depois de normalizar ambos os lados.
- **Aplicar nos filtros client-side** que hoje fazem `cpf_cnpj.includes(query)`:
  - `Clientes.tsx`, `Fornecedores.tsx`, `Transportadoras.tsx`, `GruposEconomicos.tsx`, `ContasBancarias.tsx`, `FluxoCaixa.tsx` (filtros de partes), `Fiscal.tsx`/`DistDFeHistorico.tsx` (filtro destinatário/emitente), `RemessaForm.tsx` selector de cliente, `OrcamentoForm.tsx` selector.
- **Buscas server-side (Supabase `.ilike`)**: detectar se o `query` tem só dígitos; quando sim, aplicar `.or('cpf_cnpj.ilike.%X%,nome_razao_social.ilike.%X%')`. Quando tem máscara, normalizar antes de mandar ao banco. Pontos: `hooks/useFavoritos`, lookups que paginam por `cpf_cnpj` no servidor.
- Buscas em telas mobile (cards/lista) usam o mesmo helper.

## 3. Truncamento de nome/variação em mobile

**Diagnóstico:**
- `EstoqueAjusteSheet.tsx` (linhas 191 e 255): `<p className="font-medium text-sm truncate">{p.nome}{formatVariacoesSuffix(...)}</p>` — `truncate` corta em uma linha, gerando "AGULHA DESCART… — 25 X 8" mesmo havendo espaço vertical.
- Card de produto mobile em `Produtos.tsx` mostra título com `truncate` e SKU/Interno na 2ª linha; nomes longos viram "AGULHA DESCARTAVEL - 100…".
- Card do drawer "Selecionar produto" (print 1) corta a variação "25 X 1…" do lado direito.

**Correção:**
- Trocar `truncate` por `break-words line-clamp-2` (ou `whitespace-normal break-words` quando há espaço vertical garantido):
  - `EstoqueAjusteSheet.tsx`: tornar o `<p>` do nome `line-clamp-2 leading-snug`; mover/manter `variacao` em linha separada quando ficar longo.
  - `Produtos.tsx` card mobile: nome com `line-clamp-2`; manter SKU/Interno + Estoque/Margem como hoje.
  - `EstoquePosicaoDrawer` e demais cards mobile do módulo Estoque que reaproveitam o mesmo padrão.
- Ajustar largura do badge de saldo (`shrink-0`) para garantir que o nome use a coluna inteira.
- Auditar rapidamente outros cards mobile compartilhados que herdam `truncate` em título de produto (grep de `text-sm.*truncate` em `src/pages` e `src/components`, fixando apenas onde for nome/descrição multi-palavra).

## Detalhes técnicos

- Manter contrato `mem://tech/exibicao-codigo-produto`: não duplicar `codigo_interno` e `sku` quando iguais.
- Não criar migration: tudo é frontend.
- `MaskedInput` já normaliza no `onChange`; verificar se cada formulário envia dígitos puros para o banco (tirar `.replace(/\D/g,'')` redundante no submit quando já vem normalizado).
- Helper `matchesDoc` recebe `string | null | undefined` para evitar NPEs nos filtros existentes.

## Validação
- Criar/salvar orçamento → número permanece visível após o redirect.
- Cadastrar fornecedor digitando "12345678000195" → input mostra `12.345.678/0001-95`; salva como dígitos.
- Filtrar lista de clientes por `12.345` e por `12345` → ambos retornam o mesmo conjunto.
- Sheet mobile "Selecionar produto" → nome longo quebra em 2 linhas sem cortar a variação.
