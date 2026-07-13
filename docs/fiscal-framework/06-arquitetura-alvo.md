# 06 · Arquitetura alvo do Framework Fiscal AVIZEE

## Princípios

1. **Nativo Lovable Cloud** — TypeScript nas edges (Deno), Postgres/RLS,
   Storage, Vault. Sem worker externo, sem host .NET.
2. **Camadas com dependência estrita** — Modules → Engines → Foundation.
3. **Dados, não código** — endpoints, SOAP descriptors, XSDs, políticas de
   retry são dados versionados.
4. **Plugin por documento** — Core não conhece NF-e, CT-e, MDF-e etc.;
   cada um é um módulo com contrato uniforme.
5. **Idempotência first-class** — toda operação é retryable sem duplicar.
6. **Multi-empresa preparado** — `empresa_id` em todos os contratos e RLS.
7. **Testabilidade offline** — transport, clock e cert providers são
   substituíveis por fakes.
8. **Sem exceções para fluxo de negócio** — `FiscalResult<T>` (ok/erro tipado).

## Diagrama de camadas

```text
┌────────────────────────────────────────────────────────────────────┐
│                    FRONTEND (React / Vite)                         │
│  src/pages/fiscal/*   ─▶  src/services/fiscal/* (fachada fina)     │
└──────────────────────────────────┬─────────────────────────────────┘
                                   │  invoke edge / RPC
┌──────────────────────────────────▼─────────────────────────────────┐
│                    INTEGRATION LAYER (edges)                        │
│  fiscal-nfe  ·  fiscal-events  ·  fiscal-dfe  ·  fiscal-cert       │
│  (edge functions Deno; validação Zod; correlation-id; auth JWT)    │
└──────────────────────────────────┬─────────────────────────────────┘
                                   │
┌──────────────────────────────────▼─────────────────────────────────┐
│                        FISCAL RUNTIME (TS)                          │
│  createFiscalRuntime({ empresaId, ambiente, uf, cert, endpoints }) │
│  → runtime.nfe / runtime.eventos / runtime.dfe / runtime.status    │
└───┬──────────────┬─────────────┬──────────────┬────────────┬──────┘
    │              │             │              │            │
┌───▼────┐   ┌─────▼────┐  ┌─────▼─────┐  ┌────▼─────┐  ┌──▼──────┐
│Modules │   │ Protocol │  │Authorization│  │DistDFe  │  │Manif./  │
│ NFe    │   │ Manager  │  │Consultation │  │Import   │  │Eventos  │
│(NFCe,  │   │(sync/    │  │             │  │Export   │  │         │
│ CTe,   │   │ async)   │  │             │  │         │  │         │
│ MDFe,  │   └────┬─────┘  └─────┬──────┘  └────┬────┘  └────┬─────┘
│ NFSe)  │        └────┬─────────┴──────────────┴────────────┘
└────────┘             │
                       │
       ┌───────────────┴──────────────────┐
       │                                  │
  ┌────▼──────┐                    ┌──────▼──────┐
  │ Xml Engine│                    │Signature Eng│
  │  writer   │                    │ XMLDSig +   │
  │  C14N 1.0 │                    │ SigSuite    │
  └────┬──────┘                    └──────┬──────┘
       │                                  │
       └────────────────┬─────────────────┘
                        │
                 ┌──────▼────────┐
                 │Schema Validator│  (XSDs em Storage)
                 └──────┬─────────┘
                        │
                 ┌──────▼─────────┐
                 │  SOAP Client   │  (envelope 1.2 + descritor)
                 └──────┬─────────┘
                        │
                 ┌──────▼─────────┐
                 │   Transport    │  (fetch + Deno TLS + mTLS)
                 └──────┬─────────┘
                        │
                 ┌──────▼─────────────────┐
                 │  Endpoint Registry     │  (tabela fiscal_endpoints)
                 └────────────────────────┘

CROSS-CUTTING (todos usam):
  Certificate Manager · Fiscal Clock · Logger · Audit ·
  Queue Manager (pgmq) · Cache Manager · Idempotency Store
```

