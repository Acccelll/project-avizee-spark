

Antes do plano dos 7 itens, há um **bloqueador imediato**: o build está quebrado em `OrcamentoForm.tsx` (linhas 589, 590, 654, 655) por incompatibilidade entre `SalvarOrcamentoPayload` / `SalvarOrcamentoItemPayload` e o tipo `Json` esperado pela RPC `salvar_orcamento`. O cast `as unknown as Json` aplicado na Fase C não resolveu — falta um cast mais explícito para o shape esperado pelo `supabase-js`.

# 0. Pré-requisito — Corrigir build (bloqueante)

**Causa**: tipos gerados de `salvar_orcamento` exigem `Json` (que requer `[key: string]: Json`). As interfaces de domínio têm campos opcionais e tipos específicos que o TS não infere como assinaláveis a `Json`.

**Correção**: trocar `as unknown as Json` por `as unknown as never` (padrão usado em outras RPCs do projeto, ex: `usePedidosCompra.ts` linha do `receber_compra`) nas 4 ocorrências. Sem alterar runtime.

---

# Análise dos 7 itens do anexo vs. realidade do projeto

| # | Item | Diagnóstico | Recomendação |
|---|---|---|---|
| 1 | `sidebar_sections_state` em `user_preferences` | `useUserPreference` já é genérico por chave. Hoje seções **não** persistem (`AppSidebar` mantém estado local). Não precisa de coluna nova nem alterar `admin-users` (essa edge function é só admin de usuários, nada a ver). RLS já cobre `user_preferences`. | **Fazer** — usar `useUserPreference<Record<string, boolean>>(user.id, 'sidebar_sections_state', {})` em `AppSidebar`. Zero migration, zero edge function. |
| 2 | Edge function `validate-contrast` | Já existe `ContrastDevTool.tsx` client-side fazendo isso. Cálculo é matemática pura (sem segredo, sem dependência externa). Edge function adicionaria latência de rede para algo síncrono. | **Não fazer como edge function**. Extrair `contrastRatio` para `src/utils/contrast.ts` reutilizável. Se admin precisa validar cor ao salvar tema, chamar localmente. |
| 3 | RPC `sugerir_conciliacao_bancaria` com `pg_trgm` | Heurística atual (`calcularScoreConciliacao`) usa valor exato + janela de 3 dias + Jaccard de palavras. `pg_trgm` melhoraria descrição, mas o gargalo real é volume (extratos têm dezenas, não milhares). Migrar para RPC tem custo (round-trips, perda de loop client-side em auto-match). | **Fazer parcialmente** — habilitar `pg_trgm` e criar RPC opcional `sugerir_conciliacao_bancaria(p_conta_id, p_extrato jsonb)` que retorna candidatos rankeados via `similarity()`. Manter heurística client como fallback. Ajuste mínimo no hook. |
| 4 | `pedido_compra_id` em `financeiro_lancamentos` | **Crítico e correto**. Verifiquei: `receber_compra` cria `compras` mas **não** insere financeiro vinculado ao pedido (a RPC atual no contexto está truncada antes da parte financeira — preciso ler completa antes de implementar). Buscar por `observacoes ILIKE` é frágil. | **Fazer** — migration adiciona FK + índice; ajustar `receber_compra` (ou criar trigger) para popular o campo quando gera o lançamento de "a pagar". |
| 5 | Relatórios assíncronos com `relatorio_jobs` | Verificar primeiro se existe timeout real reportado. Hoje `relatorios.service.ts` gera Excel/PDF client-side. Adicionar fila + tabela + edge function + polling é **infra significativa** para problema não comprovado. | **Adiar** — pedir ao usuário evidência (qual relatório, qual tamanho, qual erro). Sem isso é over-engineering. |
| 6 | Push notifications (OneSignal/FCM) | Requer credencial de terceiros (segredo do usuário), tabela de tokens, service worker no front, integração com eventos. **Feature nova grande**, não correção. | **Adiar** — separar em projeto próprio. Pedir ao usuário se quer abrir como roadmap. |
| 7 | Materialized views `vw_apresentacao_*` | Preciso verificar se existem `vw_apresentacao_*` (memória menciona "Apresentação Gerencial" usando estrutura analítica do Workbook). Se forem views regulares pesadas, MV + `pg_cron` faz sentido. Mas precisa medir antes. | **Investigar antes** — listar views `vw_apresentacao_*`, medir tempo de execução. Só materializar se houver ganho comprovado. |

