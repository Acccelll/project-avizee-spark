
# Revisão e melhorias — Apresentação Gerencial (V3)

## 1. Diagnóstico atual (com base no código + banco + PPTX referência)

### Problemas estruturais encontrados
1. **Modo dinâmico está “quebrado em silêncio”**: `fetchPresentationData.ts` consulta 26 views `vw_apresentacao_*` que **não existem no banco** (consultei `information_schema.views` — zero matches). O `try/catch` engole o erro e marca todos os slides como "não automatizado nesta fase". Resultado: a apresentação sai praticamente vazia em modo dinâmico.
2. **Duplicação de pipeline com Workbook**: o Workbook V2 já tem 18 views `vw_workbook_*` ricas (DRE, ABC, vendedor, região, funil, fornecedor, fiscal, logística, estoque crítico/giro, aging). A apresentação ignora tudo isso e tenta inventar suas próprias views.
3. **Render PPTX é só "texto sobre retângulos"** — `renderSeries` desenha barras com caracteres `█`, `renderTable` concatena colunas com ` | `. **Não há um único gráfico nativo do PowerPoint.** Comparado ao PPTX anexo do cliente (linhas, barras agrupadas, colunas comparativas reais), o output é visualmente pobre.
4. **Cobertura por área é só "financeiro"**: 12 slides obrigatórios são todos finanças/caixa/FOPAG. Comercial, compras, estoque, logística, fiscal, RH e social estão como **opcionais** e, na prática, sempre indisponíveis.
5. **PPTX referência mostra padrão concreto que não está sendo seguido**:
   - Capa com logo + data-base
   - Highlights com cards numéricos coloridos
   - Faturamento ME×ME com tabela ao lado de gráfico
   - Variação 12 meses como linha contínua
   - Despesas com comparativo de ano anterior + ranking de fornecedores no comentário
   - Receita×Caixa lado a lado (4 séries)
   - Confronto trimestral (1Q/2Q/3Q/4Q)
   - FOPAG mensal empilhado por categoria
   - Fluxo de caixa em tabela 4 colunas (Disponível, ACT+Bgt, Total Final, Saldo final)
   - Top 10 lucro por produto e por cliente lado a lado
   - Estoque produtos×materiais (12 meses)
   - Venda por estado (mapa/ranking)
   - Redes sociais (linha LinkedIn vs Instagram)
6. **Comentários executivos são genéricos** ("Valor atual R$ X e variação Y%"). O PPTX real tem comentários ricos: "Limite de faturamento ME 360k. 318.7k para atingir", "Maiores desembolsos: 1º Agrozootec 5.1k…". Faltam regras com contexto.
7. **`viewMap` em `fetchPresentationData.ts` referencia views inexistentes** mas o tipo `Record<SlideCodigo, string>` esconde isso porque o build não valida existência no banco.
8. **Sem suporte a comparativo Δ vs PY e Δ vs Budget** já existente no Workbook (tabela `budgets_mensais` foi criada na fase 1 do Workbook V2 e ainda não é usada na apresentação).

---

## 2. Estratégia da V3 — três pilares

### Pilar A — Reuso do pipeline Workbook
Apresentação e Workbook devem **compartilhar a camada de dados**. Em vez de criar 26 views novas, refatoramos `fetchPresentationData` para reutilizar `fetchWorkbookData()` + as views `vw_workbook_*` que já existem e estão em produção. Cada slide vira uma "projeção" do `WorkbookRawData`.

### Pilar B — Gráficos nativos PowerPoint
Substituir `renderSeries` (barras de texto) por **chart parts XML reais** (`ppt/charts/chart1.xml`) usando o schema `c:lineChart`, `c:barChart`, `c:doughnutChart` do OOXML. Isso permite que ao abrir no PowerPoint o usuário possa editar cores, dados e até copiar para Word/Excel.

### Pilar C — Cobertura corporativa de fato
Mover todos os slides de "todas as áreas" para **obrigatórios na V3**, organizados em seções, com fallback gracioso quando não há dados (em vez de simplesmente esconder).

---

## 3. Nova estrutura de slides — 7 seções, 32 slides