## Fluxo de dependência (regra)

```
Frontend ──▶ Services (fachada) ──▶ Edge Functions ──▶ Runtime
  Runtime ──▶ Modules ──▶ Engines ──▶ Foundation
  Runtime ──▶ Cross-cutting (Cert, Clock, Logger, Audit, Queue, Cache)
```

**Frontend nunca fala com SEFAZ direto.** **Modules nunca conhecem SEFAZ URLs
específicas** (resolvem via `EndpointRegistry`). **Engines nunca conhecem
documentos** (NF-e, CT-e etc.).

## Superfície pública

```ts
// pseudo-código de referência (NÃO implementar nesta etapa)
const runtime = createFiscalRuntime({
  empresaId,
  ambiente: 'homologacao' | 'producao',
  uf: 'SP',
  certificado: CertificateProvider.fromStorage(empresaId),
  endpoints: EndpointRegistry.fromDb(),
  clock: FiscalClock.system(),
  logger: fiscalLogger(correlationId),
});

// NF-e
const r = await runtime.nfe.autorizar(nota);          // FiscalResult<Protocolo>
await runtime.nfe.consultarSituacao(chave);
await runtime.nfe.cancelar(chave, protocolo, justificativa);
await runtime.nfe.cartaCorrecao(chave, correcao, nSeq);
await runtime.nfe.inutilizar({ ano, serie, nInicial, nFinal, justificativa });

// Eventos / manifestação
await runtime.eventos.ciencia(chave);
await runtime.eventos.confirmacao(chave);
await runtime.eventos.desconhecimento(chave);
await runtime.eventos.naoRealizada(chave, justificativa);

// Distribuição DF-e
await runtime.dfe.sync(empresaId);                    // usa cursor NSU
await runtime.dfe.download(chave);

// Infra
await runtime.status.consultar();
```

## Deploy topológico

```text
┌────────────┐   HTTPS   ┌──────────────────┐   mTLS SOAP   ┌──────────┐
│  Frontend  ├──────────▶│  Edge Functions  ├──────────────▶│  SEFAZ   │
│  (React)   │           │  (Deno + Runtime)│               │(estadual/│
└────────────┘           └────────┬─────────┘               │   AN)    │
                                  │                          └──────────┘
                                  │  postgres
                         ┌────────▼─────────┐
                         │  Lovable Cloud   │
                         │  (Postgres/RLS,  │
                         │   Storage, Vault,│
                         │   pgmq, cron)    │
                         └──────────────────┘
```

Nenhum componente fora do Lovable Cloud. Nenhuma máquina extra para agendar.

## Preparação para o futuro (previsto na arquitetura, não implementado na v1)

- **Módulos**: NFC-e, CT-e, MDF-e, NFS-e — plugam via `IFiscalDocumentModule`.
- **Contingência**: EPEC / FS-DA / SVC — política declarativa no `Protocol Manager`.
- **SPED / EFD**: consumidor da mesma base fiscal, sem tocar no motor.
- **DANFE/DACTE/DAMDFE**: renderizadores desacoplados do motor.
- **Multi-empresa completo**: `empresa_id` em contratos → RLS pronta.
- **A3/PKCS#11**: provider alternativo `CertificateProvider.fromPkcs11(...)`.
- **SignatureSuite RSA-SHA256**: já contemplada; ativação por config.

## O que fica fora do runtime (por decisão)

- **Persistência de notas**: responsabilidade das tabelas do ERP (`notas_fiscais` etc.). O runtime devolve `FiscalResult<T>`; quem chama persiste. (Segue ADR-08 do framework, adaptado.)
- **Renderização DANFE**: serviço separado (`danfe.service.ts` já existe).
- **Numeração**: RPC `proximo_numero_nfe` (SEQUENCE) continua responsabilidade do ERP.
- **UI**: totalmente no frontend, chama o runtime via edge.