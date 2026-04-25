## Objetivo
Garantir que as variações estejam realmente visíveis e corretas no cadastro de produtos, no drawer, na tela de edição e nos orçamentos, usando os dados já existentes no banco e coerentes com o anexo.

## O que foi validado
- Os dados existem no banco: produtos como `AG011`, `AG012`, `AG013`, `AG014`, `AG015`, `AG017`, `AG018` e `AG019` já têm `variacoes` preenchido, coerente com o anexo.
- Exemplo do produto aberto agora no preview: `e9f12579-7047-4e88-b084-ecca89becafb` (`AG008`) tem `variacoes = "40 X 16"` no banco.
- A tela de Produtos hoje **não renderiza nenhuma coluna “Variações”** na grid, apesar da expectativa do usuário.
- O drawer de produto (`ProdutoView.tsx`) também **não exibe** o campo `variacoes`.
- A tela de edição (`Produtos.tsx`) tem o campo “Variações Comerciais”, mas a leitura/escrita está inconsistente:
  - o tipo gerado do banco é `variacoes: string | null`
  - o formulário trata como `string[] | null` em alguns pontos (`Array.isArray(...)`), então produtos já salvos em texto podem abrir “sem variação” no form.
- No orçamento, a exibição do snapshot `item.variacao` existe no grid/drawers/PDF/link público, mas a carga ao editar um orçamento ainda faz `setItems(itensData)` sem normalização; isso precisa ser alinhado ao contrato do componente.
- Há passivo de dados em orçamentos antigos: todos os 80 itens de orçamento ligados a produtos com `variacoes` preenchidas estão com `orcamentos_itens.variacao` vazio.

## Plano de implementação
1. Corrigir o contrato de `variacoes` no módulo de Produtos para trabalhar com `string | null` como fonte canônica, normalizando texto CSV apenas no formulário.
2. Exibir variações onde hoje estão faltando:
   - grid de Produtos: adicionar coluna `Variações`
   - drawer `ProdutoView`: mostrar campo `Variações` na aba Geral
   - tela de edição: garantir que o valor salvo abra corretamente no input e nos chips
3. Normalizar a hidratação de itens em `OrcamentoForm.tsx` para garantir que `variacao` continue visível ao reabrir orçamentos editáveis.
4. Criar migração de backfill para popular `orcamentos_itens.variacao` com o snapshot atual de `produtos.variacoes` onde estiver vazio, preservando o comportamento esperado em PDFs, link público, drawers e grids antigos.
5. Revisar a importação para aceitar tanto `VARIAÇÕES` quanto texto simples, mantendo armazenamento consistente em `produtos.variacoes`.

## Resultado esperado
- A coluna “Variações” aparece na aba Produtos.
- O drawer de produto mostra a variação cadastrada.
- A edição do produto abre com a variação já preenchida.
- Orçamentos novos e antigos passam a mostrar a variação ao cliente quando houver snapshot faltante.

## Detalhes técnicos
- Arquivos principais:
  - `src/pages/Produtos.tsx`
  - `src/components/views/ProdutoView.tsx`
  - `src/pages/OrcamentoForm.tsx`
  - `src/components/Orcamento/OrcamentoItemsGrid.tsx` (revisão de compatibilidade)
  - `src/lib/importacao/validators.ts` (se precisar endurecer normalização)
  - nova migration SQL para backfill de `orcamentos_itens.variacao`
- Ajuste central: parar de tratar `produtos.variacoes` como array no front deste módulo; usar string canônica e converter somente para exibição/chips.
- Backfill seguro:
```text
update orcamentos_itens oi
set variacao = p.variacoes
from produtos p
where p.id = oi.produto_id
  and coalesce(btrim(p.variacoes), '') <> ''
  and coalesce(btrim(oi.variacao), '') = '';
```
- Após isso, a mesma informação ficará consistente entre produto, orçamento, PDF e link público.