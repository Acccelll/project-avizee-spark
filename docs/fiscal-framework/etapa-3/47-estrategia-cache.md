# 47 · Estratégia de cache

**Princípio**: edges Deno são stateless — cache é in-memory por invocação (bundle vivo enquanto a instância está quente). Cache persistente só quando comprovadamente necessário.

## Escopos

### In-memory por invocação (default)
- Vive durante a execução de um request/cron.
- Zero risco cross-tenant.
- TTL implícito = duração da invocação (< 60s).

### In-memory por instância (bundle quente)
- Deno Deploy mantém instância viva minutos após último request.
- Aproveitado para dados imutáveis por período (endpoints, XSD).
- TTL explícito requerido (ex.: 5 min).

### Banco (`fiscal_cache_*` ou reuso de tabelas existentes)
- Persistente cross-invocação/instância.
- Uso restrito a caso claro (status serviço, breaker state).

### Sem Redis em v1
- Custo/complexidade não justificados.
- Reavaliar em > 100 empresas ou > 1M req/dia.

## Catálogo de caches

### Endpoints SEFAZ (`fiscal-endpoint-registry`)
- **Escopo**: in-memory por instância.
- **TTL**: 5min.
- **Invalidação**: mudança em `fiscal_endpoints` → coluna `atualizado_em`; cache verifica na primeira leitura de cada instância.
- **Sincronização**: eventual (tolerada — mudança rara e propaga em < 5min).
- **Chave**: `(documento, uf, ambiente, servico, versao)`.

### XSDs (`fiscal-schema-registry`)
- **Escopo**: in-memory por instância.
- **TTL**: 30min.
- **Invalidação**: mudança em `fiscal_schemas_pl` → nova vigência; instância só lê na primeira consulta.
- **Chave**: `(documento, versaoPL, arquivo)`.
- **Fallback**: bucket lookup se cache miss.

### Certificado A1 parseado
- **Escopo**: in-memory por invocação **apenas**.
- **Motivo**: segurança — nunca persistir bytes descriptografados entre invocações.
- **Impacto**: cada invocação parseia; parse leva ~50ms.
- **Otimização futura**: reusar via bundle-scope quando LGPD/segurança permitir; hoje não.

### Configuração da empresa (`empresa_config` + `fiscal_runtime_config`)
- **Escopo**: in-memory por invocação.
- **TTL**: invocação.
- **Motivo**: mudanças raras mas críticas (CRT, ambiente); consistência forte preferida.
- **Otimização futura**: cache por instância com invalidação via `NOTIFY` (v2).

### Status serviço SEFAZ
- **Escopo**: in-memory por instância + tabela `fiscal_status_sefaz_cache` (opcional Etapa 7).
- **TTL**: 3min in-memory; 10min banco.
- **Motivo**: reduzir carga em SEFAZ (rate limit) sem sacrificar confiabilidade.
- **Chave**: `(uf, ambiente)`.
- **Invalidação**: TTL; erro sempre bypassa cache.

### Circuit breaker state
- **Escopo**: in-memory por instância + `fiscal_circuit_state` (Etapa 7).
- **TTL**: `open` por 60s; `half-open` até resultado do teste; `closed` sem TTL.
- **Invalidação**: transição de estado imediata.

### Idempotência (`fiscal_idempotency`)
- **Escopo**: banco.
- **TTL**: 24h.
- **Invalidação**: cron limpa expirados.

### Consulta cadastro SEFAZ
- **Escopo**: banco `fiscal_consulta_cadastro_cache` (opcional).
- **TTL**: 24h.
- **Motivo**: dado de contribuinte muda pouco; economiza chamadas SEFAZ.
- **Chave**: `(uf, cnpj|ie)`.

### v_nfe_portal / v_fiscal_saude_diaria
- **Escopo**: view materializada (Etapa 6+, se performance exigir).
- **Refresh**: a cada 15min via cron.
- **TTL implícito**: janela de refresh.

## Invalidação — princípios

1. **TTL sempre** — mesmo dado "imutável" ganha TTL de segurança.
2. **Miss é aceitável** — cache miss reconsulta; nunca fallback com dado stale além do TTL.
3. **Erro nunca cacheia** — resposta 5xx/timeout não é armazenada.
4. **Chave estrita** — não usar valores parcialmente construídos; usar objetos serializados canonicamente.
5. **Cross-tenant impossível** — chaves sempre incluem `empresa_id` quando o dado é por tenant.
6. **Ambiente na chave** — `homologacao` e `producao` nunca compartilham cache.

## Sincronização entre instâncias

### Estratégia atual (v1)
- Nenhuma. Cada instância mantém sua cópia. Divergência tolerada dentro do TTL.

### Estratégia futura (v2)
- Postgres `LISTEN/NOTIFY` para invalidação cross-instância de:
  - `fiscal_endpoints`
  - `fiscal_schemas_pl`
  - `fiscal_runtime_config`
- Instâncias escutam canal `fiscal_cache_invalidation` e limpam entradas correspondentes.

## Métricas

- `fiscal.cache.hit_total` (counter) — labels: `cache`.
- `fiscal.cache.miss_total` (counter).
- `fiscal.cache.evict_total` (counter).

Ratio `hit/(hit+miss)` esperado:
- endpoints: > 99%
- XSD: > 95%
- status serviço: > 80%

## Anti-padrões

- Cachear certificado descriptografado além da invocação.
- Cachear resposta de operação escrita.
- Cache sem TTL.
- Chave que ignora `empresa_id` ou `ambiente`.
- Cachear erro.
- Cachear XML autorizado além do storage (storage é a fonte).
- Reusar cache entre `homologacao` e `producao`.