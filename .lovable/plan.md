## Objetivo

Adequar visualmente o PDF de orçamento gerado em `src/components/Orcamento/OrcamentoPdfTemplate.tsx` ao **modelo de referência** enviado (`Modelo.pdf`), mantendo formato A4 retrato e a mesma pipeline de geração (`html2canvas` + `jsPDF` em `OrcamentoForm.tsx`, sem alterações nessa pipeline).

A geração já é A4 (`new jsPDF("p", "mm", "a4")` com largura `210mm` no template). O ajuste é puramente de **layout/estilo**.

## Diferenças entre layout atual e o modelo

| Bloco | Atual | Modelo (alvo) |
|---|---|---|
| Header | Logo pequena + texto bordô (#690500), título "ORÇAMENTO" no canto direito sem caixa | Caixa com borda fina envolvendo tudo. Logo grande à esquerda, dados da empresa centralizados ao lado. À direita, **3 células empilhadas** (Orçamento / nº / Data) com bordas |
| Cliente | Caixa cantos arredondados, grid 3 col com labels em negrito | Caixa retangular (sem cantos arredondados), labels alinhados à direita do título, grid claro 3-colunas com mais espaço entre linhas |
| Tabela itens (header) | Fundo bege `#f0e8d8`, texto preto | **Fundo laranja sólido `#C9743A`, texto branco em negrito** |
| Tabela itens (linhas) | Borda inferior bege | Linhas mais limpas; border externo na tabela toda |
| Totais | Caixa arredondada com 7 sub-blocos centralizados, "Valor Total" em fundo creme com texto bordô | **Faixa de células com bordas (estilo tabela)**, todos os 7 valores. Última célula "Valor Total" com **fundo laranja sólido + texto branco em negrito** |
| Condições comerciais | Caixa separada arredondada com 2 grids | **Continuação direta da tabela de totais** (mesma borda/estilo), 2 linhas com Quantidade/Peso/Pagamento/Prazo + Prazo Entrega/Frete/Tipo |
| Observações | Caixa arredondada com título bordô | Título "OBSERVAÇÕES" em negrito **fora** da caixa, e abaixo uma **caixa retangular vazia** apenas com borda fina |
| Paleta | Bordô `#690500` como destaque + bege `#f0e8d8` | **Laranja terracota `#C9743A`** (cor da logo Avizee no modelo) como único destaque, sobre branco/preto |
| Cantos | Vários `borderRadius: 4px` | Tudo retangular, sem cantos arredondados |

## Plano de implementação

### 1. Refazer `src/components/Orcamento/OrcamentoPdfTemplate.tsx`

Substituir o `return (...)` do componente mantendo:
- A mesma assinatura de props (`Props`) e o `forwardRef<HTMLDivElement, Props>`.
- O mesmo cálculo `paddedItems` (mínimo 10 linhas).
- Os helpers `formatDate` e `paymentLabel`.
- Os mesmos campos de empresa/cliente já lidos.

Mudanças visuais a aplicar (todas inline-style, para que `html2canvas` capture corretamente):

**Container raiz**
- Manter `width: 210mm`, `minHeight: 297mm`.
- Reduzir padding para `8mm 10mm` (mais próximo das margens do modelo).
- Trocar fonte principal para algo mais "documental": manter `Montserrat` mas com `fontSize: 10px` base.
- Definir constante local `const ORANGE = "#C9743A";` e `const BORDER = "#5a5a5a";` para reutilização.

**Header (substituir bloco atual)**
- `<div>` externo com `border: 1px solid ${BORDER}` envolvendo tudo.
- Layout flex 3 colunas: 
  - Coluna esquerda (logo): `flex: "0 0 25%"`, padding interno, `<img>` com `height: 60px`.
  - Coluna central (dados empresa): `flex: 1`, padding interno, `border-left: 1px solid ${BORDER}`. Nome em negrito 13px no topo, depois endereço/fone/CNPJ em 9px.
  - Coluna direita (Orçamento/Data): `flex: "0 0 18%"`, `border-left: 1px solid ${BORDER}`, dividido em 4 linhas alternando label+valor (label centralizado em 9px com fundo branco; valor centralizado em 11px). Linhas separadas por `borderTop: 1px solid ${BORDER}`.

**Bloco Cliente (substituir)**
- `<div>` com `border: 1px solid ${BORDER}`, sem `borderRadius`, padding `8px 12px`, `marginTop: 6px`.
- Manter o mesmo grid 3 colunas, mas:
  - Labels alinhados à direita seguidos de `:` e valor à esquerda (usar `display: grid; grid-template-columns: auto 1fr auto 1fr auto 1fr` por linha, ou manter grid atual com label `text-align: right`).
  - Aumentar `lineHeight` para `1.9` e usar negrito apenas no label.

**Tabela de itens (ajustar)**
- Envolver `<table>` em `border: 1px solid ${BORDER}`.
- `<thead><tr>` com `background: ${ORANGE}`, `color: #fff`, `fontWeight: 700`, padding `6px 8px`.
- Remover `borderBottom` bege das linhas; usar apenas borda `#e0e0e0` muito fina ou nenhuma (modelo tem linhas "soltas").
- Alinhamentos: Código (left), Descrição (left), Variação (center), Qtd (center), Un (center), Unit (right), Total (right).
- Remover ícone "R$" duplicado quando vazio (já está OK no atual; só revalidar).

**Bloco Totais (refazer como tabela contínua)**
- Substituir o grid atual por uma `<table>` real com `border-collapse: collapse; border: 1px solid ${BORDER}; width: 100%`.
- Linha 1: 7 `<th>` com label cinza pequeno (Total Produtos, (-)Desconto, (+)Imposto S.T., (+)Imposto IPI, (+)Frete, (+)Outras desp., **Valor Total**). A célula "Valor Total" com `background: ${ORANGE}; color: #fff`.
- Linha 2: 7 `<td>` com os valores em negrito. A célula "Valor Total" também com `background: ${ORANGE}; color: #fff; fontWeight: 700`.
- Cada célula com `border: 1px solid ${BORDER}` e padding `4px 6px`.

**Bloco Condições comerciais (anexar à tabela de totais)**
- Logo abaixo, sem espaço, outra `<table>` com mesma borda externa.
- Linha 1 (4 colunas com colspan): `Quantidade: X` | `Peso: X,XX` | `Pagamento: X` | `Prazo: X`.
- Linha 2 (3 colunas): `Prazo de Entrega: X` (colspan 2) | `Frete: X` (colspan 2) | `Tipo: X` (colspan 2). Ajustar colspans para somar 7 e alinhar com tabela acima.
- Labels em peso normal cinza, valores em negrito preto.

**Observações (ajustar)**
- Título `OBSERVAÇÕES` em negrito 10px **fora** da caixa, com `marginTop: 8px; marginBottom: 4px`.
- Caixa abaixo: `border: 1px solid ${BORDER}`, `minHeight: 50px`, padding `6px 8px`, `whiteSpace: pre-wrap`, sem cor de fundo nem cantos arredondados.

**Remoções**
- Remover todas as ocorrências de `borderRadius` no template.
- Remover destaques bordô `#690500` (substituir pelo `ORANGE`).
- Remover o background `#fffaed` do bloco "Valor Total" antigo.

### 2. Não tocar em `src/pages/OrcamentoForm.tsx`

A pipeline de geração (`html2canvas` com `scale: 2` + `jsPDF` em A4 retrato) já produz uma página A4 corretamente; não há mudança de comportamento necessária. O nome do arquivo, o `previewOpen` e o fluxo de download permanecem.

### 3. Validação visual

Após a aplicação:
- Abrir um orçamento existente, clicar em "Gerar PDF".
- Conferir no PDF gerado:
  - Header em caixa com 3 colunas (logo / dados empresa / Orçamento+Data).
  - Tabela de itens com header laranja e texto branco.
  - Faixa de totais com "Valor Total" laranja sólido, texto branco.
  - Bloco de condições logo abaixo, sem espaço, mesma moldura.
  - "OBSERVAÇÕES" em negrito acima de uma caixa vazia.
  - Conteúdo cabe em 1 página A4 com até ~10 itens (já é o caso pelo padding de linhas).

## Itens **fora** do escopo

- Substituir `html2canvas` por uma biblioteca PDF nativa (ex.: `pdfmake`/`react-pdf`). Mantém-se o pipeline atual.
- Mudanças na pipeline de envio por e-mail/token público.
- Alterar o template usado em `OrcamentoView.tsx` (esse é a tela web, não o PDF).

## Arquivos afetados

- `src/components/Orcamento/OrcamentoPdfTemplate.tsx` — único arquivo modificado (somente o JSX retornado e constantes locais de cor).
