

# Migração de Produtos e Faturamento — Preservação Total de Histórico

Implementar a estratégia que separa **catálogo atual** (produtos vivos da Conciliação) do **histórico imutável** (snapshots originais do Faturamento), com tabela-ponte de identificadores legados e classificação de match auditável.

---

## 1. Schema (migration SQL)

### 1.1 Ajustes em `produtos`
- Adicionar `descontinuado_em date NULL`.
- Adicionar `origem text` (default `'cadastro_manual'`); usar `'importacao_conciliacao'` ou `'importacao_legacy'`.
- `codigo_interno` continua como `codigo_atual` (já é UNIQUE). `tipo_item`, `unidade_medida`, `ativo`, `codigo_legado`, `variacoes` já existem — não recriar.
- Trigger `trg_produto_descontinuado`: quando `ativo` passa de true→false e `descontinuado_em` é null, gravar `now()::date`.

### 1.2 Nova tabela `produto_identificadores_legacy`
```text
id uuid PK
produto_id uuid FK→produtos(id) ON DELETE CASCADE
origem text NOT NULL                  -- 'faturamento_legacy' | 'conciliacao_legacy'
codigo_legacy text
descricao_legacy text
descricao_normalizada text            -- gerada via função
unidade_legacy text
match_tipo text CHECK IN
  ('exato_codigo','exato_descricao','manual','aproximado','nao_vinculado')
confianca_match numeric(3,2)          -- 0.00–1.00
ativo boolean DEFAULT true
observacao text
criado_em timestamptz DEFAULT now()
UNIQUE (origem, codigo_legacy, descricao_normalizada)
```
Índices: `(produto_id)`, `(codigo_legacy)`, `(descricao_normalizada)`. RLS: leitura autenticada; escrita admin/financeiro/estoquista.

### 1.3 Snapshot em `notas_fiscais_itens`
Adicionar colunas (NOT NULL após backfill — primeiro nullable, depois constraint):
```text
codigo_produto_origem text
descricao_produto_origem text
unidade_origem text
quantidade_origem numeric
valor_unitario_origem numeric
valor_total_origem numeric
produto_identificador_legacy_id uuid FK→produto_identificadores_legacy(id)
match_status text CHECK IN ('vinculado','nao_vinculado','manual','duvidoso')
origem_migracao text                 -- 'faturamento_legacy' nas linhas migradas
```
Trigger `trg_nf_item_snapshot_imutavel`: bloqueia UPDATE nas colunas `*_origem` (`RAISE EXCEPTION` se mudarem após insert).

### 1.4 Função utilitária SQL
```sql
CREATE OR REPLACE FUNCTION public.normalizar_descricao(p text)
RETURNS text LANGUAGE sql IMMUTABLE
SET search_path = public AS $$
  SELECT regexp_replace(
           lower(unaccent(coalesce(p,''))),
           '\s+', ' ', 'g'
         )::text
$$;
```
(usar a mesma em TS — `src/lib/importacao/produtoMatch.ts`).

---

## 2. Importação do catálogo atual (Conciliação → `produtos`)

Atualizar `consolidar_lote_cadastros` (RPC) para o caminho `_tipo='produto'|'insumo'`:
- Resolver duplicidade por `codigo_legado` antes de upsert.
- **Se houver duplicidade real do mesmo `codigo_atual` na planilha**: abortar o lote inteiro (`RAISE EXCEPTION`) e gravar `importacao_logs` com nível `error` listando as linhas conflitantes — NÃO consolidar parcial.
- Após upsert: gravar identidade própria em `produto_identificadores_legacy` com `origem='conciliacao_legacy'`, `match_tipo='exato_codigo'`, `confianca=1.00` (idempotente via UNIQUE).
- `produtos.origem = 'importacao_conciliacao'` quando inserido pela carga.

---

## 3. Importação do faturamento (`consolidar_lote_faturamento`)

Reescrita parcial da RPC. Para cada item do JSONB:

### 3.1 Snapshot obrigatório
Sempre gravar `codigo_produto_origem`, `descricao_produto_origem`, `unidade_origem`, `quantidade_origem`, `valor_unitario_origem`, `valor_total_origem` a partir do staging — antes de qualquer tentativa de match. Validação: se algum snapshot vier null/zero (exceto descrição), o item é rejeitado e contado em `erros`.

### 3.2 Pipeline de match (em ordem)
1. **Exato por código**: `codigo_legacy = produtos.codigo_legado` (ou `codigo_interno`). Confiança 1.0.
2. **Tabela ponte**: `produto_identificadores_legacy` com `codigo_legacy` igual + `ativo=true`.
3. **Exato por descrição normalizada**: `normalizar_descricao(descricao_legacy)` contra `produto_identificadores_legacy.descricao_normalizada` e contra `normalizar_descricao(produtos.nome)`. Confiança 0.85.
4. Se etapa 1 ou 3 retornar **>1 produto distinto**: `match_status='duvidoso'`, `produto_id=NULL`.
5. Se nenhum match: `match_status='nao_vinculado'`, `produto_id=NULL`.

### 3.3 Persistência do vínculo
- Quando match único é encontrado, fazer `INSERT … ON CONFLICT DO NOTHING` em `produto_identificadores_legacy` (origem `faturamento_legacy`, `match_tipo` conforme regra que disparou, `confianca` correspondente). Guardar o `id` retornado em `notas_fiscais_itens.produto_identificador_legacy_id`.
- `notas_fiscais.origem='importacao_historica'`, `movimenta_estoque=false`, `gera_financeiro=false` (já implementado, manter).

