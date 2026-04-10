

# Plano de Correção Técnica — ERP AviZee

## Diagnóstico atual

- **137 arquivos** com `// @ts-nocheck`
- **182 ocorrências** de `as any`
- **0 erros** de TypeScript (porque `@ts-nocheck` mascara tudo)
- **README** vazio
- Tipos de domínio mínimos (43 linhas em `erp.ts`, 12 em `orcamento.ts`)
- Interfaces duplicadas em cada página (ex: `Produto` em Produtos.tsx, `Lancamento` em Financeiro.tsx)
- Services com `as any` para contornar tipagem do Supabase
- Sem checagem de permissões na maioria das páginas/botões
- Páginas monolíticas (1000-1800 linhas misturando UI + dados + regras)

## Escopo realista por fase

Dado o volume (137 arquivos, ~25k linhas de páginas), o trabalho será dividido em **3 fases incrementais**. Este plano cobre a **Fase 1** — a mais impactante.

---

## Fase 1 — Fundação (este ciclo)

### 1. Tipos de domínio centralizados
**Arquivo:** `src/types/domain.ts`

Criar interfaces alinhadas com o schema Supabase gerado, cobrindo as entidades principais:
- `Produto`, `Cliente`, `Fornecedor`, `Transportadora`, `FormaPagamento`
- `Orcamento`, `OrcamentoItem`, `OrdemVenda`, `OrdemVendaItem`
- `PedidoCompra`, `PedidoCompraItem`, `Compra`, `CompraItem`
- `LancamentoFinanceiro`, `BaixaFinanceira`
- `NotaFiscal`, `NotaFiscalItem`
- `MovimentacaoEstoque`, `ContaBancaria`, `ContaContabil`
- `Funcionario`, `FolhaPagamento`, `Remessa`
- `GrupoProduto`, `GrupoEconomico`

Usar `Database["public"]["Tables"][T]["Row"]` como base, re-exportando com nomes de domínio legíveis. Isso elimina as 20+ interfaces duplicadas espalhadas pelas páginas.

### 2. Remover `@ts-nocheck` dos arquivos core (~30 arquivos)

Prioridade:
- **Services** (5 arquivos): `financeiro.service.ts`, `fiscal.service.ts`, `orcamentos.service.ts`, `relatorios.service.ts`, `social.service.ts`
- **Contexts** (2): `AppConfigContext.tsx`, `RelationalNavigationContext.tsx`
- **Hooks** (3): `useAppConfig.ts`, `useSidebarAlerts.ts`, `useUserPreference.ts`
- **Componentes compartilhados** (6): `ProtectedRoute`, `AdminRoute`, `AppLayout`, `AppSidebar`, `DataTable`, `GlobalSearch`
- **Páginas core** (~14): `Index`, `Login`, `Signup`, `Financeiro`, `Fiscal`, `Estoque`, `Produtos`, `Clientes`, `Fornecedores`, `Orcamentos`, `Pedidos`, `Logistica`, `FluxoCaixa`, `Administracao`

Para cada arquivo: remover `@ts-nocheck`, substituir `as any` por tipos corretos usando `domain.ts`, corrigir imports.

### 3. Reduzir `as any` nos services

Substituir os 12 `as any` nos services por tipagem do Supabase client. Exemplo: `supabase.from("financeiro_lancamentos").update({...} as any)` → usar o tipo `TablesUpdate<"financeiro_lancamentos">`.

### 4. Permissões nos botões de ação

Adicionar verificação `can()` do `AuthContext` nos botões críticos:
- Financeiro: baixa, estorno, exclusão → `can("financeiro", "editar")`
- Fiscal: confirmar NF, cancelar → `can("faturamento_fiscal", "aprovar")`
- Administração: toda a página → já protegida por `AdminRoute`
- Estoque: ajustes manuais → `can("estoque", "editar")`
- Produtos/Clientes/Fornecedores: criar, editar, excluir → `can(resource, action)`

Usar pattern: `{can("recurso", "acao") && <Button>...}` ou `disabled={!can(...)}`.

### 5. README técnico real

Substituir o README vazio por documentação cobrindo:
- Stack e arquitetura
- Como rodar localmente
- Variáveis de ambiente
- Estrutura de pastas
- Módulos existentes e status
- Convenções de código
- Padrão de services/hooks

### 6. Padronização de estados de UI

Criar componentes reutilizáveis (ou padronizar os existentes) para:
- Loading states consistentes
- Empty states com mensagem e ação
- Error states com retry

---

## Fases futuras (não neste ciclo)

**Fase 2 — Páginas secundárias:**
- Remover `@ts-nocheck` das ~40 páginas restantes
- Extrair lógica de negócio de páginas monolíticas para hooks/services
- Padronizar drawers e modais

**Fase 3 — Componentes e importação:**
- Remover `@ts-nocheck` dos ~60 componentes restantes
- Tipar hooks de importação
- Consolidar componentes de dashboard

---

## Detalhes técnicos

### Arquivos criados
| Arquivo | Propósito |
|---|---|
| `src/types/domain.ts` | Tipos centrais de domínio |
| `README.md` | Documentação técnica |

### Arquivos modificados (~35 arquivos)
- 5 services: remover `@ts-nocheck`, tipar corretamente
- 2 contexts: remover `@ts-nocheck`
- 3 hooks: remover `@ts-nocheck`
- ~6 componentes compartilhados: remover `@ts-nocheck`, adicionar permissões
- ~14 páginas core: remover `@ts-nocheck`, usar tipos de `domain.ts`, adicionar `can()` nos botões
- `.gitignore`: confirmar proteção de `.env`

### Sem alteração
- Estrutura de pastas (mantida)
- Identidade visual (mantida)
- Fluxos de negócio (mantidos)
- Schema do banco (mantido)
- Componentes UI base shadcn (mantidos)

### Riscos
- Volume alto de mudanças em um ciclo — mitigado por verificação contínua com `tsc --noEmit`
- Alguns `as any` podem ser necessários temporariamente onde o Supabase client não infere corretamente joins complexos — documentados com `// TODO: tipar quando Supabase client suportar joins tipados`

