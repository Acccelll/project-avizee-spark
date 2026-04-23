

# Plano — Hardening: logs, tipos, queries, navegação, SEFAZ e RLS docs

Cinco trilhas independentes, baixo risco, sem refactor de UI.

## 1. Logger + strip de console em produção

**`vite.config.ts`** — adicionar dentro do `defineConfig`:
```ts
esbuild: { drop: mode === 'production' ? ['console', 'debugger'] : [] },
```
Strip automático de **159** ocorrências `console.*` no bundle final.

**`src/lib/logger.ts`** (novo) — wrapper gated por `import.meta.env.DEV`:
```ts
const isDev = import.meta.env.DEV;
export const logger = {
  error: (...a: unknown[]) => { if (isDev) console.error(...a); },
  warn:  (...a: unknown[]) => { if (isDev) console.warn(...a); },
  info:  (...a: unknown[]) => { if (isDev) console.info(...a); },
};
```

**Migrar `console.error` → `logger.error`** apenas nos críticos (já cobertos pelo strip, mas dá rastreabilidade em dev limpa):
- `src/contexts/AuthContext.tsx` (3)
- `src/pages/financeiro/hooks/useBaixaFinanceira.ts` (4)
- `src/pages/Fiscal.tsx` (6)
- `src/pages/financeiro/hooks/useFinanceiroActions.ts` (1)

## 2. ESLint contra novos `as any` + saneamento dirigido

**`eslint.config.js`** — adicionar em `rules`:
```js
'@typescript-eslint/no-explicit-any': 'warn',
'no-empty': ['error', { allowEmptyCatch: false }],
```

**Saneamento de casts arriscados** (alvo: serviços fiscal/financeiro):

- **`src/services/fiscal.service.ts`** — remover `as any` do `registrarEventoFiscal.insert` tipando o payload com a Row do Supabase (`Database["public"]["Tables"]["nota_fiscal_eventos"]["Insert"]`). Remover o `eslint-disable` no topo.
- **`src/services/financeiro/baixas.ts`** — substituir `update(payload as any)` por payload tipado com `Database["public"]["Tables"]["financeiro_lancamentos"]["Update"]`.
- **`src/services/financeiro/conciliacao.service.ts`** — remover `(supabase.rpc as any)` declarando o RPC `financeiro_conciliar_baixa` com cast tipado `as unknown as { ... }` na resposta.
- **Casts inevitáveis** (tabelas/views fora dos types gerados — `vw_conciliacao_eventos_financeiros`, `conciliacao_bancaria`, `conciliacao_pares`): manter, mas trocar comentário para o padrão único:
  ```ts
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- limitação do tipo Supabase (regenerar types)
  ```

Os 105 casts globais não serão zerados — objetivo é (a) bloquear novos via lint e (b) limpar fluxos críticos.

## 3. React Query em FluxoCaixa e Conciliação

**`src/hooks/useFluxoCaixaData.ts`** (novo) — extrair o `reload` callback de `FluxoCaixa.tsx` para `useQuery` com `queryKey: ['fluxo-caixa', dataInicio, dataFim]`, `staleTime: 60_000`. `FluxoCaixa.tsx` passa a consumir `data, isLoading` em vez de `useState + useEffect`.

**`src/services/_invalidationKeys.ts`** — adicionar `'fluxo-caixa'` em `baixaFinanceira`, `fiscalLifecycle`, `faturamentoPedido` e `recebimentoCompra` para que baixas e NFs invalidem o fluxo automaticamente.

**Conciliação** — `useConciliacaoBancaria.ts` **já usa** `useQuery` para lançamentos (queryKey `['conciliacao-lancamentos', contaId, dataInicio, dataFim]`). Apenas:
- Garantir que a busca de **contas bancárias** em `Conciliacao.tsx` passe por `useQuery` com `queryKey: ['contas_bancarias','ativas']` e `staleTime: Infinity` (raramente muda).

## 4. Sócios e Participações — desduplicar navegação

**`src/lib/navigation.ts`** (linha 184) — remover o item `Sócios e Participações` do grupo Financeiro. Manter apenas o acesso via aba dentro de `/socios`.

**`src/App.tsx`** (linha 176) — manter a rota `/socios-participacoes` mas trocar o `element` para `<Navigate to="/socios?tab=participacoes" replace />` (preserva bookmarks/links externos como `FinanceiroDrawer` e `SocioDrawer`).

**`src/pages/Socios.tsx`** — ler `useSearchParams()` e usar `searchParams.get('tab') ?? 'identificacao'` como default do `<Tabs value={...}>`. Sincronizar mudança de aba na URL com `setSearchParams({ tab }, { replace: true })`.

