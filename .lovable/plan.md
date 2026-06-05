# Plano — Limpeza de filtros e ajustes em Cartões

## 1) Chip global "Hoje" (período do header) — restringir a rotas que consomem

**Problema:** O `GlobalPeriodChip` (ver `src/components/navigation/GlobalPeriodChip.tsx`) aparece em todas as rotas exceto `/`, mas só é lido por: Dashboard (`/`), `FluxoCaixa`, `FiscalDashboard` e alguns componentes de dashboard. Em telas como `Fiscal/Notas`, `Orçamentos`, `Financeiro`, `Cartões`, etc., ele não faz nada — confunde o usuário.

**Solução:** Trocar a regra de visibilidade por uma allow-list explícita por rota.

- Criar `GLOBAL_PERIOD_ROUTES = ['/fluxo-caixa', '/fiscal/dashboard']` (Dashboard `/` continua com seu seletor próprio).
- `GlobalPeriodChip` renderiza apenas quando `location.pathname` casa com a allow-list.
- Manter o `DashboardPeriodProvider` no app (não quebra consumidores).

## 2) Barra de filtros — reduzir poluição visual

**Problema:** Páginas como Orçamentos (imagens 2 e 3) mostram 6–8 controles soltos (Status, Clientes, Período com presets em linha, Validade, Legados, etc.). Em Fiscal Notas (imagem 2), idem com Modelos/Origem/Status ERP/Status SEFAZ/Emissão/Vencimento.

**Solução — padronizar via `AdvancedFilterBar` em duas zonas:**

1. **Zona primária (sempre visível):** busca + 1 seletor de período compacto (chip "Período: 30d" abrindo Popover) + botão "Filtros (n)".
2. **Zona secundária (Popover/Sheet "Filtros"):** todos os selects de domínio (Status, Modelo, Origem, Cliente, Validade, Legados, etc.). Mostra contagem ativa no botão.

Aplicar em: `Orcamentos.tsx`, `Pedidos.tsx`, `Fiscal.tsx`, `Financeiro.tsx`, `Estoque.tsx`, `Logistica.tsx`, `Clientes.tsx`, `Fornecedores.tsx`, `Produtos.tsx`. Aproveitar slots já existentes do `AdvancedFilterBar` (props `extraFilters` / `advancedFilters`) — sem nova lib.

**Períodos:** padronizar usando `PeriodFilter` canônico (memo `contrato-de-periodos`) dentro do Popover, com presets verticais ao invés de em fileira horizontal.

## 3) Relatórios saindo do tamanho da tela (imagem 4)

**Problema:** Em `Posição de Estoque em Data` e outros relatórios largos, a tabela quebra o container do `ModulePage`.

**Solução em `src/pages/relatorios/`:**

- Embrulhar a tabela do relatório num `<div className="w-full overflow-x-auto">` com `min-w-0` no pai flex.
- Garantir `table-auto` + `whitespace-nowrap` apenas em colunas numéricas; resto com `break-words`.
- Conferir que `RelatorioFiltrosBar` e o card de resultado usam `min-w-0` para permitir shrink dentro do grid.
- No modo "Lado a lado" (gráfico + tabela), usar `grid-cols-[minmax(0,1fr)_minmax(0,1fr)]` em vez de `1fr 1fr`.

## 4) Cartões de Crédito (`src/pages/CartoesCredito.tsx`)

- **Remover "Gerar fatura"** (botão e fluxo): a função `gerarFaturaCartao` consolida lançamentos que já existem no Financeiro → duplicaria. Remover:
  - Botão `Gerar fatura` em `rowExtraActions` e `mobileInlineActions`.
  - Dialog `faturaOpen` e estados `faturaCartao/faturaCompetencia/faturaSaving/handleGerarFatura`.
  - Import `gerarFaturaCartao` do service (manter a função no service para retro-compat, mas sem consumo no UI — opcional remover depois).
- **"Visualizar" deve abrir as faturas, não a edição:**
  - O `DataTable` chama `onEdit` no clique da linha / botão "Visualizar". Trocar a ação primária da linha para `openFaturasList(c)` e mover edição para um item secundário ("Editar cartão") no menu de ações.
  - Em mobile, `mobilePrimaryAction` já chama `openFaturasList` — manter.
- Conferir que o Sheet de faturas (`faturasListOpen`) lista as faturas existentes (já implementado) com ação de **Baixar fatura** preservada.

## Arquivos impactados

- `src/components/navigation/GlobalPeriodChip.tsx` — allow-list de rotas.
- `src/pages/Orcamentos.tsx`, `Pedidos.tsx`, `Fiscal.tsx`, `Financeiro.tsx`, `Estoque.tsx`, `Logistica.tsx`, `Clientes.tsx`, `Fornecedores.tsx`, `Produtos.tsx` — consolidar filtros em `AdvancedFilterBar` + Popover "Filtros".
- `src/components/AdvancedFilterBar.tsx` — (se necessário) ajustar slot para Popover de filtros agrupados.
- `src/pages/relatorios/Relatorios.tsx` e componentes de tabela do relatório — overflow/min-w-0.
- `src/pages/CartoesCredito.tsx` — remover Gerar Fatura, trocar ação primária para Faturas.

## Fora do escopo

- Mudança de design system, novas libs de filtros, refactor de roteamento ou de backend (RPCs `gerar_fatura_cartao` permanecem no DB).
