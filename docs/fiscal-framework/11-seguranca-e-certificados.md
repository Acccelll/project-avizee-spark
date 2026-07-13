# 11 · Segurança e gerenciamento de certificados

## Superfície de risco

- **Certificado A1 (.pfx)** contém a chave privada da empresa — se vazar,
  qualquer um pode emitir NF-e em nome do CNPJ.
- **Dados fiscais** contêm CPF/CNPJ, endereços, valores → escopo LGPD.
- **Chave privada da SEFAZ (mTLS)** = mesma do certificado A1 no perfil vigente.

## Armazenamento do certificado (padrão vigente — manter)

| Item | Onde | Quem lê |
|------|------|---------|
| `.pfx` binário | Bucket privado `dbavizee/certificados/empresa.pfx` (multi-empresa: `dbavizee/certificados/{empresaId}/empresa.pfx`) | Apenas edge functions com service_role |
| Senha | Supabase Vault, secret `CERTIFICADO_PFX_SENHA` (multi: `CERTIFICADO_PFX_SENHA__{empresaId}`) | Apenas RPCs SECURITY DEFINER que a edge invoca |
| Metadados (CNPJ, razão, validade) | `app_configuracoes.chave = 'certificado_digital'` | UI (via RLS) |

**Regras absolutas**:
1. `.pfx` nunca em tabela relacional.
2. Senha nunca em tabela, nunca em log, nunca no client.
3. Bucket sem acesso público. Signed URL só para admin com escopo curto (5 min).
4. Reupload substitui (upsert) — versão anterior é sobrescrita (não guardamos histórico com senha).

## Fluxo de upload seguro (já implementado — manter)

```
UI ──▶ certificado.service.uploadCertificadoA1(pfx, senha)
       1. base64(pfx)
       2. edge sefaz-proxy action=parse-certificado (valida + extrai metadados)
       3. supabase.storage.upload(dbavizee/certificados/empresa.pfx, upsert)
       4. RPC salvar_secret_vault(CERTIFICADO_PFX_SENHA, senha)
       5. app_configuracoes.upsert(certificado_digital = { cnpj, razao, validade, ... })
```

## Renovação e rotação

- **Alerta 30d antes**: cron diário lê `validadeFim` e enfileira e-mail via
  `process-email-queue`. Badge no dashboard fiscal ("Certificado vence em N dias").
- **Renovação**: mesma UI de upload sobrescreve o anterior. Sem downtime
  perceptível — edge é stateless, próxima invocação já usa o novo.
- **Revogação de emergência**: `removerCertificadoA1()` deleta bucket + Vault
  + `app_configuracoes`. Bloqueia emissão até novo upload.

## Certificado A3 (futuro)

- Fora do escopo v1 (framework .NET original também deixou fora).
- Contrato `ISigningCertificateProvider` cobre — troca provider por PKCS#11.
- Exigiria host físico com token conectado (Deno edge não suporta).

## Transporte (mTLS)

- `Deno.createHttpClient({ cert: pem, key: pem })` para mTLS com SEFAZ.
- TLS 1.2+ (rejeitar 1.0/1.1).
- Validar cadeia ICP-Brasil na SEFAZ do lado do servidor (SEFAZ faz).
- **Nunca** enviar Bearer JWT nesses requests (SEFAZ recusa).
- Documentar em `mem/tech/sefaz-mtls-transporte` (já existe).

## Segregação por empresa (multi-tenant)

- Bucket path por `empresaId`.
- Vault secret sufixado por `empresaId`.
- `fiscal_certificado_metadata.empresa_id` UNIQUE.
- RLS em tabelas fiscais: `empresa_id IN (SELECT empresa_id FROM user_empresas WHERE user_id = auth.uid())`.
- Runtime resolve `CertificateProvider.fromStorage(empresaId)` por operação.

## Segregação por ambiente

- `homologacao` e `producao` **completamente separadas**:
  - Mesmo certificado (A1 vale em ambos), mas endpoints diferentes.
  - `notas_fiscais.ambiente` obrigatório.
  - UI destaca ambiente (badge vermelho para produção).
- Nunca "produção por acidente": `ambiente` obrigatório em toda config, sem default.

## Controle de acesso

RBAC por permissão granular:

| Permissão | Ação |
|-----------|------|
| `fiscal:emitir` | Emissão de NF-e |
| `fiscal:cancelar` | Cancelamento |
| `fiscal:cce` | Carta de correção |
| `fiscal:inutilizar` | Inutilização |
| `fiscal:manifestar` | Manifestação destinatário |
| `fiscal:dfe` | Sync DistDFe manual |
| `fiscal:certificado` | Upload/remoção do certificado |
| `fiscal:auditoria` | Leitura de `fiscal_auditoria` |
| `fiscal:admin` | Todas as anteriores + configuração runtime |

Validação: `can('fiscal','emitir')` no frontend + revalidação na edge
(JWT → `user_permissions`).

## Auditoria (LGPD compatível)

- `fiscal_auditoria` guarda **hash** do payload, não o payload. Suficiente
  para provar integridade sem armazenar CPF/valores em segundo lugar.
- XMLs no bucket ficam armazenados 5 anos (obrigação fiscal); LGPD prevalece
  por lei específica.
- Solicitação LGPD de titular → RPC anonimiza em `notas_fiscais.destinatario_*`
  somente se a nota estiver **cancelada** e **fora do prazo de retenção**.
  Caso contrário, resposta é "não podemos anonimizar por obrigação fiscal".

## Proteção de segredos operacionais

- `SUPABASE_SERVICE_ROLE_KEY` — apenas edges (nunca client).
- `CERTIFICADO_PFX_SENHA` — apenas via RPC SECURITY DEFINER.
- Nunca logar body de request/response SEFAZ em nível `info`.
- Nunca logar Vault secret retornado.

## Observabilidade de segurança

- Log de: tentativa de acesso a `fiscal_auditoria` sem permissão, upload
  de certificado, remoção de certificado, mudança de `ambiente`.
- Alertar admin em: 3+ falhas de assinatura seguidas (possível cert corrompido),
  status serviço 108/109 por > 30 min, certificado a vencer em 7d.

## Regras Core aplicáveis (já em vigor no projeto)

- `search_path = public` em toda RPC/trigger fiscal.
- Log via `src/lib/logger.ts` (nunca `console.*`).
- RLS em toda tabela pública.
- GRANTs explícitos em toda tabela nova.
- Segredos via `secrets--add_secret` tool ou Vault; nunca em código.