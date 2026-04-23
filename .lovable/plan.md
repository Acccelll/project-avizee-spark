

# Revisão Profunda — Módulo Auditoria

Análise baseada **exclusivamente** no estado real: `src/pages/Auditoria.tsx` (734 LOC, rota `/auditoria` atrás de `AdminRoute`), `src/pages/admin/Logs.tsx` (445 LOC, marcado `@deprecated`, sem rota), `src/services/admin/audit.service.ts`, `src/pages/admin/hooks/useAuditLogs.ts`, `src/pages/admin/hooks/useAdminAuditUnificada.ts`, `src/pages/admin/hooks/useEventosAdminTimeline.ts`, `src/pages/admin/components/DashboardAdmin.tsx`, `src/pages/Administracao.tsx` e `docs/administracao-modelo.md`.

> **Fato central**: o ERP tem **duas trilhas de auditoria reais e independentes**. A página `/auditoria` lê **só uma delas**, ignorando justamente os eventos administrativos mais sensíveis. A view `v_admin_audit_unified` e o hook `useAdminAuditUnificada` foram criados para resolver isso, mas **nenhum componente os consome**.

---

## 1. Visão geral do módulo

- **Rota canônica**: `/auditoria` → `Auditoria.tsx`, atrás de `AdminRoute` (role `admin` obrigatória).
- **Acesso**: link direto em `navigation.ts` (Sidebar → Administração → Auditoria, ícone `Shield`) e botão "Abrir auditoria administrativa" no `DashboardAdmin.tsx`. Em `Administracao.tsx`, item "Auditoria" do grupo "Dados & Auditoria" tem `behavior: "external"` e navega para `/auditoria`.
- **Fonte de dados real**: `Auditoria.tsx` faz `supabase.from("auditoria_logs").select("*").limit(1000)` direto, **sem usar `audit.service.ts` nem `useAuditLogs`**. Filtro `period` aplicado server-side via `gte("created_at", periodToDateFrom(period))`. Demais filtros (tabela, ação, usuário, criticidade, busca) são **client-side em memória**.
- **Schema real (confirmado)**:
  - `auditoria_logs(id, tabela, acao, registro_id, usuario_id, dados_anteriores, dados_novos, ip_address, created_at)` — 13 linhas, último evento de 2026-04-20. Trigger automático em `app_configuracoes`, `empresa_config` e tabelas operacionais (segundo `docs/administracao-modelo.md`).
  - `permission_audit(id, user_id, target_user_id, role_padrao, alteracao, tipo_acao, entidade, entidade_id, motivo, ip_address, user_agent, created_at)` — 2 linhas, último de 2026-04-23. Recebe `role_grant/revoke/update`, `permission_*`, `config_update`, `branding_update`, `self_profile_update`. **Esta é a trilha de governança real.**
- **Dashboard de Segurança** (`DashboardAdmin.tsx`): conta "Eventos admin 24 h" via `permission_audit` e renderiza sparkline 7 d via `useEventosAdminTimeline` (também `permission_audit`). Mas o card aponta para `/auditoria`, que **não mostra essa tabela**.
- **Hooks**: três hooks, papéis sobrepostos:
  - `useAuditLogs` (paginado, lê `auditoria_logs`) — usado **apenas** por `Logs.tsx` deprecated.
  - `useAdminAuditUnificada` (lê view `v_admin_audit_unified` que une as duas tabelas) — **0 referências em todo o código**.
  - `useEventosAdminTimeline` (`permission_audit` 7 d) — usado só no Dashboard Admin.
- **Página deprecated**: `Logs.tsx` (`/pages/admin/Logs.tsx`) tem implementação paralela com paginação real, exportação Excel/PDF e `useSearchParams` — funcionalidades que faltam na página canônica. Não está rotada nem importada.

---

## 2. Problemas encontrados

### 2.1 Cobertura cega: faltam os eventos administrativos

1. **`Auditoria.tsx` ignora `permission_audit`.** Operações como `role_grant/revoke`, `permission_grant/revoke`, `config_update`, `branding_update`, `logo_upload`, `self_profile_update` (recém-implementado na Fase 6 do roadmap Configurações) **não aparecem na trilha de auditoria**. O usuário admin que atribui um papel a outro usuário não vê esse evento na tela `/auditoria`. Quebra de promessa explícita do `docs/administracao-modelo.md` §3.
2. **Sparkline e card "Eventos admin 24h" no Dashboard contam o que `/auditoria` não mostra.** Usuário clica "Abrir auditoria administrativa" e vê uma página onde o número não bate. Discrepância visível.
3. **`useAdminAuditUnificada` existe há tempo suficiente para ter virado dívida.** Foi a solução desenhada (UNION das duas tabelas via view) e nunca foi cabeada na UI. Nenhum import. View `v_admin_audit_unified` ainda não está em `types.ts` (cast `any` no hook).