### 3.4 Produtos descontinuados
Se `match_status='nao_vinculado'` E `codigo_legacy` não vazio: criar produto com `ativo=false`, `descontinuado_em=now()`, `origem='importacao_legacy'`, `codigo_atual=codigo_legacy`, `descricao=descricao_legacy`, `tipo_item='produto'`, `unidade_medida=unidade_legacy`. Vincular via `produto_identificadores_legacy` com `match_tipo='exato_codigo'`, `confianca=1.00`. Item da NF passa a `match_status='vinculado'`. Contador `produtos_descontinuados_criados`.

### 3.5 Idempotência
- NF: `ON CONFLICT (chave_acesso) DO NOTHING` mantido.
- Item: `UNIQUE (nota_fiscal_id, codigo_produto_origem, valor_total_origem)` parcial onde `origem_migracao='faturamento_legacy'` para evitar duplicar item em reprocessamento.

---

## 4. Hook TS (`useImportacaoFaturamento`)

- `generatePreview`: mostrar contagem prevista de match por categoria (`vinculado/duvidoso/nao_vinculado/criar_descontinuado`) — apenas leitura, sem persistir.
- Adicionar função `normalizarDescricao` em `src/lib/importacao/produtoMatch.ts` reaproveitada no preview.
- `processImport`: continuar gravando staging → RPC; ler retorno expandido (`vinculados`, `duvidosos`, `nao_vinculados`, `descontinuados_criados`) e exibir no toast.

---

## 5. Relatório de migração

Nova RPC `relatorio_migracao_faturamento(p_lote_id uuid) RETURNS jsonb`:
```text
{
  total_itens, vinculados, duvidosos, nao_vinculados,
  pct_vinculados, pct_duvidosos, pct_nao_vinculados,
  produtos_descontinuados_criados,
  amostra_nao_vinculados: [{codigo, descricao, count}],   -- top 50
  amostra_descontinuados: [{produto_id, codigo, descricao}]
}
```
Componente `RelatorioMigracaoFaturamento` exibido na página `/migracao-dados` após consolidação (consome `importacao_logs` + RPC). Listas exportáveis como CSV via `/mnt/documents/`.

---

## 6. Validações pré-conclusão (SQL — verificação no fim da RPC)
```sql
-- abortar com mensagem clara se algum quebrar:
PERFORM 1 FROM notas_fiscais_itens
 WHERE origem_migracao='faturamento_legacy'
   AND (codigo_produto_origem IS NULL OR descricao_produto_origem IS NULL
        OR quantidade_origem IS NULL OR valor_total_origem IS NULL);
-- duplicidade catalog:
PERFORM 1 FROM produtos GROUP BY codigo_interno HAVING count(*)>1;
```
Adicionar à seção "Smoke tests" do `docs/MIGRACAO.md`.

---

## Detalhes técnicos

**Arquivos editados / criados**
- `src/lib/importacao/produtoMatch.ts` (novo) — `normalizarDescricao`, tipos do relatório.
- `src/hooks/importacao/useImportacaoFaturamento.ts` — preview com contagem de match, toast expandido.
- `src/components/importacao/RelatorioMigracaoFaturamento.tsx` (novo).
- `src/pages/MigracaoDados.tsx` — exibir relatório após lote `concluido`.
- `docs/MIGRACAO.md` — seção "Estratégia de preservação histórica".
- 1 migration SQL com:
  - colunas novas em `produtos` (`descontinuado_em`, `origem`) e `notas_fiscais_itens` (snapshots + `match_status` + FK).
  - tabela `produto_identificadores_legacy` + RLS + índices + UNIQUE.
  - função `normalizar_descricao` (usa `unaccent` — habilitar extensão se necessário).
  - triggers `trg_produto_descontinuado` e `trg_nf_item_snapshot_imutavel`.
  - reescrita das RPCs `consolidar_lote_cadastros` (validação dup-código), `consolidar_lote_faturamento` (snapshot + match em 3 níveis + criação de descontinuados) e nova `relatorio_migracao_faturamento`.
  - todas com `SET search_path = public` e `SECURITY DEFINER`.

**Compatibilidade**
- Lotes já consolidados: backfill opcional via UPDATE que copia `codigo_produto`/`descricao`/`quantidade`/`valor_unitario`/`valor_total` para as colunas `*_origem` quando `origem_migracao IS NULL` e a NF pai for `origem='importacao_historica'`. Marcar `match_status` com base em `produto_id IS NULL`. Trigger de imutabilidade só dispara após o backfill (cláusula `WHEN OLD.codigo_produto_origem IS NOT NULL`).

**Fora de escopo**
- UI manual de "resolver duvidoso" (vincular item a produto via tela). Será proposto separadamente — a tabela ponte e o `match_status='duvidoso'` já preparam o terreno.
- Reprocessar lotes históricos automaticamente: rodar manualmente após deploy via `SELECT consolidar_lote_faturamento(id)` em lotes `parcial`/`erro`.
- Match aproximado por similaridade (`pg_trgm`). Pode ser adicionado depois como degrau extra entre 3 e 4.

