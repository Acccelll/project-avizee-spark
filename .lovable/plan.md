## Diagnóstico

Dois problemas no DANFE atual:

1. **Dados em branco no PDF/preview** — o parser `nfeXmlToDanfeInput` usa `getElementsByTagName` sem fallback para namespace. Para alguns XMLs (especialmente quando `xmldom`/browsers tratam `xmlns="http://www.portalfiscal.inf.br/nfe"` de forma estrita) os blocos `emit`/`dest`/`enderEmit`/`enderDest` retornam vazio. Também faltam campos importantes (fantasia do destinatário não existe na NFe, mas faltam: data saída/entrada `dhSaiEnt`, indicador IE `indIEDest`, fone, `xCpl`, complemento, `xPais`, `nro`/`xBairro` separados, transportadora `transp/transporta`, volumes `vol`, duplicatas/fatura `cobr/dup`, pagamento `pag/detPag`, ISSQN se houver, info adicional do fisco `infAdFisco`).

2. **Layout desalinhado** — o download usa `html2canvas` para rasterizar `DanfeRender` em PDF A4. Rasterização perde nitidez e desloca células quando há quebras de linha. Tailwind com `oklch` também causa falhas silenciosas em `html2canvas`. O resultado é a DANFE "achatada" e mal posicionada.

## Mudanças

### 1. Parser robusto — `src/services/fiscal/nfeXmlToDanfe.ts`

- Substituir todos os `getElementsByTagName` por um helper `findAll(parent, tag)` que tenta primeiro `getElementsByTagNameNS("*", tag)` e cai para `getElementsByTagName(tag)`. Garante leitura independente de namespace.
- Suportar `resNFe` (resumo) extraindo apenas os campos disponíveis (`chNFe`, `CNPJ`, `xNome`, `vNF`, `dhEmi`) e marcando `status_sefaz = "resumo"` para a DANFE imprimir banner "SOMENTE RESUMO — SEM DETALHES".
- Estender o tipo `DanfeInput` (em `danfe.service.ts`) com:
  - `emitente.complemento`, `bairro`, `numero_endereco`, `municipio_cod`, `pais`, `email`
  - `destinatario.complemento`, `bairro`, `numero_endereco`, `municipio_cod`, `pais`, `email`, `telefone`, `indicador_ie`
  - `data_saida_entrada`, `hora_saida_entrada`, `finalidade`, `consumidor_final`, `presenca_comprador`
  - `transportador`: `{ razao_social, cnpj_cpf, ie, endereco, municipio, uf, antt, placa, uf_placa }`
  - `modalidade_frete` (`0`–`9`)
  - `volumes`: `Array<{ qtd, especie, marca, numero, peso_liquido, peso_bruto }>`
  - `fatura`: `{ numero, valor_original, valor_desconto, valor_liquido }`
  - `duplicatas`: `Array<{ numero, vencimento, valor }>`
  - `pagamentos`: `Array<{ forma, valor }>`
  - `valor_seguro`, `base_icms`, `base_icms_st`, `valor_fcp`, `valor_ii`, `valor_total_tributos`
  - `info_fisco` (campo `infAdFisco`)
- Mapear todos esses campos no parser (`transp/transporta`, `transp/veicTransp`, `transp/vol`, `cobr/fat`, `cobr/dup`, `pag/detPag`, `total/ICMSTot/vBC`, `vBCST`, `vFCP`, `vII`, `vTotTrib`, `ide/dhSaiEnt`, `ide/finNFe`, `ide/indFinal`, `ide/indPres`, `dest/indIEDest`, `dest/email`, `enderDest/xCpl`, `enderDest/xBairro`, `enderDest/cMun`, `enderDest/xPais`, idem para `enderEmit`).
- Por item, mapear também: `vBC` ICMS, `vICMS`, `pICMS`, `CST/CSOSN`, `vIPI`, `pIPI`, `CEST` (em `ICMS`/`IPI` filhos).

### 2. Reescrita do gerador PDF — `src/services/fiscal/danfe.service.ts`

