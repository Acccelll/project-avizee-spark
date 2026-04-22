

# Importação direta das 141 notas históricas (sem UI de migração)

Você não quer construir um fluxo de importação. Quer que eu **ingira o `.xlsx` diretamente no banco**, como histórico consultável, sem mexer em estoque ou financeiro.

## Estratégia

Sem novas tabelas, sem novas telas, sem RPC nova. Uso a infra que já existe:

- `notas_fiscais` com:
  - `origem = 'importacao_historica'`
  - `movimenta_estoque = false`
  - `gera_financeiro = false`
  - `status = 'importada'`
  - `status_sefaz = 'importada_externa'`
- `notas_fiscais_itens` com `produto_id = NULL` (snapshot puro do XML).
- `fornecedor_id` preenchido **apenas** quando há match exato por CNPJ ou razão social. Caso contrário, fica `NULL` e o nome do emitente vai para `observacoes`.

## Passo a passo da execução

1. **Parse do `.xlsx`** (`notas_entrada_consolidadas.xlsx`):
   - Aba de notas → 141 cabeçalhos.
   - Aba de itens → 210 linhas detalhadas vinculadas pela chave/numero.

2. **Normalização**:
   - CNPJ: só dígitos, 14 posições.
   - Datas: ISO `YYYY-MM-DD`.
   - Valores: `numeric` brasileiro → ponto decimal.
   - Chave de acesso: 44 dígitos quando houver (NFe/BP-e); NFS-e fica sem chave.

3. **Match de fornecedor** (consulta `fornecedores` via `read_query`):
   - 1ª tentativa: `cpf_cnpj` exato.
   - 2ª tentativa: `nome_razao_social` exato (case-insensitive, trim).
   - Sem match → `fornecedor_id = NULL`.

4. **Deduplicação** (consulta `notas_fiscais`):
   - Por `chave_acesso` quando existir.
   - Por `(modelo_documento, serie, numero, fornecedor_emitente_cnpj, data_emissao)` para NFS-e sem chave.
   - Notas já existentes são puladas, registradas em log.

5. **Inserção em lote** via tool de insert:
   - `notas_fiscais`: 141 registros (menos duplicatas).
   - `notas_fiscais_itens`: 210 registros, vinculados pelo `nota_fiscal_id` retornado.
   - Tudo em batches pequenos para não estourar limite de payload.

6. **Relatório final** entregue como `.csv` em `/mnt/documents/`:
   - Notas inseridas, notas duplicadas (puladas), notas com fornecedor casado, notas órfãs.
   - Totais: quantidade por status, valor total importado.

## Onde aparece depois

As notas ficam visíveis em **Fiscal**, junto com as demais, distinguíveis pelo `origem = 'importacao_historica'` e pelo `status = 'importada'`. O badge "Histórico" e o bloqueio de ações fiscais (estornar/cancelar/devolver) **já são suportados pelas regras atuais** de `fiscalStatus.ts` para status `importada` — não preciso mexer em UI.

## Anexos (XML/PDF)

O `.xlsx` é só metadados consolidados. Os 278 arquivos originais (XML + PDF) **não estão no upload**. Duas opções:

- **A)** Ingere agora só os metadados; quando você subir um `.zip` com os arquivos originais, eu anexo num segundo passo (preenchendo `caminho_xml` / `caminho_pdf` no bucket `dbavizee`).
- **B)** Espera o `.zip` e faz tudo de uma vez.

Vou seguir com a **opção A** assumindo que você quer o histórico consultável o quanto antes. Se preferir B, me avise antes de aprovar.

## Detalhes técnicos

- **Sem migração de schema**: todas as colunas usadas já existem em `notas_fiscais` / `notas_fiscais_itens`.
- **Sem RPC nova**: insert direto respeitando RLS (executo como admin via tool de insert).
- **Idempotência**: a query de dedup garante que rodar de novo não duplica.
- **Auditoria**: log da execução salvo em `/mnt/documents/import-notas-historicas-log.csv`.
- **Reversão**: se algo sair errado, todas as notas inseridas são identificáveis por `origem = 'importacao_historica'` + `created_at` da janela e podem ser removidas com um `DELETE` filtrado.

## Fora de escopo

- Criação automática de fornecedores ausentes.
- Linkagem com produtos (`produto_id` fica `NULL`).
- Geração de financeiro / movimento de estoque retroativo.
- Reprocessamento SEFAZ.

