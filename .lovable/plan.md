## Diagnóstico atual

Hoje, ao importar um XML de NF-e (Fiscal → Importar XML), o sistema faz três "traduções" automáticas, mas todas invisíveis para o usuário:

1. **Fornecedor** — match silencioso por CNPJ (toast genérico).
2. **Produto** — match por `codigo_interno`/`sku` igual ao `cProd` do XML; quando não acha, deixa `produto_id` vazio e mostra apenas "X itens não vinculados".
3. **Unidade & valor unitário** — usa cegamente `uCom`, `qCom` e `vUnCom` do XML. Não há comparação com a unidade do cadastro do produto (`produtos.unidade_medida`), nem fator de conversão. Se o fornecedor emite em **KG** e internamente trabalhamos em **UN/MT**, o estoque entra errado e o custo unitário fica distorcido.

O banco já tem a base para corrigir isso (não precisa migration nestes campos):
- `notas_fiscais_itens` possui: `codigo_produto_origem`, `descricao_produto_origem`, `unidade_origem`, `quantidade_origem`, `valor_unitario_origem`, `valor_total_origem`, `match_status`.
- `produtos_fornecedores` possui: `referencia_fornecedor`, `descricao_fornecedor`, `unidade_fornecedor` (de-para por fornecedor já modelado, mas sem fator de conversão).
- `produtos.unidade_medida` é a unidade interna canônica.

O que falta é (a) **uma etapa explícita de tradução** no wizard de importação e (b) **fator de conversão** persistido no de-para.

## Princípio inegociável

O que está no XML é a **verdade fiscal** e nunca é alterado. A "tradução" só afeta os campos internos (estoque, custo, vínculo de produto). Os campos `*_origem` em `notas_fiscais_itens` guardam o XML cru.

## Mudanças propostas

### 1. Banco — fator e regra de conversão no de-para

Migration em `produtos_fornecedores`:
- `fator_conversao numeric NOT NULL DEFAULT 1` — quantos "unidade interna" cabem em 1 "unidade do fornecedor". Ex.: fornecedor vende KG, interno é MT, 1 KG = 0,25 MT → fator 0,25.
- `chk_fator_conversao_pos CHECK (fator_conversao > 0)`.
- Índice `(fornecedor_id, referencia_fornecedor)` para lookup rápido na importação.

### 2. Drawer "Tradução XML" — opcional ou obrigatório

Ao importar XML, classificar cada item:

- **OK** — produto casado E (`uCom == produto.unidade_medida` OU já existe `produtos_fornecedores` com `fator_conversao` salvo).
- **Pendente** — sem `produto_id` OU unidade divergente sem fator memorizado.

Comportamento:
- **100% OK** → drawer **NÃO abre**. Vai direto ao formulário com banner discreto: "NF importada de XML. Tradução automática aplicada. [Ver tradução]".
- **Qualquer pendência** → drawer **abre obrigatoriamente** e bloqueia avanço até resolver todos os itens pendentes.
- Botão "Ver tradução" no banner reabre o drawer em modo somente-leitura.

Layout do drawer (uma linha por item, pendentes destacados no topo):

```text
┌─ Item 1  [PENDENTE] ────────────────────────────────────────┐
│ DO XML (fiscal — preservado)    →   NO SISTEMA              │
│ cProd:   1234.A                 →   [Produto: Cabo 6mm  ▾]  │
│ xProd:   CABO FLEX 6MM PR 100M  →   SKU: CAB-6-PR           │
│ uCom:    KG     qCom: 25,000    →   Unid. interna: MT       │
│ vUnCom:  18,40  vProd: 460,00   →   Fator: [0,25]  ⚠        │
│                                     Qtd convertida: 6,250 MT│
│                                     Custo unitário: 73,60   │
│ [✓ Salvar tradução para este fornecedor]                    │
└─────────────────────────────────────────────────────────────┘
```

Regras:
- Coluna esquerda **read-only** (XML cru).
- Pré-preenchimento: match por `(fornecedor, cProd)` em `produtos_fornecedores` → senão match por `codigo_interno`/`sku`.
- Fator default = 1 quando `uCom == produto.unidade_medida`; senão input destacado em amarelo até confirmação.
- Cálculo derivado em tempo real:
  - `qtd_interna = qCom × fator`
  - `vUn_interno = vProd / qtd_interna` (preserva o total)
- Checkbox "Salvar tradução" → upsert em `produtos_fornecedores` ao confirmar (default ligado para itens pendentes resolvidos).
- "Confirmar tradução" só habilita quando todos os itens têm `produto_id` e `fator > 0`.

### 3. Persistência — XML preservado, internos convertidos

Em `notas_fiscais_itens`:
- `codigo_produto_origem`, `descricao_produto_origem`, `unidade_origem`, `quantidade_origem`, `valor_unitario_origem`, `valor_total_origem` ← XML cru.
- `produto_id`, `unidade`, `quantidade`, `valor_unitario`, `valor_total` ← internos convertidos.
- `match_status`: `auto` (memorizado), `manual` (usuário escolheu/confirmou), `direto` (uCom == unidade interna, fator 1 sem precisar drawer).

Movimentação de estoque e custo médio passam a usar os campos internos — corretos por construção.

### 4. Cadastro do produto — visibilidade do de-para

Na aba "Fornecedores" do cadastro de produto, adicionar colunas `Cód. fornecedor` (`referencia_fornecedor`), `Unid. fornecedor`, `Fator conversão`, com helper "1 [un. fornecedor] = N [un. interna]". Permite cadastrar a tradução **antes** de receber o primeiro XML — assim a próxima importação cai em "100% OK".

## Convenção do fator (decidida)

`qtd_interna = qCom × fator_conversao`. Ex.: fornecedor envia 25 KG e usamos MT, 1 KG = 0,25 MT → `25 × 0,25 = 6,25 MT`.

## NFs antigas

Sem backfill. Continuam como estão; apenas novas importações usam o novo fluxo.

## Arquivos que serão tocados

- `supabase/migrations/<nova>.sql` — `fator_conversao` em `produtos_fornecedores` + constraint + índice.
- `src/pages/fiscal/hooks/useNFeXmlImport.ts` — passa a buscar de-para por `(fornecedor_id, referencia_fornecedor)`, classificar cada item (OK/pendente) e devolver estrutura de tradução com fator memorizado.
- `src/pages/fiscal/components/TraducaoXmlDrawer.tsx` *(novo)* — UI da tradução conforme mockup, modo edição e somente-leitura.
- `src/pages/Fiscal.tsx` — `handleXmlImport` decide: se há pendência, abre drawer; senão vai direto ao formulário com banner. Banner tem ação "Ver tradução".
- `src/services/fiscal.service.ts` (`buildNfItemsPayload`) — gravar `*_origem` + `match_status`.
- `src/pages/Cadastros.tsx` (aba Fornecedores do produto) — colunas `unidade_fornecedor` e `fator_conversao`.
- `mem://features/traducao-xml-fiscal` *(nova memória)* — doutrina: XML é fiscal e imutável; tradução afeta só interno; drawer obrigatório só com pendência; fator `qtd_interna = qCom × fator`.

## Ordem de execução

1. Migration `fator_conversao` + constraint + índice.
2. Estender `useNFeXmlImport` (lookup de-para + classificação OK/pendente).
3. Criar `TraducaoXmlDrawer` (componente puro).
4. Plugar drawer condicional + banner em `Fiscal.tsx`.
5. Atualizar `buildNfItemsPayload` para `*_origem` + `match_status`.
6. Estender aba Fornecedores do cadastro de produto.
7. Salvar memória da doutrina.
