---
name: fiscal-framework/compliance
description: Compliance Engine, versionamento legal, Reforma Tributária e motor tributário abstrato (Etapa 12)
type: feature
---

# Compliance Engine (Etapa 12)

Módulo `src/modules/fiscal/compliance/` implementa a governança contínua do Framework Fiscal.

## Regras invioláveis
- Nenhum tributo pode ser hard-coded — sempre passar pelo `TributoRegistry` com `TributoDefinicao` e vigência.
- Nenhuma alíquota ou base de cálculo fica em código: usar `MotorTributarioAbstrato` + `Calculador` parametrizado.
- Toda mudança de configuração fiscal passa por `GovernancaConfiguracoesService.registrar` (gera versão, autor, aprovação, vigência).
- Reforma Tributária (IBS/CBS/IS) **coexiste** com o modelo atual (ICMS/IPI/PIS/COFINS/ISS); nunca substituir — controlar pelo `ReformaTributariaService.contextoTransicao`.
- Toda atualização de layout/XSD/endpoint passa pelo `CentroAtualizacoesService.preValidar` antes do `aplicar`.
- Migrações fiscais executam via `MigracaoRunner` para garantir rollback automático em caso de erro.

## Eventos
Prefixo `fiscal.compliance.*` — declarados em `FiscalEventBus`.

## Roadmap
`ROADMAP_PADRAO` em `application/roadmap.ts` é a fonte de verdade para próximos documentos/obrigações (NFC-e, CT-e, MDF-e, NFS-e, BP-e, NF3-e, SPED, EFD-Reinf, eSocial, Reforma Tributária).
