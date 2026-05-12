## Escopo

Plano dividido por tier conforme a auditoria. Vou implementar **TIER 1 inteiro** + os itens de **TIER 2** que são correções de segurança/consistência rápidas (I-01, I-02). TIER 2 maiores (I-03 C14N, I-04 services, I-05 `as any`) e TIER 3/4 ficam como ondas separadas — sinalizo recomendação ao final.

### Achados após verificação no banco (importante)

Inspecionei `pg_policies` e `pg_proc` antes de planejar:

- **C-01 (parcialmente diferente do reportado).** Não há políticas órfãs `allow_all_authenticated` nessas tabelas. O que existe são policies finais com `USING (true)` / `WITH CHECK (true)` no próprio policy "definitivo":
  - `fechamentos_mensais.fm_select` → `USING (true)` ❌
  - `workbook_templates.wt_select` → `USING (true)` ❌
  - `workbook_geracoes.wg_select / wg_insert / wg_update` → todas `true` ❌
  - `fechamento_caixa_saldos`, `fechamento_estoque_saldos`, `fechamento_financeiro_saldos`, `fechamento_fopag_resumo`: já têm policies de SELECT/INSERT/UPDATE com `has_role(...)` corretas — **não precisam de mudança**.
  - `mapeamento_gerencial_contas`: não existe no schema atual (sem ação).
- **C-02 já está corrigido.** As 4 funções pgmq (`enqueue_email`, `read_email_batch`, `delete_email`, `move_to_dlq`) já têm `proconfig = {search_path=public}`. Sem ação.

## TIER 1 — Críticos

### C-01. Tightening de RLS (apenas tabelas realmente abertas)

Migration única que dropa e recria as policies frouxas, alinhando com o padrão `admin OR financeiro` já usado nas tabelas-irmãs:

- `fechamentos_mensais.fm_select` → `USING (has_role(admin) OR has_role(financeiro))`.
- `workbook_templates.wt_select` → `USING (has_role(admin) OR has_role(financeiro))` (templates são insumo do módulo gerencial).
- `workbook_geracoes.wg_select / wg_insert / wg_update` → restringir a `admin OR financeiro`. INSERT/UPDATE adicionalmente `WITH CHECK (created_by = auth.uid() OR has_role(admin))` se a coluna existir (verifico no migration antes de aplicar).
- Adicionar `COMMENT ON POLICY` documentando o motivo (single-tenant + role gate), aderente à memória `RLS Single-Tenant`.

### C-02. SECURITY DEFINER sem search_path

**Sem ação** — verificação direta em `pg_proc` mostra que as 4 funções já têm `SET search_path = public`. Atualizar a memória se necessário para não reabrir.

### C-03. Remover `exportar-certificado-pem`

- Confirmar com o usuário no fim do plano que os PEMs já estão no Cloudflare (a função foi marcada como temporária).
- Após confirmação: deletar o diretório `supabase/functions/exportar-certificado-pem/` e undeploy via `supabase--delete_edge_functions`.

## TIER 2 — Correções rápidas a embarcar agora

### I-01. CORS uniforme

Migrar todas as edge functions **browser-callable** para `_shared/cors.ts` (`buildCorsHeaders(origin)`):

- `sefaz-proxy`, `sefaz-distdfe`, `correios-api`, `validate-invite`, `consultadanfe-proxy`, `instagram-oauth`, `notify-orcamento-resposta`, `preview-transactional-email`, `handle-email-unsubscribe`, `handle-email-suppression`, `test-smtp`, `send-transactional-email`, `apresentacao-cadencia-runner`, `social-sync`, `admin-users`, `admin-sessions` (estas duas já usam o helper — confirmar).
- Server-to-server / cron / webhooks ficam como estão (`webhooks-dispatcher`, `process-*-cron`, `auth-email-hook`, `process-email-queue`, `notify-admin-new-signup`).
- Substituir o bloco `const corsHeaders = { … "*" }` por `const corsHeaders = buildCorsHeaders(req.headers.get("origin"))` dentro do handler. Manter shape do export para não impactar callers.

### I-02. `notas_fiscais` exigir role além de tenant

Migration que recria `nf_select` e `nf_insert` para o padrão de `financeiro_lancamentos`:

