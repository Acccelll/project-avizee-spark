# ADR-014 · Envelope de resposta padronizado (SucessoEnvelope / ErroEnvelope)

**Status**: Aceito · **Data**: 2026-07-13 · **Etapa**: 2

## Contexto
Respostas hoje têm formatos variados por edge. UI tem `if/else` proliferando.

## Decisão
Toda edge fiscal responde `SucessoEnvelope<T>` ou `ErroEnvelope` (doc 26). HTTP status reflete transporte; regra de negócio em `error.codigo`. Rejeição SEFAZ = 200 com `ok:false` + `cstat`.

## Consequências
- **+** Cliente único (`useFiscalRequest`) trata tudo.
- **+** Correlation-id sempre presente na resposta.
- **−** Requer migração das UIs consumidoras — feita em Etapa 4 sob flag.