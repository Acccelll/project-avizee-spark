## Resumo

Seis ajustes coordenados para reduzir atrito no fluxo Comercial → Fiscal e padronizar nomenclatura. Todos preservam a stack atual (sem refactors) e seguem a doutrina já memorizada (StatusVariantMap, ViewDrawerV2, RBAC).

---

## 1. Tooltip nos itens do autocomplete (nome cortado)

**Onde:** `src/components/ui/AutocompleteSearch.tsx` (componente único — corrige todos os pontos: tradução XML, ItemsGrid, OrcamentoItemsGrid, ProductAutocomplete).

**Solução proposta:** atributo `title` nativo no `<button>` da opção, contendo `label + sublabel + metaLine`. É o caminho rápido, acessível e zero-dependência — surge ao passar o mouse sem precisar de Radix Tooltip dentro do dropdown (que conflitaria com o portal do popover). Mantém o `truncate` visual atual.

> Alternativa avaliada (Radix Tooltip): exige envolver cada linha em `<TooltipProvider>` dentro de um popover já posicionado em z-50 — risco de flicker e custo maior. Descartada em favor do `title` nativo.

---

## 2. "Itens da Nota" muito pequena — mínimo de 3 linhas

**Onde:** `src/components/ui/ItemsGrid.tsx` (estado vazio).

Trocar `text-center text-muted-foreground py-8` por uma área com `min-h-[180px]` (≈3 linhas de input) e empty-state mais útil: ícone + texto + atalho **"+ Adicionar primeiro item"**. Vale tanto na tabela desktop (`<tr><td>` com altura mínima) quanto no card mobile.

---

## 3. Cadastro rápido de produto/cliente durante a nota (manual e XML)

Aproveita o `onCreateNew` que **já existe** em `AutocompleteSearch` (hoje só renderiza quando não há resultado) e adiciona um drawer leve de cadastro express.

**Componentes novos:**
- `src/components/cadastro-rapido/QuickProdutoDrawer.tsx` — campos mínimos: nome, grupo, unidade, código interno (auto-sugerido pela regra do item 4), preço de custo. Salva em `produtos` com `tipo_item='produto'`, `ativo=true`. Devolve o produto criado.
- `src/components/cadastro-rapido/QuickClienteDrawer.tsx` — nome/razão, CPF/CNPJ (com lookup via `useCnpjLookup` já existente), e-mail, telefone. Demais campos editáveis depois em `/clientes`.
- `src/components/cadastro-rapido/QuickFornecedorDrawer.tsx` — análogo, usado na entrada XML quando o emitente não está cadastrado.

**Pontos de integração:**
- `ItemsGrid` e `OrcamentoItemsGrid`: passar `onCreateNew` que abre `QuickProdutoDrawer`; ao confirmar, faz `refetch` da lista de produtos e seleciona o recém-criado na linha.
- `TraducaoXmlDrawer`: idem para cada linha pendente — pré-preenche nome com `xProd` e código interno seguindo a regra do grupo escolhido. Após criar, atualiza o `produtoId` da linha e oferece marcar `salvarDePara`.
- `useNFeXmlImport`: quando o emitente não casa com nenhum fornecedor, exibir CTA **"Cadastrar fornecedor a partir do XML"** já com CNPJ, razão, IE e endereço pré-preenchidos do `nfe.emitente`.
- Cabeçalho do `Fiscal.tsx` (cliente do destinatário em saída): mesmo padrão.

**RBAC:** drawers respeitam `can('produtos','editar')`, `can('clientes','editar')`, `can('fornecedores','editar')`. Sem permissão, o botão some.

---

## 4. Regra de nomenclatura de SKU = SIGLA DO GRUPO + sequência

