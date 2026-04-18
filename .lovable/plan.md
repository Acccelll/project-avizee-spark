

# Diagnóstico visual — telas de listagem/grid

Mapeei **~26 listagens** + 4 wrappers compartilhados (`ModulePage`, `AdvancedFilterBar`, `DataTable`, `StatusBadge`) + 2 cards KPI (`StatCard` antigo + `SummaryCard` novo). Infraestrutura visual existe; aplicação está fragmentada.

## Categorias

**A. Cadastrais** — Clientes, Fornecedores, Produtos, GruposEconomicos, Transportadoras, Funcionarios, UnidadesMedida, FormasPagamento
**B. Operacionais** — Pedidos, Orcamentos, PedidosCompra, CotacoesCompra, Fiscal, Remessas, Logistica
**C. Financeiras/contábeis** — Financeiro, ContasBancarias, ContasContabeis, FluxoCaixa, Conciliacao
**D. Operacional misto com tabs** — Estoque, Logistica, Auditoria, MigracaoDados

## Inconsistências visuais reais

### 1. **Dois componentes de KPI coexistem** — quebra mais visível do sistema
- Cadastrais (Clientes/Fornecedores/Produtos/Transportadoras/Funcionarios/UnidadesMedida/FormasPagamento/GruposEconomicos/ContasBancarias/ContasContabeis) usam `StatCard` (antigo, simples, sem `variant`/sparkline/meta)
- Operacionais (Pedidos/Orcamentos/Estoque/Social/Auditoria/Logs/Produtos novo) usam `SummaryCard` (rico, com `variant`, ícone colorido, sparkline)

Resultado: troca entre módulos parece troca de produto. Mesmas KPIs renderizam fontes/paddings/cores diferentes.

### 2. **Toolbar duplicada** — `ModulePage` tem search built-in **e** páginas usam `AdvancedFilterBar` separado
`ModulePage` aceita `searchValue`/`onSearchChange`/`filters`/`count` — mas Pedidos/Orcamentos/Fiscal/Financeiro **não passam** isso e renderizam `<AdvancedFilterBar>` como filho. Resultado: dois layouts de toolbar, espaçamentos diferentes, contagem aparece em lugares diferentes (uma vez no header da `ModulePage`, outra no rodapé do `AdvancedFilterBar`).

### 3. **Header da página sem contexto operacional**
`ModulePage` mostra só `title` + `subtitle` + botão "Novo X". Nas operacionais (Pedidos/Fiscal/Financeiro) **falta** indicador de contexto (período ativo, filtros aplicados, escopo). Subtítulos são genéricos ("Gerencie seus pedidos de venda") em vez de contextual ("142 pedidos · 12 atrasados").

### 4. **Filtros sem hierarquia visual**
`AdvancedFilterBar` empilha todos os `MultiSelect` lado a lado com `w-[180px]` hardcoded. Sem distinção entre filtro primário (status) e secundários (cliente/data). Em Pedidos: 4 multiselects + 2 date inputs em linha — virou parede de controles indistinguíveis.

### 5. **Datas em filtros inconsistentes**
- Pedidos/PedidosCompra usam `<Input type="date">` cru com `<span>até</span>` no meio
- Fiscal usa o mesmo padrão mas com larguras diferentes
- Financeiro usa preset chips ("Hoje", "7 dias", "Mês")

Sem `DateRangePicker` compartilhado. Cada tela parece feita por equipes diferentes.

### 6. **Coluna de ações inconsistente**
- DataTable só renderiza `Eye/Copy` (visualizar/duplicar) automaticamente
- Operacionais (Pedidos/Orcamentos/Fiscal) renderizam **botões inline na própria coluna `acoes`** com texto + ícone ("Gerar NF", "Aprovar", "Enviar") — visualmente pesado, polui a linha
- Cadastrais ficam só com 2 ícones — coluna Ações fica vazia/desproporcional

Sem padrão de "ação primária visível + secundárias em overflow menu".

### 7. **Densidade de linha desigual**
- DataTable usa padding default `p-4` em `<TableCell>`
- Cadastros com poucas colunas ficam **muito vazios** (linhas altas com pouco conteúdo)
- Operacionais com muitas colunas + badges + 2 linhas (PrazoBadge tem `flex-col`) ficam **densos demais**

### 8. **Status badges com hierarquia diferente em colunas**
- `StatusBadge` (operacionais) usa cor pastel de fundo + ícone — coerente
- Pedidos.faturamento usa **outro Badge** com `statusFaturamentoColors` próprio (não passa pelo `StatusBadge`) — escala de cores diferente
- ContasBancarias/Produtos usam Badge cru `<Badge variant="outline">Ativo</Badge>` para boolean — sem ícone, sem coerência com StatusBadge

