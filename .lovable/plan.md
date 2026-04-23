

# Revisão Transversal Final — ERP AviZee como Produto Único

Síntese consolidada das 8 revisões anteriores (Auth/Login, Navegação Global, Design System, e os módulos individuais) cruzada com o estado real atual: 49 páginas em `src/pages`, 4 fontes vivas de status (`statusSchema.ts`, `STATUS_VARIANT_MAP`, `comprasStatus.ts`, `StatusBadge.statusMeta`), 14 views relacionais, 4 roles RBAC, ~70 arquivos consumindo `StatusBadge`.

> **Fato central**: cada módulo, isoladamente, está sólido. O atrito está nas **junturas**: status divergem entre módulos para o mesmo conceito (ex.: "cancelar" vs "cancelado" vs "rejeitado"), filtros de período usam 4 implementações paralelas, e a fronteira entre **excluir/inativar/cancelar/estornar** muda de regra a cada tela — usuário não consegue prever o efeito da ação antes de clicar.

---

## 1. Visão geral do projeto

**Stack consolidada** (não migra): React 18 + Vite 5 + Tailwind v3 + shadcn/ui + TanStack Query + Supabase via Lovable Cloud. Roteamento client-side; shell autenticado único (`AppLayout`); guards `Permission/Admin/Social/ProtectedRoute`.

**Módulos vivos** (15 áreas funcionais):
- **Operacional**: Dashboard, Comercial (Orçamentos/Pedidos), Compras (Cotações/Pedidos de Compra), Logística (3 abas unificadas), Estoque, Fiscal (NFe/NFCe + SEFAZ proxy), Financeiro (a receber/pagar/baixas/conciliação).
- **Cadastros**: Clientes (com Grupos Econômicos), Fornecedores, Transportadoras, Produtos/Insumos, Funcionários, Sócios, Formas de Pagamento, Unidades de Medida, Contas Bancárias/Contábeis.
- **Analítico**: Relatórios (CSV/XLSX/PDF), Workbook Gerencial, Apresentação Gerencial, Auditoria (`v_admin_audit_unified`).
- **Plataforma**: Administração, Configurações (4 abas), Migração de Dados (6 fases), Auth, Social (feature-flag).

**Padrões consolidados** (já canônicos):
- `ModulePage` + `DataTable` (com `useDataTablePrefs` + `useDataTableExport` recém-extraídos) + `AdvancedFilterBar` + `SummaryCard` + `StatusBadge` + `ViewDrawerV2`.
- `useSupabaseCrud<T>` para CRUD genérico; RPCs para operações multi-tabela.
- `RelationalDrawerStack` empilha drawers cross-módulo via `useRelationalNavigation.pushView`.
- RLS estrito + `chk_*` constraints + `search_path = public` em RPCs.

**Padrões NÃO consolidados** (origem dos atritos transversais):
- Fontes de status, filtros de período, semântica de exclusão, forma de criar entidade rápida, padrão de aprovação/cancelamento.

---

## 2. Principais inconsistências transversais

### 2.1 Semântica de status fragmentada em 4 fontes

| Fonte | Conteúdo | Uso real |
|---|---|---|
| `lib/statusSchema.ts` | 8 maps domínio-específicos com `{label, color}` (color = string genérica como "info", "secondary") | Importada em ~12 lugares para popular MultiSelects de filtro |
| `types/ui.ts:STATUS_VARIANT_MAP` | 60+ chaves → `StatusVariant` (success/warning/etc) | **Single source de cor** consumida pelo `StatusBadge` (recém-unificado) |
| `components/StatusBadge.tsx:statusMeta` | 50+ chaves → `{icon, label}` | Render do badge |
| `components/compras/comprasStatus.ts` | Aliases (`finalizada→aprovada`, `recebido_parcial→parcialmente_recebido`) + helpers `cotacaoCanEdit`/`pedidoCanReceive` | Apenas Compras |

