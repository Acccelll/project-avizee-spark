# ADR-010 · Nove bounded contexts fiscais

**Status**: Aceito · **Data**: 2026-07-13 · **Etapa**: 2

## Contexto
"Fiscal" como monólito conceitual concentra decisões conflitantes. Preciso de fronteiras claras.

## Decisão
Nove contextos: Configuração Fiscal · Certificados · Documentos Fiscais · Eventos · Comunicação SEFAZ · Distribuição DF-e · Manifestação · Auditoria · Monitoramento. Detalhados no doc 21.

## Consequências
- **+** Owner claro de dado por contexto.
- **+** Contratos entre contextos usam DTOs conceituais + eventos, evita entidade compartilhada.
- **−** Sobreposição entre `Eventos` e `Manifestação` (ambos escrevem em `nota_fiscal_eventos`) — resolvida por `tp_evento` como discriminador.