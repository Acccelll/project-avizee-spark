# Plano de migração: páginas → camada de serviços

## Contexto

Hoje, ~20 páginas em `src/pages` chamam `supabase.from(...)` ou `supabase.rpc(...)`
diretamente. O mesmo SELECT pode aparecer em 3 arquivos com pequenas variações,
e qualquer mudança de schema vira caça-fantasma.

A meta é que páginas dependam apenas de `@/services/*`, não de
`@/integrations/supabase/client`. Páginas viram orquestração de UI; queries
ficam isoladas, testáveis e reusáveis.

## Padrão (já implementado em `src/services/clientes.service.ts`)

```ts
// services/<dominio>.service.ts
import { supabase } from "@/integrations/supabase/client";
import type { Tables, TablesInsert, TablesUpdate } from "@/integrations/supabase/types";

export type Foo = Tables<"foo">;

export async function listFoo(filtro: string): Promise<Foo[]> {
  const { data, error } = await supabase.from("foo").select("*").ilike("nome", `%${filtro}%`);
  if (error) throw error;
  return (data || []) as Foo[];
}

export async function createFoo(payload: TablesInsert<"foo">): Promise<Foo> {
  const { data, error } = await supabase.from("foo").insert(payload).select().single();
  if (error) throw error;
  return data as Foo;
}
```

Regras:
- Funções **assíncronas tipadas** retornando o domínio, não `{ data, error }`.
- Erros são **`throw`-ados** — o caller decide UX (toast, retry, fallback).
- Sem manipulação de UI dentro do service (sem `toast`, sem `navigate`).
- Tipos vêm de `Tables<...>` / `TablesInsert<...>` / `TablesUpdate<...>` para
  manter o acoplamento ao schema visível.

## Roteiro priorizado

### Fase 1 — alta densidade de queries (alto risco, alto ROI)

| Página | # queries | Service alvo | Status |
|---|---|---|---|
| `Fiscal.tsx` | 14 | estender `services/fiscal.service.ts` (lookups + `upsertNotaFiscalComItens`) | ✅ 2026-04-28 |
| `OrcamentoForm.tsx` | 14 | estender `services/orcamentos.service.ts` | TODO |
| `FluxoCaixa.tsx` | 4 | `services/financeiro/lancamentos.ts` (`createLancamento`) | ✅ 2026-04-28 |
| `Clientes.tsx` (sub-tabs) | 6 | `services/clientes.service.ts` | ✅ template |
| `Logistica.tsx` | 8 | `services/logistica/{remessas,lookups}.service.ts` | ✅ 2026-04-28 |
| `Orcamentos.tsx` | 4 | `services/orcamentos.service.ts` (+`duplicateOrcamento`) | ✅ 2026-04-28 |
| `RemessaForm.tsx` | 6 | `services/logistica/{remessas,lookups}.service.ts` (lookups + `getRemessaById`) | ✅ 2026-04-28 |
| `PedidoCompraForm.tsx` | 6 | `services/pedidosCompra.service.ts` (novo) | ✅ 2026-04-28 |
| `ConfiguracaoFiscal.tsx` | 3 | estender `services/fiscal.service.ts` (`getEmpresaConfig`/`upsertEmpresaConfig`) | ✅ 2026-04-28 |
| `Budget.tsx` | 3 | `services/budget.service.ts` (novo) | ✅ 2026-04-28 |

**Estratégia para `OrcamentoForm.tsx`:** combinar com o refactor pendente do
arquivo (1.272 linhas). Extrair primeiro hooks (`useOrcamentoSubmit`,
`useOrcamentoConvert`) e dentro deles consumir o service — não mexer no JSX
no mesmo lote.

### Fase 2 — páginas de cadastro

| Página | # queries | Service alvo |
|---|---|---|
| `Produtos.tsx` | ~5 | `services/produtos.service.ts` (lookups + RPCs encapsuladas) ✅ 2026-04-28 |
| `CotacaoCompraForm.tsx` | 9 | `services/cotacoesCompra.service.ts` (novo) ✅ 2026-04-28 |
| `Fornecedores.tsx` | ~4 | `services/fornecedores.service.ts` (criar) |
| `Funcionarios.tsx` | ~3 | `services/rh.service.ts` (criar) |
| `Transportadoras.tsx` | ~3 | `services/logistica.service.ts` (estender) |

### Fase 3 — páginas de consulta/relatório

| Página | Notas |
|---|---|
| `Auditoria.tsx` | Migrar e remover `ViewDrawer` v1 |
| `admin/Logs.tsx` | Idem |
| `RelatoriosFinanceiros.tsx` | Já consome alguns services — finalizar |
| `Apresentacao.tsx` | Centralizar em `services/apresentacao.service.ts` |

## Como migrar uma página (passo-a-passo)

1. **Inventariar queries:** `grep -n "supabase\.\(from\|rpc\)" src/pages/X.tsx`.
2. **Agrupar por entidade.** Cada grupo vira 1–N funções no service.
3. **Criar/estender o service** seguindo o padrão acima.
4. **Substituir na página:** `await listX(...)` em vez de `supabase.from(...)`.
   Mantenha o try/catch + toast no caller.
5. **Rodar build + smoke test** da página.
6. **Não combinar** com refactor visual no mesmo PR.

## Anti-padrões a evitar

- ❌ Service que retorna `{ data, error }` (vaza Supabase no domínio).
- ❌ Service que mostra toasts (UX no service = acoplamento ruim).
- ❌ Função genérica `query<T>(table, filters)` (perde tipagem).
- ❌ Migrar 5 páginas de uma vez (impossível revisar com segurança).

## Checklist de aceite por página

- [ ] Nenhum `import { supabase }` na página.
- [ ] Build TS verde.
- [ ] Funcionalidade smoke-testada (load, create, edit, delete).
- [ ] Tipos do service casam com `Tables<...>` (sem `as any`).
- [ ] Notas de breaking changes registradas no PR (se houver).
