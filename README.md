# AviZee ERP

Sistema de gestão empresarial completo construído com React, TypeScript e Supabase.

## Stack Tecnológica

| Camada      | Tecnologia                       |
|-------------|----------------------------------|
| Frontend    | React 18 + TypeScript 5 + Vite 5 |
| Estilização | Tailwind CSS 3 + shadcn/ui       |
| Backend     | Supabase (Lovable Cloud)          |
| Auth        | Supabase Auth (email + senha)     |
| Banco       | PostgreSQL (via Supabase)         |
| State       | React Query (TanStack Query v5)   |
| Forms       | React Hook Form + Zod             |
| Charts      | Recharts                          |

## Rodando Localmente

```bash
# 1. Instalar dependências
npm install

# 2. Configurar variáveis de ambiente
cp .env.example .env
# Editar .env com suas credenciais Supabase

# 3. Iniciar o servidor de desenvolvimento
npm run dev
```

### Variáveis de Ambiente

| Variável                          | Descrição                             | Obrigatória |
|-----------------------------------|---------------------------------------|:-----------:|
| `VITE_SUPABASE_URL`              | URL do projeto Supabase               | ✅          |
| `VITE_SUPABASE_PUBLISHABLE_KEY`  | Chave anônima (anon key) do Supabase  | ✅          |
| `VITE_SUPABASE_PROJECT_ID`       | ID do projeto Supabase                | ✅          |
| `VITE_DEV_EMAIL`                 | E-mail para auto-preenchimento (dev)  | ❌          |
| `VITE_DEV_PASSWORD`              | Senha para auto-preenchimento (dev)   | ❌          |

## Estrutura de Pastas

```
src/
├── assets/            # Imagens e recursos estáticos
├── components/        # Componentes React reutilizáveis
│   ├── dashboard/     # Blocos do dashboard principal
│   ├── estoque/       # Drawers e formulários de estoque
│   ├── financeiro/    # Modais e drawers financeiros
│   ├── fiscal/        # Dialogs e drawers fiscais
│   ├── importacao/    # Componentes de importação de dados
│   ├── logistica/     # Componentes de logística
│   ├── navigation/    # Header, sidebar, busca global
│   ├── Orcamento/     # Componentes do módulo de orçamentos
│   ├── precos/        # Preços especiais
│   ├── social/        # Módulo de redes sociais
│   ├── ui/            # Componentes base (shadcn/ui + customizados)
│   ├── usuarios/      # Gerenciamento de usuários
│   └── views/         # Views de detalhe (drawers relacionais)
├── contexts/          # React Contexts (Auth, Config, Navigation)
├── hooks/             # Custom hooks (CRUD, preferências, etc.)
│   └── importacao/    # Hooks específicos de importação
├── integrations/
│   └── supabase/      # Client e tipos gerados (NÃO editar)
├── lib/               # Utilitários, formatação, validação
├── mocks/             # Dados mock para desenvolvimento
├── pages/             # Páginas/rotas da aplicação
├── services/          # Camada de serviço (acesso a dados + lógica)
├── test/              # Setup e utilitários de teste
├── tests/             # Testes de integração
└── types/             # Tipos TypeScript centralizados
    ├── domain.ts      # Tipos de domínio (aliases do schema Supabase)
    ├── erp.ts         # Enums de status e config visual
    ├── orcamento.ts   # Tipos de orçamento
    └── social.ts      # Tipos do módulo social
```

## Módulos do ERP

