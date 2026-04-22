

# Revisão Profunda — Módulo Relatórios

Análise baseada exclusivamente no código real de `src/pages/Relatorios.tsx`, `src/config/relatoriosConfig.ts`, `src/services/relatorios.service.ts`, `src/utils/relatorios.ts`, `src/types/relatorios.ts`, hooks em `src/pages/relatorios/hooks/*` e componentes em `src/pages/relatorios/components/*`.

---

## 1. Visão geral do módulo

O módulo é um **workspace único** (`/relatorios`) que combina catálogo + execução. Estado ao vivo:

- **Catálogo**: 15 relatórios em 4 categorias (`reportConfigs`), com 6 marcados `priority`. Renderizado quando `?tipo` está vazio.
- **Workspace**: ativado por `?tipo=…`. Persiste filtros em URL (`di`, `df`, `cli`, `for`, `grp`, `st`, `ag`, `tp`, `drc`, `drm`).
- **Pipeline de dados**: `useRelatorio(tipo, filtros)` → `carregarRelatorio()` (Supabase) → `filtrarPorStatus()` → `sortarRows()` → render.
- **Camada semântica** (boa, recente): `RelatorioResultado.meta` (`kind`, `valueNature`, `timeAxis`), `statusKey`/`statusKind` por linha em `statusMap.ts`, `reportRuntimeSemantics` por relatório.
- **Saídas**: tabela (ou `DreTable`), `RelatorioChart` (bar/pie/line), `PreviewModal` + `PreviewDocument`, `ExportMenu` (CSV/XLSX/PDF via `export.service.ts`).
- **Acessórios**: favoritos (`useRelatoriosFavoritos`, localStorage), densidade compacta (localStorage), `ActiveFiltersBar`, ocultar colunas, drill-down em chart (mapa hardcoded).

Estado geral: **arquitetura sólida e bem documentada**, com migração parcial concluída para o contrato semântico. Os problemas restantes são de **coerência de produto** entre relatórios muito diferentes embarcados na mesma tela.

---

## 2. Problemas encontrados (reais, presentes hoje)

### 2.1 Heurísticas frágeis ainda ativas (fallback "morto-vivo")

- `Relatorios.tsx:41-42` define `BADGE_CRITICAL`/`BADGE_OK` com tokens absurdos ("c", "alta", "a") usados quando uma linha não traz `*Kind`. Como **todos os loaders já populam** `statusKind`/`criticidadeKind`/`faixaKind` (confirmado em `relatorios.service.ts`), esse fallback nunca dispara em produção — mas **continua sendo a fonte de verdade visual** caso alguém adicione um relatório novo e esqueça `statusKind`. Risco silencioso.
- `utils/relatorios.ts:188-192` `BADGE_TONE_MAP` usa regex `\b(...|c)\b` e `(...|b)/i` — qualquer texto com letra "c" ou "b" isolada vira destructive/warning. `classifyBadgeTone` é exportado e importado em `Relatorios.tsx:30` mas **não é usado** no render atual; só fica no bundle. Código morto + risco se for re-ativado.
- `utils/relatorios.ts:139` `filtrarPorStatus` ainda faz `String(status ?? situacao ?? faturamento).includes(wanted)` quando `statusKey` ausente. Funciona hoje, quebra na próxima fonte de dados.

### 2.2 Filtro de status: catálogo vs realidade

- `FiltrosRelatorio.tsx:28-34` declara `DEFAULT_STATUS_OPTIONS` com `aberto / vencido / pago / pendente`. Aplicado a **todos os relatórios** que não declararem `statusOptions` (e nenhum dos configs em `relatoriosConfig.ts` declara — confirmado ao varrer o arquivo).
- Resultado: em **Estoque** o seletor "Status" mostra "Pago / Vencido"; em **Vendas** mostra "Pago" (não existe), em **Compras** idem. O usuário filtra por algo que **não existe naquele relatório** e recebe lista vazia sem saber por quê.
- Felizmente `filters.showStatus = false` na maioria dos configs, então o seletor não aparece. Mas em `financeiro` e `aging` (onde aparece) os valores `aberto/parcial/pago/vencido/cancelado/estornado` do `financeiroStatusMap` divergem do select, e em `aging` a faixa real é `a_vencer/vencido` — o select promete "Pago" que nunca casa.

