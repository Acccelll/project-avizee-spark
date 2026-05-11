# Migração Fiscal → Camada de Services

Extrair todas as chamadas diretas a `supabase.from / rpc / functions` do domínio Fiscal para `src/services/fiscal/*`, seguindo o contrato em `src/services/CONTRACTS.md` (funções tipadas, retorno do domínio, `throw` em erro, sem toast/navigate).

## Escopo (8 arquivos consumidores, 5 services)

### Services — criar/estender

**1. `src/services/fiscal/lifecycle.service.ts` (estender)**
- `gerarFinanceiroNfeEntrada(notaId, duplicatas, formaPagamento, cartaoId)` → `Promise<void>`. Wrappa `rpc("gerar_financeiro_nfe_entrada")`.
- `atualizarFinanceiroNota({ notaId, formaPagamento, condicaoPagamento, parcelas })` → `Promise<void>`. Wrappa `rpc("atualizar_financeiro_nota")`.
- Tipo `Duplicata` exportado (numero, vencimento, valor) e `AtualizarFinanceiroNotaParams`.

**2. `src/services/fiscal/tributacao.service.ts` (estender — já existe)**
- `aplicarMatrizFiscal(params)` → `Promise<MatrizFiscalResult>`. Wrappa `rpc("aplicar_matriz_fiscal")`. Substitui as 2 chamadas em `EmitirNFeWizard.tsx`.
- `deleteNaturezaOperacao(id)` → `Promise<void>`. Wrappa `from("naturezas_operacao").delete().eq("id", id)`.
- `saveMatrizRegra(payload, editingId?)` → `Promise<void>`. Insert ou update em `matriz_fiscal`.
- `deleteMatrizRegra(id)` → `Promise<void>`.

**3. `src/services/fiscal/numeracao.service.ts` (criar)**
- `proximoNumeroNfe(serie)` → `Promise<string>`. Wrappa `rpc("proximo_numero_nfe")`.
- `gerarChaveAcessoNfe(nfId)` → `Promise<string>`. Wrappa `rpc("gerar_chave_acesso_nfe")` (confirmar nome real da RPC ao implementar).
- `updateNotaFiscalCampo(id, patch)` → `Promise<void>`. Wrappa `from("notas_fiscais").update(patch).eq("id", id)`. Usa `Database["public"]["Tables"]["notas_fiscais"]["Update"]`.

**4. `src/services/fiscal/dashboardFiscal.service.ts` (estender)**
- `fetchKpisFiscal(filters: FiscalKpisFilters)` → `Promise<FiscalKpisResult>`. Wrappa `rpc("kpis_fiscal")`. Mantém constante `EMPTY` e merge `{ ...EMPTY, ...data }` que hoje vive em `useFiscalKpis`. Tipos passam a viver no service e são re-exportados pelo hook.

**5. `src/services/fiscal/danfe.service.ts` (estender)**
- `consultarDanfePorChave(chave)` → `Promise<DanfeConsultaResult>`. Wrappa `supabase.functions.invoke("consultadanfe-proxy", { body: { chave } })`. Tipo do resultado derivado da resposta atual usada no Dialog.

### Refactors de consumidores (apenas substituir a chamada — manter toasts, invalidações e navegação intactos)

| Arquivo | Substituir por |
|---|---|
| `src/pages/Fiscal.tsx` (2 ocorrências, l. 777 e 820) | `gerarFinanceiroNfeEntrada(...)` |
| `src/pages/faturamento/EmitirNFeWizard.tsx` (l. 563, 1269) | `aplicarMatrizFiscal(...)` |
| `src/pages/faturamento/EmitirNFeWizard.tsx` (l. 695 — `empresa_config.crt`) | `getEmpresaConfigPrincipal()` (já existe em `empresaConfig.service.ts`) |
| `src/pages/faturamento/FaturamentoCadastros.tsx` (l. 194) | `deleteNaturezaOperacao(id)` |
| `src/pages/faturamento/FaturamentoCadastros.tsx` (l. 531/535) | `saveMatrizRegra(payload, editing?.id)` |
| `src/pages/faturamento/FaturamentoCadastros.tsx` (l. 554) | `deleteMatrizRegra(id)` |
| `src/pages/fiscal/hooks/useFiscalKpis.ts` | `fetchKpisFiscal(filters)` dentro do `queryFn` |
| `src/pages/fiscal/hooks/useSefazAcoes.ts` (l. 136, 152, e qualquer `from("notas_fiscais").update`) | `proximoNumeroNfe`, `gerarChaveAcessoNfe`, `updateNotaFiscalCampo` |
| `src/pages/fiscal/components/BuscarPorChaveDialog.tsx` (l. 129) | `consultarDanfePorChave(chave)` |
| `src/components/fiscal/EditarPagamentoNotaModal.tsx` (l. 63) | `atualizarFinanceiroNota({...})` |

## Convenções aplicadas

- Imports de tipos vêm de `@/integrations/supabase/types` (`Database["public"]["Tables"][...]["Row" | "Insert" | "Update"]`, `Json`).
- Services não importam `toast`, `useNavigate`, `useQueryClient` — o caller mantém isso.
- Erros: `if (error) throw error;` — sem mascarar.
- RPCs com payload `Json`: cast explícito `as unknown as Json` quando necessário (padrão já em uso em `lifecycle.service.ts`).
- Não tocar em `src/lib/realtime/*`, `src/types/rpc.ts` nem em `supabase.auth.*` (exceções legítimas pela memória `camada-services-unica`).

## Validação pós-migração

1. `rg "supabase\.(from|rpc|functions|storage)" src/pages/Fiscal* src/pages/faturamento src/pages/fiscal src/components/fiscal` → deve ficar vazio (exceto chamadas a `supabase.auth.*` se houver).
2. `tsc` limpo (build automático do harness).
3. Smoke test: `src/test/smoke/*` continuam passando.
4. Comportamento UX preservado: toasts, navegações e invalidações de cache exatamente onde estavam.

## Fora de escopo

- Não criar novas RPCs no banco.
- Não alterar assinaturas de hooks consumidores além do mínimo (eles continuam expondo a mesma API para a UI).
- Não mexer em `nfeBuilders.service.ts`, `nfeXmlParser.service.ts`, `sefaz.service.ts` ou demais services já migrados.
