# ADR-009 · Arquitetura em 6 camadas explícitas

**Status**: Aceito · **Data**: 2026-07-13 · **Etapa**: 2

## Contexto
Preciso de uma organização que permita testar Domain sem Deno/Supabase, trocar
transport sem mexer em UI e adicionar novos documentos sem tocar orquestração.

## Decisão
Adotar 6 camadas: **ERP → Fiscal Module (fachada) → Application → Domain → Infrastructure → External Services**. Dependência estritamente descendente.

## Consequências
- **+** Testabilidade do Domain sem edge.
- **+** Substituição de transport (proxy externo, mudança futura para outro provider) não afeta Application nem Domain.
- **+** Novos documentos entram como plugin no Domain.
- **−** Overhead de indireção para operações simples — aceitável dado o crescimento previsto.

## Rejeitados
- **Hexagonal puro** (léxico): ruído sem ganho.
- **CQRS + Event Sourcing**: overkill para volume atual.
- **Microserviços por documento**: custo operacional alto em Deno edge.

Substitui/refina o doc 06 da Etapa 1.