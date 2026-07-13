# 30 · Estratégia de segurança

## Certificado digital (A1)

- **Storage**: bucket `dbavizee` sob prefixo `certificados/{empresaId}/` — RLS-driven policy: leitura só via edge com `service_role`; usuário nunca acessa direto.
- **Senha**: Supabase Vault (`CERTIFICADO_PFX_SENHA__{empresaId}`), acessada apenas por edge via RPC `SECURITY DEFINER`.
- **Extração**: helper compartilhado (`_shared/pfx.ts`) — nunca reimplementar por edge (auditoria facilitada).
- **Nunca**: senha em coluna, em `.env`, em log, em resposta HTTP, em erro.

## Criptografia

- **Em trânsito**: TLS 1.2+ para todas as chamadas externas; mTLS para SEFAZ.
- **Em repouso**: Postgres transparent-at-rest (padrão Supabase); Storage AES-256; Vault com criptografia dedicada.
- **Aplicação**: sem cripto customizada — hashes com `crypto.subtle` do runtime (SHA-256 para audit hash).

## Segregação por empresa (multi-tenant)

- Toda tabela `fiscal_*` tem `empresa_id NOT NULL`.
- **RLS padrão**: `empresa_id IN (SELECT empresa_id FROM user_empresas WHERE user_id = auth.uid())`.
- **empresa_id nunca vem do body** — derivado do JWT na edge.
- **Storage prefixado** por `empresaId` (v2); v1 single-tenant vigente.
- **Vault** com nome discriminado por `empresaId`.
- **Certificado cache** por invocação (não persiste entre requests → sem cross-tenant leak).

## Segregação por ambiente

- Coluna `ambiente` obrigatória em todas as tabelas fiscais operacionais.
- Numeração isolada (sequences distintas por ambiente).
- Chaves não colidem (posição do dígito ambiente).
- UI **sempre** mostra badge de ambiente ativo (banner amarelo em homologação).

## Gestão de segredos

| Segredo | Onde | Rotação |
|---|---|---|
| Senha `.pfx` | Vault | quando trocar cert |
| `SUPABASE_SERVICE_ROLE_KEY` | Deno.env (edge) | por incidente |
| Chave API contador (futuro) | tabela `fiscal_api_keys` (hash bcrypt) | manual |
| Senha admin | Auth (não gerenciada aqui) | política própria |

**Regra**: qualquer secret novo passa pelo tool `add_secret`. Nunca hardcode. Nunca commit.

## LGPD

- **Dado pessoal em fiscal**: nome, CPF/CNPJ, endereço do destinatário; itens; valores.
- **Base legal**: obrigação legal (Ajuste SINIEF 07/05 → retenção 5 anos).
- **Direitos do titular**:
  - Acesso: RPC `lgpd_exportar_dados_titular(cpf)` — inclui NFs onde é destinatário.
  - Portabilidade: exportação JSON+XML.
  - Eliminação: **negada** durante prazo legal (retenção obrigatória) — resposta padronizada com justificativa. Após 5 anos, `anonimizar_titular_fiscal(cpf)` substitui por hash.
- **Log de acesso** a dado pessoal fiscal em `fiscal_auditoria` (leitura crítica registrada).
- **DPO/encarregado**: contato em `/legal/privacidade`.

## Auditoria

- `fiscal_auditoria` (doc 27) — append-only, 5 anos.
- Escritas: `SefazRequisitado`, `SefazRespondeu`, `DocumentoAutorizado`, `Cancelamento*`, `Manifestação*`, `CertificadoCarregado`, acessos a dado pessoal fiscal, alterações em `fiscal_endpoints`, alterações em `fiscal_runtime_config`.
- Leitura: apenas `fiscal:auditoria` ou `fiscal:admin`.
- Trigger anti-tamper: bloqueia UPDATE/DELETE (só INSERT).

## Rastreabilidade

