# 21 · Bounded Contexts

Nove contextos delimitam o domínio fiscal. Cada contexto tem **um dono lógico**,
um vocabulário próprio (ubiquitous language) e integra com os demais apenas via
eventos ou contratos publicados.

```text
                      ┌───────────────────────┐
                      │  Configuração Fiscal  │◄────── emissor, série,
                      │  (empresa_config,     │        ambiente vigente,
                      │   fiscal_runtime_cfg) │        matriz_fiscal
                      └──────────┬────────────┘
                                 │ publica cfg
   ┌───────────────┐             ▼            ┌────────────────────┐
   │ Certificados  │────► Documentos Fiscais ◄────── Eventos
   │ (A1 + Vault + │      (NF-e, NFC-e, CT-e, │      (cancel, CCe,
   │  metadata)    │       MDF-e, NFS-e)      │       inutil., manif)
   └──────┬────────┘             │            └─────────┬──────────┘
          │ fornece assinatura   │ solicita              │
          ▼                      ▼                       ▼
   ┌──────────────────────────────────────────────────────────┐
   │                Comunicação SEFAZ                          │
   │        (SOAP, XML, XSD, mTLS, Endpoint Registry)          │
   └──────────────────────────────────────────────────────────┘
                                 │
          ┌──────────────────────┼──────────────────────┐
          ▼                      ▼                      ▼
   ┌─────────────┐       ┌───────────────┐      ┌──────────────┐
   │ Distribuição│       │ Manifestação  │      │  Auditoria   │
   │    DF-e     │──────►│ Destinatário  │      │ (fiscal_     │
   │             │       │               │      │  auditoria)  │
   └─────────────┘       └───────────────┘      └──────────────┘
                                 │
                                 ▼
                        ┌──────────────────┐
                        │  Monitoramento   │
                        │ (telemetria +    │
                        │  cron health)    │
                        └──────────────────┘
```

## Ficha por contexto

### 1. Configuração Fiscal
- **Responsabilidade**: manter dados do emissor (CNPJ, IE, CRT, regime), série,
  numeração, ambiente vigente, política de retry, timeouts, contingência.
- **Fronteira**: **não conhece** SEFAZ nem certificado; só configuração.
- **Publica**: `EmpresaFiscalConfigurada`, `AmbienteAlterado`, `SerieRotacionada`.
- **Consome**: nada.
- **Owner de dados**: `empresa_config`, `fiscal_runtime_config`, `matriz_fiscal`, `naturezas_operacao`.

### 2. Certificados
- **Responsabilidade**: ciclo de vida do certificado A1 (upload, parse, storage, rotação, expiração, alerta 30d).
- **Fronteira**: **nunca** valida XML nem faz assinatura por conta própria; expõe a matéria-prima (bytes + senha) para o Signature Engine.
- **Publica**: `CertificadoCarregado`, `CertificadoProximoDoVencimento`, `CertificadoExpirado`, `CertificadoRemovido`.
- **Consome**: nada.
- **Owner de dados**: bucket `dbavizee/certificados/{empresaId}/empresa.pfx`, Vault `CERTIFICADO_PFX_SENHA__{empresaId}`, `fiscal_certificado_metadata` (opcional).

### 3. Documentos Fiscais
- **Responsabilidade**: modelar cada documento (NF-e, NFC-e, CT-e, MDF-e, NFS-e), serializar XML, autorizar, consultar, persistir.
- **Fronteira**: não gerencia eventos após autorização (dono é `Eventos`); não faz DF-e.
- **Publica**: `DocumentoSerializado`, `DocumentoAssinado`, `DocumentoAutorizado`, `DocumentoRejeitado`, `DocumentoDenegado`.
- **Consome**: `EmpresaFiscalConfigurada`, `CertificadoCarregado`.
- **Owner de dados**: `notas_fiscais`, `notas_fiscais_itens`, `nota_fiscal_anexos`, `inutilizacoes_numeracao`.