### 2.2 Duplicação de código (Logs.tsx vs Auditoria.tsx)

4. **Duas implementações paralelas** com 95% do mesmo código (TABLE_META, ACAO_META, SENSITIVE_TABLES, getCriticality, DiffViewer, CRITICALITY_STYLE) duplicadas literalmente. Qualquer ajuste (novo módulo, nova ação) precisa ser feito em **dois lugares** — e o autor original sabe disso, marcou `@deprecated`, mas não removeu.
5. **`Logs.tsx` tem features que faltam em `Auditoria.tsx`**:
   - paginação real server-side (`useAuditLogs` + `setPage`),
   - exportação Excel/PDF (`exportarParaExcel`/`exportarParaPdf`),
   - filtros via `useSearchParams` (deep-link).
   
   A página deprecated é estruturalmente melhor que a canônica em vários pontos. A consolidação foi para o lado errado.
6. **`audit.service.ts` é usado apenas pelo arquivo deprecated.** `fetchAuditLogs`/`useAuditLogs`/`registrarAuditLog` ficam órfãos quando `Logs.tsx` morrer.

### 2.3 Limites de leitura e paginação

7. **`Auditoria.tsx` faz `.limit(1000)` puro**, sem paginação. Em produção, com triggers automáticos em ~30 tabelas, esse limite é alcançado em **horas, não dias**. KPIs ("Total no Período", "Sensíveis") e o filtro client-side passam a operar sobre uma janela arbitrária dos 1000 mais recentes — o usuário acredita estar vendo "30 dias" mas vê só o teto.
8. **KPIs computados sobre `logs` carregados, não sobre o filtro server-side.** Se o usuário aplica `tabelaFilter`, os KPIs continuam refletindo o conjunto bruto. Confunde a leitura.
9. **Sem indicador de truncamento.** Se vier 1000, a UI deveria avisar "exibindo os 1000 mais recentes — refine o período". Hoje não avisa.

### 2.4 Filtros e UX

10. **Filtro "Usuário" lista só `usuariosNosPeriodo`** (usuários presentes nos logs já carregados). Se o usuário cujos eventos você quer investigar não está nas 1000 linhas mais recentes, ele desaparece do dropdown — efetivamente impossível filtrar por ele.
11. **Sem filtro por IP, sem filtro por `registro_id`.** A busca textual cobre, mas não há campo dedicado nem chip ativo. Investigação forense precisa de "todos os eventos do registro X" e "todos os eventos do IP Y" como facets.
12. **Sem filtros por `target_user_id` e `motivo`** — colunas críticas que existem em `permission_audit` mas a página não conhece.
13. **Filtros não vivem na URL.** `Auditoria.tsx` usa `useState`. Não dá para compartilhar link "auditoria de produtos do último mês"; refresh perde tudo. `Logs.tsx` resolveu isso com `useSearchParams` — a página canônica regrediu.
14. **`PeriodFilter` aceita `"todos"`** sem contramedida. Selecionar "Todos" + 1000 linhas + filtro client-side = janela aleatória de eventos e UX confusa.
15. **Filtros e busca não emitem chips ativos.** O padrão do projeto (`AdvancedFilterBar` com `FilterChip`) não é usado. Nenhuma indicação visual do que está filtrado fora dos selects.

### 2.5 Semântica do diff e visualização

16. **`DiffViewer` mostra `String(value)` para campos não-primitivos** — objetos, arrays e jsonb caem em `[object Object]`. Inutiliza o diff em colunas como `dados_novos.itens`, `payload`, `meta`. `Logs.tsx` usa `JSON.stringify(...)` (parcialmente melhor).
17. **Diff não distingue ADD/REMOVE/CHANGE.** Trata tudo como mudança binária. Em INSERT (`dados_anteriores=null`), o componente cai no fallback "Dados Novos" inteiro em pre-formatado — sem destacar que é criação.
18. **Cores hardcoded (`bg-red-100`, `bg-green-100`)** em `ACAO_META`, `CRITICALITY_STYLE` e dentro do `DiffViewer`, em vez de tokens semânticos (`bg-success`, `bg-destructive`). Inconsistente com a faxina recente em Configurações.

### 2.6 Identidade do ator e contexto

19. **`profiles` é carregado uma vez no mount** sem coluna `ativo`/sem paginar. Funciona com poucos usuários, escala mal. Usuários removidos do `profiles` aparecem como UUID truncado em logs antigos — sem fallback informativo.
20. **`ip_address` exibido como `font-mono` cru.** Sem geolocalização, sem agrupamento. Em `permission_audit` ainda existe `user_agent` que **não é coberto** pela página.
21. **Sem coluna `target_user_id`.** Eventos do tipo "admin X alterou roles do usuário Y" são exibidos como "X mexeu em `user_roles`" sem dizer quem é Y. Perde-se a informação operacional mais útil.

