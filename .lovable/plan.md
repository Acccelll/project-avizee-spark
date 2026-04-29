
# Revisão e revamp da Importação de Notas de Entrada

## 1. Diagnóstico

### Estado atual do banco
- **0 notas com `tipo_operacao='entrada'`** em `notas_fiscais` (de 347 totais — todas saída/internas).
- **0 compras** em `compras`.
- **0 lotes** do tipo `compras_xml` rodados.
- **143 fornecedores** cadastrados.

### Estado da planilha consolidada (`notas_entrada_consolidadas.xlsx`)
- 278 arquivos brutos → **141 notas únicas**: 118 NFe + 12 NFe-só-PDF + 7 NFS-e + 1 BP-e + 3 PDF cru.
- 125 estruturadas via XML, 16 só por PDF.
- **210 itens** detalhados extraídos dos XMLs.
- **58 fornecedores distintos**; só 4 sem CNPJ.
- Cobertura por campo: Número 100%, Chave 90%, CNPJ 92%, Emissão 92%, Valor 92%.

### Gaps no pipeline atual (`useImportacaoXml` + `inserirCompraXml`)
1. **Insere apenas em `compras`** (4 colunas: número, data, valor, observação). Não cria registro em `notas_fiscais`, não grava itens, não captura impostos, frete, série, chave, natureza da operação, transportadora, duplicatas.
2. **Descarta notas sem fornecedor cadastrado** (apenas loga erro). Hoje isso significaria perder ~80 notas, já que só 58 dos 141 emitentes provavelmente existem em `fornecedores`.
3. **Não trata NFS-e nem BP-e** — parser só conhece NF-e modelo 55.
4. **Não tem OCR para PDF** — os 16 PDFs ficariam de fora.
5. **Não reconcilia com `nfe_distribuicao`** (DistDF-e), perdendo a oportunidade de marcar manifestação automática.
6. **Não atualiza estoque** (`movimenta_estoque=true` na nota mas sem trigger conectado para entrada).
7. **Sem detecção de duplicidade por número+série+CNPJ** — só por chave de acesso. Notas sem chave (PDF) podem duplicar.
8. **Sem reaproveitamento do `nfeXmlParser.service.ts`** (parser fiscal completo já existe e é usado pela autorização de saída).

## 2. Estratégia (4 ondas)

### Onda A — Backend: RPC `importar_nfe_entrada` + auto-criação de fornecedor
Centraliza a persistência atômica de uma NF-e de entrada em uma RPC `SECURITY DEFINER`. O front-end passa um JSON estruturado e a RPC:

1. Resolve o fornecedor pelo CNPJ:
   - Se existe → reutiliza.
   - Se não existe → **cria** em `fornecedores` com nome, CNPJ, IE, UF, cidade do emitente. Marca `origem='import_xml_entrada'` e `ativo=true`.
2. Faz **upsert** em `notas_fiscais` por `(chave_acesso)` quando há chave, ou por `(numero, serie, fornecedor_id, modelo_documento)` quando não há (PDF/NFS-e). Preenche **todos** os campos disponíveis: número, série, chave, emissão, valor_total, valor_produtos, frete, desconto, ICMS/IPI/PIS/COFINS/ICMS-ST, natureza_operacao, modelo (55/65/57/SE), tipo_operacao='entrada', status='importada'.
3. Insere itens em `notas_fiscais_itens` (já existente).
4. Vincula a `nfe_distribuicao` quando a chave bater (atualiza `status_manifestacao` para `ciencia_da_operacao`).
5. Retorna `{nf_id, fornecedor_id, fornecedor_criado, itens_inseridos, atualizada}`.

Migrations criadas:
- Coluna `origem` em `fornecedores` (enum: `manual|import_xml_entrada|import_planilha|distdfe`).
- Constraint única parcial em `notas_fiscais` para a chave de dedup.
- A RPC propriamente dita.

### Onda B — Parser unificado (NF-e 55 + NFS-e + BP-e + PDF)
Novo módulo `src/lib/importacao/nfeEntradaParser.ts` que:

- **NF-e (modelo 55)**: reaproveita `nfeXmlParser.service.ts` que já existe e está mais completo que `lib/nfeXmlParser.ts`.
- **NFS-e**: parser tolerante a múltiplos layouts municipais (ABRASF, Ginfes, IssNet) — extrai número, RPS, prestador, valor, data, ISS.
- **BP-e (modelo 63)**: similar ao 55, namespace diferente.
- **PDF (DANFE)**: usa `pdfjs-dist` (já no projeto) + heurísticas regex para extrair Número, CNPJ, Emissão, Valor Total, Chave (44 dígitos). Marca `requer_revisao=true` e `status='rascunho'`.

Saída padronizada: `ParsedNotaEntrada` discriminada por `modelo_documento`.

### Onda C — UI revamp `MigracaoDados → aba "NFs de Entrada"`
Substitui o `useImportacaoXml` por `useImportacaoNotasEntrada`:

