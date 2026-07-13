# 29 · Comunicação com a SEFAZ

## Pilha de comunicação

```
APP → ENG.soap.envelopar
    → ENG.signature.sign (se ainda não assinado)
    → CROSS.endpoint.resolve
    → CROSS.circuit_breaker.permitir
    → ENG.transport.send (mTLS)
        └── se destino=AN → adapter externo proxy mTLS
    → CROSS.audit.registrar
    → DOM.parseRetorno
```

## Certificado A1

- **Armazenamento**: bucket `dbavizee/certificados/{empresaId}/empresa.pfx` (v2 multi-tenant).
- **Senha**: Supabase Vault (`CERTIFICADO_PFX_SENHA__{empresaId}`) — nunca em coluna nem em env.
- **Extração**: helper `supabase/functions/_shared/pfx.ts` (leaf-detection para escolher a folha correta em cadeias com múltiplos certs).
- **Cache**: in-memory por invocação de edge (edges são stateless).
- **Rotação**: upload substitui `.pfx` → invalida cache no próximo request; alerta 30d antes da validade; alerta crítico 7d.
- **Nunca A3 em v1**: PKCS#11 exige runtime nativo não disponível em Deno edge.

## Assinatura digital (XMLDSig enveloped)

- **Algoritmo default**: RSA-SHA1 (obrigatório SEFAZ v4.00).
- **`SignatureSuite` ágil**: RSA-SHA256 pronto — feature flag `fiscal:v2:sign-sha256` habilita quando NT SEFAZ permitir.
- **C14N**: implementação própria em TS (ADR-002) — Exclusive C14N 1.0 com namespaces herdados, xml:space preservado, ordenação canônica.
- **Regras**:
  - Assinatura injetada como irmão do elemento referenciado, não filho.
  - `Reference URI="#Id"` — Id do elemento (`infNFe`, `infEvento`, `infInut`).
  - Um `Signature` por elemento.
  - Cadeia de certificação incluída em `<KeyInfo><X509Data>`.
- **Validação**: `ENG.signature.validate` verifica digest + assinatura + integridade do XML pré-envio (defensivo).

## SOAP 1.2

- **Envelope genérico**: `soap12:Envelope/Header/Body`.
- **`SoapOperationDescriptor`**:
  ```
  { serviceNamespace, dataElementName, soapAction?, operationElementName? }
  ```
- **Single-wrapper** (estadual): `Body/nfeDadosMsg/<xml>`.
- **Double-wrapper** (Ambiente Nacional): `Body/nfeDistDFeInteresse/nfeDadosMsg/<xml>`.
- **SOAPAction**: incluída quando o autorizador exige (varia por UF).
- **Content-Type**: `application/soap+xml; charset=utf-8; action="<action>"`.

## XML

- **Encoding**: UTF-8, sem BOM.
- **Sem `<?xml?>` embutido**: SEFAZ rejeita se presente em elementos aninhados.
- **Modelo intermediário `XmlNode`**: writer determinístico — ordem canônica de atributos garantida.
- **Namespaces**: `nfe = http://www.portalfiscal.inf.br/nfe`, `ds = http://www.w3.org/2000/09/xmldsig#`.

## XSD

- **Fonte**: bucket `dbavizee/fiscal/schemas/PL_{codigo}_v{versao}/*.xsd`.
- **Registro**: `fiscal_schemas_pl` associa `(documento, versao_pl, vigencia)`.
- **Aplicação**: opcional — se XSD ausente, valida-se apenas contra regras de domínio + resposta SEFAZ. Não bloqueia envio.
- **PLs suportados**: PL_010 (NF-e 4.00) obrigatório; futuros conforme SEFAZ publicar.

## Ambientes

- **`homologacao`**: URLs SEFAZ de homologação em `fiscal_endpoints`. NF de homologação carrega item obrigatório "NOTA FISCAL EMITIDA EM AMBIENTE DE HOMOLOGAÇÃO - SEM VALOR FISCAL" no primeiro item.
- **`producao`**: URLs de produção. `empresa_config.ambiente_padrao` define default; ERP permite override por operação com `fiscal:admin`.
- **Isolamento**: numeração, chaves e certificados **não** cruzam ambientes. Chave de homologação começa com `21` no dígito X (verificar spec) — não confundível com produção.

## Contingência