### 2.3 Semântica de período inconsistente entre relatórios

- `reportRuntimeSemantics` declara `periodAxisLabel` (ex.: `vencimento/pagamento dos títulos`), mas o `meta.timeAxis.field` no service nem sempre bate:
  - `financeiro` → `meta.timeAxis = vencimento` (linha 413), mas o loader de `financeiro` filtra por `data_vencimento` E o `periodAxisLabel` do config diz "vencimento/pagamento" — usuário não sabe qual é.
  - `compras` → `meta.timeAxis.field = 'criacao'` (684), mas `dateSortField = 'emissao'` no semantics (821). Conflito puro.
  - `fluxo_caixa` → `meta.timeAxis.field = 'pagamento'` (486) mas `periodAxisLabel = 'movimentação de caixa'`.
- Para o usuário: o "Período" filtra X mas o cabeçalho diz Y e a ordenação aplica Z.

### 2.4 KPIs descolam do escopo visível

- `Relatorios.tsx:158-168` calcula `kpiCards` a partir de `resultado.kpis` (universo do banco). `sortedRows` aplica filtros locais (`statusFiltro`, `agrupamento`). Quando há filtro local, a UI só pendura "(universo total)" no `variation` (539). Tabela e KPIs ficam falando de mundos diferentes. Já existe banner `Escopo divergente` (667-672) mas só na tabela — **KPIs continuam mentindo silenciosamente** sobre o que o usuário vê.

### 2.5 Drill-down "preparado" mas não funcional

- `Relatorios.tsx:679` `onRowClick` exibe `toast.info('Drill-down em preparação...')` quando `semantics.investigableField` existe — para o usuário, **clicar na linha não faz nada útil**, mas o cursor sugere clicabilidade.
- `handleChartDrillDown` (274-292) só funciona para 4 mapeamentos (vendas, faturamento, compras, curva_abc) e ignora o ponto clicado (só troca de relatório, sem aplicar filtro derivado). Para `aging`, `estoque`, etc., dispara apenas um toast.
- `drillDown[]` está declarado em `estoqueConfig` (182-185) com `targetField: 'produtoId'` — mas a query de estoque (linha 183) **não retorna `produtoId` nos rows** (apenas `id` no select cru, descartado pelo map). Promessa não cumprida.

### 2.6 Exportação: fontes de verdade duplicadas

- `Relatorios.tsx` formata badges/percent/currency dentro de `columns[].render` (175-207).
- `PreviewDocument.tsx:17` reusa `formatCellValue` do service.
- `exportarParaPdf/Excel/Csv` recebe `exportColumnDefs` e formata novamente em `export.service.ts` por `format`.
- Três caminhos paralelos. Ex.: badges aparecem como string crua no PDF/Excel, sem cor. Coluna "criticidade" exporta "Zerado" sem nenhum marcador de criticidade. Preview mostra como string também (`PreviewDocument` não renderiza badge).

### 2.7 Ordenação heurística remanescente

- `sortarRows` (`utils/relatorios.ts:152-184`) aceita `valueSortField`/`dateSortField`/`statusField` por config, mas faz fallback para `r['valor'] ?? r['valorTotal']` e, em fluxo de caixa, soma `entrada + saida` como aproximação. Para o usuário em "Maior valor primeiro" no fluxo de caixa, isso ordena por **volume bruto**, não por saldo (conceitos opostos em finanças).

### 2.8 DRE: caso especial mal acomodado

- DRE não usa `DataTable`, usa `DreTable` próprio (664). Mas a UI continua oferecendo: ocultar colunas, ordenação, agrupamento, status, badge — **nenhum desses se aplica**. Os controles ficam visíveis e inertes.
- `buildDreDateRange` é local em `Relatorios.tsx:47-59` e duplica lógica de `dreCompetencia`. Não há link para o conceito de DRE estruturado em `useRelatorioFinanceiro.ts:34-37` (que apenas chama `useRelatorio('dre')` sem nada do builder).
- `ExportMenu` exporta DRE como tabela `linha/valor` simples — perde a hierarquia (header/subtotal/dedução/resultado renderizada em `DreTable.tsx:30-37`).

### 2.9 Catálogo + workspace na mesma rota

