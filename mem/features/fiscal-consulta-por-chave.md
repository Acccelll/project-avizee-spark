---
name: fiscal-consulta-por-chave
description: Busca de NF-e por chave de acesso (44 dígitos) com fallback DistDFe + sync SEFAZ
type: feature
---
# Consulta de NF-e por chave de acesso

- Botão "Buscar por chave" em /fiscal abre `BuscarPorChaveDialog`.
- Estratégia 2 níveis:
  1. Local: `nfe_distribuicao.xml_nfe WHERE chave_acesso = ?` (xml já chegou via DistDFe cron).
  2. Sob demanda: chama edge `sefaz-distdfe` (action `consultar-nsu`) e re-consulta local.
- Limitação SEFAZ: NFeDistribuicaoDFe SÓ devolve XMLs destinados ao CNPJ do certificado A1. Não existe API pública gratuita para baixar XML arbitrário por chave.
- Reuso: `useNFeXmlImport.importXml` aceita `File | string`; o handler `processarXmlImportado` em `Fiscal.tsx` é agnóstico à origem (upload manual vs consulta), passando pelo TraducaoXmlDrawer e quick-add fornecedor normalmente.
- Tabela canônica: `public.nfe_distribuicao` com UNIQUE em chave_acesso e CHECK char_length=44.