### 2.7 Riscos estruturais

22. **`v_admin_audit_unified` não está nos `types.ts`** — `useAdminAuditUnificada` força `(supabase as any)`. Toda chamada à view é não-tipada. Convite a regressão silenciosa.
23. **Triggers gravam em `auditoria_logs` E `permission_audit` para tabelas administrativas** (vide `docs/administracao-modelo.md` §3 — `app_configuracoes`/`empresa_config` → `auditoria_logs` (CONFIG_*); `user_roles`/`user_permissions` → `permission_audit`). Sem deduplicação, a mesma ação pode aparecer **uma vez em cada tabela** — a view UNION resolveria isso, mas hoje a UI lê só metade.
24. **`Logs.tsx` (deprecated) ainda compila, ainda é tree-shaking-relevant, ainda gera chunk lazy?** Não — não é importado no `App.tsx`, então o bundler dropa. Mas o arquivo segue evoluindo (`@deprecated` foi adicionado tarde; código real já divergiu da página canônica). Fonte de confusão para novos contribuidores.
25. **Permissão por role hardcoded.** `/auditoria` exige `admin`. Não existe `auditoria:visualizar` em `ERP_RESOURCES`. Auditor externo / compliance officer que não é admin não tem como receber acesso delegado.
26. **`Auditoria.tsx` não está em `mem://` nem em `docs/`.** Só `permission_audit` aparece em `docs/administracao-modelo.md`. A coexistência das duas trilhas e o status "view existe mas UI não usa" é folclore.

---

## 3. Problemas prioritários

| # | Problema | Severidade | Impacto |
|---|---|---|---|
| 1 | `/auditoria` ignora `permission_audit` (itens 1-3) | **Crítica** | Eventos sensíveis (role/permission/config) invisíveis |
| 2 | Limite 1000 sem paginação e sem aviso (itens 7-9) | **Alta** | Subconjunto silencioso, KPIs enganosos |
| 3 | Duplicação Auditoria.tsx × Logs.tsx (itens 4-6) | **Alta** | Drift, manutenção dupla, regressão garantida |
| 4 | Sem `target_user_id`, `motivo`, `user_agent` na UI (itens 12, 21) | Alta | Investigação forense incompleta |
| 5 | Filtros não vão para a URL (item 13) | Média | Sem deep-link, sem refresh-safe |
| 6 | Diff cai em `[object Object]` para jsonb (item 16) | Média | Inutiliza investigação de payloads |
| 7 | Filtro de usuário só lista quem está nos 1000 (item 10) | Média | Investigação por usuário furada |
| 8 | View `v_admin_audit_unified` não tipada (item 22) | Média | `any` em produção |
| 9 | Sem permissão delegável `auditoria:visualizar` (item 25) | Baixa | Compliance officer depende de admin |
| 10 | Cores hardcoded vs tokens semânticos (item 18) | Baixa | Inconsistência visual com faxina recente |

---

## 4. Melhorias de UI/UX

- **Trocar a fonte para `v_admin_audit_unified`** via `useAdminAuditUnificada` (após tipar): a página passa a mostrar as duas trilhas com `origem` como facet (`permission_audit` × `auditoria_logs`).
- **Coluna "Ator → Alvo"** quando `target_user_id` existe: "admin@x edit perm de joao@y" em vez de "admin@x mexeu em user_permissions".
- **Coluna "Motivo"** (já vem em `permission_audit.motivo`) com truncamento + tooltip, e exibida em destaque no drawer.
- **Chip "1000 eventos exibidos — refine o período"** quando `count >= limit`. Padrão `AdvancedFilterBar` com `FilterChip` ativo para todos os filtros.
- **Filtros via `useUrlListState`** para deep-link (período, tabela, ação, usuário, criticidade, ator, alvo, IP).
- **Diff melhorado**: serializar objetos com `JSON.stringify`, destacar INSERT (badge verde "Criado"), DELETE (badge vermelho "Excluído"), e formatar diffs aninhados (mostrar só os caminhos alterados, ex: `itens[0].quantidade: 5 → 7`).
- **KPIs separar "no período carregado" vs "filtrado"**: dois contadores ou usar tab. Hoje todos os KPIs olham `logs` (carregado), nenhum reflete `filteredLogs`.
- **Substituir `bg-red-100`/`bg-green-100` por tokens semânticos** (`bg-success`, `bg-destructive`, `text-success-foreground`...).
- **Exibir `user_agent`** abreviado no drawer ("Chrome 130 / macOS"), com tooltip do raw.
- **Botões de exportação Excel/PDF** já existem em `Logs.tsx` — portar para a página canônica.
- **Paginação real** (mover para `useAuditLogs`-like com ranges) em vez de `.limit(1000)`.

