# Framework Fiscal AVIZEE — Etapa 3 · Especificação Técnica e Funcional

Etapas 1 e 2 concluídas. Esta etapa transforma a arquitetura em **especificação
técnica exaustiva** pronta para implementação. Continua sem código, sem
migrations, sem alteração de funcionalidade.

| # | Documento | Objetivo |
|---|-----------|----------|
| 40 | [Especificação funcional](40-especificacao-funcional.md) | Cada funcionalidade com objetivo, fluxos, dependências, eventos, regras |
| 41 | [Regras de negócio](41-regras-de-negocio.md) | Catálogo numerado RN-XXX de todas as regras |
| 42 | [Modelo de dados detalhado](42-modelo-dados-detalhado.md) | Cada entidade com campos, índices, retenção, auditoria |
| 43 | [Catálogo de APIs](43-catalogo-apis.md) | Toda API com recursos, params, respostas, erros, rate limit |
| 44 | [Catálogo de eventos](44-catalogo-eventos.md) | Nome, produtor, payload, consumidores, semântica |
| 45 | [Máquinas de estado](45-maquinas-de-estado.md) | Documento, evento, certificado, fila, processamento |
| 46 | [Estratégia de filas](46-estrategia-filas.md) | Síncronas, assíncronas, DLQ, retry, backoff |
| 47 | [Estratégia de cache](47-estrategia-cache.md) | Endpoints, schemas, certificados, invalidação |
| 48 | [Estratégia de testes](48-estrategia-testes.md) | Unit, integração, contrato, E2E, fiscal, XML, SOAP, carga |
| 49 | [Casos de uso](49-casos-de-uso.md) | UC-XXX com atores, pré-cond, fluxos, exceções |
| 50 | [Matriz de rastreabilidade](50-matriz-rastreabilidade.md) | Requisito → UC → Serviço → Módulo → Entidade → API → Evento → Fluxo |
| 51 | [Análise de riscos](51-analise-riscos.md) | Riscos com probabilidade, impacto, mitigação |
| 52 | [Critérios de aceitação](52-criterios-aceitacao.md) | CA-XXX por funcionalidade, Gherkin-like |
| 53 | [Backlog técnico priorizado](53-backlog-tecnico.md) | Épicos, histórias, dependências, ordem |
| 54 | [Glossário](54-glossario.md) | Termos fiscais e técnicos canônicos |

**Observabilidade e Segurança** permanecem nos docs 30 e 32 da Etapa 2
(referência oficial). Complementos específicos desta etapa vão como seções nos
respectivos documentos acima (testes de segurança em 48, RN de segurança em 41).

## Restrições reafirmadas

- Não implementar código.
- Não criar migrations.
- Não alterar banco.
- Não criar APIs.
- Não modificar funcionalidades existentes.

Toda referência a "implementar", "executar", "criar tabela" nestes documentos é
**especificação de trabalho futuro** — nunca instrução para esta etapa.