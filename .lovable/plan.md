
## Objetivo
Refatorar `src/components/Orcamento/OrcamentoPdfTemplate.tsx` para igualar 100% o layout do **ORC100270** (modelo aprovado), corrigindo todas as regressões introduzidas no template anterior. Cor laranja `#C9743A` é mantida — só layout, espaçamento e densidade mudam.

## Diagnóstico (comparação visual lado a lado)

| Item | Modelo ORC100270 (alvo) | Atual ORC100271 (errado) |
|---|---|---|
| Número orçamento | `100270` puro | OK no exemplo, mas precisa stripar prefixo "ORC" se vier |
| Header tabela itens | Faixa **laranja** baixa (~26px) | Faixa **preta** alta (~80px) — quebra de cor |
| Cliente | Grid 3 colunas, line-height ~1.4, fonte 10px, 6 linhas | Grid 2 colunas, line-height 2.0, fonte 11px, 8+ linhas, CNPJ quebra |
| Linhas vazias na tabela itens | Invisíveis (sem bordas) | Bordas em todas as 10 linhas → "papel pautado" |
| Padding células itens | ~3px vertical | ~5-6px vertical |
| Totais (header) | Labels em 1 linha, fonte 10px | Quebram em 2 linhas (col estreita + fonte 9.5) |
| Totais (valor) | Padding ~6px, valor 14px bold | Padding 10px, valor 11px → "R$ 0,00" estoura |
| Metadados (Qtd/Peso/Pag/Prazo) | Texto corrido inline em 2 linhas, sem caixas | Caixas separadas com label cinza sobre valor bold |
| Header empresa | Nome + endereço **sem borda** entre eles | Borda horizontal divide nome/endereço |

## Mudanças por seção

### 1. Número do orçamento — strip "ORC"
- No render do header (3ª coluna), exibir `numero.replace(/^ORC/i, "")` em vez de `numero` cru.
- Banco e nome do arquivo (`pdf.save`) permanecem com prefixo (não tocar em `OrcamentoForm.tsx`).

### 2. Header empresa (3 colunas)
- Coluna 1 (~30%): logo grande (~110px), padding 10px, borda direita.
- Coluna 2 (~50%): bloco único sem subdivisão horizontal — nome empresa em **bold 13px no topo** + endereço/fone/cidade/CNPJ logo abaixo (line-height 1.4, fonte 10px). **Remover** o `borderBottom` interno que separa nome de endereço.
- Coluna 3 (~20%): mantém 4 células empilhadas "Orçamento / [número] / Data / [data]". Reduzir altura mínima total para ~110px.

### 3. Bloco cliente — compactar para 6 linhas em 3 colunas
Reescrever o grid de **2 colunas → 3 colunas** com line-height 1.5 e fonte 10px (não 11px). Padding interno do bloco: `6px 12px` (não `10px 14px`).

Estrutura:
```
Linha 1: [Cod.Cliente: X]    [           ]    [Fantasia: X]
Linha 2: [Cliente: X (colspan 3)                          ]
Linha 3: [Endereço: X (colspan 2)         ]    [Bairro: X]
Linha 4: [Cidade: X]    [UF: X]               [CEP: X]
Linha 5: [CNPJ/CPF: X]  [I.E.: X]             [Email: X]
Linha 6: [Fone: X]      [Celular: X]          [Contato: X]
```
- Labels em `<b>`, valores texto normal, sem `&nbsp;` artificial.
- Última coluna alinhada à direita (`textAlign: right` com label inline).
- Uma só borda externa, sem borders entre linhas.

### 4. Tabela de itens
- **Header laranja** (`#C9743A`, branco, fonte 10px, padding `5px 6px`, altura ~26px). Manter texto branco em **bold**. Manter separação visual entre colunas via `borderRight: "1px solid #fff"`.
- **Linhas com produto**: padding `4px 8px`, fonte 10px, `borderBottom: "1px solid #e8e8e8"`.
- **Linhas vazias (padding até 10)**: renderizar a `<tr>` mas **sem bordas**, altura mínima `16px`. Detectar via `!item.produto_id` e omitir o `borderBottom`.
- Remover bordas verticais entre colunas no `<tbody>` (manter só no `<thead>`).

### 5. Bloco totais (faixa horizontal de 7 colunas)
Reescrever como **uma única faixa**, não tabela com 3 linhas:
- 7 `<td>` lado a lado.
- Cada célula: `<div>` com label fonte 9.5px peso 600 cor `#444` em cima + `<div>` valor fonte 13px bold mono embaixo.
- Padding célula: `6px 8px`.
- Última célula "Valor Total": fundo `#C9743A`, texto branco, label e valor maiores (label 11px, valor 14px).
- Bordas: `border: 1px solid #cccccc`, com `borderTop: 2px solid #cccccc` para destacar separação da tabela de itens.

### 6. Metadados — texto corrido em 2 linhas
**Remover totalmente** as caixas atuais (com `<div>` de label + `<b>` de valor). Substituir por 2 `<div>` simples logo abaixo da faixa de totais:

```
Linha 1: <b>Quantidade:</b> 26    <b>Peso:</b> 1,30    <b>Pagamento:</b> A PRAZO    <b>Prazo:</b> —
Linha 2: <b>Prazo de Entrega:</b> 9 DIAS ÚTEIS    <b>Frete:</b> SEDEX    <b>Tipo:</b> FOB
```

- Padding `4px 12px`, fonte 10px, sem bordas internas.
- Separação entre campos via espaçamento horizontal (4 espaços ou `gap` em flex).
- Para combinar com o modelo, usar `display: flex; justify-content: space-between` para distribuir 4 campos por linha.
- "Prazo de Entrega" em **bold no valor** (destaque de atenção como no modelo).

### 7. Tipografia geral
- Fonte base do template: **10px** (era 10-11). Padding externo do template: `8mm 10mm` (mantido).
- Margin entre seções (header → cliente → tabela → totais → obs): **6px** (era 8-10px).

### 8. Bloco OBSERVAÇÕES
- Manter como está (já está OK no modelo). Apenas reduzir minHeight para `60px` e fonte para 10px.

## Arquivos afetados

- **`src/components/Orcamento/OrcamentoPdfTemplate.tsx`** — refactor completo do JSX, mantendo a interface de Props inalterada. Nenhuma mudança de tipos.
- **`src/pages/OrcamentoForm.tsx`** — **NÃO tocar**. O nome do arquivo PDF e os dados passados continuam com prefixo "ORC"; a remoção do prefixo é só na renderização.

## Verificação

1. `npx tsc --noEmit` para garantir zero erros de tipo.
2. Pedir ao usuário para gerar um PDF de teste (com 1-2 itens e com 10+ itens) e comparar lado a lado com o `ORC100270`.
3. Validar que:
   - Header da tabela está laranja (não preto).
   - Linhas vazias não desenham bordas.
   - "Valor Total" aparece em uma linha só (sem quebrar).
   - Bloco cliente cabe em 6 linhas compactas.
   - Metadados são texto corrido sem caixas.
   - Documento cabe confortavelmente em A4 com 15-20 itens.

## O que NÃO muda

- Cor laranja `#C9743A` (header da tabela e Valor Total) — preservada.
- Logo, identidade visual, fonte Montserrat — preservados.
- Pipeline `html2canvas + jsPDF` em `OrcamentoForm.tsx` — não tocar.
- Estrutura de seções (header / cliente / itens / totais / obs) — preservada.
- Props da interface `Props` em `OrcamentoPdfTemplate` — preservadas.