1. **Drop zone** aceita `.xml`, `.pdf`, `.zip` (até 500 arquivos via ZIP, vs 200 atuais).
2. **Pré-visualização tabular** mostra para cada arquivo: status (✅ válido / ⚠️ requer revisão / ❌ duplicada / ❌ erro), número, fornecedor (com badge "será criado"), emissão, valor, modelo. Permite desmarcar individualmente.
3. **Painel de fornecedores a criar** lista os emitentes novos, agrupados por CNPJ, mostra quantas notas vinculadas. Botão "Editar antes de criar" abre modal para corrigir nome/IE.
4. **Importação** chama a RPC em paralelo (chunks de 10), com barra de progresso e log ao vivo.
5. **Relatório final**: notas importadas, fornecedores criados, itens, erros — com export CSV.

### Onda D — Carga inicial dos 278 arquivos via planilha consolidada
Edge function `importar-notas-entrada-consolidadas` que lê `notas_entrada_consolidadas.xlsx` (subido pelo usuário no storage `migracao/`) e:

1. Para cada linha de **Notas**: chama a mesma RPC `importar_nfe_entrada` com os campos já estruturados. As 141 notas entram de uma vez, criando ~30 fornecedores faltantes.
2. Para cada linha de **Itens_XML**: insere em `notas_fiscais_itens` vinculando pela chave de acesso.
3. Para os 16 PDFs sem XML: aplica OCR mais agressivo (parsing do texto cru em "Destinatário" — vi que vários PDFs têm o cabeçalho fiscal completo dentro daquele campo, ex.: a nota DGTF tem CNPJ destinatário, frete, IPI 118,72 etc. embutidos em texto).
4. Gera relatório CSV em `/mnt/documents/import-notas-entrada-relatorio.csv`.

Após Onda D, **quando você reanexar o ZIP de XMLs**, rodamos um **passe de enriquecimento** que reconcilia pela chave de acesso e preenche o que faltava (tributos por item, transportadora, duplicatas, NCMs completos), sem duplicar notas — graças ao upsert da Onda A.

## 3. Garantias mínimas exigidas
Para **toda** nota importada (XML, PDF ou planilha):
- ✅ **Número** — 100% (já temos para todas).
- ✅ **Fornecedor** — 100% (criado se não existir).
- ✅ **Emissão** — para PDFs sem data, default = data do diretório (Ano/Mês na planilha) + flag `data_estimada=true`.
- ✅ **Valor** — para PDFs sem valor extraído, marcar `status='rascunho'` + entrar na fila de revisão (não bloqueia importação).

## 4. Detalhes técnicos

**Arquivos novos**:
- `supabase/migrations/<ts>_importar_nfe_entrada.sql` — coluna `origem` em fornecedores, constraint única parcial em notas_fiscais, RPC `importar_nfe_entrada(p_payload jsonb)`.
- `src/lib/importacao/nfeEntradaParser.ts` — parser unificado.
- `src/lib/importacao/danfePdfParser.ts` — heurísticas regex sobre texto de DANFE.
- `src/hooks/importacao/useImportacaoNotasEntrada.ts` — substitui `useImportacaoXml`.
- `src/components/importacao/NotasEntradaPreview.tsx` — tabela de pré-visualização.
- `src/components/importacao/FornecedoresACriarPanel.tsx` — painel de criação.
- `supabase/functions/importar-notas-entrada-consolidadas/index.ts` — carga inicial.

**Arquivos modificados**:
- `src/services/importacao.service.ts` — adiciona `importarNfeEntrada(payload)` e remove `inserirCompraXml` legacy.
- `src/pages/MigracaoDados.tsx` — troca aba XML.

**Compatibilidade**: hook antigo `useImportacaoXml` fica deprecated mas funcional por 1 release; novo hook coexiste.

**Performance**: RPC é única chamada por nota (vs 3 hoje: select fornecedor, insert compra, insert log). Importar 141 notas: ~5 s.

**Segurança**: RPC com `search_path=public`, valida CNPJ (14 dígitos) e chave (44 dígitos) antes de criar fornecedor; rejeita se ambos faltarem.

**Testes**: extender `src/lib/importacao/__tests__/xmlImport.test.ts` com fixtures de NFS-e e BP-e; teste de upsert (idempotência).

## 5. Resultado esperado após as 4 ondas
- **141 notas de entrada** importadas com Número, Fornecedor, Emissão e Valor garantidos.
- **~30 fornecedores novos** criados automaticamente a partir dos XMLs/planilha.
- **210 itens** vinculados.
- **125 notas estruturadas** com tributos completos; **16 notas-PDF** em fila de revisão com dados parciais.
- **Pipeline pronto** para receber o ZIP completo de XMLs e fazer o passe de enriquecimento sem duplicar nada.

## 6. Ordem de execução proposta
1. Onda A (migration + RPC) — base de tudo.
2. Onda D (edge function + execução da carga via planilha) — entrega valor imediato: as 141 notas no ar.
3. Onda B (parser unificado) — habilita XML/PDF interativo.
4. Onda C (UI revamp) — fecha o ciclo para uso recorrente.
5. (Quando ZIP chegar) passe de enriquecimento.