- Eliminar a dependência de `html2canvas`. PDF passa a ser desenhado 100% por `jsPDF` em vetor (texto + linhas + retângulos + barcode CODE-128C como imagem PNG single).
- Layout fiel ao modelo SEFAZ/TOTVS (mesma estrutura do PDF de referência anexado pelo usuário):
  - **Recibo do destinatário** (linha superior com nº/série à direita).
  - **Cabeçalho**: grid 3 colunas — emitente (razão, fantasia, endereço completo, CEP, fone, IE) | DANFE (rótulo, 0/1 ENT/SAÍDA, nº, série, página) | controle do fisco (barcode + chave formatada + texto de consulta).
  - Linha "NATUREZA DA OPERAÇÃO | PROTOCOLO DE AUTORIZAÇÃO".
  - Linha "INSC. ESTADUAL | INSC. EST. SUBST. TRIB. | CNPJ".
  - **Destinatário/Remetente**: nome | CNPJ | data emissão; endereço | bairro | CEP | data saída/entrada; município | UF | fone | IE | indicador IE.
  - **Fatura/Duplicatas** quando presente (lista em mini-tabela 3 colunas).
  - **Cálculo do imposto**: linha 1 (Base ICMS, V. ICMS, Base ICMS ST, V. ICMS ST, V. Importação, V. FCP, V. PIS, V. Produtos) + linha 2 (V. Frete, V. Seguro, Desconto, Outras Desp., V. IPI, V. COFINS, V. Aprox. Tributo, **V. Total NF** em negrito maior).
  - **Transportador/Volumes**: razão | frete por conta | cód. ANTT | placa | UF | CNPJ; endereço | município | UF | IE; volumes (qtd, espécie, marca, número, peso L, peso B).
  - **Produtos/Serviços**: cabeçalho fixo (Cód., Descrição, NCM, CST, CFOP, UN, Qtd, V.Unit, V.Total, B.ICMS, V.ICMS, V.IPI, Alíq.ICMS, Alíq.IPI). Quebra linha automática (descrição em múltiplas linhas com `splitTextToSize`). Reabre cabeçalho em página nova.
  - **Cálculo ISSQN** (placeholder mínimo se ausente).
  - **Dados adicionais**: `infCpl` à esquerda + `infAdFisco` separado, "Reservado ao fisco" à direita.
  - **Banners**: homologação (amarelo) e "SEM VALOR FISCAL" (vermelho) quando aplicável; "SOMENTE RESUMO" quando `status_sefaz === "resumo"`.
- Helpers internos: `drawCell(x, y, w, h, title, value, opts)`, `drawGridRow(...)`, `wrapText(...)`, `nextPageIfNeeded(yMin)`. Tudo em mm, A4 retrato.

### 3. Atualização do fluxo no Portal — `src/pages/fiscal/PortalFiscal.tsx`

- Download passa a chamar `gerarDanfePdf(danfe, false)` diretamente (Blob → `<a download>` com nome `"{numero} - {nome_emitente}.pdf"`). Remove `downloadDanfeFromDom` e dependência de `html2canvas`.
- Preview continua usando `DanfeRender` (HTML, sem print dialog automático), mas o botão "Baixar" dentro do dialog também usa o blob de `gerarDanfePdf` — não rasteriza mais o DOM.
- `DanfeRender` é atualizado para consumir os novos campos (transportador, volumes, fatura, pagamentos) e ficar visualmente alinhado ao PDF (mesma ordem de blocos).

### 4. Remoção de dependências mortas

- `downloadDanfeFromDom` e `html2canvas` (já importado dinamicamente) ficam sem chamadores — remover a função do `DanfeRender.tsx`.
- `jspdf` continua em uso.

## Validação

1. Abrir `/fiscal/portal`, escolher a NF "CLC CORDAS" (procNFe completa).
2. **Preview**: dialog mostra todos os blocos preenchidos (emitente, destinatário com endereço/IE/fone, transportador, totais, itens com NCM/CFOP/qtd corretos).
3. **Baixar PDF**: arquivo `"97 - CLC CORDAS....pdf"` abre em vetor, com alinhamento idêntico ao layout SEFAZ — comparar lado a lado com o PDF anexado (`69850 - CND 27 COMERCIO...`).
4. NF apenas `resNFe`: banner "SOMENTE RESUMO" e campos do emitente preenchidos (CNPJ, xNome, vNF), demais "—".
5. NF em homologação: banner amarelo "SEM VALOR FISCAL".

## Arquivos tocados

```text
src/services/fiscal/nfeXmlToDanfe.ts       (rewrite — namespace-safe + campos novos)
src/services/fiscal/danfe.service.ts       (rewrite gerarDanfePdf — vetor jsPDF + novos campos no DanfeInput)
src/pages/fiscal/components/DanfeRender.tsx (atualiza para novos campos; remove downloadDanfeFromDom)
src/pages/fiscal/PortalFiscal.tsx           (download passa a usar gerarDanfePdf blob direto)
```

Sem mudanças em banco, edge functions, RLS ou outros módulos.