---

## 5. Melhorias estruturais

1. **Tornar `Auditoria.tsx` um shell fino** que consome `useAdminAuditUnificada` (renomeado para `useAuditTrail` ou similar) com filtros server-side completos. Adeus `useAuditLogs` para a UI principal.
2. **Regenerar `types.ts`** para que `v_admin_audit_unified` seja tipada — remove o `(supabase as any)` em `useAdminAuditUnificada.ts`.
3. **Apagar `src/pages/admin/Logs.tsx`** depois de portar paginação + export. Remover `useAuditLogs` se ninguém mais usar; manter `audit.service.ts` apenas se `registrarAuditLog` for usado por edge functions/forms (verificar grep mostrou uso só em `Logs.tsx`).
4. **Extrair `TABLE_META`, `ACAO_META`, `SENSITIVE_TABLES`, `getCriticality`, `DiffViewer`, `ActionBadge`, `CriticalityBadge`** para `src/lib/audit/` (módulo único). Hoje estão duplicados em dois arquivos.
5. **Adicionar `auditoria` em `ERP_RESOURCES`** com ações `visualizar`/`exportar`. Trocar `AdminRoute` por `PermissionRoute resource="auditoria"`. Compliance officer ganha acesso delegável.
6. **RPC `audit_search(filters jsonb, page int, page_size int)`** opcional, com `SECURITY DEFINER + search_path=public`, agregando filtros server-side por todos os campos (incluindo `target_user_id`, `motivo`, `tipo_acao`). Acaba com filtro client-side e com o teto de 1000.
7. **Atualizar `mem://`** com a fronteira: `auditoria_logs` = trilha operacional automática (CRUD em tabelas de domínio); `permission_audit` = trilha de governança (ator x alvo, com motivo). UI lê os dois via view.
8. **Dashboard Admin** passa a apontar para `/auditoria?origem=permission_audit&periodo=24h` para o card "Eventos admin 24 h", garantindo coerência número-tela.

---

## 6. Roadmap de execução

| Fase | Entrega | Dependências | Esforço | Impacto |
|---|---|---|---|---|
| 1 | Regenerar `types.ts` para tipar `v_admin_audit_unified` | Nenhuma | S | Remove `any` e habilita IntelliSense |
| 2 | Substituir fonte de `Auditoria.tsx` para `useAdminAuditUnificada` (mostrar `permission_audit` + `auditoria_logs`) | Fase 1 | M | **Resolve item crítico 1** |
| 3 | Adicionar colunas/filtros `origem`, `tipo_acao`, `target_user_id`, `motivo`, `user_agent` no drawer e na lista | Fase 2 | M | Investigação forense viável |
| 4 | Mover filtros para URL via `useUrlListState` + chips ativos via `AdvancedFilterBar` | Fase 2 | M | Deep-link, refresh-safe |
| 5 | Paginação real server-side (range) com indicador de truncamento | Fase 2 | M | Acaba com janela arbitrária dos 1000 |
| 6 | Portar exportação Excel/PDF de `Logs.tsx` para `Auditoria.tsx` | Fase 5 | S | Recupera feature perdida |
| 7 | Apagar `Logs.tsx`, `useAuditLogs` (se sem uso) e `fetchAuditLogs` | Fase 6 | S | Remove duplicação |
| 8 | Extrair `TABLE_META`, `ACAO_META`, `DiffViewer`, badges para `src/lib/audit/` | Fase 7 | S | Fonte única |
| 9 | Diff inteligente: INSERT/DELETE explícitos, jsonb formatado, paths aninhados | Fase 8 | M | Inutiliza menos o drawer |
| 10 | Cores semânticas (`bg-success`/`bg-destructive`) substituindo `bg-red-100` etc | Fase 8 | S | Coerência visual |
| 11 | Adicionar `auditoria` em `ERP_RESOURCES`; trocar `AdminRoute` por `PermissionRoute` | Nenhuma | S | Acesso delegável |
| 12 | RPC `audit_search` server-side completa (opcional) | Fase 5 | L | Performance + filtros forenses |
| 13 | Dashboard Admin: card "Eventos admin 24h" linka `/auditoria?origem=permission_audit&periodo=24h` | Fase 4 | S | Coerência número-tela |
| 14 | Atualizar `mem://features/auditoria-trilhas.md` | Fase 7 | S | Governança |

**Quick wins (1 PR cada)**: 1, 6, 10, 11, 13, 14.
**Refatoração estrutural**: 2, 3, 4, 5, 7, 8, 9.
**Evolução de produto**: 12.

