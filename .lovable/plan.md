

# Finalização das pendências da Revisão de Migração

Restam 4 lacunas das 11 correções do documento de revisão. As demais (aliases, schema novo, RPCs base, smoke tests) já estão aplicadas. Este plano foca exclusivamente no que ainda não funciona ponta-a-ponta.

---

## Pendência 1 — Hierarquia sintética do plano de contas

A tabela `contas_contabeis_sinteticas` e a RPC `carga_inicial_processar_extras` já existem, mas ninguém envia linhas com `_tipo='sintetica'` ao staging. O parser não lê a aba `Sinteticas` e o `useCargaInicial` não a empacota.

**`src/lib/importacao/conciliacaoParser.ts`**
- Adicionar tipo `SinteticaRow { codigo; descricao; nivel; conta_pai_codigo; _originalLine }` e expor `sinteticas: SinteticaRow[]` em `ConciliacaoBundle`.
- Em `parseConciliacaoWorkbook`, buscar aba via `findSheet(wb, ["Sinteticas","Sintéticas"])` e chamar novo `parseSinteticas` (colunas: `Código Sintético`, `Nome Sintético Sugerido`, `Nível`, `Conta Pai`).

**`src/hooks/importacao/useCargaInicial.ts`**
- Acrescentar `bundle.sinteticas.forEach(s => cadRows.push({ ..., dados: { _tipo: "sintetica", codigo: s.codigo, descricao: s.descricao, nivel: s.nivel, conta_pai_codigo: s.conta_pai_codigo } }))` antes do plano analítico.
- Atualizar `CargaInicialResumo.contagens` com `sinteticas`.

**Migração SQL**
- Alterar `carga_inicial_processar_extras` para também: após criar sintéticas, fazer `UPDATE contas_contabeis SET conta_sintetica_codigo = (mais longo prefixo do código que case com `contas_contabeis_sinteticas.codigo`)` para amarrar a hierarquia.

---

## Pendência 2 — `conta_bancaria_id` no financeiro

O campo `Banco` chega ao JSONB mas vira só texto. `contas_bancarias` tem `descricao` (não `apelido`).

**Migração SQL — `consolidar_lote_financeiro`**
- Adicionar bloco após resolução da conta contábil:
  ```sql
  IF v_dados->>'banco' IS NOT NULL AND v_dados->>'banco' <> '' THEN
    SELECT id INTO v_conta_bancaria_id FROM contas_bancarias
     WHERE upper(unaccent(descricao)) = upper(unaccent(v_dados->>'banco'))
        OR upper(unaccent(titular))   = upper(unaccent(v_dados->>'banco'))
     LIMIT 1;
  END IF;
  ```
- Incluir `conta_bancaria_id` no `INSERT INTO financeiro_lancamentos`.
- Mesmo bloco em `merge_lote_conciliacao`.

---

## Pendência 3 — `produtos_fornecedores` na carga inicial

A RPC `vincular_produto_fornecedor` já está pronta; falta invocá-la dentro de `carga_inicial_conciliacao` após o loop de produtos/insumos.

**Migração SQL — `carga_inicial_conciliacao`**
- Após o `INSERT/UPDATE` de cada produto, se `dados->>'fornecedor_principal_nome'` ou `fornecedor_principal_legado` existirem, chamar:
  ```sql
  PERFORM vincular_produto_fornecedor(
    v_produto_id,
    dados->>'fornecedor_principal_nome',
    dados->>'fornecedor_principal_legado',
    dados->>'ref_fornecedor',
    dados->>'url_produto_fornecedor',
    NULL
  );
  ```
- Idem em `merge_lote_conciliacao`.

---

## Pendência 4 — `custo_historico_unitario` em NF itens

Coluna existe mas RPC ignora. Preserva margem real da época da venda.

**Migração SQL — `consolidar_lote_faturamento`**
- No `INSERT INTO notas_fiscais_itens`, acrescentar coluna e valor:
  ```sql
  custo_historico_unitario = NULLIF(v_item->>'custo_unitario','')::numeric
  ```
- Documentar em `docs/MIGRACAO.md` que esse campo congela o custo histórico (separado do custo médio atual do produto).

---

## Detalhes técnicos

**Arquivos editados:**
- `src/lib/importacao/conciliacaoParser.ts` (parseSinteticas + tipo)
- `src/hooks/importacao/useCargaInicial.ts` (staging de sintéticas + resumo)
- `docs/MIGRACAO.md` (parágrafo sobre custo histórico)
- 1 nova migration SQL com 4 alterações de função (`carga_inicial_processar_extras`, `consolidar_lote_financeiro`, `merge_lote_conciliacao`, `carga_inicial_conciliacao`, `consolidar_lote_faturamento`).

**RPCs alteradas (todas mantendo `SET search_path = public, SECURITY DEFINER`):**
- `consolidar_lote_financeiro` — resolver `conta_bancaria_id` por descricao/titular.
- `merge_lote_conciliacao` — idem + chamada `vincular_produto_fornecedor`.
- `carga_inicial_conciliacao` — chamada `vincular_produto_fornecedor`.
- `carga_inicial_processar_extras` — pós-processo de `conta_sintetica_codigo` por prefixo.
- `consolidar_lote_faturamento` — gravar `custo_historico_unitario`.

**Fora de escopo:** UI para visualizar sintéticas/centros de custo; reprocessar lotes já consolidados (rodar manualmente após deploy se desejado); criar coluna `apelido` em `contas_bancarias` (a busca usará `descricao`/`titular` que já existem).

