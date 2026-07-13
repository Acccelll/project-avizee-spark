---
name: Framework Fiscal — segurança do certificado e transporte
description: Regras absolutas de armazenamento de A1, senha no Vault, mTLS Deno e segregação por empresa/ambiente
type: constraint
---
Regras absolutas do framework fiscal:

1. **Certificado A1 (.pfx)**: apenas no bucket privado `dbavizee` no path `certificados/empresa.pfx` (single-tenant vigente) ou `certificados/{empresaId}/empresa.pfx` (multi-tenant). **Nunca** em coluna de tabela. **Nunca** em Git.
2. **Senha do certificado**: apenas no Supabase Vault sob `CERTIFICADO_PFX_SENHA` (single) ou `CERTIFICADO_PFX_SENHA__{empresaId}` (multi). Leitura só por RPC SECURITY DEFINER. **Nunca** logar, retornar ao client, colocar em tabela.
3. **Metadados do cert** (CNPJ, razão, validade): em `app_configuracoes.chave = 'certificado_digital'` — dados não sensíveis.
4. **Transporte SEFAZ**: sempre mTLS via `Deno.createHttpClient({ cert, key })`; TLS 1.2+; **nunca** enviar Bearer JWT (SEFAZ recusa).
5. **Ambiente** (`homologacao` | `producao`): obrigatório e explícito em toda operação; sem default para evitar "produção por acidente".
6. **RLS por empresa**: quando multi-tenant ligar, `empresa_id IN (SELECT empresa_id FROM user_empresas WHERE user_id = auth.uid())` em toda tabela fiscal.
7. **XMLs autorizados**: bucket `fiscal/{yyyy}/{mm}/{entrada|saida}/{chave}.xml`, retenção mínima 5 anos (obrigação legal).
8. **`fiscal_auditoria`**: guarda hash do payload, nunca o payload inteiro. XML fica no bucket.
9. **Alertas de vencimento**: cron diário → e-mail 30/15/7d antes do `validadeFim`; badge no dashboard.

Detalhes em `docs/fiscal-framework/11-seguranca-e-certificados.md`.