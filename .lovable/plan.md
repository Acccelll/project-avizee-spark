

# Importação direta dos 204 orçamentos históricos (somente consulta)

Mesma filosofia da importação das notas históricas: **eu ingiro o `.xlsx` direto no banco**, sem construir UI de migração, sem mexer em estoque/financeiro, e sem disparar nenhum fluxo comercial.

## Diagnóstico do arquivo

`orcamentos_consolidados.xlsx`:
- 243 arquivos lidos → **204 orçamentos únicos** (33 com revisão; mantida a maior revisão, preferindo versão sem "LUCRO" no nome)
- **183 itens** parseados com sucesso, 0 falhas
- Critério de seleção do principal já aplicado na consolidação

## Diferença crítica em relação às notas

A tabela `orcamentos` **não tem** coluna `origem` nem status `importado`. O CHECK atual permite só:
`rascunho | pendente | aprovado | convertido | rejeitado | cancelado | expirado`

E há trigger `trg_orcamento_transicao_valida` que bloqueia escritas fora do fluxo oficial.

Para não corromper o domínio comercial vivo, vou **adicionar uma coluna `origem` em `orcamentos`** (mesmo padrão de `notas_fiscais`) e ampliar o CHECK para incluir `historico`. Isso é cirúrgico e reversível.

## Estratégia de mapeamento

Cada orçamento da planilha vira um registro em `orcamentos` com:

- `status = 'historico'` (novo valor permitido pelo CHECK ampliado)
- `origem = 'importacao_historica'` (nova coluna)
- `numero` = número original da planilha (prefixado com `H-` se colidir com numeração atual)
- `data_orcamento`, `validade`, `valor_total`, `quantidade_total`, `peso_total` preenchidos quando disponíveis
- `cliente_id`: match exato por CNPJ ou razão social na tabela `clientes`. Sem match → `NULL` e nome do cliente vai para `cliente_snapshot` (jsonb) + `observacoes`
- `vendedor_id`: `NULL` (não tentamos casar)
- `observacoes_internas`: metadados da consolidação (arquivo origem, revisão, se tinha "LUCRO", etc.)
- `observacoes`: texto livre do orçamento original quando houver

Itens vão para `orcamentos_itens` com:
- `produto_id` casado por `codigo_interno` ou `codigo_legado` exato; sem match → `NULL`
- `codigo_snapshot`, `descricao_snapshot`, `quantidade`, `unidade`, `valor_unitario`, `valor_total` preenchidos do XLSX
- Demais campos (custo, peso) preservados quando vierem

## Passo a passo

1. **Migration** mínima:
   - `ALTER TABLE orcamentos ADD COLUMN origem text DEFAULT 'sistema'`
   - Drop + recria `chk_orcamentos_status` incluindo `'historico'`
   - Ajusta `trg_orcamento_transicao_valida` para **não bloquear** transições quando `origem = 'importacao_historica'` (e bloquear qualquer transição saindo de `historico`, mantendo-o terminal e read-only)
   - Ajusta `trg_orcamento_protege_delete` para permitir delete bulk apenas via filtro `origem = 'importacao_historica'` por admin (idempotência da reimportação)

2. **Parse do `.xlsx`** (Python + pandas/openpyxl) extraindo cabeçalhos e itens.

3. **Normalização**: CNPJ só dígitos, datas ISO, valores numéricos BR → ponto decimal, números de orçamento trimados.

4. **Match de cliente** via `read_query` em `clientes`:
   - 1ª: `cpf_cnpj` exato
   - 2ª: `nome_razao_social` exato (case-insensitive, trim)
   - Sem match → `cliente_id = NULL`, snapshot preserva o nome

5. **Match de produto** via `read_query` em `produtos`:
   - 1ª: `codigo_interno` exato
   - 2ª: `codigo_legado` exato
   - Sem match → `produto_id = NULL`, descrição/código ficam no snapshot

6. **Deduplicação** por `(numero, data_orcamento, cliente_match_chave)` consultando `orcamentos`. Reimportar não duplica.

7. **Inserção em lote** com triggers temporariamente DISABLED para `trg_orcamento_transicao_valida` (necessário para inserir já em `historico`) e re-enabled ao fim — mesmo padrão usado nas notas.

8. **Relatório final** em `/mnt/documents/import-orcamentos-historicos-log.csv`:
   - Inseridos / pulados (duplicata) / com cliente casado / com itens 100% casados / órfãos
   - Totais de valor importado e quantidade

## Onde aparece depois

Na listagem de **Cotações** (`/orcamentos`):
- Adiciono `'historico'` ao `statusOrcamento` em `src/lib/statusSchema.ts` com label "Histórico" e cor neutra
- Adiciono filtro "Apenas históricos / Excluir históricos / Todos" no AdvancedFilterBar (default: **excluir históricos**, para não poluir KPIs do dia-a-dia)
- Botões de ação (enviar para aprovação, aprovar, converter em pedido) ficam ocultos quando `status = 'historico'` ou `origem = 'importacao_historica'`
- Drawer/edição abre em modo **read-only** para esses registros

Sem nova rota, sem nova tela.

## Detalhes técnicos

### Migration
```sql
ALTER TABLE orcamentos ADD COLUMN origem text NOT NULL DEFAULT 'sistema';
ALTER TABLE orcamentos DROP CONSTRAINT chk_orcamentos_status;
ALTER TABLE orcamentos ADD CONSTRAINT chk_orcamentos_status
  CHECK (status = ANY (ARRAY['rascunho','pendente','aprovado','convertido',
                              'rejeitado','cancelado','expirado','historico']));
-- ajuste do trigger de transição para tratar origem='importacao_historica' e status terminal 'historico'
```

### KPIs comerciais
KPIs em `Orcamentos.tsx` filtram por `origem != 'importacao_historica'` por padrão para não inflar conversão / valores em aberto.

### Idempotência
Dedup por chave composta + flag de origem. Permite rodar de novo sem efeito colateral.

### Reversão
`DELETE FROM orcamentos WHERE origem = 'importacao_historica'` (cascata em itens). Único caso onde delete em massa é permitido.

### Sem mudar stack
React, Supabase, mesma arquitetura. Apenas:
- 1 migration (add column + check + trigger ajuste)
- 1 entrada no `statusSchema.ts`
- 1 filtro no `Orcamentos.tsx`
- 1 guarda nos botões de ação / formulário

## Fora de escopo
- Vinculação com pedidos de venda históricos
- Recriação de clientes ou produtos ausentes
- Recálculo de margens / rentabilidade dos históricos
- PDF / template visual desses orçamentos antigos (ficam como dado tabular)