---

# Plano de execução

## Fase 0 — Desbloquear build *(obrigatório antes de tudo)*
- Trocar `as unknown as Json` → `as unknown as never` em `src/pages/OrcamentoForm.tsx` (4 ocorrências, linhas ~589, 590, 654, 655).
- Validar com `tsc --noEmit`.

## Fase 1 — Item 1: Persistir expansão de seções da sidebar
- Em `src/components/AppSidebar.tsx`, substituir o estado local de seções abertas por `useUserPreference<Record<string, boolean>>(user?.id, 'sidebar_sections_state', {})`.
- Sem migration (a tabela `user_preferences` já é chave-valor com RLS por dono — o hook resolve tudo).
- Sem mexer em `admin-users` (escopo errado no anexo).

## Fase 2 — Item 2: Utilitário de contraste reutilizável (não edge function)
- Extrair `parseRgb`, `luminance`, `contrastRatio` de `ContrastDevTool.tsx` para `src/utils/contrast.ts` exportado.
- Atualizar `ContrastDevTool` para importar do utilitário.
- Disponibilizar para uso em `Configuracoes.tsx` (validação de cor de tema admin) — mostrar aviso se ratio < 4.5.

## Fase 3 — Item 4: FK `pedido_compra_id` em `financeiro_lancamentos`
- **Investigar primeiro** (read-only): ler `receber_compra` completa (db-functions truncou) e qualquer trigger em `compras` que crie financeiro.
- Migration:
  - `ALTER TABLE financeiro_lancamentos ADD COLUMN pedido_compra_id UUID REFERENCES pedidos_compra(id);`
  - `CREATE INDEX idx_financeiro_lancamentos_pedido_compra ON financeiro_lancamentos(pedido_compra_id);`
- Atualizar `receber_compra` (ou trigger correspondente) para preencher `pedido_compra_id` ao inserir lançamento "pagar".
- Refatorar `usePedidosCompra.ts` (`viewFinanceiro`) — substituir busca por `observacoes ILIKE` por filtro `eq('pedido_compra_id', p.id)`.

## Fase 4 — Item 3: `pg_trgm` + RPC `sugerir_conciliacao_bancaria`
- Migration: `CREATE EXTENSION IF NOT EXISTS pg_trgm;`
- Criar RPC `sugerir_conciliacao_bancaria(p_conta_id uuid, p_extrato jsonb)` retornando `TABLE(extrato_id text, lancamento_id uuid, score numeric)` — combina valor exato, janela de data e `similarity(descricao_norm, extrato_descricao_norm)`.
- `SECURITY DEFINER` + `SET search_path = public`.
- Em `useConciliacaoBancaria.autoMatch`, tentar RPC; em caso de erro, cair no `sugerirConciliacao` client atual.

## Fase 5 — Itens 5, 6, 7: **Adiados**
- Pedir confirmação ao usuário com evidência (item 5), escolha de provider (item 6), e medição de performance (item 7) antes de implementar.

---

# Pontos a validar antes de avançar

1. **Build OK** após Fase 0 (`tsc --noEmit`).
2. **`receber_compra` versão completa** — confirmar onde o lançamento financeiro é criado (RPC ou trigger separada) antes de Fase 3.
3. **Estrutura real de `pedidos_compra_itens`** — campos `produto_id`, `quantidade`, `valor_unitario` para reuso em Fase 3.
4. **Existência de `vw_apresentacao_*`** — listar antes de qualquer ação no item 7.

# Riscos
- Fase 3: alterar `receber_compra` impacta fluxo crítico de recebimento — precisa de validação manual no preview após deploy.
- Fase 4: RPC com `pg_trgm` pode retornar resultados diferentes do client em edge cases (acentos, normalização) — manter fallback é mandatório.
- Fase 1: `useUserPreference` faz upsert por chave; chave nova convive sem conflito com `sidebar_collapsed`.

# Sequência recomendada
**0 → 1 → 2 → 3 → 4** nesta ordem. 5/6/7 só após confirmação explícita do usuário com escopo refinado.

# Cautelas finais
- Não criar edge function para validação de contraste (cálculo é matemático, sem segredo).
- Não alterar `admin-users` no item 1 (escopo do anexo está incorreto).
- Não criar tabela `relatorio_jobs` sem evidência de timeout.