- `?tipo` ausente → catálogo. `?tipo=…` → workspace. Voltar = `setSearchParams({})`.
- Não há rota dedicada por relatório (`/relatorios/vendas`), o que **quebra**: deep-link com bookmarks do browser; histórico de navegação ("voltar" no browser passa por todas mudanças de filtro); analytics por relatório; permissões finas por relatório (todos sob a mesma guard).
- Favoritos (`useRelatoriosFavoritos`) gravam só `URLSearchParams` em localStorage — **sem multiusuário**, sem sincronia entre dispositivos, perdidos ao limpar cache.

### 2.10 Hooks especializados sub-utilizados

- `useRelatorioVendas`, `useRelatorioFinanceiro`, `useRelatorioEstoque` existem com `select` para pré-computar `vendasPorPeriodo`, `agingPorFaixa`, etc. **`Relatorios.tsx` não os usa** — chama `useRelatorio` direto (linha 140). Os derivados (`vendasPorPeriodo`) são código morto. Confusão para quem mantiver.

### 2.11 Bugs/atritos menores concretos

- `Relatorios.tsx:679` — `onRowClick` checa `semantics?.investigableField` mas o tipo correto em `relatoriosConfig.ts:137` é `investigableField` (typo "investigationField" no summary, mas o código real usa `investigableField` — confirmado). OK.
- `Relatorios.tsx:218-219` recalcula `exportScopeDescription` a cada render sem memo (barato, mas reaparece em closures de toast).
- `useRelatoriosFavoritos.ts` — `salvar()` retorna `RelatorioFavorito | null`, mas `setFavoritos` é assíncrono e o `result` é capturado na closure síncrona que pode não ter rodado quando o `return result` executa. Atualmente funciona porque `setState` callback executa síncrono no React 18 batched, mas é frágil.
- `Relatorios.tsx:64` cast direto `as TipoRelatorio` em string da URL — sem validação. `?tipo=hack` carrega `selectedMeta = undefined` e a UI mostra tela vazia sem catálogo.
- `MultiSelect` de Grupos lista todos os grupos carregados; clientes/fornecedores usam `AsyncMultiSelect`. Inconsistência UX de busca.

### 2.12 Riscos de manutenção

- 3 fontes de verdade para semântica de status:
  1. `statusMap.ts` (canônico, linhas → `*Key/*Kind`)
  2. `BADGE_CRITICAL`/`BADGE_OK` em `Relatorios.tsx` (legado)
  3. `BADGE_TONE_MAP` em `utils/relatorios.ts` (não usado mas exportado)
  
  → Próximo dev tem 3 lugares para errar.
- 2 contratos para "tipo de valor" (quantidade vs monetário): `meta.valueNature` (novo) e `_isQuantityReport` (deprecated). `Relatorios.tsx:143` usa OR dos dois — toda nova feature precisa lembrar de alimentar os dois ou virar bug.
- `Relatorios.tsx` tem **750 linhas** com seleção, KPIs, filtros, tabela, chart, preview, export, favoritos e densidade tudo no mesmo componente. Difícil testar isoladamente.
- `relatorios.service.ts` tem **1303 linhas** com 15 loaders inline. `case "dre"` sozinho passa de 100 linhas. Qualquer mudança acopla todos os relatórios pelo mesmo arquivo.

---

## 3. Problemas prioritários

Ordenados por impacto x risco (top = corrigir primeiro):

1. **P1 — Filtros de status quebrados em alguns relatórios** (2.2). Usuário filtra "Pago" em Aging e recebe lista vazia. Bug visível.
2. **P1 — KPIs vs tabela divergem silenciosamente** (2.4). Reportes gerenciais com números errados é o pior tipo de bug nesse módulo.
3. **P1 — Drill-down de linha promete e não entrega** (2.5). Cursor pointer + toast "em preparação" é dívida de produto exposta ao usuário.
4. **P2 — Semântica de período inconsistente** (2.3). `meta.timeAxis.field` ≠ `dateSortField` ≠ `periodAxisLabel`. Confunde análise.
5. **P2 — DRE com controles inertes** (2.8). Ocultar colunas / agrupar em DRE não faz nada — controles visíveis, sem ação.
6. **P2 — Heurísticas zumbis** (2.1). `BADGE_CRITICAL`/`classifyBadgeTone` morrem-em-pé e voltam a morder na próxima entidade.
7. **P3 — 3 caminhos de formatação para export/preview/tela** (2.6). Badges não exportam, preview não pinta status.
8. **P3 — Hooks especializados não usados** (2.10). Limpeza de código morto.

