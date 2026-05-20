## Objetivo

Adicionar em **Relatórios** a opção de **exportar XMLs arquivados em um único `.zip`**, respeitando filtros (período, fornecedor/cliente, tipo entrada/saída, status). Reaproveita os XMLs já persistidos em `dbavizee/fiscal/{ano}/{mes}/{tipo}/{chave}.xml` (feature de arquivamento já implementada).

## UX

Novo relatório dedicado **"XMLs Arquivados"** na categoria *Fiscal/Faturamento* (ao lado de "NF-e de Entrada" e "Faturamento"). Mantém o padrão visual do workspace de Relatórios — tabela com colunas Tipo / Emissão / Nº / Chave / Parceiro / Valor / Status / "XML arquivado" (badge sim/não).

Filtros disponíveis (via `FiltroRelatorio` padrão):
- **Período** (data de emissão) — obrigatório
- **Tipo**: Entrada / Saída / Ambos (novo `statusOptions`)
- **Fornecedor** (quando tipo = entrada/ambos)
- **Cliente** (quando tipo = saída/ambos)
- **Status SEFAZ** (autorizada, cancelada, denegada, etc.) — reutilizando filtro de status já existente
- **Apenas com XML arquivado** (default ligado)

CTA principal: substituir o `ExportMenu` padrão (PDF/Excel/CSV) por uma versão estendida que adiciona a opção **"XMLs (.zip)"**. Só nesse relatório.

Confirmação antes de zips grandes (>500 arquivos ou >100 MB estimados) via `useConfirmDialog`.

## Comportamento do export ZIP

1. A partir das linhas filtradas atualmente visíveis, coleta `caminho_xml` (ignora linhas sem XML, contabilizando "X NF-e sem XML arquivado — não incluídas").
2. Baixa em paralelo (concorrência 6) via `getNfeXmlSignedUrl` → fetch → Blob (reusa `src/services/fiscal/xmlStorage.service.ts`).
3. Monta `.zip` com `jszip` (já no projeto) estruturado:
   ```text
   xmls_{periodo}/
     entrada/{AAAA-MM}/{chave}.xml
     saida/{AAAA-MM}/{chave}.xml
     _resumo.csv   # chave, tipo, emissao, parceiro, valor, status, caminho
   ```
4. Toast em fases ("Coletando", "Compactando X/Y", "Concluído") seguindo o padrão de `useRelatorioExport`.
5. Nome do arquivo: `xmls_nfe_{YYYYMMDD}_{YYYYMMDD}.zip`.

Falhas individuais não abortam o lote — entram em `_falhas.txt` dentro do zip, e o toast final indica "N XMLs · M falhas".

## Implementação técnica

**Arquivos novos**
- `src/services/fiscal/xmlBatchExport.ts` — função `exportarXmlsZip({ rows, onProgress })` com pool de concorrência + jszip + dispatch de download. Sem lógica de UI.
- `src/services/relatorios/loaders/xmlsArquivados.ts` — query em `notas_fiscais` retornando linhas tipadas (`XmlArquivadoRow`) com filtros de período/tipo/parceiro/status e flag `temXml = caminho_xml IS NOT NULL`.
- `src/types/relatorios.ts` — interface `XmlArquivadoRow`.

**Arquivos editados (mínimos)**
- `src/services/relatorios.service.ts` — registrar novo `case 'xmls_arquivados'` no dispatcher.
- `src/services/relatorios/lib/shared.ts` — adicionar `'xmls_arquivados'` ao union `TipoRelatorio`.
- `src/config/relatoriosConfig.ts` — novo `xmlsArquivadosConfig` (colunas, filtros, meta `kind: 'list'`).
- `src/pages/relatorios/hooks/useRelatorioExport.tsx` — aceitar `enableXmlZip?: boolean` e expor `handleExportXmlZip` + estado `isExportingZip`.
- `src/pages/relatorios/components/ExportMenu.tsx` — prop opcional `onExportXmlZip`; quando presente, adiciona `DropdownMenuItem` "XMLs (.zip)" com ícone `FileArchive` e hint `"N XMLs · ~M MB"`.
- `src/pages/Relatorios.tsx` — passar `onExportXmlZip` apenas quando `tipo === 'xmls_arquivados'`.

**Sem mudanças** em: schema de banco, migrações, RLS, edge functions, bucket (`dbavizee/fiscal/` já existe com policies corretas), nem em `xmlStorage.service.ts` (apenas consumido).

## Fora de escopo

- Export direto para Google Drive (já descartado em decisão anterior — armazenamento interno é canônico).
- Geração retroativa de XML para NF-e antigas sem `caminho_xml` (mostrar contagem e instruir reimportação).
- Inclusão de DANFE PDF no zip (pode ser feature futura separada).

## Verificação

- Smoke: gerar zip com 1 NF-e e abrir/inspecionar estrutura.
- Caso "0 XMLs no filtro": toast de aviso, sem download.
- Caso "linhas filtradas mas nenhuma com `caminho_xml`": toast com instrução.
- Mobile: dropdown do `ExportMenu` exibe a nova opção com `min-h-11`.