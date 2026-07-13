# Revisão E2E — importação de faturas de cartão

Testei os 9 PDFs enviados (C6/Inter/RecargaPay × abr/mai/jun) extraindo o texto e simulando os parsers atuais. Achados abaixo são todos reproduzíveis; nada é suposição.

## Diagnóstico

### 1. Compet\u00eancia no m\u00eas errado (todos os emissores)
Hoje `competencia` = mês do vencimento. Ex.: `RecargaPay_Maio-2.pdf` fecha 03/06 e vence 10/06 → grava em **2026-06**, mas o consumo é de maio. Mesmo problema no C6 (vence 10/05, consumo abril) e Inter (vence 07/05, consumo abril).
→ Passar `competencia` = mês do **fechamento** (ou último dia do período consumido).

### 2. Ano errado nas linhas do C6
Parser usa `anoRef = ano do vencimento`. Numa fatura de abril/26 (venc. 10/05/26, fecha 29/04/26) a linha `26 dez  MP *ALIEXPRESS - Parcela 5/12  15,05` vira **2026-12-26** (futuro). Deveria ser 2025-12-26.
→ Se `mês da linha > mês do fechamento`, ano = `anoRef − 1`.

### 3. Ano errado nas linhas do RecargaPay (secund\u00e1rio)
Datas vêm completas no PDF (`14/05/2026`), mas quando aparece linha sem data (continuação da anterior — ex.: `Ultrafarmasao...`) o parser reutiliza `ultimaData`. Isso está correto; só precisa garantir que continua funcionando quando corrigirmos regex.

### 4. "Pagamentos da pr\u00f3pria fatura" inflam o total
- RecargaPay já filtra `Pagamento Da Fatura` — ok.
- **C6 não filtra** `Pag Fatura Boleto  1.007,97` → soma linhas ≠ `valor_total`.
- **Inter não filtra** `PAGAMENTO ON LINE + R$ 3.061,21` e `RESGATE PONTOS + R$ 17,50`; o PDF do Inter mostra `Total CARTÃO ...  R$ 0,00` para esse cartão exatamente porque esses créditos anulam débitos. Importar como linha faz Σ(linhas) divergir do "Fatura atual".
→ Filtrar em todos os parsers (regex compartilhada): `Pagamento da fatura`, `Pag Fatura Boleto`, `Pagamento on line`, `Resgate pontos`, `Cr[eé]dito de estorno`, `Ajuste de fatura`.

### 5. Totais e linhas n\u00e3o batem — falta valida\u00e7\u00e3o
Nenhum parser compara `Σ(lancamentos.valor)` com `valor_total` do cabeçalho. Divergência passa silenciosa e o usuário vê o descasamento só depois no painel de conciliação.
→ Após parsear, calcular `diff = valor_total − Σ(linhas positivas)`; se `|diff| > 0,01`, marcar a fatura no preview do lote com badge amarelo "Divergência R$ X,XX — revisar" e no importador single com aviso não-bloqueante.

### 6. RecargaPay Junho n\u00e3o \u00e9 reconhecido — PDF sem camada de texto
`RecargaPay_Junho-3.pdf` foi gerado por "Microsoft: Print To PDF" a partir de imagens. `pdftotext` devolve 4 bytes; `pdfjs` devolve string vazia; `detectarEmissor("")` retorna `null` → erro genérico `Emissor não reconhecido`.
→ Antes de tentar detectar emissor, se `texto.trim().length < 200` **ou** o PDF só tem imagens (`content.items.length === 0` em todas as páginas), lançar erro específico: `"PDF sem texto extraível — reexporte a fatura original a partir do app/portal do emissor ou importe o OFX correspondente."` Mostrar essa mensagem tanto no dialog singular quanto na tabela do lote.

### 7. Regex do C6 pega linhas que n\u00e3o s\u00e3o transa\u00e7\u00e3o
Padrão atual `^(\d{1,2})\s+(mês)\s+(.+?)\s+([\d.]+,\d{2})$` — ok para linhas normais, mas depois do fix do item 4 basta acrescentar o filtro. Nenhuma outra falsa positiva encontrada nos 3 PDFs C6.

