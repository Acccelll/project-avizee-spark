---
name: Framework Fiscal — spec técnica oficial (Etapa 3)
description: Especificação exaustiva com regras RN, casos UC, critérios CA, catálogos de APIs/eventos, filas, cache, testes, riscos, backlog; consultar antes de implementar
type: reference
---
A Etapa 3 (`docs/fiscal-framework/etapa-3/`) é a **especificação de trabalho** de todo o Framework Fiscal. Consultar antes de qualquer implementação:

- **`40-especificacao-funcional.md`** — F-001..F-026 (fichas de funcionalidade).
- **`41-regras-de-negocio.md`** — RN-001..RN-910 (catálogo numerado).
- **`42-modelo-dados-detalhado.md`** — entidades, índices, retenção, particionamento.
- **`43-catalogo-apis.md`** — API-001..API-023 (endpoints, params, códigos, rate limit).
- **`44-catalogo-eventos.md`** — nomes canônicos de eventos + consumidores.
- **`45-maquinas-de-estado.md`** — documento, evento, cert, fila, breaker, contingência, idempotência.
- **`46-estrategia-filas.md`** — pgmq, backoff (tabela), DLQ, VT por fila.
- **`47-estrategia-cache.md`** — TTLs, escopos, invalidação, anti-padrões.
- **`48-estrategia-testes.md`** — pirâmide, cobertura obrigatória, testes fiscais homologação.
- **`49-casos-de-uso.md`** — UC-001..UC-035 (atores, fluxos, exceções).
- **`50-matriz-rastreabilidade.md`** — F↔UC↔Serviço↔Módulo↔Entidade↔API↔Evento↔Fluxo.
- **`51-analise-riscos.md`** — RT/RF/RI/RP/RS/RO/RR com mitigação.
- **`52-criterios-aceitacao.md`** — CA-XXX.n Gherkin-like + Definition of Done.
- **`53-backlog-tecnico.md`** — E-01..E-14, H-XXX, ordem, dependências, marcos M1..M8.
- **`54-glossario.md`** — termos canônicos e anti-termos.

ADR novo desta etapa: **ADR-017** eventos no particípio passado; comandos no imperativo.

**How to apply:** ao implementar qualquer funcionalidade fiscal, identifique F-XXX (doc 40) → UCs correspondentes (doc 49) → RNs aplicáveis (doc 41) → CAs a satisfazer (doc 52) → históricas do backlog (doc 53). Nunca aceite "resolvido" sem CAs verdes + rastro em `fiscal_auditoria` + métrica em `fiscal_telemetria`. Códigos de erro devem sair de `FISCAL.*` do doc 43. Nomes de eventos devem sair do doc 44 (particípio passado, ADR-017).