
Vou organizar tudo em um plano único de hardening, mas preciso esclarecer alguns pontos críticos antes de executar — especialmente sobre `.env` (que no Lovable é gerenciado automaticamente) e build secrets (que não posso adicionar).

## Plano — Hardening de segurança, tipos e DX

### Bloco 1 — Segurança (ajustado à realidade Lovable)

**P1 — `.env` exposto:** No Lovable, `.env` é **auto-gerado** (linha 1 do arquivo: "automatically updated"). Não é versionado por mim e os valores são `VITE_SUPABASE_*` (anon key + URL públicos por design — protegidos por RLS, não por segredo). Vou:
- Confirmar `.env` no `.gitignore` (já está).
- Documentar no README que rotacionar a anon key se feita por engano deve ser via painel Lovable Cloud.
- **Não posso** rotacionar a chave por você — é ação no painel.

**P2/P8A — `ADMIN_EMAIL` hardcoded:** Centralizar em `src/constants/app.ts` lendo `import.meta.env.VITE_ADMIN_EMAIL` com fallback `"admin@avizee.com.br"`. Atualizar `.env.example`. Importar em `Login.tsx` e `RequestAccessDialog.tsx`. (Variáveis `VITE_*` ficam no bundle público de qualquer forma — isso é cosmético/configurável, não secreto.)

**P8B — Signup por convite:** Gate em `Signup.tsx` baseado em `VITE_INVITE_ONLY` + `?invite=<token>`. Validação simples client-side (token não-vazio). Tokens reais via Supabase invitations ficam fora de escopo — se quiser fluxo completo, é uma passada própria.

**P9 — Dev button guard:** Trocar `showDevButton` por `import.meta.env.DEV && ...` em `Login.tsx`.

### Bloco 2 — Type safety (escopo realista)

**P3A — ESLint `no-unused-vars`:** Trocar `"off"` por `"warn"` com pattern `^_`. Vai gerar muitos warnings — aceitável (não quebra build).

**P3B — `useSupabaseCrud` genérico:** Adicionar generic `T extends keyof Database["public"]["Tables"]`. Risco de quebrar callers existentes que passam strings arbitrárias — vou manter assinatura retrocompatível com overload/default.

**P3C — Expandir `tsconfig.strict-core.json`:** Adicionar `src/services/**/*`, `src/hooks/**/*`, `src/lib/**/*`, `src/contexts/**/*`. **Risco real:** vai gerar centenas de erros. Estratégia: adicionar e listar os erros, mas **não corrigir todos** nesta passada (escopo aberto demais). Documentar no `docs/typescript-hardening-plan.md`.

**P4 — `social.service.ts`:** Remover `function table()` e `socialRpc` wrappers, usar `supabase.from('social_contas')` direto. Os tipos já existem em `Database`. Risco: se algum método chamar coluna que não existe nos tipos gerados, erro de compilação — corrigir caso a caso.

### Bloco 3 — Bugs

**P5 — Workbook template path:** Mover `src/assets/templates/workbook_gerencial_v1.xlsx` para `public/templates/workbook_gerencial_v1.xlsx` e usar path absoluto. Remover fallback silencioso, lançar erro claro. **Preciso confirmar:** o arquivo existe hoje em `src/assets/templates/`? Se não existir, o fallback é o único caminho — manter mas com warning visível.

**P6 — `useAutoSave` expiração:** Adicionar `maxAgeMs` (default 7 dias) no hook + check em `restore()` + retornar `savedAt` para o caller exibir data. Atualizar `OrcamentoForm` para mostrar data no banner de restauração.

### Bloco 4 — Performance

**P7 — `AuthContext` bootstrap RPC:** Criar migration com função `get_user_bootstrap(uuid)` retornando profile+roles+permissions em uma chamada. Refatorar `AuthContext` para usar a RPC com fallback nas funções atuais (caso a RPC falhe). **Decisão de migration** — preciso confirmar.

### Perguntas antes de executar
<questions:perguntas>
- Aplicar P3C (expandir `strict-core` para services/hooks/lib/contexts) sabendo que vai expor centenas de erros de tipo que **não serão corrigidos nesta passada** (apenas listados)? Ou manter escopo atual e adicionar apenas alguns arquivos selecionados?
- Aplicar P7 (criar RPC `get_user_bootstrap` via migration)? Isso requer migration de DB.
- Para P8B (signup por convite), validação simples client-side só checando se `?invite=` está presente é suficiente, ou quer um fluxo real com tabela `invitations` no banco (escopo maior)?
- P5 — confirmar se quer que eu **mova** o template de `src/assets/` para `public/` (precisa ler/copiar o arquivo binário), ou apenas usar a Opção B (`?url` import do Vite) que mantém o arquivo onde está?
</questions:perguntas>

### Fora de escopo
- Rotação manual da anon key (ação no painel).
- Corrigir os ~301 `as any` (apenas habilitar lint para visibilidade).
- Fluxo real de invitations em DB.
- Refatorar todos os arquivos que quebrem após `useSupabaseCrud` ficar genérico (vai com fallback retrocompatível).

### Critério de aceite
- `ADMIN_EMAIL` centralizado em `src/constants/app.ts`.
- Dev button só aparece em `import.meta.env.DEV`.
- Signup gated por `VITE_INVITE_ONLY` + `?invite=`.
- `useAutoSave` expira rascunhos > 7 dias e expõe `savedAt`.
- `social.service.ts` sem `as never`/`as unknown as`.
- Workbook template carrega de path estável; falha lança erro visível.
- ESLint avisa sobre unused vars (não silencia mais).
- Build OK.

### Arquivos afetados
- `src/constants/app.ts` (novo)
- `src/pages/Login.tsx`
- `src/components/RequestAccessDialog.tsx`
- `src/pages/Signup.tsx`
- `src/hooks/useAutoSave.ts`
- `src/pages/OrcamentoForm.tsx` (banner com data)
- `src/services/social.service.ts`
- `src/lib/workbook/generateWorkbook.ts` (+ possível mover asset)
- `src/hooks/useSupabaseCrud.ts`
- `tsconfig.strict-core.json`
- `eslint.config.js`
- `.env.example`
- `README.md`
- `src/contexts/AuthContext.tsx` (se P7 aprovado)
- migration nova (se P7 aprovado)