| Módulo         | Status      | Rota Principal       | Descrição                                |
|----------------|-------------|----------------------|------------------------------------------|
| Dashboard      | ✅ Completo | `/`                  | Visão geral com KPIs e alertas           |
| Clientes       | ✅ Completo | `/clientes`          | Cadastro com grupos econômicos           |
| Fornecedores   | ✅ Completo | `/fornecedores`      | Cadastro com vínculo de produtos         |
| Produtos       | ✅ Completo | `/produtos`          | Cadastro com composição e fiscal         |
| Orçamentos     | ✅ Completo | `/orcamentos`        | Criação, aprovação, conversão em pedido  |
| Pedidos        | ✅ Completo | `/pedidos`           | Gestão de pedidos e faturamento          |
| Estoque        | ✅ Completo | `/estoque`           | Posição, movimentações, ajustes          |
| Fiscal         | ✅ Completo | `/fiscal`            | NF-e entrada/saída, DANFE, devolução     |
| Financeiro     | ✅ Completo | `/financeiro`        | Contas a pagar/receber, baixas           |
| Fluxo de Caixa | ✅ Completo | `/fluxo-caixa`       | Entradas, saídas, saldo, importação CSV  |
| Relatórios     | ✅ Completo | `/relatorios`        | 12+ tipos (DRE, ABC, aging, etc.)        |
| Logística      | ✅ Completo | `/logistica`         | Remessas e rastreamento                  |
| Compras        | ✅ Completo | `/pedidos-compra`    | Pedidos de compra                        |
| Cotações       | ✅ Completo | `/cotacoes-compra`   | Cotações com propostas de fornecedores   |
| Administração  | ✅ Completo | `/administracao`     | Usuários, roles, config empresa          |
| Contas Bancárias| ✅ Completo| `/contas-bancarias`  | Cadastro de contas                       |
| Transportadoras| ✅ Completo | `/transportadoras`   | Cadastro de transportadoras              |
| Formas Pgto    | ✅ Completo | `/formas-pagamento`  | Formas e condições de pagamento          |
| Importação     | ✅ Completo | `/migracao-dados`    | Importação de planilhas e XML            |
| Social         | 🔧 Parcial  | `/social`            | Integração com redes sociais             |

## Convenções de Código

### Tipagem

- **Tipos de domínio** → importar de `@/types/domain`
- **Tipos do Supabase** → usar os tipos gerados em `@/integrations/supabase/types`
- **Nunca editar** `src/integrations/supabase/client.ts` ou `types.ts`

### Hooks

- `useSupabaseCrud<T>()` — CRUD genérico tipado com paginação, busca e filtros
- `useAppConfig<T>()` — configurações do sistema com sync cross-tab
- `useUserPreference<T>()` — preferências do usuário com persistência

### Services

- `services/*.service.ts` — lógica de negócio e operações complexas no Supabase
- Páginas chamam hooks/services, nunca o Supabase diretamente para operações complexas

### Permissões (RBAC)

Roles: `admin`, `vendedor`, `financeiro`, `estoquista`

```typescript
import { useAuth } from "@/contexts/AuthContext";
const { can, hasRole } = useAuth();

// Verificar permissão
if (can("financeiro", "editar")) { /* ... */ }
if (hasRole("admin")) { /* ... */ }
```

### RLS (Row Level Security)

Tabelas sensíveis (financeiro, RH, config) possuem políticas RLS restritivas.
Tabelas de cadastro compartilhado (clientes, produtos) usam `USING(true)` para
permitir acesso a todos os usuários autenticados.

## Dívida Técnica

### `@ts-nocheck` remanescentes

~121 arquivos ainda possuem `// @ts-nocheck`. Prioridade de remoção:

1. ~~Services~~ ✅ Removido
2. ~~Contexts~~ ✅ Removido
3. ~~Hooks principais~~ ✅ Removido
4. ~~Componentes compartilhados~~ ✅ Removido
5. **Páginas core** — próximo passo
6. **Componentes de módulo** — fase seguinte
7. **Dashboard e importação** — fase final

### Próximos Passos

1. Remover `@ts-nocheck` das 14 páginas core (Produtos, Clientes, Financeiro, etc.)
2. Adicionar verificações `can()` em botões de ações sensíveis
3. Extrair lógica de negócio de páginas monolíticas para hooks/services
4. Padronizar estados de loading/empty/error entre telas
5. Adicionar testes para services e fluxos críticos

## Scripts Disponíveis

```bash
npm run dev          # Servidor de desenvolvimento
npm run build        # Build de produção
npm run lint         # Verificação de lint
npm run test         # Rodar testes (vitest)
npm run preview      # Preview do build
```

## Licença

Proprietário — © AviZee. Todos os direitos reservados.
