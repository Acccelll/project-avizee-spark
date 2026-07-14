---
name: fiscal-framework/platform
description: Fiscal Platform — arquitetura de plugins, registries e SDK para novos documentos fiscais (Etapa 13)
type: feature
---

# Fiscal Platform (Etapa 13)

Módulo `src/modules/fiscal/platform/` é o **núcleo agnóstico** do Framework Fiscal.

## Regras invioláveis
- Nenhuma regra específica de documento (NF-e, NFC-e, CT-e, ...) pode residir em `platform/`.
- Novos documentos fiscais são **plugins** implementando `PluginDocumentoFiscal` e devem usar apenas o SDK (`platform/sdk`).
- Registro/descoberta obrigatórios via `FiscalPlatform.use()` ou `discover()`; nunca acoplar módulos entre si.
- NF-e continua vivendo em `src/modules/fiscal/nfe/`. O adapter é `nfe/plugin.ts` — não mover código da NF-e para dentro de `platform/`.
- Comunicação SEFAZ continua pelo canal único `sefaz-proxy` (integrações são registradas, mas o transporte é o mesmo).
- Toda regra tributária passa pelo Compliance Engine (Etapa 12).

## Template
`platform/template/` contém `README.md` (guia oficial) e `exemplo-fdoc.plugin.ts` (plugin fictício "F-Doc" usado para provar extensibilidade nos testes).

## Testes
`platform/__tests__/platform.test.ts` cobre: coexistência NF-e + F-Doc, descoberta por capacidade, versionamento de layouts, workflow com compensação, cache de integrações e validadores agregados.