**Schema (migração):**
- Adicionar `grupos_produto.sigla TEXT` (2–4 chars, único quando preenchido). UI em `/produtos` aba "Grupos" para editar.
- Sequência por grupo via tabela `grupos_produto_sku_seq(grupo_id uuid PK, ultimo_numero int)` e RPC `proximo_sku_grupo(_grupo_id uuid) returns text` (`SECURITY DEFINER, search_path=public`) — segue a doutrina de **numeração atômica via SEQUENCES/RPCs** (mem://tech/numeracao-atomica-documentos).
- Formato: `{SIGLA}{NNN}` com padding mínimo 3 (ex.: `AG001`, `AG002`); cresce sozinho a partir de 999.

**UI em `Produtos.tsx`:**
- Ao selecionar/mudar `grupo_id` no formulário, e o campo SKU estiver vazio, chama `proximo_sku_grupo` e preenche.
- Botão "Gerar próximo" ao lado do input SKU (sempre disponível) — preview sem reservar até salvar.
- Validação Zod no `produtoSchema`: se grupo tem sigla, SKU deve começar com ela (warning, não bloqueio, para preservar legados).
- Mesma lógica usada no `QuickProdutoDrawer` do item 3.

> Não retroage SKUs existentes — só padroniza novos.

---

## 5. Fluxo "Gerar Pedido" no Comercial — clarificar que **não** é nota fiscal

**Diagnóstico:** hoje o botão e o status na `OrdemVendaView` (status_faturamento + ícone Receipt) dão impressão de emissão fiscal. Falta evidenciar **origem (orçamento)**, **número do pedido do cliente** e **destino (NF emitida / faturado)**.

**Ações:**
- Renomear CTA principal de "Gerar Pedido" → **"Converter em Pedido de Venda"** com subtítulo "(não emite nota — apenas confirma a venda)".
- No `OrcamentoView`/dialog de conversão, exibir card explicativo com 3 etapas em linha (timeline horizontal):

```text
Orçamento #123  →  Pedido #PV-456  →  NF-e #000789
   (origem)         (esta etapa)        (próxima — Faturar)
```

- Adicionar campo **"Nº pedido do cliente"** (`pedido_cliente_ref TEXT` em `pedidos_venda`) no diálogo de conversão e na aba Faturamento — referência opcional de PO do cliente para casar depois com NF.
- Em `OrdemVendaView`:
  - Abrir bloco "Origem" mostrando link clicável para o orçamento (`Orçamento #X — aceito em DD/MM`).
  - Aba "Faturamento" hoje existente: trocar o badge "Status faturamento" por **timeline visual** (Não faturado → Parcial → Faturado) usando o `STATUS_VARIANT_MAP` (mem://produto/contrato-de-status).
  - Exibir lista de NFs vinculadas com nº/série/chave, valor, data — link para `/fiscal?id=...`.
- CTA secundário **"Faturar agora"** continua existindo, mas só ativo quando o pedido está aprovado e tem saldo a faturar; texto do botão: "Emitir NF-e deste pedido".

**Migração:** `ALTER TABLE pedidos_venda ADD COLUMN pedido_cliente_ref TEXT;` + `chk_` se quiser limitar tamanho.

---

## 6. Remover "(novo)" do submódulo Faturamento

**Onde:** `src/lib/navigation.ts:196`.

Trocar `'Faturamento (novo)'` por `'Faturamento'`. Verificar também sidebar/breadcrumbs derivados (não há outras ocorrências do label "(novo)" — confirmado por busca).

---

## Detalhes técnicos

**Migrações SQL** (uma única, fase 1):
```sql
ALTER TABLE grupos_produto ADD COLUMN sigla TEXT;
CREATE UNIQUE INDEX uq_grupos_produto_sigla ON grupos_produto(sigla) WHERE sigla IS NOT NULL;

CREATE TABLE grupos_produto_sku_seq (
  grupo_id uuid PRIMARY KEY REFERENCES grupos_produto(id) ON DELETE CASCADE,
  ultimo_numero int NOT NULL DEFAULT 0
);
ALTER TABLE grupos_produto_sku_seq ENABLE ROW LEVEL SECURITY;
-- política: leitura/escrita só via RPC SECURITY DEFINER

CREATE OR REPLACE FUNCTION proximo_sku_grupo(_grupo_id uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_sigla text; v_num int;
BEGIN
  SELECT sigla INTO v_sigla FROM grupos_produto WHERE id = _grupo_id;
  IF v_sigla IS NULL THEN RAISE EXCEPTION 'Grupo sem sigla configurada'; END IF;
  INSERT INTO grupos_produto_sku_seq(grupo_id, ultimo_numero) VALUES (_grupo_id, 1)
    ON CONFLICT (grupo_id) DO UPDATE SET ultimo_numero = grupos_produto_sku_seq.ultimo_numero + 1
    RETURNING ultimo_numero INTO v_num;
  RETURN v_sigla || lpad(v_num::text, 3, '0');
END $$;

ALTER TABLE pedidos_venda ADD COLUMN pedido_cliente_ref TEXT;
```

**Memória a atualizar** após implementação:
- `mem/features/traducao-xml-fiscal.md` — anotar suporte a quick-create de produto/fornecedor.
- Nova entrada `mem/features/cadastro-rapido.md` — padrão dos QuickDrawers.
- Nova entrada `mem/features/sku-por-grupo.md` — regra SIGLA+NNN e RPC.
- Atualizar `mem/index.md` (Memories).

## Ordem sugerida de execução

1. Itens **1, 2, 6** (correções rápidas, baixíssimo risco) — mesma entrega.
2. Item **4** (migração + sigla + RPC + UI grupo/produto).
3. Item **3** (QuickDrawers, depende do item 4 para autosugerir SKU).
4. Item **5** (refino do fluxo Comercial → Pedido → NF).

Quer aprovar tudo de uma vez ou prefere fatiar em duas entregas (1+2+6 primeiro, depois 3+4+5)?