```
SEÇÃO 1 — ABERTURA (2 slides)
  01 Capa (logo, data-base, autor, período)
  02 Sumário executivo (Highlights — 6 cards: ROL, Caixa, Receita, Despesa, Resultado, NPS/Backorder)

SEÇÃO 2 — FINANCEIRO (8 slides) [vw_workbook_dre_mensal, faturamento, despesa, caixa]
  03 Faturamento mensal (col + tabela ME×ME atual×PY)
  04 Variação faturamento 12 meses (linha contínua)
  05 Despesas mensais (col + Δ vs PY + top fornecedores no comentário)
  06 Receita vs Caixa (4 séries lado a lado, atual×PY)
  07 Receita vs Despesa — Confronto trimestral (1Q–4Q + YTD)
  08 DRE Gerencial (waterfall: Receita → Deduções → RL → FOPAG → OpEx → EBITDA)
  09 Fluxo de caixa (tabela 12m + linha de saldo)
  10 Bancos detalhado (saldos por conta + variação)

SEÇÃO 3 — PESSOAS (1 slide) [vw_workbook_fopag/fechamento_fopag]
  11 FOPAG mensal (barra empilhada por categoria + retiradas + headcount)

SEÇÃO 4 — COMERCIAL (5 slides) [vendas_vendedor, vendas_cliente_abc, vendas_regiao, orcamentos_funil]
  12 Top 10 Lucro por Produto e por Cliente (2 rankings lado a lado)
  13 Vendas por estado (ranking + bandeirinhas UF)
  14 Curva ABC de clientes (Pareto: barras + linha acumulada)
  15 Performance por vendedor (ranking + Δ vs mês anterior)
  16 Funil de orçamentos (cards: leads → cotados → aprovados → conversão %)

SEÇÃO 5 — COMPRAS / ESTOQUE (3 slides) [compras_fornecedor, estoque_giro, estoque_critico]
  17 Top fornecedores + lead time médio
  18 Variação de estoque (produtos × materiais, 12 meses)
  19 Estoque crítico (itens abaixo do mínimo, dias de cobertura)

SEÇÃO 6 — LOGÍSTICA / FISCAL (3 slides) [logistica_resumo, fiscal_resumo]
  20 Logística & SLA (OTIF, prazos médios, devoluções)
  21 Backorder / Carteira (pedidos pendentes, valor, idade)
  22 Tributos do período (ICMS, PIS, COFINS, IPI — col empilhado)

SEÇÃO 7 — RISCO E RECEBÍVEIS (3 slides) [aging_cr/cp]
  23 Aging consolidado CR + CP (stacked bar por bucket)
  24 Inadimplência (cards: % atraso, valor, top devedores)
  25 Capital de giro (CR − CP, dias de giro)

SEÇÃO 8 — MARKETING / SOCIAL (1 slide) [social_metricas_snapshot]
  26 Redes sociais (linha Instagram vs LinkedIn — novos seguidores 12m)

SEÇÃO 9 — FECHAMENTO (1 slide)
  27 Encerramento + próximos passos + assinatura editorial
```

> Todos os 27 viram **required**. Slides sem dados ainda renderizam, mas mostram painel "indisponível" elegante (já existe `unavailablePanel`). O usuário continua podendo desligar opcionalmente no diálogo de geração via `slideConfig`.

---

## 4. Mudanças técnicas concretas

### 4.1 Banco de dados — uma migration nova
**`supabase/migrations/<ts>_apresentacao_v3_views.sql`**

Criar 6 views novas que **não existem ainda** e são específicas da apresentação (combinam várias `vw_workbook_*` em formato de slide):

- `vw_apresentacao_highlights` — agrega 6 KPIs do período (uma linha)
- `vw_apresentacao_confronto_trimestral` — pivota receita/despesa/resultado em 1Q/2Q/3Q/4Q + YTD + PY
- `vw_apresentacao_dre_waterfall` — uma linha por step do waterfall (label, valor, cor)
- `vw_apresentacao_lucro_top10` — top 10 lucro por produto e por cliente
- `vw_apresentacao_social_evolucao` — série mensal de seguidores LinkedIn/Instagram a partir de `social_metricas_snapshot`
- `vw_apresentacao_capital_giro` — CR – CP, dias de giro (a partir de aging)

Todas com `SET search_path = public`, sem RLS (são views; segurança herdada das tabelas-base).

### 4.2 Refatorar `src/lib/apresentacao/fetchPresentationData.ts`

- **Remover** o `viewMap` com 26 views fantasmas.
- **Reusar** `fetchWorkbookData()` (já existe e está testado) para obter o `WorkbookRawData`.
- **Adicionar** um adapter `mapWorkbookToSlides(raw, requestedSlides)` que projeta o raw em `Record<SlideCodigo, dados>`.
- Manter o caminho `fechado` que já lê de `fechamentos_mensais` (snapshots).
- Remover o `try/catch` que mascara erros — qualquer falha deve subir, com fallback `indisponivel:true` apenas quando a view retornar vazia.

### 4.3 Novo módulo `src/lib/apresentacao/sheets/` (espelho do Workbook)

Criar um arquivo por seção, cada um exportando `buildSlide(codigo, dados): SlideRenderSpec`:

```
src/lib/apresentacao/sheets/
  financeiro.ts     (slides 03–10)
  pessoas.ts        (slide 11)
  comercial.ts      (slides 12–16)
  estoque.ts        (slides 17–19)
  logistica.ts      (slides 20–22)
  risco.ts          (slides 23–25)
  marketing.ts      (slide 26)
```

Cada `SlideRenderSpec` declara: layout (cards | tabela | grafico_nativo + tipo), `chartPayload` (categories/series), `headerKpis`, `commentsAuto`.

