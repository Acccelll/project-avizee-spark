# Etapa 13 — Fiscal Platform (arquitetura de plugins e multi-documento)

## Objetivo

Transformar o Framework Fiscal em uma **plataforma extensível** onde novos
documentos fiscais (NFC-e, CT-e, MDF-e, BP-e, NF3-e, NFS-e, futuros) sejam
implementados como **plugins** consumindo apenas contratos públicos.

## Estrutura entregue

`src/modules/fiscal/platform/`:

```
platform/
├─ types.ts                       # Contratos genéricos (PluginDocumentoFiscal, DescritorLayout, Servico, Builder, Validador, Evento, Integracao, Workflow)
├─ platform.ts                    # FiscalPlatform + getFiscalPlatform singleton
├─ registries/
│  ├─ documentoRegistry.ts        # DocumentoRegistry (por código + capacidade)
│  ├─ layoutRegistry.ts           # PlatformLayoutRegistry (multi-versão)
│  ├─ servicoRegistry.ts          # ServicoRegistry (descoberta por nome/capacidade)
│  ├─ validadorRegistry.ts        # ValidadorRegistry (runAll agrega erros)
│  ├─ builderRegistry.ts          # BuilderRegistry (xml/json/protobuf/...)
│  ├─ eventoRegistry.ts           # EventoRegistry (fiscal/interno/integracao/auditoria)
│  ├─ integracaoRegistry.ts       # IntegracaoRegistry (adapters cacheados)
│  └─ workflowRegistry.ts         # WorkflowRegistry + WorkflowExecutor (saga)
├─ sdk/                           # definePlugin/defineLayout/defineServico/...
├─ template/
│  ├─ README.md                   # Guia oficial para novos documentos
│  └─ exemplo-fdoc.plugin.ts      # Plugin fictício "F-Doc" usado nos testes
└─ __tests__/platform.test.ts
```

## Adapter da NF-e

`src/modules/fiscal/nfe/plugin.ts` expõe a NF-e como plugin (`NFePlugin`) —
o módulo NF-e existente **não foi alterado** (compatibilidade retroativa
garantida).

## Regras arquiteturais

- **Core agnóstico**: `platform/` não referencia nenhum documento específico.
- **Descoberta**: `platform.discover([...])` carrega múltiplos plugins.
- **Coexistência**: dois documentos podem estar registrados ao mesmo tempo;
  layouts convivem em versões distintas.
- **Compensação**: `WorkflowExecutor` reverte passos executados em caso de erro.
- **Compatibilidade retroativa**: NF-e (Etapas 6–7), Recebimento (8),
  Escrituração (9), Operacional (10), Homologação (11) e Compliance (12)
  continuam intactos e são reutilizados pelos plugins.

## Como adicionar um novo documento

1. Crie `src/modules/fiscal/<codigo>/` seguindo o template.
2. Exporte um `PluginDocumentoFiscal` via `sdk.definePlugin`.
3. Registre com `platform.use(plugin)` ou `platform.discover([...])`.
4. Escreva testes de extensibilidade análogos aos de `FDocPlugin`.

Consulte o guia completo em [`template/README.md`](../../../src/modules/fiscal/platform/template/README.md).