**Inconsistências reais entre módulos para o mesmo conceito**:
- "Aprovado": Orçamento usa `aprovado` (success), Pedido usa `aprovada` (success), Cotação de Compra usa `aprovada` (success), Pedido de Compra usa `aprovado` (info — não success!). **Quatro grafias, dois tons** para o mesmo conceito.
- "Cancelado": Orçamento `cancelado` (destructive), Pedido `cancelada` (destructive), NF `cancelada` (destructive), Financeiro `cancelado` (**secondary, não destructive**). Financeiro foge do padrão.
- "Faturado": Pedido `faturada` (success), STATUS_VARIANT_MAP `faturado` (primary). **Tom diferente** entre o schema legacy e o canônico.
- "Pendente": Orçamento `pendente` (info), Pedido `pendente` (warning), NF `pendente` (warning), Financeiro `aberto` (warning — usa nome diferente). Mesmo conceito, 2 tons + 2 nomes.
- "Em separação" (Pedido) vs "em_analise" (Cotação Compra) vs "em_transito" (Logística) — três status sequenciais "em movimento", sem padrão de prefixo.
- `statusOrcamento.pendente.color = "info"` mas `STATUS_VARIANT_MAP.pendente = "warning"`. **Direta contradição** entre as duas fontes — sorte do `StatusBadge` consumir só STATUS_VARIANT_MAP.

### 2.2 Excluir vs Inativar vs Cancelar vs Estornar — sem doutrina

Cinco verbos com regras distintas por módulo, sem mapa global:

| Ação | Onde aparece | Comportamento real | Cobertura RPC |
|---|---|---|---|
| **Excluir** (`remove`) | Cadastros simples (Funcionários, Formas Pgto, Unidades, Sócios, Contas Bancárias/Contábeis) | DELETE físico (com FK constraint, falha se em uso) | `useSupabaseCrud.remove` direto |
| **Inativar** (toggle `ativo`) | Produtos, Clientes, Fornecedores, Transportadoras, Unidades, Funcionários | Soft delete via flag `ativo=false` | UPDATE direto |
| **Cancelar** | Orçamento, Pedido, NF, Pedido de Compra, Cotação de Compra, Financeiro, Remessa | RPC dedicada por módulo (`cancelar_*`) com motivo | RPC mantém histórico |
| **Estornar** | Apenas Financeiro (`processarEstorno`) | Cancela baixa, devolve título a `aberto`/`parcial` | RPC oficial |
| **Rejeitar** | Apenas Orçamento e Cotação Compra | Status terminal alternativo a Aprovado | UPDATE direto |

**Problemas concretos**:
- `FormasPagamento` mostra **botão "Excluir" + texto "Considere inativar para preservar histórico"**. Se inativar é a recomendação, por que o botão padrão é Excluir?
- `Funcionarios` tem **ambos**: campo `ativo` (toggle) e botão `Excluir` (remove). Sem guidance de quando usar cada.
- `Produtos` só inativa (sem excluir). `Clientes` mesmo. **Decisão correta**, mas inconsistente com cadastros menores.
- `Unidades` faz a coisa certa: confirma "inativar mesmo assim?" se em uso, evitando excluir. Mas a confirm só mostra count via consulta extra; outros cadastros nem checam.
- Pedido cancelado **estorna estoque**? Sim, via trigger. Mas o usuário só descobre lendo o `labelMap` do `useTransicionarRemessa` (`"Cancelada (estoque revertido quando aplicável)"`). Não há aviso pré-confirmação no Pedido.
- Financeiro `cancelado` é **muted/secondary**, não destructive — porque "cancelar lançamento não pago" foi tratado como neutro. Para usuário, "cancelado" é destrutivo em todo lugar; aqui é cinza.

### 2.3 Filtros de período: 4 implementações paralelas

| Componente | Onde | Períodos |
|---|---|---|
| `filters/PeriodFilter.tsx` | Não tem importadores na grep — código vivo, uso 0 | 6 presets |
| `Estoque.tsx` (linhas 522-533) | Movimentação de estoque | 2 inputs `date` manuais + botão "Limpar Datas" |
| `Pedidos.tsx` (linhas 411-420) | Pedidos | 2 inputs `date` manuais via URL params (`de`/`ate`) |
| `Financeiro.tsx` + `Conciliacao.tsx` | Financeiro | `financialPeriods` próprio em `filters/periodTypes.ts` com ranges customizados |
| `Dashboard` | KPIs e charts | Próprio `DashboardPeriodContext` |
| `Auditoria.tsx` | Logs unificados | URL `de`/`ate` próprios |

**Cinco implementações** para o mesmo conceito de "filtrar por período". Nenhuma consome `PeriodFilter`. O componente "oficial" está morto; cada tela inventou a sua. Resultado: comportamento de "ontem" é diferente entre Estoque e Pedidos.