### 9. **Booleano "Ativo/Inativo" tratado de 4 formas**
- StatusBadge `status="ativo"` (Pedidos)
- `<Badge variant={ativo ? "default" : "secondary"}>` (Clientes/Produtos)
- `<Switch>` na linha (raro)
- Coluna oculta (alguns)

### 10. **Empty state já padronizado mas mensagens fracas**
DataTable usa `EmptyState` shared, mas `emptyTitle`/`emptyDescription` quase nunca são customizados. Resultado: "Nenhum registro encontrado / Tente ajustar os filtros" em todas as telas — sem orientação contextual ("Cadastre seu primeiro pedido", "Importe via XML").

### 11. **KPI cards: número de cards e variação inconsistente**
- Pedidos: 4 cards (Total/Valor/Em andamento/Atrasados)
- Orcamentos: 4 cards
- Fiscal: 4 cards
- Estoque: 4 cards bons
- Cadastros: 1 card só ("Total de Clientes") — desperdício de espaço, KPI sem informação útil

Cadastros não exploram KPIs derivados (ex.: "Ativos / Inativos / Sem CPF / Com pendência").

### 12. **Action button no header desproporcional**
`ModulePage` força botão "Novo X" `h-11 sm:h-9` sempre. Em telas com ações múltiplas (importar/exportar/novo) cada página resolve do seu jeito via `headerActions`. Sem padrão para "ação primária + dropdown de ações secundárias".

### 13. **Largura de filtros hardcoded**
`className="w-[180px]"` se repete ~50× no projeto. Mesma `MultiSelect` com larguras diferentes em telas diferentes (180/200/220 px sem critério).

### 14. **Tabs internos quebram fluxo da página**
Estoque/Logistica/Auditoria têm tabs **dentro** da `ModulePage`. As tabs ficam soltas após KPIs e antes do toolbar — usuário não percebe que cada tab tem seus próprios filtros (alguns reusam, outros não).

### 15. **Sticky behavior ausente**
Em listagens longas, `<thead>` não é sticky. Toolbar também rola. Em listas de 100+ linhas perde-se o cabeçalho.

### 16. **Coluna `acoes` sempre na última posição mas nem sempre necessária**
DataTable injeta coluna de ações sozinho. Algumas páginas adicionam **outra** coluna `acoes` manualmente (Pedidos line 358) — duas colunas de ação na mesma tabela.

### 17. **PrazoBadge / SituacaoBadge / FaturamentoBadge — 3 badges customizados que poderiam usar `StatusBadge` com tone**
Cada um reimplementa cor/ícone/layout `flex-col`. Sem usar o sistema central.

### 18. **Contagem de registros aparece 2× em algumas telas**
`ModulePage` mostra "X registros" no header da toolbar quando `count` é passado, **e** `AdvancedFilterBar` mostra "X registros" no canto direito. Em Pedidos, ambos são populados — duplicação.

## Estratégia de correção

Foco: **harmonizar reusando o que existe** + criar 3 helpers pequenos. Sem reescrever páginas.

### Fase 1 — Infraestrutura visual nova/consolidada

**1.1 Migrar `StatCard` → `SummaryCard`**
Tornar `StatCard` um wrapper deprecation-shim que repassa para `SummaryCard` com defaults (`density="default"`). Migrar imports nos 9 cadastros.
Resultado: KPI visual unificado em todo sistema.

**1.2 `ListPageHeader` (novo, opcional)**
Substitui o header da `ModulePage` em telas operacionais quando faz sentido:
```tsx
<ListPageHeader
  title="Pedidos de Venda"
  contextLine={`${count} pedidos · ${atrasados} atrasados · ${formatCurrency(totalValue)}`}
  primaryAction={{ label: "Novo Pedido", icon: Plus, onClick }}
  secondaryActions={[{ label: "Importar XML", onClick }, { label: "Exportar", onClick }]}
/>
```
- Linha de contexto vira **resumo escaneável** acima do título
- `secondaryActions` vão para dropdown overflow consistente
- Mantém `ModulePage` simples para cadastros que não precisam disso

**1.3 `FilterToolbar` (refactor de `AdvancedFilterBar`)**
- Adiciona zona de **filtros primários** (sempre visíveis, ex.: status) vs **secundários** (collapse atrás de "Mais filtros")
- Aceita `dateRange={{ from, to, onChange }}` com componente unificado (em vez de 2 `<Input type="date">` soltos)
- Larguras via tokens `FILTER_W_SM` (140) `FILTER_W_MD` (180) `FILTER_W_LG` (220)
- Remove duplicação de "X registros" (só mostra se `ModulePage` não mostrou)