### Modos suportados (roadmap)
| Modo | Descrição | v1 |
|---|---|---|
| **SVC-AN** | Serviço Virtual de Contingência AN (autorização normal por outro autorizador) | planejado v1.1 |
| **SVC-RS** | Alternativo SVC-AN | planejado v1.1 |
| **EPEC** | Evento Prévio de Emissão em Contingência | v2 |
| **FS-DA** | Formulário de Segurança (manual, papel) | não automatizável |
| **Offline NFC-e** | emissão local + transmissão diferida | escopo NFC-e |

### Decisão automática (`fiscal-contingency-manager`)
```
se status-serviço da UF cStat ≠ 107 por > 5 min:
  se documento = NFe: sugerir SVC-AN
  se documento = NFCe: ativar offline com DPEC pendente
se autorizador principal 500/timeout persistente:
  circuit breaker abre → sugere contingência ao operador (não ativa sozinho — decisão fiscal do usuário)
```

Ativação é **explícita** por usuário com `fiscal:admin` — nunca automática (risco fiscal).

## Retry

- **Onde**: **exclusivamente** no orquestrador (Application Layer / consumidor de fila). Nunca no Transport.
- **Backoff**: exponencial com jitter — `min(60 * 2^tentativa, 3600) + random(0..30)` segundos.
- **Tetos**: 10 tentativas para autorização/eventos; ilimitado para DFe (com backoff longo até 1h).
- **Não retry**: rejeições (cstat de negócio), denegações, XSD inválido, endpoint não cadastrado.

## Timeout

| Operação | Timeout default | Ajustável |
|---|---|---|
| statusServico | 8s | via `fiscal_runtime_config` |
| autorizar | 30s | idem |
| retAutorizacao | 15s | idem |
| consultarProtocolo | 15s | idem |
| recepcaoEvento | 20s | idem |
| distDFeInt | 60s | idem |

Timeout dispara `SefazTimeout` (retryable).

## Circuit Breaker

- **Chave**: `(uf, ambiente, servico)`.
- **Threshold**: 5 falhas consecutivas em 60s → abre.
- **Half-open**: após 60s, permite 1 request de teste (status-serviço).
- **Fecha**: cStat=107 → drena fila de retry.
- **Estado**: in-memory por invocação + tabela opcional `fiscal_circuit_state` para persistir entre invocações (backlog Etapa 3).

## Cache

| O que | TTL | Onde |
|---|---|---|
| Endpoint resolvido | 5 min | in-memory por invocação |
| Status serviço (cstat=107) | 3 min | in-memory + tabela opcional |
| Certificado parseado | vida da invocação | in-memory |
| PLs XSD | 30 min | in-memory (bytes ficam no bucket) |

Nada crítico é cacheado além da invocação (edges stateless — segurança).

## Monitoramento (métricas mínimas)

Emitidas a cada operação:
- `fiscal.request.duracao_ms` (histogram) — labels: `uf, ambiente, servico, documento`.
- `fiscal.request.total` (counter) — labels: idem + `cstat`.
- `fiscal.request.erro` (counter) — labels: idem + `categoria`.
- `fiscal.breaker.state` (gauge) — 0/1/2 (closed/open/half).
- `fiscal.cert.dias_restantes` (gauge) — por empresa.
- `fiscal.queue.lag_seg` (gauge) — por fila.

Backend: `fiscal_telemetria` + `cron_health` (já existentes) + dashboards em `/admin/health` (parcial hoje, ampliar).

## Observabilidade

- Correlation-id fim-a-fim (doc 23).
- Logs estruturados via `_shared/logger.ts` (nunca `console.*`).
- Mascaramento CNPJ/CPF em nível info; completo em debug.
- XML nunca logado inteiro; hash SHA-256 + tamanho.
- Traços (`x-trace-id` — futuro, aguarda OTLP export).

## Decisões-chave (justificativas)

| Decisão | Justificativa |
|---|---|
| Retry só no orquestrador | Facilita observabilidade, evita double-request quando timeout é falso |
| Contingência não automática | Decisão fiscal do usuário; ativar sozinho gera notas em modo errado |
| C14N própria | ADR-002; libs npm em Deno instáveis para spec XMLDSig SEFAZ |
| Ambiente sem default | ADR-001 força consciência; erro pego cedo |
| Cache com TTL curto | Segurança > performance; volumes atuais toleram |
| mTLS via proxy externo p/ AN | `mem/tech/sefaz-mtls-transporte.md` — limitação Deno/rustls confirmada |