### 2.4 Drawer vs Detail vs Edit — três paradigmas para a mesma coisa

| Padrão | Onde | Característica |
|---|---|---|
| **ViewDrawerV2** (canônico) | 14 views relacionais + Logística + Auditoria + KPI | Side panel com tabs internas, `pushView` empilha drawers |
| **Detail page** (`/fiscal/:id`) | Apenas Fiscal (`FiscalDetail.tsx`) | Página inteira separada — não usa drawer |
| **Edit page** (`/orcamentos/:id`, `/pedidos/:id`, `/fiscal/:id/editar`, `/cotacoes-compra/:id`, `/pedidos-compra/:id`, `/remessas/:id`) | 6 entidades operacionais | Página inteira de edição (não modal) — para forms longos com itens |

**Conflitos reais**:
- Clicar num Orçamento na grid abre **OrcamentoView (drawer)**. Clicar em "Editar" sai para `/orcamentos/:id` (página inteira). Quem está no drawer e quer editar precisa navegar e perde stack relacional.
- Fiscal tem 3 paradigmas: grid → `FiscalDetail` (página) → `/fiscal/:id/editar` (página). Os outros módulos com forms longos (Orçamento, Pedido) só têm 2 (drawer + edit). **Fiscal é o outlier** — sem motivo claro.
- `RemessaView` é drawer; `RemessaForm` é página. Coerente com Pedido. Mas `EntregaDrawer` é drawer e **não tem página de edição** — a edição acontece **dentro do drawer** (V2 variant `operational`). Padrão diferente do Orçamento sem documentação.

### 2.5 Coerência de nomenclatura de entidades

- **Orçamento** (UI/rotas) ↔ `orcamentos` (DB) — OK.
- **Pedido** (UI) ↔ `ordens_venda` (DB). Aliases legados: `/ordens-venda` redireciona para `/pedidos`. `statusOrdemVenda` deprecated. **Funciona, mas a tabela ainda é `ordens_venda`**, então toda query SQL usa o nome antigo enquanto a UI fala "Pedido".
- **Compra** (UI) ↔ `pedidos_compra` (DB). E `cotacoes_compra` separado.
- **Remessa** (UI/legacy) e **Logística** (UI atual) ↔ `remessas` (DB). Confusão: o módulo se chama Logística mas a tabela é Remessas, e ainda existe rota `/remessas/:id` (form de edição) sob o módulo Logística.
- **Funcionário** (UI/DB) ↔ não tem ligação com `usuarios` (auth). Funcionário é cadastro RH; Usuário é login. Mas a permissão de `/funcionarios` agora é `usuarios:visualizar` (recente correção) — acoplamento de permissão entre dois cadastros conceitualmente distintos.

### 2.6 Criação rápida vs criação completa: dois fluxos paralelos

- **Cliente**: `QuickAddClientModal` (recém-reescrito sobre FormModal) acessível de Orçamento/Pedido + grid completa em `/clientes`.
- **Produto**: criação só em `/produtos` (form modal completo) — sem quick-add. Em Orçamento, se faltar produto, sai e volta.
- **Fornecedor**: idem produto — só em `/fornecedores`.
- **Forma de Pagamento**: criação só em `/formas-pagamento`. Em Orçamento/Pedido, dropdown lê e fica.
- **Transportadora**: idem.

**Inconsistência**: Cliente tem quick-add porque Orçamento/Pedido precisa muito; outros cadastros não. Mas em Pedido de Compra, faltando Fornecedor, mesma fricção — sem quick-add.

### 2.7 Permissões: ações declaradas vs ações usadas

`ERP_ACTIONS` declara 19 ações. Auditoria das matrizes:
- `orcamentos:visualizar_rentabilidade` existe e é checada (vendedor não tem). OK.
- `apresentacao:editar_comentarios`, `apresentacao:aprovar` declaradas — usadas em `ApresentacaoGerencial`.
- `social:gerenciar_alertas`, `social:configurar`, `social:sincronizar` declaradas — usadas.
- `pedidos:confirmar` declarada — **uso real**: nenhuma checagem `can('pedidos','confirmar')` na grep. Ação morta.
- `compras:confirmar` declarada — mesmo destino, sem `can(...)` check encontrado.
- `estoque:aprovar` declarada — sem uso encontrado.
- `relatorios:exportar` é checada apenas em DataTable indireto via `useDataTableExport` (que **não verifica permissão** atualmente — exporta sem check).

