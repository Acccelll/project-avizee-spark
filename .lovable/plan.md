
# Revisão e proposta de melhoria — Workbook Gerencial

## 1. Diagnóstico do estado atual

O módulo `/relatorios/workbook-gerencial` (ver `src/lib/workbook/`) hoje gera 9 abas, todas concentradas em **Financeiro**:

| Aba atual | Conteúdo | Limitação |
|---|---|---|
| Confronto | Receita × Despesa × Resultado mensal | Sem PY (ano anterior) nem Budget; sem totais trimestrais (1Q/2Q…) |
| Caixa | Saldo atual por conta bancária | Snapshot único — não traz evolução mensal "Disponível/Bloqueado/Inicial/Final" como no anexo |
| Despesa | Total + acumulado + variação m/m | Sem quebra por categoria/centro de custo |
| FOPAG | Folha por funcionário × mês | Sem encargos, sem total por departamento |
| Faturamento NFs | Total mensal + acumulado | Sem comparativo PY, sem "Limite Fat." (Simples Nacional) |
| Estoque | Saldo atual material vs produto | Snapshot único, sem giro/cobertura/curva ABC |
| Aging CR / CP | Faixas de vencimento por mês | OK, mas isolado das abas comerciais |
| Parâmetros | Hash + metadados | OK |

**O que está faltando (vs. o anexo `Financeiro_workbook_2026-4.xlsx` e os domínios do ERP):**

1. **Comparativos** — o anexo trabalha com 3 colunas paralelas: **PY (ano anterior real) | CY (ano corrente real) | Budget**, com colunas de "Variação Budget %", "Variação 2025" e "Variação Mês Anterior". Hoje o workbook só mostra o período pedido, sem nenhum comparador.
2. **Trimestralização e YTD** — o anexo agrega 1Q/2Q/3Q/4Q e YTD; nosso Confronto só tem mensal.
3. **Caixa evolutivo** — anexo mostra "Disponível / Bloqueado / Inicial / Final / Caixa Livre" mês a mês; nosso Caixa só fotografa o presente.
4. **Áreas inexistentes** apesar dos dados estarem no banco:
   - **Comercial**: orçamentos, taxa de conversão, ticket médio, top vendedores, top clientes, mix por região;
   - **Compras / Suprimentos**: pedidos vs recebidos, lead time, OTIF, top fornecedores, savings de cotação;
   - **Estoque analítico**: giro, cobertura (dias), curva ABC, ruptura, ajustes/perdas;
   - **Logística**: entregas no prazo, frete % faturamento, devoluções, ocorrências;
   - **Fiscal**: NFs emitidas/canceladas, base ICMS/PIS/COFINS, limite Simples;
   - **DRE gerencial**: receita bruta → líquida → margem bruta → EBITDA → resultado;
   - **KPIs executivos** (capa): MRR/ARR equivalente, runway de caixa, DSO, DPO, ciclo de conversão.
5. **Gráficos nativos Excel** — hoje só temos tabelas. O anexo usa colunas/linhas combinadas (Receita vs Despesa, evolução de caixa, etc.). `exceljs` suporta `wb.addChart()` e referências de range.
6. **Capa executiva** — falta uma "Sheet 0" com sumário, período, empresa, logo, KPIs principais e índice clicável.
7. **Budget** — não existe tabela `budgets_mensais` no banco; precisa ser criada para alimentar a coluna Budget.
8. **Modo Fechado** — atualmente só financeiro tem snapshot em `fechamento_*_saldos`. Estender para comercial/estoque/compras quando a competência estiver fechada.

---

## 2. Arquitetura proposta

### 2.1 Nova estrutura de abas (V2 do template)

**Capa & navegação**
- `00_Capa` — logo da empresa, período, modo (Dinâmico/Fechado), 8 KPIs (Receita CY, Resultado CY, Margem %, Caixa Final, DSO, DPO, Cobertura Estoque, Limite Fiscal), sumário com hyperlinks para cada aba
- `01_DRE` — DRE gerencial com PY | CY | Budget | Δ% | YTD

