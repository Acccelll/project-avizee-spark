# pgTAP database tests

Estes testes rodam contra um banco Supabase local (shadow DB) usando o runner
oficial `supabase test db`, que instala pgTAP automaticamente.

## Pré-requisitos

- Supabase CLI instalado (`npm i -g supabase` ou via Homebrew).
- Docker rodando localmente.

## Como executar

```bash
supabase start          # sobe o stack local (uma vez)
npm run test:db         # executa todos os arquivos *.test.sql
```

## Convenção

- Um arquivo por área crítica, numerado: `NNN_nome.test.sql`.
- Cada teste deve abrir uma transação, chamar `plan(N)`, declarar fixtures,
  rodar asserts e terminar com `ROLLBACK` — testes não deixam resíduo.

## Testes implementados (esqueleto)

| # | Arquivo | Cobertura |
|---|---|---|
| 001 | `001_parcelas_residuo.test.sql` | Geração de parcelas com resíduo de centavos |
| 002 | `002_baixa_lote.test.sql` | Baixa em lote (total/parcial/idempotência) |
| 003 | `003_estoque_ajuste.test.sql` | `ajustar_estoque_manual` e guard de saldo negativo |
| 004 | `004_confirmar_nota.test.sql` | Confirmação fiscal e idempotência |
| 005 | `005_orcamento_publico.test.sql` | RPC `get_orcamento_publico` |

> Os arquivos contêm fixtures mínimas e asserts de exemplo — antes de
> executar pela primeira vez, ajuste os nomes exatos das RPCs/colunas
> conforme o schema atual (alguns RPCs evoluíram desde o draft).