**1.4 `RowActions` (componente)**
Substitui as colunas `acoes` manuais nas operacionais:
```tsx
<RowActions
  primary={{ label: "Gerar NF", icon: FileOutput, onClick, disabled }}
  secondary={[
    { label: "Editar", icon: Edit, onClick },
    { label: "Duplicar", icon: Copy, onClick },
  ]}
  destructive={{ label: "Excluir", onClick }}
/>
```
- Primária visível como ícone+label compacto
- Secundárias em `DropdownMenu` (overflow `MoreVertical`)
- Destrutiva sempre por último, vermelha
- Reaproveitável em Pedidos/PedidosCompra/Orcamentos/Fiscal/Financeiro/Recebimentos

**1.5 Padronização do `StatusBadge`**
- Mover `statusFaturamentoColors` (Pedidos) para `statusConfig` central do `StatusBadge`
- Adicionar tones para todos os status faturamento/devolução
- Substituir 4 padrões de "Ativo/Inativo" por `<StatusBadge status={ativo ? 'ativo' : 'inativo'} />`

**1.6 Sticky `<thead>` no `DataTable`**
- `position: sticky; top: 0` no `<thead>` quando `maxHeight` definido OU `data.length > 25`
- Não muda layout para listas curtas

### Fase 2 — Aplicação cirúrgica por listagem

| Listagem | Ajuste visual |
|---|---|
| **Cadastros** (Clientes/Fornecedores/Produtos/Transportadoras/Funcionarios/GruposEconomicos/UnidadesMedida/FormasPagamento) | Migrar `StatCard` → `SummaryCard`; expandir KPIs (Total/Ativos/Inativos/Específico do módulo); padronizar Ativo/Inativo via `StatusBadge` |
| **Pedidos** | Adotar `ListPageHeader` com contextLine; `RowActions` substitui coluna acoes manual; mover `PrazoBadge` para usar `StatusBadge` com tones; date range unificado |
| **Orcamentos** | Mesmo de Pedidos; remover duplicação de count; agrupar status+faturamento via `StatusBadge` |
| **PedidosCompra** | `RowActions` para Enviar/Receber/Editar; date range unificado; KPIs sobre `filteredData` (já feito tecnicamente, só revisar visual) |
| **CotacoesCompra** | `RowActions`; KPIs com `variant` semântico |
| **Fiscal** | `ListPageHeader` com contextLine ("X notas · Y pendentes · Z confirmadas"); `RowActions` para Confirmar/Estornar; status uniformizado |
| **Financeiro** | Date range unificado (manter chips de preset que funcionam bem); `RowActions` para Baixar/Estornar; KPIs com `variant` por tipo (success=receber, danger=pagar/vencido) |
| **ContasBancarias/ContasContabeis** | Migrar `StatCard` → `SummaryCard`; sticky thead em ContasContabeis (lista longa) |
| **FluxoCaixa/Conciliacao** | Sticky thead; padronizar status badges |
| **Estoque** | Tabs já estão ok; só padronizar empty states de cada tab; `RowActions` no histórico |
| **Logistica** | Mesmo Estoque; harmonizar com Remessas |
| **Auditoria/Logs** | Sticky thead obrigatório (lista grande); empty state contextual |
| **MigracaoDados** | Empty state com CTA para próxima fase |
| **DataTable** (componente) | Sticky thead; remover popover "Filtros avançados" interno (já desabilitado por flag, agora remover dead code) |

### Fase 3 — Polimento final
- Padronizar `gap-3` no grid de KPIs e `gap-2` em filtros
- Densidade de linha do DataTable: passar para `py-3 px-4` (vs `p-4`) — economia vertical sem aperto
- Subtítulos contextuais em todas as ListPageHeader operacionais
- Empty states com `actionLabel` quando faz sentido (ex.: "Adicionar primeiro cliente")

### Fora do escopo
- Não tocar lógica de negócio
- Não mexer em formulários (modais/drawers de edição)
- Não redesenhar tema/cores base
- Não migrar React Query nem hooks técnicos
- Relatorios/ApresentacaoGerencial/Social mantidos como estão

## Critério de aceite
- KPIs unificados via `SummaryCard` (sem `StatCard` legado em uso direto)
- Toolbar sem duplicação de count/search
- Filtros com hierarquia primária/secundária + date range unificado
- Coluna de ações em operacionais via `RowActions` (primária + overflow)
- Status booleano "Ativo/Inativo" sempre via `StatusBadge`
- Sticky `<thead>` em listas longas
- Empty states contextuais por módulo
- Build OK (`tsc --noEmit`); sem regressão funcional

## Entregáveis
Tabela final por listagem: `problema visual → ajuste aplicado`.