**Visão financeira**
- `02_Confronto` — Receita / Despesa / Resultado mensal **com 3 blocos: 24 / 25 / 26** + colunas trimestrais (1Q–4Q) (igual à página 2 do anexo)
- `03_Caixa_Evolutivo` — Disponível / Bloqueado / Saldo Inicial / Final / Caixa Livre / Variação por mês (igual à página 3)
- `04_Caixa_Posicao` — saldo atual por conta + projeção 30/60/90 dias
- `05_Despesa_Categoria` — quebra por centro de custo / categoria contábil
- `06_FOPAG` — funcionário × mês + totais por departamento + encargos
- `07_Aging_CR` / `08_Aging_CP` — mantém atual + indicadores DSO/DPO

**Visão comercial**
- `09_Faturamento` — NF mensal × PY × Budget × Limite Simples
- `10_Vendas_Vendedor` — ranking + ticket médio + conversão
- `11_Vendas_Cliente` — top 20 + curva ABC
- `12_Vendas_Regiao` — mapa por UF/cidade
- `13_Orcamentos_Funil` — abertos / aprovados / perdidos + taxa de conversão

**Visão compras & estoque**
- `14_Compras_Fornecedor` — top fornecedores + lead time + OTIF
- `15_Cotacoes_Savings` — economia gerada por cotação
- `16_Estoque_Posicao` — material × produto × valor (atual)
- `17_Estoque_Giro` — giro + cobertura (dias) + ABC
- `18_Estoque_Critico` — itens em ruptura ou abaixo do mínimo

**Visão logística & fiscal**
- `19_Logistica` — entregas no prazo, frete % faturamento, devoluções
- `20_Fiscal` — NFs emitidas/canceladas, bases tributárias, limite Simples

**Sistema (ocultas por padrão)**
- `RAW_*` — todas as fontes brutas (mantém esquema atual + novas)
- `Parametros` — hash, geração, fórmulas, modo

### 2.2 Padrão visual de cada aba (inspirado no anexo)

Cada aba "visual" terá 4 zonas:

```
┌────────────────────────────────────────────────────┐
│ Título + período + modo                            │
├──────────┬──────────┬──────────┬──────────────────┤
│ KPI 1    │ KPI 2    │ KPI 3    │ KPI 4 (cards)    │
├──────────┴──────────┴──────────┴──────────────────┤
│ Tabela mensal (PY | CY | Budget | Δ% | Δ vs PY)   │
│ + linha de totais trimestrais e YTD               │
├────────────────────────────────────────────────────┤
│ Gráfico nativo Excel (coluna/linha combinada)     │
└────────────────────────────────────────────────────┘
```

### 2.3 Backend — novas views e tabelas

**Migrations a criar:**

1. `vw_workbook_dre_mensal` — agrupa receita líquida, deduções, CMV, despesas operacionais, EBITDA por competência
2. `vw_workbook_caixa_evolutivo` — saldo inicial/final/disponível/bloqueado por mês, derivado de `caixa_movimentos` + `contas_bancarias`
3. `vw_workbook_vendas_vendedor` — agrega `notas_fiscais`/`ordens_venda` por vendedor
4. `vw_workbook_vendas_cliente_abc` — curva ABC com classe A/B/C
5. `vw_workbook_orcamentos_funil` — abertos, aprovados, perdidos por mês
6. `vw_workbook_compras_fornecedor` — gasto + lead time médio (`pedidos_compra` vs `recebimentos_compra`)
7. `vw_workbook_estoque_giro` — giro = CMV/estoque médio, cobertura = estoque/consumo médio
8. `vw_workbook_estoque_critico` — itens com estoque ≤ mínimo
9. `vw_workbook_logistica` — % no prazo, devoluções (`remessas` + `remessa_eventos`)
10. `vw_workbook_fiscal_resumo` — NFs por status, bases ICMS/PIS/COFINS/ISS, somatório anual p/ Simples

**Nova tabela `budgets_mensais`** (com RLS):
```sql
create table public.budgets_mensais (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid,
  competencia date not null,        -- primeiro dia do mês
  categoria text not null,          -- 'receita' | 'despesa' | 'fopag' | etc.
  centro_custo_id uuid null,
  valor numeric(14,2) not null default 0,
  observacoes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(empresa_id, competencia, categoria, centro_custo_id)
);
```
+ RLS (apenas roles `admin`/`financeiro` podem inserir/editar; todos autenticados leem).

**Tela auxiliar:** `/financeiro/budget` (formulário simples por competência × categoria, reaproveita `useSupabaseCrud`). Sem essa tela, a coluna Budget vem zerada e o workbook degrada graciosamente.

### 2.4 Camada de geração (frontend)

