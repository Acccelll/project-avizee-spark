# Migração do banco Lovable Cloud → Supabase próprio

## O que já verifiquei neste projeto

- 152 tabelas no schema `public`, ~8 mil linhas de dados no total.
- 340 arquivos de migration versionados em `supabase/migrations/` (mais um baseline de referência).
- 6 buckets de storage: `dbavizee`, `email-assets` (público), `orcamentos-pdf`, `etiquetas-correios`, `danfe-pdfs`, `database_export_03_08_26` — com 71 arquivos armazenados.
- 25 edge functions em `supabase/functions/`.
- Não tenho acesso de leitura aos schemas `auth` e `cron` daqui (permissão negada), nem à senha do banco atual nem à service role key do backend gerenciado. Isso limita o que consigo extrair automaticamente (detalhado abaixo).

## Estratégia

Reconstruir o banco no seu projeto Supabase a partir das migrations do repositório (que são a fonte de verdade do schema) e depois carregar os dados exportados. Nada é destruído no ambiente atual até você validar o novo.

```text
Repo (340 migrations)  ──push──►  Supabase seu projeto (schema+RLS+funcs+triggers)
Cloud atual (dados)    ──CSV───►  COPY nas tabelas do novo projeto
Cloud atual (storage)  ──down──►  upload nos buckets recriados
Edge functions + secrets ─────►   deploy no novo projeto
.env do app            ──swap──►  novas URL/anon key
```

## Passos

1. **Preparar o alvo**: no seu projeto Supabase, habilitar as extensões usadas (pgcrypto, pg_cron, pg_net, pgmq, vault) antes de aplicar o schema.
2. **Aplicar o schema**: `supabase link` no seu projeto + `supabase db push` com as migrations do repo, na ordem. Corrigir eventuais falhas pontuais (objetos criados fora de migration).
3. **Exportar os dados**: eu gero CSVs por tabela (na ordem de dependência de FK) em `/mnt/documents/export/`, com um script `import.sh` de `\copy` para você rodar contra o novo banco. Complementarmente você pode usar Cloud → Advanced → Export data.
4. **Sequences**: script para ressincronizar todas as sequences (`setval`) após a carga, senão numeração de documentos (ORC/OV/PC/NF-e) colide.
5. **Storage**: recriar os 6 buckets com a mesma visibilidade e políticas, e copiar os 71 arquivos (via CLI/script com as chaves dos dois projetos — a leitura no lado atual precisa ser feita por você, logado no app, pois não tenho a service role key).
6. **Edge functions e secrets**: deploy das 25 functions no seu projeto e recadastro manual dos secrets (SMTP, certificado A1, worker mTLS, Correios, etc.) — valores de secret não são legíveis por mim.
7. **Auth (usuários)**: os 71+ usuários e hashes de senha vivem no schema `auth`, ao qual não tenho acesso. Opções: (a) você usa a Management API/dump do seu lado, ou (b) recriar usuários e disparar reset de senha. Precisa da sua decisão.
8. **Cron jobs**: `cron.job` também é inacessível daqui; a lista está espalhada em migrations e documentada em `docs/` — recrio via SQL no novo projeto a partir das migrations e você confere.
9. **Trocar a conexão do app**: substituir `VITE_SUPABASE_URL` / `VITE_SUPABASE_PUBLISHABLE_KEY` / `VITE_SUPABASE_PROJECT_ID` pelos do seu projeto e ajustar `supabase/config.toml` (`project_id`).
10. **Validação**: contagem de linhas por tabela lado a lado, smoke test de login, emissão fiscal, financeiro e upload de arquivo.

## Limitações honestas

- Não consigo rodar `pg_dump` daqui, nem ler senha do banco/service role do ambiente gerenciado.
- Schema `auth` e `cron`: sem leitura — exigem ação sua com as credenciais do seu lado.
- Desligar o Lovable Cloud é irreversível e apaga banco, storage e functions. Só faça isso após a validação completa do novo ambiente.
- A string de conexão que você colou aponta para o pooler na porta 5432 do **seu** projeto; para `db push`/`COPY` grande, prefira a conexão direta ou o pooler em modo session.

## Detalhes técnicos

- Ordem de carga dos CSVs derivada de grafo de FK (152 tabelas); tabelas com FK cíclica carregadas com constraints `DEFERRED` na transação.
- Triggers de negócio (ex.: `trg_estoque_movimentos_sync`, resync de saldo financeiro) devem ficar **desabilitados** durante a carga (`ALTER TABLE ... DISABLE TRIGGER USER`) e reabilitados depois, para não recalcular saldos em cima de dados já consolidados.
- RLS: aplicada pelas migrations; a carga é feita como superuser/postgres, então as policies não bloqueiam o import.