**Risco**: `useDataTableExport` é hook compartilhado; se `relatorios:exportar` deveria ser global, ele deveria gate-keep. Hoje não.

### 2.8 Componentes legacy paralelos remanescentes

Pós-cleanup do design system, **ainda restam**:
- `pages/admin/Logs.tsx` ainda importava `ViewDrawer` (legado) — verificar se foi migrado em paralelo às outras 5 telas (foi marcado como done, mas grep ainda mostra `Auditoria.tsx` agora usa V2; bom).
- `lib/statusSchema.ts` continua sendo a fonte para MultiSelects de filtro (porque expõe `statusToOptions`). `STATUS_VARIANT_MAP` não tem `toOptions`. **Duas fontes coexistem por motivo válido**, mas sem doutrina escrita.
- `comprasStatus.ts` mistura aliases + helpers de transição + label maps. Para o resto do ERP, não há `pedidosStatus.ts`/`fiscalStatus.ts`/`financeiroStatus.ts` equivalentes — Compras tem privilégio. Outros módulos espalham helpers inline.
- `as any` em 10 arquivos críticos: `ApresentacaoGerencial`, `OrcamentoPublico`, `MigracaoDados`, `FluxoCaixaChart`, `Orcamentos.tsx`, `RelatorioMigracaoFaturamento`, `ImportacaoStatusBadge`, `ClienteView`, `ReconciliacaoDetalhe`. **Dívida tipada visível**.

### 2.9 Integrações ponta a ponta com pontos cegos

- **Orçamento → Pedido → NF → Financeiro → Conciliação**: fluxo principal funciona, mas **rastreabilidade reversa é opaca**. Dado um lançamento financeiro, achar o pedido origem requer 2 cliques (drawer → relational link). Auditoria unificada (`v_admin_audit_unified`) ajuda mas é só log, não navegação.
- **Pedido de Compra → Recebimento → Estoque → NF de Entrada (Fiscal entrada)**: fluxo separado. NF de entrada importada por XML não vincula automaticamente ao Pedido de Compra correspondente — `PedidoCompraLinker` no NotaFiscalForm é manual.
- **Cotação Compra → Pedido de Compra → Cotação de outro fornecedor**: comparação de propostas na cotação ok; mas o pedido gerado **não mantém referência clicável** à cotação origem em todos os pontos (a `viewCotacao` no PedidoCompraDrawer só carrega numero/status).
- **Logística → Remessa → Pedido**: status_transporte da remessa não dispara update no status do Pedido (Pedido fica em `entregue` apenas via processo separado).

### 2.10 Governança de permissões

- `useFavoritos` agora sincroniza via `useUserPreference` (recente). Bom.
- `DataTable` usa `useDataTablePrefs` (recente). Bom.
- Mas `useDashboardLayout` (widgets do Dashboard) usa **localStorage por user_id** (linha 25 de Index.tsx) — não sincroniza. Mais um ponto de inconsistência entre devices.
- Roles têm 4 valores fixos (`admin/vendedor/financeiro/estoquista`) — sem perfil "gestor de compras", "operador logístico", "controle interno". ERPs reais precisam de mais granularidade ou de overrides bem usados.
- Overrides via `user_permissions` existem (allow/deny), mas só admin gerencia. Não há "delegação temporária" (ex: vendedor de férias delega aprovação a colega).

### 2.11 Pontos que bloqueiam escalabilidade

- **`useSupabaseCrud` carrega lista inteira em memória** — para `clientes`, `produtos`, `fornecedores` com 10k+ registros, vai estourar. `DataTable` virtualiza render mas o array em memória continua todo. Sem paginação server-side nem cursor.
- **GlobalSearch** consome RPC `global_search` (recém-criada) com limite 5 por categoria — escala para milhares.
- **Exportação PDF/XLSX no client** (`useDataTableExport`) — para >50k linhas, navegador trava. Sem fallback para job server-side.
- **Snapshots de cliente em Orçamento (`cliente_snapshot` JSON)** — boa decisão para histórico, mas sem indexação no JSON, busca por cliente em orçamentos antigos é lenta.
- **`v_admin_audit_unified`** unifica 2 tabelas de log, mas se o volume crescer (cada operação registra), virtualização não basta — precisa de archival/partition.