Refatorar `src/lib/workbook/`:

- `fetchWorkbookData.ts` — ampliar `WorkbookRawData` com 10 novos blocos (vendas, compras, estoque analítico, logística, fiscal, dre, budget, caixa evolutivo, orçamentos funil, vendedor)
- `buildVisualSheets.ts` — quebrar em **um arquivo por área** dentro de `src/lib/workbook/sheets/`:
  - `sheets/capa.ts`, `sheets/dre.ts`, `sheets/confronto.ts`, `sheets/caixaEvolutivo.ts`, `sheets/comercial.ts`, `sheets/compras.ts`, `sheets/estoque.ts`, `sheets/logistica.ts`, `sheets/fiscal.ts`
  - cada um exporta `build<Area>(wb, data, ctx)` com `ctx = { months, monthsPY, budget, empresa, logo }`
- `lib/workbook/charts.ts` — helper `addColumnLineChart(ws, { range, position, title })` usando `exceljs` charts
- `lib/workbook/styles.ts` — paleta consistente (azul `#1F4E79` cabeçalho, verde positivo, vermelho negativo, formato `R$ #.##0,00` e `0,0%`)
- `lib/workbook/comparators.ts` — `computeVariation(cy, py)`, `computeBudgetVar(cy, budget)`, `aggregateQuarter(months)`, `aggregateYTD(months)`

### 2.5 Capa com logo

- Buscar logo de `app_configuracoes.geral.logo_url` (já existente) ou `empresa_config.logo_path`
- Fazer `fetch` da imagem → `arrayBuffer` → `wb.addImage({ buffer, extension: 'png' })`
- Inserir em `00_Capa` `range A1:C5`

### 2.6 UI de geração (`WorkbookGeracaoDialog`)

Adicionar:
- **Seleção de abas** (checkboxes agrupados por área) — hoje o tipo `WorkbookParametros` já tem `abasSelecionadas`, mas o dialog não expõe
- **Toggle "Incluir comparativo PY"** e **"Incluir Budget"** (desabilita se não houver dados)
- **Toggle "Incluir gráficos"** (gráficos pesam ~30% no tamanho do arquivo)
- Pré-visualização do número de abas que serão geradas
- Estimativa de tempo (baseado em `meses × abas`)

### 2.7 Histórico e versionamento

- Adicionar coluna `template_versao` em `workbook_geracoes` para distinguir V1/V2 e permitir reproduzir versões antigas
- Botão "Comparar com geração anterior" (download de ambas para diff manual)

---

## 3. Plano de execução por fases

**Fase 1 — Fundação (sem quebra)**
- Criar migrations das 10 views novas + tabela `budgets_mensais` com RLS
- Refatorar `buildVisualSheets.ts` em `sheets/*.ts` (mantendo abas atuais)
- Adicionar `charts.ts` e `comparators.ts`
- Acrescentar capa `00_Capa` com logo + KPIs

**Fase 2 — Comparativos PY/Budget**
- Estender `Confronto` para 3 blocos anuais + trimestres (espelha página 2 do anexo)
- Estender `Faturamento NFs` com PY + Limite Simples
- Adicionar `01_DRE` com PY|CY|Budget|Δ%

**Fase 3 — Comercial + Estoque analítico**
- Abas 09–13 (comercial) e 16–18 (estoque)
- Gráficos nativos em cada aba

**Fase 4 — Compras, Logística, Fiscal**
- Abas 14–15 + 19 + 20

**Fase 5 — UX**
- Dialog com seleção de abas + toggles
- Tela `/financeiro/budget` para alimentar a coluna Budget
- Comparação de gerações no histórico

---

## 4. Confirmações antes de seguir para a Fase 1

1. **Escopo da V2**: posso seguir com o catálogo completo das 21 abas (capa + 20) ou prefere começar por um subconjunto (ex.: só Capa + DRE + Confronto comparativo + 1 aba comercial) para validar visual antes de expandir?
2. **Budget**: aprova a criação da tabela `budgets_mensais` + tela `/financeiro/budget`? Sem isso a coluna Budget fica zerada (degradação graciosa).
3. **Gráficos nativos no Excel**: aprova ativar (arquivo ~30% maior) ou prefere manter só tabelas e deixar gráficos para a Apresentação Gerencial?
4. **Logo**: usar logo de `app_configuracoes.geral.logo_url` ou prefere campo dedicado em `empresa_config`?
