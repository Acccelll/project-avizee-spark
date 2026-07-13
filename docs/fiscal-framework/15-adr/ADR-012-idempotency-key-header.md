# ADR-012 · Idempotency-Key em APIs escritas

**Status**: Aceito · **Data**: 2026-07-13 · **Etapa**: 2

## Contexto
Cliente pode reenviar requisição por timeout/erro de rede. Sem chave de idempotência, corremos risco de duplicidade além do que UNIQUE cobre.

## Decisão
Header opcional `Idempotency-Key` (obrigatório para chamadas via API externa). Tabela `fiscal_idempotency (empresa_id, key)` armazena hash de resposta por 24h. Conflito devolve 409.

## Consequências
- **+** Retry seguro sem duplicar operação.
- **+** Detecta cliente com bug repetindo com payloads distintos.
- **−** Uma tabela extra + limpeza periódica.