```
USING (
  empresa_id = current_empresa_id()
  AND (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'financeiro') OR has_role(auth.uid(),'fiscal'))
)
```

(Confirmar enum: hoje há `admin`, `financeiro`, `vendedor`, `estoquista`. Se `fiscal` ainda não existe, manter `admin OR financeiro` — alinhado ao padrão atual de financeiro_lancamentos.) UPDATE/DELETE não mudam.

## Itens NÃO incluídos nesta onda (recomendação)

- **I-03** C14N real em `sefaz-proxy`: requer porte/integração de lib específica + fixtures — onda própria com testes de integração.
- **I-04** Pages com `supabase.from(...)` direto: refactor para `services/` — onda de organização.
- **I-05** Limpeza de `as any`: aproveitar `src/types/rpc.ts` — onda de typing.
- **TIER 3** (squash de migrations, `USING(true)` legado, `ADMIN_EMAIL` hardcode, `refetchOnWindowFocus`, PWA, `carga_inicial_conciliacao`, TODOs) e **TIER 4** (helpers, RPC consolidada, vault, testes): cada item merece sua ondinha.

## Detalhes técnicos

### Migration RLS (C-01) — esqueleto

```sql
-- fechamentos_mensais
DROP POLICY IF EXISTS fm_select ON public.fechamentos_mensais;
CREATE POLICY fm_select ON public.fechamentos_mensais
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'financeiro'));

-- workbook_templates
DROP POLICY IF EXISTS wt_select ON public.workbook_templates;
CREATE POLICY wt_select ON public.workbook_templates
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'financeiro'));

-- workbook_geracoes
DROP POLICY IF EXISTS wg_select ON public.workbook_geracoes;
DROP POLICY IF EXISTS wg_insert ON public.workbook_geracoes;
DROP POLICY IF EXISTS wg_update ON public.workbook_geracoes;
CREATE POLICY wg_select ON public.workbook_geracoes
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'financeiro'));
CREATE POLICY wg_insert ON public.workbook_geracoes
  FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'financeiro'));
CREATE POLICY wg_update ON public.workbook_geracoes
  FOR UPDATE TO authenticated
  USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'financeiro'));
```

### Migration `notas_fiscais` (I-02)

```sql
DROP POLICY IF EXISTS nf_select ON public.notas_fiscais;
DROP POLICY IF EXISTS nf_insert ON public.notas_fiscais;
CREATE POLICY nf_select ON public.notas_fiscais
  FOR SELECT TO authenticated
  USING (
    empresa_id = current_empresa_id()
    AND (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'financeiro'))
  );
CREATE POLICY nf_insert ON public.notas_fiscais
  FOR INSERT TO authenticated
  WITH CHECK (
    empresa_id = current_empresa_id()
    AND (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'financeiro'))
  );
```

### CORS (I-01) — patch padrão por função

```ts
import { buildCorsHeaders } from "../_shared/cors.ts";
Deno.serve(async (req) => {
  const corsHeaders = buildCorsHeaders(req.headers.get("origin"));
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  // …respostas existentes mantêm `...corsHeaders`
});
```

### C-03 — execução

1. `supabase--delete_edge_functions(["exportar-certificado-pem"])`.
2. `rm -rf supabase/functions/exportar-certificado-pem`.

## Validação pós-implementação

- `supabase--linter` para checar warnings novos.
- `psql` para confirmar que as policies recriadas batem com o esperado.
- Smoke test rápido: chamar `correios-api` do preview (origin Lovable) deve continuar funcionando; chamar de `curl` sem origin → fallback `*`; chamar com origin não-allowlisted → não receber `Access-Control-Allow-Origin` correspondente.

## Pergunta antes de implementar

Confirmar dois pontos antes de aplicar:

1. **C-03**: Os PEMs já foram subidos no Cloudflare e a `exportar-certificado-pem` pode ser deletada agora? (Se ainda não, mantemos a função e abro warning na memória.)
2. **I-02**: Para `notas_fiscais`, basta `admin OR financeiro` (padrão de `financeiro_lancamentos`) ou também queremos liberar `vendedor` para SELECT? Hoje `vendedor` lê via `orcamentos`/`ordens_venda`, não NF — meu default é **não incluir vendedor**.