---

## 4. Melhorias de UI/UX

- **Catálogo com busca/filtro**: hoje 15 cards estáticos. Adicionar input de busca por título/objetivo e filtro por categoria. Mostrar último uso (de favoritos).
- **Cabeçalho do workspace expõe o eixo temporal**: junto a "Período: 01/01–31/01" exibir badge "Eixo: vencimento" / "Eixo: emissão" derivado de `meta.timeAxis.label` — elimina a confusão de 2.3.
- **Tooltip explicando KPI vs tabela** quando `hasLocalFiltersApplied` é true: hoje só vai um sufixo `(universo total)` — pouco visível. Trocar por banner de cima ou ícone clicável no card.
- **Filtro de status dinâmico**: derivar opções do `statusMap` real do relatório (cada loader já sabe seus status canônicos). Eliminar `DEFAULT_STATUS_OPTIONS`.
- **Estado de drill-down honesto**: enquanto não houver navegação real, **remover o cursor pointer e o toast** — `onRowClick={undefined}`. Quando entregar, ativar por relatório.
- **Badges no Preview/PDF/Excel**: pintar com cor (PDF: cell fill por `statusKind`; Preview: usar componente `Badge` real).
- **Densidade compacta**: persiste por usuário em localStorage hoje. Migrar para `user_preferences` (já existe a tabela conforme `mem://features/preferencias-de-usuario`) para sincronia entre dispositivos.
- **Empty state do filtro**: quando filtro local zera resultado mas universo tem dados, exibir CTA "limpar filtros locais" diferenciando de "sem dados no banco".
- **Acessibilidade**: vários `Popover`s sem `aria-label` no trigger; `Checkbox` de colunas sem label associado por `htmlFor` (usa `<label>` envolvente, mas sem id — leitor de tela funciona, mas inconsistente com o resto do projeto).
- **Mobile**: grid `xl:grid-cols-[2fr_1fr]` empilha em mobile, mas `FiltrosRelatorio` com `flex-wrap` + Selects 250px estoura em telas <380px.

---

## 5. Melhorias estruturais

### 5.1 Tipar `?tipo` com runtime guard

Validar `searchParams.get('tipo')` contra `Object.keys(reportConfigs)` antes do cast. Redirecionar para catálogo se inválido.

### 5.2 Quebrar `Relatorios.tsx` (750 linhas)

Extrair em arquivos isolados, hooks dedicados:
- `useRelatorioWorkspace(tipo)` — agrega URL state, query, derived `sortedRows`, kpis, columns.
- `useRelatorioExport()` — handlers CSV/XLSX/PDF + `isExporting` + `exportColumnDefs`.
- `useRelatorioFiltrosUrl()` — `filtrosState` ↔ `searchParams`.
- `<RelatorioCatalogo />` — bloco do catálogo (linhas 479-513).
- `<RelatorioWorkspace />` — bloco ativo (515-714).
- `<RelatorioActiveActions />` — coluna direita de ações (575-636).

### 5.3 Quebrar `relatorios.service.ts` (1303 linhas)

Pasta `src/services/relatorios/loaders/` com um arquivo por relatório (`estoque.loader.ts`, `dre.loader.ts`…), e `index.ts` mapeando `tipo → loader`. `carregarRelatorio` vira dispatcher de 10 linhas.

### 5.4 Eliminar contratos legacy

- Remover `_isQuantityReport`/`_isDreReport`. Manter só `meta.valueNature`/`meta.kind`. Migrar consumers (`Relatorios.tsx:143-144`, `PreviewDocument.tsx`).
- Remover `BADGE_CRITICAL`/`BADGE_OK` do `Relatorios.tsx`. O fallback se torna `'secondary'` quando `statusKind` ausente, e adicionar warn em dev: `console.warn('[Relatorios] Linha sem statusKind no relatório X')`.
- Remover `classifyBadgeTone`/`BADGE_TONE_MAP` de `utils/relatorios.ts` (não-usados) ou marcar `@deprecated` com path de remoção.

