# ADR-017 · Nomenclatura de eventos no particípio passado (fatos)

**Status**: Aceito · **Data**: 2026-07-13 · **Etapa**: 3

## Contexto
Padronizar nomes de eventos entre docs 24 (Etapa 2) e 44 (Etapa 3) — havia risco de aparecerem variantes tipo `AutorizarDocumento` (imperativo, sugere comando) misturadas com `DocumentoAutorizado` (fato).

## Decisão
Eventos são **fatos passados**: `SubstantivoParticípio` em português (`DocumentoAutorizado`, `CertificadoCarregado`, `EventoRegistrado`, `FilaProcessada`). Comandos usam imperativo (`AutorizarNFe`, `CancelarNota`). Nunca misturar.

## Consequências
- **+** Leitor distingue fato de intenção sem context switch.
- **+** Consumidor sabe que só pode reagir (não ordenar).
- **−** Nomenclatura em português apenas; código em inglês (tipos TS) usa mesma raiz (`DocumentoAutorizadoEvent`).