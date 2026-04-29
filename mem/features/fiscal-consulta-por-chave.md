---
name: fiscal-consulta-por-chave
description: Busca de NF-e por chave de acesso (44 dígitos) via DistDFe consChNFe com cache local
type: feature
---
# Consulta de NF-e por chave de acesso

- Botão "Buscar por chave" em /fiscal abre `BuscarPorChaveDialog`.
- Estratégia em 2 níveis:
  1. Local: `nfe_distribuicao.xml_nfe WHERE chave_acesso = ?` (cache + DistDFe cron).
  2. SEFAZ: edge `sefaz-distdfe` action `consultar-chave` monta `<distDFeInt>` com `<consChNFe><chNFe>` (consulta direta por chave, NÃO incremental por NSU).
- Após sucesso na SEFAZ, faz upsert em `nfe_distribuicao(chave_acesso, xml_nfe)` para cachear.
- Limitação SEFAZ (legal): NFeDistribuicaoDFe só devolve XMLs cuja NF é destinada ao CNPJ do certificado A1. cStat 137/138 = chave existe mas não é vinculada — UI exibe `xMotivo` real e orienta solicitar ao emissor.
- Reuso: `useNFeXmlImport.importXml` aceita `File | string`; handler em `Fiscal.tsx` é agnóstico à origem.
- Edge `sefaz-distdfe` aceita actions `consultar-nsu` (incremental) e `consultar-chave` (pontual).
