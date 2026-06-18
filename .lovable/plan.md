# Etapa 1 — Higiene de código & observabilidade

Escopo: as 4 sub-etapas descritas (1.1 a 1.4). Baixo risco, pré-requisito de 2 e 6. Sem mudanças de UX nem schema.

## 1.1 — Logger central substituindo `console.*` em `src/`

Estado real auditado: **147 ocorrências** de `console.*` em ~50 arquivos de `src/` (não 143). `src/lib/logger.ts` já existe e já tem gate por `import.meta.env.DEV` + `esbuild.drop` em produção — não precisa reescrever, apenas adotar.

Ação:
1. Substituir em todo `src/` (exceto `src/lib/logger.ts` e `src/integrations/supabase/client.ts` — este é auto-gerado):
   - `console.error` → `logger.error`
   - `console.warn` → `logger.warn`
   - `console.info`/`console.log`/`console.debug` → `logger.info` (logger não expõe `debug`/`log`; mapear para `info`, que já é silenciado em prod)
2. Em cada arquivo alterado, adicionar `import { logger } from "@/lib/logger";`.
3. Mascarar dados sensíveis nos call sites encontrados: senhas, tokens, `linha_digitavel`, `arquivo_base64`, conteúdo PFX, CPF/CNPJ completos (manter só 3 últimos dígitos quando útil para debug).
4. Em `eslint.config.js`, adicionar:
   ```js
   "no-console": ["error", { allow: [] }]
   ```
   com `overrides` ignorando `supabase/functions/**` (lá vale o logger de `_shared/logger.ts`, que usa `console.*` por design) e `src/lib/logger.ts`.

Não tocar: `supabase/functions/**`, `scripts/**`, `src/integrations/supabase/client.ts`.

Verificação:
- `rg -n "console\." src | grep -v "src/lib/logger.ts\|src/integrations/supabase/client.ts"` → vazio.
- `npm run lint` falha se alguém reintroduzir `console.`.

## 1.2 — Erros consistentes em services + mutations

Ação:
1. Varrer `src/services/**` por `catch` que não re-lança nem reporta: padronizar para
   ```ts
   } catch (err) {
     logger.error("[<contexto>] <ação>", err);
     throw err; // ou retornar Result tipado conforme padrão do arquivo
   }
   ```
   Não criar tipo `Result` novo se já existir convenção local — preservar.
2. Verificar que toda `useMutation` em `src/hooks/**` e `src/pages/**/hooks/**` tem `onError` com `notifyError(err)` (helper já existente em `src/utils/errorMessages.ts`) ou `toast.error`. Adotar **sonner** (já é o padrão; `useToast` legado fica como está, não migrar nesta etapa para não inflar diff).
3. Não introduzir biblioteca nova de toast.

Verificação: `rg -n "catch\s*\{\s*\}|catch\s*\(\s*\w+\s*\)\s*\{\s*\}" src/services` → vazio. Auditoria manual em 5 mutations aleatórias mostra `onError`.

## 1.3 — Remover serviço fantasma `sessoes.service.ts`

Auditoria:
- `src/services/admin/sessoes.service.ts` é wrapper redundante sobre a Edge Function `admin-sessions` (mesma função usada por `adminSessions.service.ts`, que é a versão oficial consumida por `src/hooks/useSessoes.ts`).
- Único consumidor: `src/services/admin/__tests__/sessoes.test.ts`.
- A tabela `user_sessions` realmente não existe; o comentário do próprio arquivo confirma.

Decisão recomendada (default): **remover**.
- `rm src/services/admin/sessoes.service.ts`
- `rm src/services/admin/__tests__/sessoes.test.ts`
- Ajustar comentário em `adminSessions.service.ts` que cita `sessoes.service.ts`.

Dead-code adicional: rodar `bunx knip --no-progress` (ou `ts-prune`) **só para reportar** nesta etapa; remover apenas itens claramente órfãos e sem efeito colateral (não tocar edge functions, migrations, rotas, contextos, testes). Itens duvidosos viram lista para uma etapa futura.

Verificação: `npm run typecheck`, `npm run build` verdes; nenhuma referência a `user_sessions` ou `sessoes.service` em `src/`.

## 1.4 — Wrapper `QueryState` + adoção em listagens

Criar `src/components/ui/QueryState.tsx`:
```tsx
type Props<T> = {
  isLoading: boolean;
  isError: boolean;
  error?: unknown;
  data: T | undefined;
  isEmpty?: (data: T) => boolean; // default: array vazio
  onRetry?: () => void;
  skeleton: ReactNode;            // skeleton específico da tela
  empty: ReactNode;               // <EmptyState .../> da tela
  children: (data: T) => ReactNode;
};
```
- `isLoading` → renderiza `skeleton` (com `aria-busy`).
- `isError` → bloco de erro padronizado com `notifyError` no `useEffect` + botão "Tentar novamente" chamando `onRetry`.
- `isEmpty(data)` → renderiza `empty`.
- caso contrário → `children(data)`.

Adoção nesta etapa: **não migrar tudo**. Migrar 5 telas representativas para validar o contrato:
- `Orcamentos`, `Pedidos`, `Clientes`, `Produtos`, `Financeiro` (lista principal).
Demais telas entram em backlog da Etapa 5 (UX), aproveitando que ali já se mexe em estados visuais.

Verificação manual nas 5 telas: rede offline → erro com retry; lista vazia → empty; carregando → skeleton; sem tela branca.

## Ordem de execução e PRs sugeridos

1. PR-1.1 logger + ESLint rule (mecânico; diff grande mas seguro).
2. PR-1.2 catches e onError (pequeno, alto valor).
3. PR-1.3 remoção `sessoes.service.ts` + relatório knip.
4. PR-1.4 `QueryState` + 5 telas piloto.

Cada PR roda `npm run lint && npm run typecheck && bunx vitest run` antes de fechar.

## Não-objetivos desta etapa

- Não migrar `useToast` legado para sonner.
- Não corrigir paginação (Etapa 2).
- Não mexer em RLS/MFA/LGPD (Etapa 3).
- Não tocar nos monólitos (Etapa 6).
- Não adicionar gates de cobertura no CI (Etapa 7).

## Riscos & mitigações

- **Substituição em massa de `console.*`**: feita por arquivo via `apply_patch` (não `sed`) para preservar mensagens e args; rodar `tsc` após cada lote de ~10 arquivos.
- **Remoção do `sessoes.service.ts`**: confirmado que só testes consomem; se o usuário quiser manter a feature de "user_sessions" persistidas, abortar e abrir etapa própria.
- **`no-console` como `error`**: pode quebrar PRs em andamento; comunicar no commit message.