### 4. Eventos
- **Responsabilidade**: cancelamento, CCe, inutilização (fora de sequência é falha), manifestação do destinatário.
- **Fronteira**: aplica-se **após** existir chave de acesso (própria ou de terceiros para manifestação).
- **Publica**: `CancelamentoAutorizado`, `CCeRegistrada`, `ManifestacaoConfirmada`, `InutilizacaoAutorizada`.
- **Consome**: `DocumentoAutorizado`, `DFeRecebido`.
- **Owner de dados**: `nota_fiscal_eventos`, `eventos_fiscais`.

### 5. Comunicação SEFAZ
- **Responsabilidade**: transporte SOAP+mTLS, resolução de endpoint, seleção de contingência, C14N, assinatura XMLDSig, validação XSD, timeouts, circuit breaker.
- **Fronteira**: agnóstica ao documento — só entende `SoapOperationDescriptor` e bytes.
- **Publica**: `SefazRequisitado`, `SefazRespondeu`, `SefazTimeout`, `SefazIndisponivel`.
- **Consome**: nada (é infra pura, chamada pelos outros contextos).
- **Owner de dados**: `fiscal_endpoints`, `fiscal_schemas_pl`.

### 6. Distribuição DF-e
- **Responsabilidade**: buscar notas emitidas contra o CNPJ, incrementar NSU, decodificar docZip, persistir sem duplicar.
- **Fronteira**: **não** faz manifestação automaticamente (é opt-in via `fiscal_runtime_config.sync_auto_ciencia`).
- **Publica**: `DFeSincronizado`, `DFeRecebido`, `DFeNSUAvancado`.
- **Consome**: `EmpresaFiscalConfigurada`, `CertificadoCarregado`.
- **Owner de dados**: `nfe_distribuicao`, `nfe_distribuicao_itens`, `nfe_distdfe_sync`.

### 7. Manifestação do Destinatário
- **Responsabilidade**: ciência, confirmação, desconhecimento, operação não realizada.
- **Fronteira**: opera sobre chave de terceiros; separada de `Eventos` porque tem regras próprias de prazo (135/180 dias) e semântica de negócio.
- **Publica**: `ManifestacaoRegistrada`.
- **Consome**: `DFeRecebido`.
- **Owner de dados**: `nota_fiscal_eventos` (compartilhado com Eventos, distinguido por `tp_evento` 210200–210240).

### 8. Auditoria
- **Responsabilidade**: rastro imutável de toda comunicação fiscal (5 anos legais).
- **Fronteira**: **write-only** para os demais contextos; leitura restrita a `fiscal:auditoria`.
- **Publica**: nada (é sink terminal).
- **Consome**: todos os eventos acima.
- **Owner de dados**: `fiscal_auditoria`.

### 9. Monitoramento
- **Responsabilidade**: telemetria agregada, saúde dos crons, alertas de certificado, alertas de SEFAZ indisponível.
- **Fronteira**: agrega; **não modifica** dados operacionais.
- **Publica**: `AlertaFiscalDisparado`.
- **Consome**: eventos de todos os contextos + `cron_health`.
- **Owner de dados**: `fiscal_telemetria`, `cron_health` (reusa).

## Contract Map (ACL entre contextos)

| De → Para | Tipo | Payload |
|---|---|---|
| Documentos → Comunicação | Command | `{ envelope, descriptor, ctx }` |
| Comunicação → Documentos | Result | `{ status, cstat, protocolo?, xmotivo }` |
| Documentos → Eventos | Event | `DocumentoAutorizado{ chave, protocolo, empresaId }` |
| DF-e → Manifestação | Event | `DFeRecebido{ chave, cnpjEmitente, empresaId }` |
| Qualquer → Auditoria | Command | `RegistrarRastro{ correlationId, operacao, request_hash, response }` |
| Qualquer → Monitoramento | Event | `MetricaEmitida{ nome, valor, tags }` |

**Regra**: entre contextos só trafega **DTO conceitual** (não entidade). Cada
contexto pode ter sua própria representação interna sem contaminar os demais.