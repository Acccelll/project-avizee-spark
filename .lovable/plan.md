## Etapa 3 — Segurança & LGPD (escopo aprovado)

### 3.1/3.2 — Fechar gaps remanescentes de RLS / SECURITY DEFINER

Lookup tables (`bancos`, `formas_pagamento`, `centros_custo`, `contas_contabeis*`, `empresas`, `empresa_config`, `grupos_*`, `ibge_municipios`, `unidades_medida`, `transportadoras`, `produto_composicoes`, `produtos_fornecedores`, `produto_identificadores_legacy`, `remessa_itens`, `social_*`, `bancos`, `comentarios`) **permanecem `USING(true)` para `authenticated`** — alinhado com a memória `rls-single-tenant.md` (não há grant para `anon`).

Migração endurece o resto:

| Tabela | SELECT hoje | SELECT depois |
|---|---|---|
| `stg_cadastros`, `stg_compras_xml`, `stg_estoque_inicial`, `stg_faturamento`, `stg_financeiro_aberto` | `true` | `has_role(auth.uid(),'admin')` |
| `apresentacao_comentarios`, `apresentacao_geracoes`, `apresentacao_templates`, `apresentacao_slide_telemetria` | `true` | `admin OR financeiro` |
| `cliente_registros_comunicacao`, `clientes_enderecos_entrega` | `true` | `admin OR vendedor OR financeiro` |
| `nfe_distdfe_sync` | `true` | `admin OR financeiro` |
| `importacao_logs`, `importacao_lotes` | duplicado (`true` + admin) | drop policy `true`, mantém admin |

Mantém `empresa_id` previsto (não introduz filtro multi-tenant agora; só comenta).

`SECURITY DEFINER` views: já catalogadas em `security-definer-views.md` (4 exceções com `COMMENT`). Sweep adicional: confirmar nenhuma view nova DEFINER, garantir `SET search_path = public` em todas as `SECURITY DEFINER` functions (memória `seguranca-funcoes-sql.md`).

### 3.3 — MFA TOTP (opcional para todos)

Novo hook `useMfa()` (`enroll`, `verify`, `unenroll`, `listFactors`). Substitui o card "Em breve" em `SegurancaSection.tsx` por bloco real:
- Lista fatores ativos (com `created_at`, opção remover).
- Botão "Adicionar autenticador" → drawer/modal com QR code + campo de 6 dígitos.
- Toast de sucesso e atualização do estado.

Login: o cliente Supabase já dispara `aal2` automaticamente quando há fator. Adicionar tela `MfaChallenge` (rota `/mfa`) chamada de `Login` quando `currentLevel='aal1' && nextLevel='aal2'`. Sem enforcement por papel (escolha do usuário).

### 3.4 — Rate limit em edge functions expostas

Novo helper `supabase/functions/_shared/rate-limit.ts` em memória (Map por instância, janela deslizante) — suficiente para o caso comum sem persistir tabela. Assinatura: `await checkRateLimit(key, {limit, windowSec})` → lança 429.

Aplicado a: `ia-extracao-documento`, `ia-sugestao`, `consultadanfe-proxy`, `social-sync` (já validados em PRs anteriores; só plugar o limit). Chave = `userId || ip`.

### 3.5 — Base LGPD

**Migração:**
- `lgpd_solicitacoes` (`titular_tipo` ∈ cliente|fornecedor|funcionario, `titular_id`, `tipo` ∈ exportar|anonimizar, `status`, `solicitado_por`, `concluido_em`, `payload` jsonb p/ exportação, `motivo`).
- RPC `exportar_dados_titular(_tipo, _id)` → jsonb consolidando cadastro + comunicações + orçamentos/pedidos/NFs/lançamentos relacionados.
- RPC `anonimizar_titular(_tipo, _id)` — preserva NFs autorizadas (substitui nome/email/telefone/endereço no cadastro mestre por `[ANONIMIZADO #id]`; CPF/CNPJ vira hash; **não** toca snapshots de NF emitida nem `financeiro_lancamentos` históricos). Registra em `lgpd_solicitacoes` e `auditoria_logs`.
- Ambas `SECURITY DEFINER`, `SET search_path = public`, guard `has_role admin`.
- Novo recurso `lgpd` em `permissions.ts`/`RESOURCE_ACTIONS` (apenas para admin).
- Coluna `consentimento_lgpd_em timestamptz` em `clientes`/`fornecedores`/`funcionarios` (nullable).

**UI:**
- Nova seção em `/administracao` (`LgpdSection`) listando solicitações + form "Nova solicitação" (busca titular por tipo, escolhe ação, mostra preview).
- Botão "Registrar consentimento LGPD" nos formulários de cliente/fornecedor/funcionário (toggle simples gravando `consentimento_lgpd_em = now()`).

### Verificação

- `psql` confirma novas policies.
- Linter sem novos avisos relevantes.
- Tests `vitest run` continuam verdes (785).
- Smoke manual: vendedor não vê `stg_*`; admin enrola MFA, desloga, loga com challenge; admin exporta titular e anonimiza um cliente de teste — NF preservada.

### Arquivos previstos

- `supabase/migrations/<ts>_etapa3_rls_lgpd_mfa.sql`
- `supabase/functions/_shared/rate-limit.ts` (+ aplicação nas 4 funções)
- `src/pages/configuracoes/hooks/useMfa.ts`
- `src/pages/configuracoes/sections/SegurancaSection.tsx` (substitui placeholder)
- `src/pages/MfaChallenge.tsx` + rota
- `src/pages/admin/sections/LgpdSection.tsx`
- `src/services/lgpd.service.ts`
- `src/lib/permissions.ts` (+ `lgpd`)
- `.lovable/memory/features/lgpd.md` + atualização de `rls-single-tenant.md`

Estimativa: 1 migração grande + ~10 arquivos novos/editados. Sem refactor de monólitos.
