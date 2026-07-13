# Framework Fiscal AVIZEE — Etapa 2 · Projeto Arquitetural Definitivo

A Etapa 2 transforma a análise da Etapa 1 em um **projeto arquitetural completo**
do Framework Fiscal do AVIZEE. Continua sendo **apenas documentação**: nenhum
código, migration, edge function, tabela ou API foi criado ou alterado.

A Etapa 1 permanece válida como base (`docs/fiscal-framework/00-INDEX.md`).
A Etapa 2 aprofunda, refina e consolida — não substitui.

## Documentos desta etapa

| # | Documento | Objetivo |
|---|-----------|----------|
| 20 | [Arquitetura em camadas](20-arquitetura-em-camadas.md) | Camadas ERP → Fiscal Module → Application → Domain → Infrastructure → SEFAZ |
| 21 | [Bounded contexts](21-bounded-contexts.md) | Contextos do domínio fiscal e suas fronteiras |
| 22 | [Catálogo de módulos](22-catalogo-de-modulos.md) | Módulos com responsabilidade, limites, dependências, contratos, eventos |
| 23 | [Fluxos arquiteturais](23-fluxos-arquiteturais.md) | Autorização, consulta, cancelamento, CCe, inutilização, DFe, manifestação, import/export, retry, recovery |
| 24 | [Contratos internos](24-contratos-internos.md) | Contratos entre módulos (entradas, saídas, eventos, payloads conceituais) |
| 25 | [Modelo conceitual de serviços](25-modelo-conceitual-servicos.md) | Objetivo, operações, dependências, extensões |
| 26 | [Modelo conceitual de APIs](26-modelo-conceitual-apis.md) | Finalidade, auth, versionamento, paginação, respostas, erros |
| 27 | [Modelo de dados aprofundado](27-modelo-dados-aprofundado.md) | Entidades, agregados, integridade, versionamento, soft delete, auditoria |
| 28 | [Integração com ERP](28-integracao-erp.md) | Cadastros, produtos, clientes, fornecedores, empresas/filiais, compras, vendas, estoque, financeiro, logística, relatórios, dashboard, usuários, permissões |
| 29 | [Comunicação com SEFAZ](29-comunicacao-sefaz.md) | Certificado A1, assinatura, SOAP, XML, XSD, ambientes, contingência, retry, timeout, circuit breaker, cache |
| 30 | [Segurança](30-seguranca.md) | Certificados, criptografia, segregação, Vault, LGPD, RLS, prevenção de vazamento |
| 31 | [Escalabilidade](31-escalabilidade.md) | Multi-empresa, multi-filial, filas, assíncrono, tolerância a falhas |
| 32 | [Observabilidade](32-observabilidade.md) | Logs estruturados, métricas, tracing, auditoria, alertas |
| 33 | [Extensibilidade](33-extensibilidade.md) | Roadmap NFC-e, CT-e, MDF-e, NFS-e, SAT, SPED, EFD-Reinf, eSocial, integrações estaduais/municipais |
| 34 | [ADRs Etapa 2](15-adr/) | ADR-009 a ADR-016 (novas decisões) |
| 35 | [Roadmap arquitetural](35-roadmap-arquitetural.md) | Ordem das próximas etapas de implementação |

## Restrições reafirmadas

- Não implementar código.
- Não criar migrations.
- Não alterar banco.
- Não criar APIs.
- Não modificar funcionalidades existentes.

## Consolidação

Ao término desta etapa, os documentos aqui listados, somados aos da Etapa 1
e às memórias em `mem/fiscal-framework/`, constituem a **referência oficial**
de todas as próximas etapas de implementação. Divergências futuras exigem
novo ADR (`ADR-XXX-supersedes-ADR-YYY.md`).