---

## 3. Problemas críticos do sistema como produto

| # | Problema | Impacto produto | Origem |
|---|---|---|---|
| 1 | Mesmo conceito ("aprovado/cancelado/pendente") tem cor e grafia diferentes entre módulos | Usuário não confia na cor — precisa ler o texto sempre | 4 fontes de status sem doutrina |
| 2 | "Excluir" vs "Inativar" vs "Cancelar" sem regra escrita | Risco de exclusão acidental + UI confusa em FormasPagamento | Sem `mem://` doutrinário |
| 3 | 5 implementações paralelas de filtro de período | "Últimos 30 dias" significa coisas diferentes em telas diferentes | `PeriodFilter` órfão; cada tela fez o seu |
| 4 | Fluxo Orçamento usa drawer p/ ver e página p/ editar; Fiscal usa só páginas; outros mistos | Curva de aprendizado por módulo | Sem padrão "quando drawer / quando página" |
| 5 | Quick-add só existe para Cliente | Em Orçamento/Pedido, criar Produto/Fornecedor força sair e voltar | Decisão pontual sem expansão |
| 6 | `pedidos:confirmar`, `compras:confirmar`, `estoque:aprovar` declaradas mas nunca checadas | False sense of governance | Permissões dead code |
| 7 | `useDataTableExport` exporta sem checar `:exportar` | Vendedor exporta dados restritos | Hook agnóstico de permissão |
| 8 | `useDashboardLayout` ainda em localStorage | Layout do dashboard sumiu ao trocar de device | Não migrado p/ `useUserPreference` |
| 9 | Status `pendente` no schema legado é `info`, no STATUS_VARIANT_MAP é `warning` | Contradição direta entre fontes — bug latente | Não unificado |
| 10 | NFe entrada por XML não auto-vincula ao Pedido de Compra | Re-trabalho manual em todo recebimento | Linker manual |
| 11 | Status do Pedido não muda quando Remessa é entregue | Dashboard mostra Pedido como pendente embora entregue | Sem trigger cross-modular |
| 12 | `useSupabaseCrud` carrega lista inteira | Quebra com 10k+ registros | Sem cursor/server pagination |
| 13 | Exportação PDF/XLSX 100% client-side | Navegador trava em volumes grandes | Sem job background |
| 14 | 10 arquivos com `as any` em paths críticos (Orçamento Público, Migração, Apresentação) | Type safety furada onde mais importa | Dívida não atacada |
| 15 | 4 roles fixos sem "gestor de compras"/"operador logístico" | Cliente real precisa de mais perfis ou usa overrides ad-hoc | Granularidade RBAC |

---

## 4. Melhorias prioritárias

### 4.1 Doutrina (sem código, só decisão escrita)

**Criar 4 documentos `mem://` que definem contratos transversais**:
1. `mem://produto/contrato-de-status.md` — para cada conceito de domínio (aprovado, pendente, cancelado, faturado, em movimento), uma única grafia + variant. Tabela cruzando módulo×status. Regra: "novo status → adicionar primeiro aqui, depois em código".
2. `mem://produto/excluir-vs-inativar-vs-cancelar.md` — árvore de decisão: entidade tem histórico operacional? → cancelar+motivo. Cadastro mestre referenciável? → inativar. Tabela puramente de configuração? → excluir físico permitido.
3. `mem://produto/quando-drawer-quando-pagina.md` — regra: form com itens dinâmicos (linhas) → página. Visualização + edição inline simples → drawer V2 variant `edit`. Fluxos cross-relacionais → pushView no drawer.
4. `mem://produto/contrato-de-periodos.md` — todo filtro de período usa `PeriodFilter` único; lista canônica de presets e regra para custom range.

### 4.2 Unificações (código)

