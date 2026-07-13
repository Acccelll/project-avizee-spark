# Framework Fiscal AVIZEE — Documentação da Etapa 1

Esta pasta concentra toda a **engenharia reversa, diagnóstico, arquitetura alvo,
ADRs, backlog e convenções** produzidos na Etapa 1 do redesenho do Framework
Fiscal do AVIZEE Spark. Nenhum código, migration, edge function ou componente
foi criado nesta etapa — apenas documentação.

A base de referência foi o projeto **FiscalFramework v0.21** (.NET, ~1.6k LoC),
que **não é copiado**: é usado exclusivamente como referência arquitetural e
funcional. O framework será reimplementado nativamente em TypeScript/Deno +
Postgres/RLS/Storage/Vault, aproveitando os padrões e evitando a dependência
de worker externo em .NET.

## Mapa dos documentos

| # | Documento | Objetivo |
|---|-----------|----------|
| 01 | [Inventário AVIZEE](01-inventario-avizee.md) | Tudo que já existe no ERP hoje na camada fiscal |
| 02 | [Inventário FiscalFramework](02-inventario-fiscalframework.md) | Estrutura completa do projeto .NET de referência |
| 03 | [Engenharia reversa do FiscalFramework](03-engenharia-reversa-fiscalframework.md) | Camadas, contratos, fluxos, C14N, XMLDSig, SOAP, Transport, EndpointRegistry, plugin de documento |
| 04 | [Diagnóstico do AVIZEE fiscal](04-diagnostico-avizee-fiscal.md) | O que funciona, o que está frágil, débitos técnicos |
| 05 | [Matriz comparativa](05-matriz-comparativa.md) | AVIZEE × FiscalFramework por capacidade |
| 06 | [Arquitetura alvo](06-arquitetura-alvo.md) | Nova arquitetura modular + diagramas |
| 07 | [Módulos e responsabilidades](07-modulos-e-responsabilidades.md) | Especificação de cada módulo |
| 08 | [Fluxos fiscais](08-fluxos-fiscais.md) | Passo a passo de todos os fluxos |
| 09 | [Integração com o ERP](09-integracao-erp.md) | Mapa por módulo do ERP |
| 10 | [Modelo de dados conceitual](10-modelo-dados-conceitual.md) | Entidades propostas (sem DDL) |
| 11 | [Segurança e certificados](11-seguranca-e-certificados.md) | Storage, Vault, mTLS, RLS, LGPD |
| 12 | [Tratamento de erros e retry](12-tratamento-erros-e-retry.md) | Taxonomia cStat, retry/backoff, contingência |
| 13 | [Logging, auditoria, observabilidade](13-logging-auditoria-observabilidade.md) | Correlação, mascaramento, sinks |
| 14 | [Preparação futura](14-preparacao-futura.md) | NF-e, NFC-e, CT-e, MDF-e, NFS-e, DF-e etc. |
| 15 | [ADRs](15-adr/) | Architecture Decision Records |
| 16 | [Riscos e premissas](16-riscos-e-premissas.md) | Limitações Deno, XSDs, SEFAZ, LGPD |
| 17 | [Oportunidades de melhoria](17-oportunidades-de-melhoria.md) | O que fica melhor que o original |
| 18 | [Backlog técnico priorizado](18-backlog-tecnico-priorizado.md) | Épicos/histórias das próximas etapas |
| 19 | [Convenções e nomenclaturas](19-convencoes-e-nomenclaturas.md) | Naming de serviços, tabelas, buckets, secrets |

## Como usar

- **Antes de qualquer implementação fiscal futura**, consulte os documentos 06, 07 e 15 (ADRs).
- **Antes de mexer em tabelas/RPCs**, consulte 10 e 11.
- **Antes de mexer em edge functions**, consulte 06, 08, 12 e 13.
- **Antes de definir o próximo sprint fiscal**, consulte 18.

A memória do Lovable (`mem/fiscal-framework/*`) resume as regras de aplicação
contínua; esta pasta é a referência longa.

## Etapa 2 · Projeto arquitetural definitivo

A Etapa 2 aprofunda e consolida a arquitetura. Índice completo em
[`etapa-2/00-INDEX.md`](etapa-2/00-INDEX.md). Novos ADRs 009–016 em
[`15-adr/`](15-adr/). Continua sem código, sem migrations, sem alteração
de funcionalidade existente.

## Restrições da Etapa 1 (reafirmadas)

- Nenhum arquivo `.ts`, `.sql`, migration, edge function, componente ou dependência foi criado/alterado.
- Nenhum arquivo em `src/`, `supabase/functions/` ou `supabase/migrations/` foi tocado.
- O framework .NET não foi copiado; apenas citado como referência.