## Escopo do fix

### Frontend / parsers (`src/services/conciliacaoCartao/`)

1. **`parseHelpers.ts`** — adicionar:
   - `competenciaDoFechamento(dataFechamento, dataVencimento) → 'YYYY-MM'`: usa fechamento se existir, senão `vencimento − 1 mês` (para RecargaPay/Inter que não expõem data de fechamento no cabeçalho, mas o rodapé traz o período "De 03/05/2026 até 03/06/2026" — parsear e usar o `até` como fechamento).
   - `ehLinhaPagamentoFatura(desc): boolean` com a lista acima.
   - `ajustarAnoAnterior(mesLinha, mesFechamento, anoRef)` para o C6.

2. **`c6Parser.ts`**:
   - Extrair `data_fechamento` (já existe via `mFech`), derivar `competencia` a partir dela.
   - Aplicar `ajustarAnoAnterior` em cada linha.
   - Filtrar linhas via `ehLinhaPagamentoFatura`.

3. **`interParser.ts`**:
   - Extrair período: regex adicional `/(\d{2}\/\d{2}\/\d{4})\s*(?:a|at[eé])\s*(\d{2}\/\d{2}\/\d{4})/i` no rodapé; `data_fechamento` = segundo grupo; competência = mês do fechamento.
   - Filtrar `ehLinhaPagamentoFatura` (aplica-se a "PAGAMENTO ON LINE" e "RESGATE PONTOS").

4. **`recargapayParser.ts`**:
   - Extrair período do bloco `De DD/MM/AAAA até DD/MM/AAAA` (aparece por cartão); `data_fechamento` = último `até`; competência = mês do fechamento.
   - Já filtra "Pagamento Da Fatura" — manter.

5. **`faturaParser.ts` + `pdfText.ts`**:
   - Em `extractPdfText`, contar itens de texto totais; retornar string vazia se zero.
   - Em `parseFaturaPdf`, se `texto.trim().length < 200`, lançar `Error("PDF sem texto extraível — reexporte a fatura original ou importe o OFX correspondente.")` antes do `detectarEmissor`.

6. **Valida\u00e7\u00e3o de total** (nova fun\u00e7\u00e3o `validarFatura(parsed) → { ok, diff, aviso? }`):
   - Chamada em `preverFatura` (lote) e no dialog singular (`ImportarFaturaCartaoDialog`).
   - Se `|diff| > 0,01`, popular `parsed.aviso` (novo campo opcional em `FaturaImportInput`).

### UI

7. **`ImportarFaturasLoteDialog.tsx`**: nova coluna "Aviso" na tabela de preview mostrando `parsed.aviso` (badge amarelo). Não bloqueia importação.

8. **`ImportarFaturaCartaoDialog.tsx`**: se `parsed.aviso`, exibir `Alert` amarelo abaixo do sumário com o texto do aviso e Σ(linhas) vs `valor_total`.

### Sem migra\u00e7\u00e3o SQL

Nenhum schema muda. RPC `cartao_importar_fatura` continua recebendo os mesmos campos; apenas `competencia`/`data_compra` chegam corretas.

## Fora de escopo

- OCR de PDFs escaneados (usuário optou por rejeitar com mensagem).
- Reparse retroativo de faturas já importadas — o usuário roda "Limpar tudo" e reimporta (fluxo já existente e testado).
- Ajuste automático da diferença — o botão "Gerar ajuste" da Fase 3 anterior já cobre.

## Valida\u00e7\u00e3o

Após aplicar, rodar `tsgo` e reimportar os 9 PDFs. Critérios de aceite:
- 8 faturas parseiam sem erro; a 9ª (RecargaPay_Junho-3) mostra a mensagem específica "PDF sem texto extraível".
- Competência = mês do fechamento em 100% dos casos.
- Nenhuma linha com data futura no C6.
- Onde `|Σ − valor_total| > 0,01`, aviso amarelo visível antes do usuário confirmar.