- **`statusOrcamento.pendente` mudar `color` para "warning"** alinhando com `STATUS_VARIANT_MAP`. Auditar todas as 8 tabelas em `statusSchema.ts` contra o map canônico.
- **`PeriodFilter` virar componente real consumido** em Estoque, Pedidos, Financeiro, Conciliação, Auditoria. Aceitar `mode="preset"|"range"|"both"`. Ranges customizados via popover.
- **`useDataTableExport` receber `permission?: PermissionKey`** e gate por `useCan` antes de iniciar export. `relatorios:exportar` como default.
- **`useDashboardLayout` migrar para `useUserPreference<DashboardPrefs>('dashboard_layout')`** com fallback localStorage e migração one-shot (mesmo padrão do `useFavoritos` recente).
- **Quick-add expansão**: criar `QuickAddProductModal` (mínimo: nome, SKU, unidade, preço) + `QuickAddSupplierModal` (CNPJ via API + nome) e plugar em Orçamento/Pedido/Pedido de Compra.
- **Status canônico Pedido de Compra `aprovado`**: trocar de `info` para `success` em `statusPedidoCompra` para alinhar com Orçamento/Pedido/Cotação.

### 4.3 Integrações ponta a ponta

- **Trigger DB ou edge function** que ao marcar Remessa como `entregue` atualiza Pedido associado para `entregue` (idempotente, com guarda anti-loop).
- **NFe entrada XML auto-link** ao Pedido de Compra: ao importar XML, casar `chave_nfe` ↔ `pedidos_compra.fornecedor_id + valor_total + data_pedido` em janela ±15 dias; se ambíguo, sugere lista no `PedidoCompraLinker`.
- **Botão "Ver origem" universal no drawer** de qualquer entidade derivada (Pedido → Orçamento; NF → Pedido; Lançamento Financeiro → NF/Pedido). Já existe parcial via RelationalLink; padronizar.

### 4.4 Escalabilidade

- **Server-side pagination em `useSupabaseCrud`**: adicionar `mode: "memory" | "cursor"` (default memory para compat, cursor para listas grandes). DataTable já tem `infiniteScroll`; falta o backend.
- **Edge function `export-bulk`** para CSV/XLSX/PDF de >10k linhas — gera em background, salva em Storage, manda email/notificação com link. Hook `useDataTableExport` decide local vs remote por threshold.
- **Particionar `auditoria_logs` por mês** (Postgres native partitioning) — view `v_admin_audit_unified` continua transparente.

### 4.5 Governança de permissões

- **Remover ações declaradas e não usadas** (`pedidos:confirmar`, `compras:confirmar`, `estoque:aprovar`) **OU implementá-las** onde fariam sentido (ex.: confirmar Pedido = passar de `aprovada` para `em_separacao`).
- **Adicionar role `gestor_compras`** com: `compras:*`, `fornecedores:*`, `estoque:visualizar`, `relatorios:visualizar`.
- **Adicionar role `operador_logistico`** com: `logistica:*`, `pedidos:visualizar`, `estoque:editar`.

### 4.6 Type safety

- **Eliminar `as any` em 10 arquivos**: criar tipos para `vw_fluxo_caixa_financeiro`, `orcamentos_public_view`, `slides_json` (Apresentação), `cliente_snapshot`. Usar Database['public']['Views'] do generated types.

---

## 5. Prompt corretivo final "Para o Lovable"

