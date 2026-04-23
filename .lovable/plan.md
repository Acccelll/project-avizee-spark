

# Plano: Segurança, Robustez Fiscal, Feature Flag Social e Mobile do Orçamento

Quatro frentes independentes mas agrupáveis em uma execução. Tudo segue padrões já existentes no projeto (memórias de design system, RBAC, mobile do Comercial).

---

## Frente 1 — Segurança de credenciais

**Limitação técnica:** não posso executar `git rm --cached .env` nem rotacionar chaves no dashboard Supabase — essas duas ações são **manuais do usuário** (documentadas no entregável, não executáveis pelo agente). O resto é código.

1. **`.gitignore`**: confirmar que `.env` está listado (já está). Sem alteração de código.
2. **`src/integrations/supabase/client.ts`**: adicionar comentário no topo (sem mexer na lógica — arquivo é gerado, mas o cabeçalho de comentário é seguro) explicando:
   - `VITE_SUPABASE_PUBLISHABLE_KEY` é a anon key, **pública por design** (protegida por RLS).
   - Secrets reais (service_role, certificados, senhas SMTP) ficam apenas em **Edge Functions** via `Deno.env.get()` e no Supabase Vault.
3. **Instruções manuais** entregues ao usuário no chat após a execução:
   - `git rm --cached .env && git commit -m "chore: untrack .env"`
   - Rotacionar anon key em Supabase Dashboard → Project Settings → API → "Reset anon key" (e atualizar `.env` local).

---

## Frente 2 — RLS permissiva: documentação + hardening

Migration **`audit_rls_permissiva`** (via tool de migração, com aprovação do usuário):

1. **`COMMENT ON TABLE`** em cada tabela crítica documentando o modo single-tenant. Lista verificada do plano:
   `financeiro_lancamentos, clientes, fornecedores, compras, compras_itens, estoque_movimentos, financeiro_baixas, conciliacao_bancaria, notas_fiscais, notas_fiscais_itens`.
2. **`app_configuracoes`**: dropar policies `USING (true)` existentes e criar `admin_only_config` com `EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin','superadmin'))`. Antes de gravar, vou inspecionar as policies atuais (`pg_policies`) para garantir que o nome do `DROP POLICY` está correto e que não quebro nenhum fluxo de leitura usado por `useAppConfig`.
3. **`README.md`** ganha seção **"Segurança / RLS"** explicando:
   - Modo atual: single-tenant, RLS permissiva para `authenticated`.
   - Para multi-tenant: adicionar coluna `empresa_id` em todas as tabelas críticas, popular via trigger `BEFORE INSERT`, recriar policies com `WHERE empresa_id = current_setting('app.empresa_id')::uuid` ou via `user_roles.empresa_id`.

---

## Frente 3 — Robustez do `sefaz-proxy`

1. **`src/services/fiscal/sefaz/httpClient.service.ts`** — `enviarParaSefaz`:
   - Detectar `FunctionsHttpError` via `error.context?.status === 404` e lançar mensagem amigável: *"Serviço de emissão fiscal não está disponível. Contate o suporte técnico (sefaz-proxy não deployado)."*
   - Manter retry para erros transitórios (5xx/timeout); 404 não deve sofrer retry — falha imediata.
2. **`supabase/functions/sefaz-proxy/index.ts`** — CORS:
   - Trocar `allowedOrigin ?? ""` por `allowedOrigin ?? "*"` em todos os pontos onde a origem é montada.
3. **`src/pages/fiscal/components/SefazAcoesPanel.tsx`** — banner de configuração ausente:
   - Importar `obterCertificadoConfigurado` do service de certificados (vou localizar o módulo correto antes de codar).
   - Renderizar `<Alert variant="warning">` com link `/administracao` quando o resultado for `null`.
   - Botão "Transmitir SEFAZ" também fica desabilitado nesse caso (defesa em profundidade).
4. **`README.md`** — nova seção **"Deploy das Edge Functions"** com:
   - `supabase functions deploy sefaz-proxy`
   - Env vars necessárias: `ALLOWED_ORIGIN`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `CERTIFICADO_PFX_SENHA`.

---

## Frente 4 — Feature flag Social documentada

1. **`.env.example`**: adicionar `VITE_FEATURE_SOCIAL=false` com comentário explicativo.
2. **`src/lib/navigation.ts`**: substituir o spread condicional do item Social pelo objeto sempre presente com `badge: 'Em breve'` e `disabled: true` quando a flag não for `'true'`. Vou primeiro ler o arquivo para confirmar tipos `NavSectionKey`/`NavSubgroup` e estender a tipagem do item de navegação com `disabled?: boolean` e `badge?: string` se ainda não existirem.
3. **`AppSidebar` / `SidebarSection`**: respeitar `disabled` aplicando `opacity-50 pointer-events-none` no item, mantendo o badge visível e bloqueando navegação. Vou inspecionar `SidebarSection.tsx` para fazer a alteração no ponto certo (item raiz, não nos subitens).