- `correlation_id` fim-a-fim (doc 23).
- `ator` = `auth.uid()` sempre gravado.
- Timestamps UTC + timezone armazenado (`timestamptz`).
- Origem da alteração (`origem: 'ui'|'api'|'cron'|'admin_rpc'`) em operações sensíveis.

## Permissões (RBAC)

Escopos `fiscal:*` do doc 26. Padrão:
- Usuário comum: `fiscal:emitir`, `fiscal:cancelar`, `fiscal:cce` (dependendo do papel).
- Financeiro: `fiscal:manifestar`.
- Admin fiscal: `fiscal:admin`.
- Auditor: `fiscal:auditoria` (só leitura).

**UI**: componentes de ação fiscal usam `can('fiscal', 'emitir')` — nunca esconder somente por UI; enforcement é backend (edge + RLS).

## RLS

### Tabelas operacionais
```
USING (empresa_id IN (SELECT empresa_id FROM user_empresas WHERE user_id = auth.uid()))
WITH CHECK (empresa_id IN (SELECT empresa_id FROM user_empresas WHERE user_id = auth.uid()))
```

### Tabelas de referência (`fiscal_endpoints`, `fiscal_schemas_pl`)
- SELECT: `authenticated`.
- INSERT/UPDATE/DELETE: `fiscal:admin`.

### `fiscal_auditoria`
- SELECT: `fiscal:auditoria`.
- INSERT: `service_role` (edges).
- UPDATE/DELETE: bloqueado.

### `fiscal_runtime_config`
- SELECT: `empresa_id` do usuário.
- INSERT/UPDATE: `fiscal:admin` da empresa.

## Prevenção contra vazamento

Regras invioláveis:

1. **Erro nunca vaza stack ao cliente** — mensagem genérica + `correlation_id` para investigação interna.
2. **XML nunca em log ou resposta de erro** — só hash + tamanho.
3. **Senha nunca em log** — sanitizador em `_shared/sanitize.ts`.
4. **CNPJ/CPF mascarado** em info level (`123.***.***.09`); completo apenas em debug + `auditoria`.
5. **Response headers** — sem `X-Powered-By`, sem versão, sem stack.
6. **CORS estrito** — `ALLOWED_ORIGIN` explícito; sem `*`.
7. **Rate limit** por (empresa, action) — evita enumeração de chaves.
8. **Idempotency-Key** obrigatório em operações escritas via API externa — evita replay.
9. **Signed URLs de XML** com TTL 10 min máximo.
10. **Sem `EXECUTE` de SQL dinâmico** com input do usuário em RPCs — usa parâmetros nomeados.

## Modelo de ameaça (STRIDE resumido)

| Ameaça | Vetor típico | Mitigação |
|---|---|---|
| **Spoofing** | JWT roubado | expiração curta, MFA opcional, refresh rotation |
| **Tampering** | edição de auditoria | trigger anti-tamper + RLS |
| **Repudiation** | usuário nega ação | `ator + correlation_id + timestamp` em audit |
| **Info disclosure** | vazamento XML/PFX | RLS + storage policy + signed URL curto |
| **DoS** | flood de autorização | rate limit + circuit breaker + backoff |
| **Elevation of privilege** | escape RLS | escopo em `user_permissions` + defense-in-depth (edge check + RLS) |

## Checklist de hardening fiscal (aplica em toda edge fiscal)

- [ ] CORS via `_shared/cors.ts`.
- [ ] Auth via JWT; `empresa_id` do JWT.
- [ ] Zod validation do body (`_shared/validate.ts`).
- [ ] Rate limit (`_shared/rate-limit.ts`).
- [ ] Sanitização de log.
- [ ] Correlation-id gerado se ausente.
- [ ] Timeout explícito.
- [ ] `try/catch` global com resposta padrão.
- [ ] Auditoria escrita em todo path (sucesso e falha).
- [ ] Métrica emitida.
- [ ] `search_path = public` em todo RPC chamado.
- [ ] Nenhum `console.*`.
- [ ] Nenhum `new Date()` fora do `clock`.