**`src/components/navigation/MobileBottomNav.tsx`** — manter mapeamento `'/socios-participacoes': 'socios:visualizar'` (resolve permissão antes do redirect).

## 5. Pré-validação fiscal antes da SEFAZ

**`src/services/fiscal/validadores/preEmissao.validator.ts`** (novo):
```ts
export interface ErroPreEmissao { campo: string; mensagem: string; }
export function validarPreEmissao(nf, itens): ErroPreEmissao[] {
  // CNPJ emitente, CPF/CNPJ destinatário, NCM (validarNCM) e CFOP (validarCFOP) por item
}
```
Usa as funções já existentes `validarNCM` e `validarCFOP` (note: nomes em CAPS no projeto, não camelCase).

**`src/pages/fiscal/hooks/useSefazAcoes.ts`** — em `transmitir`, antes da chamada `autorizarNFe`:
```ts
const erros = validarPreEmissao(nf, dadosNFe.itens);
if (erros.length > 0) {
  setUltimoRetorno({
    motivo: `${erros.length} problema(s) de pré-emissão`,
    erros: erros.map(e => `${e.campo}: ${e.mensagem}`),
  });
  setModalAberto(true);
  toast.error(`${erros.length} problema(s) antes da emissão`);
  return null;
}
```
`SefazRetornoModal` já renderiza `erros[]` — sem mudança de UI.

## 6. RLS single-tenant — comentários no schema

**Migration `supabase/migrations/{ts}_rls_single_tenant_docs.sql`**:
```sql
COMMENT ON TABLE public.financeiro_lancamentos IS 'RLS: single-tenant intencional. Ver mem://security/rls-single-tenant';
COMMENT ON TABLE public.clientes              IS '...';
COMMENT ON TABLE public.fornecedores          IS '...';
COMMENT ON TABLE public.compras               IS '...';
COMMENT ON TABLE public.compras_itens         IS '...';
COMMENT ON TABLE public.notas_fiscais         IS '...';
COMMENT ON TABLE public.notas_fiscais_itens   IS '...';
COMMENT ON TABLE public.estoque_movimentos    IS '...';
COMMENT ON TABLE public.conciliacao_bancaria  IS '...';
COMMENT ON TABLE public.financeiro_baixas     IS '...';
```
A doc completa já existe em `.lovable/memory/security/rls-single-tenant.md` (não duplicar em `docs/`).

## Notas técnicas

- **Sem mudança de UI** — apenas infra/governança.
- **`as any` em testes** (`ofxParser.test.ts`) fica como está (polyfill jsdom).
- ESLint regra muda `error` → `warn` para os 105 casts existentes não quebrarem build; novos aparecem como warning visível.
- `logger.ts` é minimalista por design — sem deps, sem buffer, sem sink remoto (escopo: dev only).
- A migration de comentários é segura/idempotente (apenas metadados).

## Resumo do que muda

| Arquivo | Tipo | O quê |
|---|---|---|
| `vite.config.ts` | edit | `esbuild.drop` em prod |
| `src/lib/logger.ts` | new | wrapper gated DEV |
| `eslint.config.js` | edit | `no-explicit-any: warn` + `no-empty` |
| `src/contexts/AuthContext.tsx` | edit | 3× console→logger |
| `src/pages/Fiscal.tsx` | edit | 6× console→logger |
| `src/pages/financeiro/hooks/useBaixaFinanceira.ts` | edit | 4× console→logger |
| `src/pages/financeiro/hooks/useFinanceiroActions.ts` | edit | 1× console→logger |
| `src/services/fiscal.service.ts` | edit | tipar Insert, remover `as any` |
| `src/services/financeiro/baixas.ts` | edit | tipar Update |
| `src/services/financeiro/conciliacao.service.ts` | edit | tipar RPC, padronizar comments |
| `src/hooks/useFluxoCaixaData.ts` | new | useQuery |
| `src/pages/FluxoCaixa.tsx` | edit | usar hook |
| `src/services/_invalidationKeys.ts` | edit | adicionar `fluxo-caixa` |
| `src/pages/Conciliacao.tsx` | edit | useQuery contas |
| `src/lib/navigation.ts` | edit | remover item duplicado |
| `src/App.tsx` | edit | `/socios-participacoes` → `<Navigate>` |
| `src/pages/Socios.tsx` | edit | tab via URL |
| `src/services/fiscal/validadores/preEmissao.validator.ts` | new | validador agregador |
| `src/pages/fiscal/hooks/useSefazAcoes.ts` | edit | guard no `transmitir` |
| `supabase/migrations/{ts}_rls_single_tenant_docs.sql` | new | `COMMENT ON TABLE` |

