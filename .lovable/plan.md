## Objetivo

No Portal Fiscal (`/fiscal/portal`), substituir o botão "DANFE PDF (em breve)" por duas ações funcionais por linha:

- **Visualizar PDF** — abre o DANFE em um Dialog com `<iframe>` sobre o blob gerado.
- **Baixar PDF** — baixa o arquivo nomeado como `"{numero} - {nome_emitente}.pdf"` (sanitizado para filesystem).

O layout do PDF segue o que já existe em `gerarDanfePdf` (DANFE simplificada com código de barras CODE-128C da chave, blocos emitente/destinatário, itens, totais e banner de homologação/sem valor fiscal). O PDF anexado pelo usuário serve apenas como referência visual — não há parser de PDF; usamos o renderer existente para garantir consistência com a DANFE já emitida em outras telas.

## Mudanças

### 1. Novo parser `src/services/fiscal/nfeXmlToDanfe.ts`

Função única `parseNfeXmlToDanfeInput(xml: string): DanfeInput`:

- Usa `DOMParser` (browser) para ler o `procNFe`/`NFe` e popular o `DanfeInput`.
- Mapeia os blocos: `ide` (nº, série, dhEmi, natOp, tpNF), `emit` (CNPJ, xNome, xFant, IE, enderEmit), `dest` (CNPJ/CPF, xNome, IE, enderDest), `det[]` → itens (`prod`: cProd, xProd, NCM, CFOP, uCom, qCom, vUnCom, vProd), `total/ICMSTot` (vProd, vFrete, vDesc, vOutro, vICMS, vST, vIPI, vPIS, vCOFINS, vNF), `protNFe/infProt` (nProt → `protocolo_autorizacao`), `ide/tpAmb` ("1"→produção, "2"→homologação), `infAdic/infCpl` → observações.
- Define `status_sefaz = "autorizada"` quando há `infProt.cStat = "100"`.
- Helpers tolerantes (`text(node, tag)`, `num(...)`, `attr(...)`) — todos os campos opcionais retornam `null`/`0` quando ausentes (suporta resumos parciais).

### 2. `src/pages/fiscal/PortalFiscal.tsx`

- Estado novo: `pdfPreview: { url: string; row: PortalRow } | null` e `gerando: string | null` (id da linha em processamento).
- Helper local `carregarXmlDaLinha(row)` extraído do código atual de `verXml/baixarXml` para evitar duplicação.
- Helper local `sanitizeFilename(s)` — troca `/ \ : * ? " < > |` e caracteres de controle por espaço, colapsa whitespace, faz trim.
- Nova função `gerarPdf(row, modo: "preview" | "download")`:
  - Carrega o XML; se vazio, `toast.error("XML não disponível...")` (mesma mensagem do baixar XML).
  - `const danfe = parseNfeXmlToDanfeInput(xml)`.
  - `const blob = await gerarDanfePdf(danfe, false)`.
  - **download**: cria `<a download="{numero} - {nome}.pdf">` com URL do blob (revoga em seguida). Usa `row.numero ?? danfe.numero` e `row.nome_emitente ?? danfe.emitente.razao_social`, ambos passados por `sanitizeFilename`.
  - **preview**: `URL.createObjectURL(blob)` → setPdfPreview; `revokeObjectURL` ao fechar.
- Botão "DANFE PDF" atual (`disabled`) vira **dois** botões:
  - `Eye` com badge file? Para preservar a coluna, usamos `FileText` (preview) + `Download` específico (com tooltip "Baixar DANFE PDF"). Ambos `disabled={!r.tem_xml || gerando === r.id}`; spinner quando processando.
- Novo `Dialog` para o preview:
  - `max-w-5xl`, conteúdo `<iframe src={pdfPreview.url} className="w-full h-[80vh]" title="DANFE" />`.
  - Header com nº + emitente e botão "Baixar" que reaproveita `gerarPdf(row, "download")`.

### 3. Sem mudanças em banco, edge functions, RLS ou outros módulos.

## Detalhes técnicos

- `gerarDanfePdf` já carrega `jspdf`/`jsbarcode` via dynamic import — preview e download compartilham o mesmo Blob (gera 1 vez).
- O parser tolera `procNFe` (com `protNFe`) e `NFe` puro; quando faltam totais/itens (resumo `resNFe`), o PDF ainda é gerado mas marcado "SEM VALOR FISCAL" pelo próprio `gerarDanfePdf` (já trata `status_sefaz !== "autorizada"`).
- `tipo_documento === "procEventoNFe" | "resEvento" | "resNFe"`: os botões de PDF ficam `disabled` (PDF de evento não faz sentido na DANFE; resumo sem itens não tem o que renderizar). Apenas `procNFe` habilita.
- Nome do arquivo: ex. `"97 - PLUMA INDUSTRIAL S/A.pdf"` (`/` substituído por espaço pelo sanitizer).

## Arquivos tocados

```text
src/services/fiscal/nfeXmlToDanfe.ts   (novo)
src/pages/fiscal/PortalFiscal.tsx      (edit: ações, helpers, dialog de preview)
```

## Validação

- Abrir `/fiscal/portal`, localizar uma NF `procNFe` (ex.: CLC CORDAS), clicar em **Visualizar PDF** → iframe renderiza DANFE com chave + código de barras.
- Clicar em **Baixar PDF** → arquivo salvo como `"{numero} - {nome emitente}.pdf"`.
- Linha `resNFe`/evento: botões PDF aparecem desabilitados.