---

## Frente 5 — Mobile do Orçamento (form + grid)

Já existe parte do trabalho mobile no Comercial (`mem://produto/comercial-mobile.md`). Esta frente complementa o que ainda estava pendente no `OrcamentoForm` raiz.

1. **`src/components/Orcamento/OrcamentoItemsGrid.tsx`**:
   - Já tem `renderMobileCards()` no padrão atual; vou **garantir** que `min-w-[980px]` foi removido do desktop e que o `useIsMobile` é a única chave de troca de layout (sem dupla guarda CSS+JS conflitante).
   - Cada card mobile com:
     - Linha 1: código + descrição (truncate com tooltip).
     - Linha 2: qtd + unitário (grid 2 cols).
     - Linha 3: desconto + subtotal.
     - Rodapé: ações (duplicar, remover) com `min-h-[44px]`.
   - Todos os inputs com `min-h-[44px]` em mobile.
2. **`src/pages/OrcamentoForm.tsx`** — header de ações:
   - Em mobile: deixar apenas **"Salvar"** + menu **"⋯ Mais"** (DropdownMenu) com Visualizar, PDF, Templates, etc.
   - Desktop: layout atual permanece.
3. **`src/pages/OrcamentoForm.tsx`** — footer sticky mobile:
   - Componente `<div className="md:hidden fixed bottom-0 inset-x-0 bg-background border-t p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] z-40 flex items-center justify-between gap-3">` com **"Total: R$ X.XXX,XX"** à esquerda e botão **"Salvar"** à direita (h-11).
   - Adicionar `pb-24 md:pb-0` no container do form para evitar conteúdo escondido atrás do footer.

---

## Detalhes técnicos

- **Migration**: usar a tool de migração (gera SQL e pede aprovação). `SET search_path = public` não se aplica a `COMMENT`/`POLICY` — sem necessidade aqui.
- **Edge Function**: alterar `index.ts` do `sefaz-proxy` faz redeploy automático (não pedir ao usuário).
- **Tipagem**: estender o tipo do item de navegação para `disabled?: boolean` e `badge?: string` no mesmo arquivo; verificar consumidores via `code--search_files` antes de mudar.
- **Sem mexer em arquivos auto-gerados** (`types.ts`, `client.ts` lógica). Apenas o cabeçalho de comentário do `client.ts` será adicionado — risco baixo, mas se o arquivo for re-gerado o comentário some; vou alertar o usuário disso.
- **Validação final**: `npx tsc --noEmit` ao fim.

---

## Roadmap de execução (uma rodada, ordem)

| # | Etapa | Arquivos |
|---|---|---|
| 1 | Comentário de segurança no `client.ts` | `src/integrations/supabase/client.ts` |
| 2 | `.env.example` ganha `VITE_FEATURE_SOCIAL` | `.env.example` |
| 3 | Migration `audit_rls_permissiva` (COMMENTs + policy `app_configuracoes`) | DB |
| 4 | Hardening Edge Function CORS | `supabase/functions/sefaz-proxy/index.ts` |
| 5 | `httpClient.service.ts` trata 404 amigavelmente | `src/services/fiscal/sefaz/httpClient.service.ts` |
| 6 | `SefazAcoesPanel` banner de certificado ausente | `src/pages/fiscal/components/SefazAcoesPanel.tsx` |
| 7 | `navigation.ts` Social com `badge`/`disabled` + `SidebarSection` respeita disabled | `src/lib/navigation.ts`, `src/components/sidebar/SidebarSection.tsx` |
| 8 | `OrcamentoItemsGrid` confirmar mobile cards + 44px | `src/components/Orcamento/OrcamentoItemsGrid.tsx` |
| 9 | `OrcamentoForm` header com "⋯ Mais" + footer sticky mobile | `src/pages/OrcamentoForm.tsx` |
| 10 | README: seções "Segurança / RLS" + "Deploy das Edge Functions" | `README.md` |
| 11 | Memória: atualizar `mem://produto/comercial-mobile.md` com footer sticky do form e mover constraints de RLS para `mem://security/rls-single-tenant.md` | memória |
| 12 | Mensagem final: instruções manuais (rotação de anon key + `git rm --cached .env`) | chat |

**Validação:** `npx tsc --noEmit` após o passo 9.