```
Implemente as 12 correções transversais do ERP AviZee, em fases atômicas.
NÃO faça refactor amplo; cada fase é um PR isolado.

FASE 1 — Doutrina (criar 4 arquivos mem):
1. mem/produto/contrato-de-status.md com tabela módulo×status e regra "novo status entra primeiro em STATUS_VARIANT_MAP".
2. mem/produto/excluir-vs-inativar-vs-cancelar.md com árvore de decisão por tipo de entidade.
3. mem/produto/quando-drawer-quando-pagina.md.
4. mem/produto/contrato-de-periodos.md.
Atualize mem/index.md com as 4 entradas em "Memories".

FASE 2 — Unificar status:
Em src/lib/statusSchema.ts, mude statusOrcamento.pendente.color de "info" para "warning"
e statusPedidoCompra.aprovado.color de "info" para "success", para alinhar com STATUS_VARIANT_MAP.
Não toque em mais nada.

FASE 3 — PeriodFilter como fonte única:
Refatore src/components/filters/PeriodFilter.tsx para aceitar:
  mode: "preset" | "range" | "both" (default "both")
  value: { preset?: string; from?: string; to?: string }
  onChange: (next) => void
Migre src/pages/Estoque.tsx (movimentação) e src/pages/Pedidos.tsx (filtros de emissão)
para consumi-lo. Mantenha URL params (de/ate) em Pedidos.

FASE 4 — useDataTableExport com permissão:
Adicione prop opcional `permission?: PermissionKey` ao hook src/hooks/useDataTableExport.ts.
Quando informado, useCan internamente e bloqueie export retornando toast.error
"Sem permissão para exportar" + log analytics.
Ajuste DataTable para passar a permissão "relatorios:exportar" por default;
páginas que quiserem outra (ex: "financeiro:exportar") sobrescrevem.

FASE 5 — useDashboardLayout migrar para useUserPreference:
Em src/hooks/useDashboardLayout.ts, troque a persistência localStorage
por useUserPreference<DashboardLayoutPrefs>("dashboard_layout") + migração
one-shot do localStorage existente (mesmo padrão de useFavoritos.ts).

FASE 6 — Remover permissões mortas:
Em src/lib/permissions.ts, remova "confirmar" da lista RESOURCE_ACTIONS de
pedidos e compras, e "aprovar" de estoque (todas declaradas, nenhuma usada).
Verifique grep de can('pedidos','confirmar') etc antes de remover.

FASE 7 — Quick-add Produto e Fornecedor:
Crie src/components/QuickAddProductModal.tsx e
src/components/QuickAddSupplierModal.tsx no mesmo padrão de
QuickAddClientModal (FormModal + FormSection).
Plugue em OrcamentoForm/PedidoForm (botão + ao lado do dropdown de Produto)
e em PedidoCompraForm (Fornecedor).

FASE 8 — Trigger Remessa→Pedido:
Migration: criar trigger AFTER UPDATE em remessas.status_transporte
que, quando muda para 'entregue', atualiza ordens_venda.status para 'entregue'
para todos os pedidos vinculados (via tabela ponte ou JOIN).
SET search_path = public; idempotente.

FASE 9 — Eliminar 5 `as any` mais críticos:
Criar tipos em src/types/database-views.ts para:
  - vw_fluxo_caixa_financeiro
  - orcamentos_public_view
  - orcamentos_itens_public_view
Substituir em FluxoCaixaChart.tsx e OrcamentoPublico.tsx.
Não toque ApresentacaoGerencial / MigracaoDados nesta fase.

FASE 10 — Roles adicionais:
Migration: adicionar 'gestor_compras' e 'operador_logistico' ao enum app_role.
Em src/lib/permissions.ts, expandir APP_ROLES, ROLE_LABELS, ROLE_DESCRIPTIONS
e rolePermissionMatrix com as duas roles + permissões listadas no roadmap.

FASE 11 — Quick-Win UI: NFe entrada auto-sugestão de Pedido de Compra:
No PedidoCompraLinker (componente já existente em pages/fiscal/components),
ao abrir, fazer query automática:
  pedidos_compra WHERE fornecedor_id = nf.fornecedor_id
                  AND ABS(valor_total - nf.valor_total) < 0.01
                  AND data_pedido BETWEEN nf.data_emissao - 15d AND nf.data_emissao
Se 1 resultado: pré-seleciona. Se >1: lista no topo do dropdown como "sugestões".

FASE 12 — Cursor pagination opcional em useSupabaseCrud:
Adicionar prop `mode?: "memory" | "cursor"` ao useSupabaseCrud.
Default "memory" (sem breaking change). Quando "cursor", paginação server-side
com .range() seguindo currentPage do DataTable (que já existe).
Documentar no JSDoc quando usar cada modo.

REGRAS DE EXECUÇÃO:
- Cada fase é um PR. NÃO mistura.
- Após cada fase, rodar `tsc --noEmit` e confirmar zero erros.
- NÃO criar componentes novos fora dos especificados.
- NÃO refatorar arquivos não citados.
- Preservar 100% da API pública dos hooks/components alterados.
- Ao terminar uma fase, atualizar mem/index.md se relevante.
```

---

## 6. Prompt corretivo final "Para o Copilot/Codex"

