---
name: Arquivamento de XML NF-e
description: XMLs importados (entrada/saída) são arquivados em dbavizee/fiscal/{ano}/{mes}/{tipo}/{chave}.xml e referenciados em notas_fiscais.caminho_xml
type: feature
---
## Doutrina

Todo XML de NF-e importado para o sistema (drawer fiscal, consulta por chave, lote .zip de compras) é gravado no bucket privado `dbavizee` sob o prefixo `fiscal/`, e o path é salvo em `notas_fiscais.caminho_xml`.

**Caminho canônico:** `fiscal/{YYYY}/{MM}/{entrada|saida}/{chave_acesso}.xml`

**Idempotente:** upload com `upsert: true` por chave de acesso.

**Falha de upload NÃO bloqueia importação** — caller emite `toast.warning` e a NF é salva sem `caminho_xml`. A nota nunca pode ser perdida por causa do arquivamento.

**Service único:** `src/services/fiscal/xmlStorage.service.ts` (`uploadNfeXml`, `getNfeXmlSignedUrl`, `downloadNfeXml`, `triggerDownloadNfeXml`).

**UI:** botão "Baixar XML" aparece no dropdown da lista fiscal e no rodapé do `NotaFiscalEditModal` apenas quando `caminho_xml` está presente.

**Google Drive:** não é destino primário (exigiria OAuth por usuário e mistura responsabilidade fiscal com conta pessoal). Pode existir futuramente como espelho/export opcional.

**Backfill:** NFs antigas (anteriores a esta feature) ficam sem `caminho_xml`. Não há job de backfill — a reimportação manual do XML preenche o campo.

**Índice:** `idx_notas_fiscais_com_xml` (parcial, `WHERE caminho_xml IS NOT NULL`) para consulta rápida.