### 5.5 Filtros de status declarativos

Cada `ReportConfig` declara seus `statusOptions` derivados do respectivo `*StatusMap`. `FiltrosRelatorio` deixa de ter `DEFAULT_STATUS_OPTIONS`. Helper:

```ts
const statusOptionsFromMap = (map: Record<string, StatusMeta>) =>
  [{value:'todos', label:'Todos'}, ...Object.entries(map).map(...)]
```

### 5.6 Unificar formatação tela ↔ preview ↔ export

Criar `src/services/relatorios/formatters.ts` com `formatRowCell(value, columnDef, context)` único. `Relatorios.tsx` (renderer), `PreviewDocument` e `export.service.ts` consomem o mesmo formatter. Badge ganha cor em PDF/Excel via mapping `statusKind → fillColor`.

### 5.7 Drill-down real

`drillDown[]` no config + `drillDownReady: true` em `meta` + `targetField` retornado de fato pelo loader (incluir `produtoId`/`clienteId` nas linhas, escondidos das colunas visíveis). `onRowClick` passa a chamar `navigate(drillDown[0].route + '?id=' + row[targetField])`.

### 5.8 Rotas dedicadas (opcional, alto valor)

`/relatorios` (catálogo) + `/relatorios/:tipo` (workspace). Filtros continuam em querystring. Ganhos: deep-link, analytics, permissão por relatório, histórico de browser limpo.

### 5.9 Favoritos no banco

Migrar `useRelatoriosFavoritos` (localStorage) para tabela `relatorios_favoritos (user_id, nome, tipo, params, criado_em)` com RLS por `user_id`. Sincroniza entre dispositivos e sobrevive a limpeza de cache.

### 5.10 Testes

`utils/relatorios.test.ts` cobre utils. **Faltam**:
- Testes de `filtrarPorStatus` com `statusKey` e fallback.
- Testes do `statusMap` (cobertura dos 5 maps).
- Smoke test de cada loader em `relatorios.service.ts` (ao menos shape do `meta`).

---

## 6. Roadmap de execução

Sequência recomendada, cada fase isolável e entregável:

| # | Fase | Escopo | Risco | Esforço |
|---|------|--------|-------|---------|
| 1 | **Correções de coerência (P1)** | Status options dinâmicos por relatório (2.2), banner KPI vs tabela visível (2.4), remover cursor+toast de drill-down inerte (2.5), validar `?tipo` | baixo | S |
| 2 | **Limpeza de heurísticas zumbis** | Remover `BADGE_CRITICAL`/`BADGE_OK`, `classifyBadgeTone` não usado, deprecated `_isQuantityReport`/`_isDreReport` | baixo | S |
| 3 | **Alinhar semântica de período** | Reconciliar `meta.timeAxis` ↔ `dateSortField` ↔ `periodAxisLabel` por relatório; expor "Eixo" no header | baixo | S |
| 4 | **DRE: ocultar controles inertes** | `FiltrosRelatorio` e ações ocultam ordenação/colunas quando `meta.kind === 'dre'` | baixo | XS |
| 5 | **Decompor `Relatorios.tsx`** | Extrair `useRelatorioWorkspace`, `useRelatorioExport`, `<RelatorioCatalogo />`, `<RelatorioWorkspace />` | médio | M |
| 6 | **Decompor `relatorios.service.ts`** | Pasta `loaders/` por relatório + dispatcher | médio | M |
| 7 | **Formatter único** | `formatters.ts` consumido por tela/preview/export; badges com cor em PDF/Excel | médio | M |
| 8 | **Drill-down real (vendas → vendas_cliente, estoque → produto)** | Incluir `*Id` nos rows; navegação aplicando filtro | médio | M |
| 9 | **Rotas dedicadas `/relatorios/:tipo`** | Refator de URL + atualização de favoritos/links | médio | M |
| 10 | **Favoritos persistidos no banco com RLS** | Tabela + migration + hook + UI | baixo | S |
| 11 | **Testes** | Cobertura de `filtrarPorStatus`, `statusMap`, smoke de loaders | baixo | M |

**Quick wins (1 PR cada)**: fases 1, 2, 3, 4, 10.  
**Refatoração estrutural**: 5, 6, 7.  
**Evolução de produto**: 8, 9.