```
You are working on ERP AviZee (React 18 + Vite + Tailwind + Supabase via
Lovable Cloud). Apply the following targeted fixes. Each task is independent
and must be implemented as a separate commit.

CONTEXT:
- Status canonical map: src/types/ui.ts STATUS_VARIANT_MAP
- Status icons/labels: src/components/StatusBadge.tsx statusMeta
- Permissions: src/lib/permissions.ts (ERP_RESOURCES × ERP_ACTIONS)
- Period filter (currently unused): src/components/filters/PeriodFilter.tsx
- Generic CRUD hook: src/hooks/useSupabaseCrud.ts
- User preferences sync: src/hooks/useUserPreference.ts

TASK 1 — Align status colors:
File: src/lib/statusSchema.ts
- Change statusOrcamento.pendente.color from "info" to "warning"
- Change statusPedidoCompra.aprovado.color from "info" to "success"
Reason: STATUS_VARIANT_MAP marks both as warning/success respectively;
legacy schema diverges. Single value change each.

TASK 2 — Refactor PeriodFilter to be reusable:
File: src/components/filters/PeriodFilter.tsx
- Add props: mode ("preset" | "range" | "both", default "both"),
  value ({ preset?: string; from?: string; to?: string }),
  onChange ((next) => void)
- Render preset chips OR date range inputs OR both based on mode.
- Keep existing 6 presets: hoje, 7d, 15d, 30d, 90d, year.
Then update src/pages/Estoque.tsx (lines ~520-535, replace inline date inputs)
and src/pages/Pedidos.tsx (replace inline date inputs around lines 411-420,
keep URL params de/ate sync).

TASK 3 — Permission-gate exports:
File: src/hooks/useDataTableExport.ts
- Add optional prop: permission?: PermissionKey
- When set, call useCan().can(resource, action) at export start.
  If denied: toast.error("Sem permissão para exportar"), return early.
File: src/components/DataTable.tsx — pass permission ?? "relatorios:exportar"
to the hook.

TASK 4 — Migrate dashboard layout to backend prefs:
File: src/hooks/useDashboardLayout.ts
- Replace localStorage.getItem/setItem("dashboard_layout_${userId}") with
  useUserPreference<DashboardLayoutPrefs>("dashboard_layout")
- Add one-shot migration effect: on first mount, if backend has default and
  localStorage has data, write localStorage to backend and remove local key.
Reference pattern: src/hooks/useFavoritos.ts (recent migration).

TASK 5 — Remove dead permission actions:
File: src/lib/permissions.ts
- Verify with grep: no can('pedidos','confirmar'), can('compras','confirmar'),
  can('estoque','aprovar') in src/.
- Remove these from RESOURCE_ACTIONS arrays only (do not touch ERP_ACTIONS
  enum — would need migration).

TASK 6 — Quick-add modals for Product and Supplier:
Mirror src/components/QuickAddClientModal.tsx pattern:
- src/components/QuickAddProductModal.tsx — fields: nome, sku, unidade_medida,
  preco_venda. On save: insert into produtos, return id, call onCreated.
- src/components/QuickAddSupplierModal.tsx — fields: cnpj (with ViaCNPJ
  lookup if available, see src/services for existing helper), nome_fantasia,
  razao_social. On save: insert into fornecedores, return id.
Both use FormModal + FormSection from existing wrappers.

TASK 7 — Database trigger Remessa → Pedido:
Create migration:
  CREATE OR REPLACE FUNCTION sync_pedido_status_on_remessa_entregue()
  RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
  BEGIN
    IF NEW.status_transporte = 'entregue' AND OLD.status_transporte <> 'entregue' THEN
      UPDATE ordens_venda
        SET status = 'entregue', updated_at = now()
        WHERE id = NEW.pedido_id  -- adjust column name if different
        AND status NOT IN ('entregue', 'cancelada');
    END IF;
    RETURN NEW;
  END $$;
  CREATE TRIGGER trg_remessa_entregue_sync
    AFTER UPDATE OF status_transporte ON remessas
    FOR EACH ROW EXECUTE FUNCTION sync_pedido_status_on_remessa_entregue();

TASK 8 — Type the public views (eliminate `as any`):
Create src/types/database-views.ts with explicit interfaces:
  OrcamentoPublicView, OrcamentoItemPublicView, FluxoCaixaFinanceiroView.
Replace `as any` casts in src/pages/OrcamentoPublico.tsx and
src/components/dashboard/FluxoCaixaChart.tsx with these types.

CONSTRAINTS:
- Never modify src/integrations/supabase/{client,types}.ts
- All new RPCs/functions must SET search_path = public
- Do not introduce new dependencies
- Do not change public APIs of existing hooks (only add optional props)
- After each task, run `npx tsc --noEmit` and ensure zero errors
- Preserve existing tests; add minimal new tests only if you change behavior
```