### 4.4 Renderizador PPTX — gráficos nativos OOXML

Refatorar `generatePresentation.ts` para suportar **chart parts** reais:

- Novo helper `chartPartXml(spec: ChartPayload): { partXml, relsXml }` que emite `<c:chartSpace>` com `c:lineChart` / `c:barChart` / `c:doughnutChart` conforme o `ChartKind` já tipado em `src/lib/apresentacao/charts.ts`.
- Adicionar entradas em `[Content_Types].xml` para `application/vnd.openxmlformats-officedocument.drawingml.chart+xml`.
- Cada slide com gráfico ganha `ppt/charts/chartN.xml` + `ppt/slides/_rels/slideN.xml.rels` referenciando o chart.
- Manter `renderCards`, `renderRanking`, `renderTable` para slides sem gráfico (texto+tabela).
- **NÃO** quebrar os testes existentes (`generatePresentation.test.ts`) — adicionar testes novos para chart parts.

### 4.5 Comentários executivos com regras de negócio

Estender `commentRules.ts` com geradores específicos por slide, espelhando o tom do PPTX referência:

- **Faturamento**: "Limite de faturamento ME 360k. R$ X para atingir." (quando regime tributário = ME)
- **Despesas**: anexar top 3 fornecedores do mês a partir de `compras_fornecedor`
- **Receita×Caixa**: anexar top 3 clientes que pagaram no período
- **Aging**: alertar buckets > 90 dias com %
- **Estoque crítico**: listar até 3 SKUs com cobertura < 7 dias
- **Vendedor**: nomear o líder + variação vs mês anterior
- **Funil**: % conversão e principal gargalo (etapa com maior queda)

Cada regra retorna `ExecutiveComment[]` (estrutura já existe) com severidade adequada.

### 4.6 Diálogo de geração

Atualizar `ApresentacaoGeracaoDialog.tsx`:
- Agrupar slides opcionais por **seção** (não lista flat) com checkbox "selecionar tudo da seção"
- Adicionar toggle "Comparar com ano anterior" (PY) e "Comparar com Budget"
- Adicionar campo "Empresa" (se mais de uma) — hoje fica null
- Preview de cobertura (X/27 slides terão dados, Y indisponíveis) **antes** de gerar, usando uma chamada leve a `fetchPresentationData` em modo dry-run

### 4.7 Preview no app

Atualizar `ApresentacaoSlidesPreview.tsx` para:
- Agrupar por seção com headers
- Mostrar miniatura visual aproximada de cada slide (não só "Aguardando dados")
- Indicar via badge se o slide tem chart nativo ou texto

### 4.8 Histórico

`ApresentacaoHistoricoTable.tsx` ganha colunas para:
- Cobertura (24/27)
- Seções incluídas (badges)
- Modo (dinâmico/fechado)
- Hash de auditoria (8 chars)

---

## 5. Fases de execução sugeridas

| Fase | Escopo | Entrega |
|------|--------|---------|
| **F1 — Fundação de dados** | Migration com 6 views novas + reescrita de `fetchPresentationData` para consumir `vw_workbook_*` | Modo dinâmico volta a funcionar de fato |
| **F2 — Cobertura corporativa** | Mover todos os 27 slides para required, criar `sheets/` por seção, adapter `mapWorkbookToSlides` | Apresentação cobre todas as áreas |
| **F3 — Gráficos nativos** | Refatorar `generatePresentation` com `chartPartXml`, suportar line/bar/doughnut/stacked/waterfall | PPTX abre no PowerPoint com gráficos editáveis |
| **F4 — Comentários ricos** | Estender `commentRules` com regras por slide (top fornecedores, líder de vendas, gargalo de funil etc.) | Comentários iguais ao PPTX referência |
| **F5 — UX do diálogo + Preview** | Agrupamento por seção, toggle PY/Budget, dry-run de cobertura, preview visual | Usuário sabe o que vai sair antes de gerar |
| **F6 — Workflow editorial** | Seções de aprovação por seção (não global), comentários por slide com diff automático×editado, histórico de versões | Apresentação vira documento revisável |

---

## 6. Pontos que precisam de decisão antes da F1

1. **Logo / data-base**: o PPTX usa logo na capa. Hoje a apresentação não tem. Devo puxar do `app_configuracoes.geral.logo_url`?
2. **Limite ME (regime tributário)**: o comentário "limite ME 360k" depende de saber o regime fiscal da empresa. Está em `empresa_config`?
3. **Backorder / Carteira**: existe tabela `ordens_venda` com status "backorder"? Confirmar antes da F2.
4. **Social**: `social_metricas_snapshot` já tem histórico mensal de seguidores ou só snapshots pontuais?

Posso seguir direto com a F1 (correção crítica do modo dinâmico) e abrir issues separadas para os 4 pontos acima conforme apareçam, ou prefere que eu pergunte tudo antes via `ask_questions`?
