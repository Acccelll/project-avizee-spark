# 24 · Contratos internos entre módulos

Contratos **conceituais** (não implementação). Notação pseudo-TS por clareza,
sem compromisso com nomes finais em código.

## Fachada → Application

```
CommandAutorizarNFe {
  empresaId: UUID
  ambiente: 'homologacao' | 'producao'
  nota: NotaFiscalDTO       // já preenchida pelo ERP
  correlationId: string
  ator: UUID                 // auth.uid
}

ResultAutorizacao =
  | { ok: true; chave; protocolo; dhAutorizacao; xmlPath }
  | { ok: false; categoria; cstat?; xmotivo?; violacoesXsd?; recuperavel: boolean }
```

Análogo para `CommandCancelar`, `CommandCCe`, `CommandInutilizar`,
`CommandManifestar`, `CommandSincronizarDFe`, `CommandBaixarPorChave`,
`CommandImportarXml`, `CommandExportarXml`.

## Application → Domain Module

```
SerializeInput   { nota: NotaFiscalDTO, versao: '4.00' }
SerializeOutput  { xml: string, chave: ChaveAcesso }

SignInput        { xml: string, elementId: string, cert: Certificate, suite?: SignatureSuite }
SignOutput       { xmlAssinado: string }

ValidateInput    { xml: string, documento: 'NFe'|'NFCe'|..., versaoPL: string }
ValidateOutput   { violacoes: string[] }  // vazio = ok

ParseRetornoInput  { xmlResposta: string, operacao: ServicoFiscal }
ParseRetornoOutput { cstat: string; xmotivo: string; protocolo?: string; nRec?: string; dhResp: Date; recuperavel: boolean }
```

## Application → Comunicação SEFAZ

```
SefazEnviarInput {
  documento: 'NFe'|'NFCe'|...
  ctx: FiscalContext          // { empresaId, uf, ambiente, tipoEmissao }
  servico: ServicoFiscal
  descriptor: SoapOperationDescriptor
  body: string                // XML assinado
  timeoutMs?: number
  correlationId: string
}

SefazEnviarOutput {
  status: number
  body: string                // XML resposta
  contentType: string
  duracaoMs: number
  endpointUrl: string         // usado para auditoria
}
```

## Certificate Manager → Signature Engine

```
Certificate {
  cert: Uint8Array            // DER/PEM
  key: Uint8Array
  cnpjTitular: string
  validadeInicio: Date
  validadeFim: Date
  serial: string
  subjectCN: string
}
```

O Signature Engine **nunca** persiste `Certificate`; usa e descarta na mesma
invocação da edge.

## Endpoint Registry → qualquer chamador

```
EndpointQuery { documento, uf, ambiente, servico, versao }
EndpointRow   { url, versao, atualizadoEm, fonte }

resolve(EndpointQuery) → EndpointRow | throws EndpointNaoCadastrado
```

`EndpointNaoCadastrado` é **prescritivo**: mensagem inclui exatamente qual
linha faltando e como cadastrar (`INSERT INTO fiscal_endpoints...`).

## Queue Manager → consumidores

```
QueueMessage<T> {
  msgId: bigint
  visibilityTimeout: number
  payload: T
  readCt: number
  enqueuedAt: Date
}

Handler<T> = (msg: QueueMessage<T>) => Promise<'ack' | 'nack' | 'retry'>
```

- `ack`: pgmq.delete.
- `nack`: pgmq.archive (envenenamento).
- `retry`: `pgmq.set_vt` com backoff.

## Audit Sink

```
AuditEntry {
  empresaId
  correlationId
  operacao          // 'autorizar' | 'cancelar' | ...
  ator: UUID
  timestamp: Date
  documento?
  chaveAcesso?
  requestHash: string     // SHA-256 do body enviado (não do XML completo)
  responseStatus: number
  cstat?: string
  xmotivo?: string
  duracaoMs: number
  endpointUrl: string
  retryable: boolean
  tentativa: number
}
```

**Write-only** para todos os módulos. Leitura apenas por `fiscal:auditoria`.

## Eventos de domínio (canônicos)

```
DocumentoSerializado    { chave, documento, versao, tamanhoBytes }
DocumentoAssinado       { chave, digest, suite }
DocumentoAutorizado     { chave, protocolo, dhAutorizacao, empresaId }
DocumentoRejeitado      { chave, cstat, xmotivo, corrigivel }
DocumentoDenegado       { chave, cstat, xmotivo }
CancelamentoAutorizado  { chave, nProt, dhEvento }
CCeRegistrada           { chave, nSeq, dhEvento }
InutilizacaoAutorizada  { ano, serie, nI, nF, nProt }
ManifestacaoRegistrada  { chave, tipo, nSeq, dhEvento }
DFeSincronizado         { empresaId, nsuInicio, nsuFim, novasChaves: number }
DFeRecebido             { chave, cnpjEmitente, documento, empresaId }
DFeNSUAvancado          { empresaId, nsuAntigo, nsuNovo }
CertificadoCarregado    { empresaId, validadeFim }
CertificadoProximoDoVencimento { empresaId, diasRestantes }
CertificadoExpirado     { empresaId, expiradoEm }
SefazRequisitado        { endpoint, servico, correlationId }
SefazRespondeu          { endpoint, servico, status, cstat, duracaoMs, correlationId }
SefazTimeout            { endpoint, servico, timeoutMs, correlationId }
SefazIndisponivel       { uf, ambiente, motivo }
EndpointResolvido       { documento, uf, ambiente, servico, url }
ContingenciaAtivada     { empresaId, modo: 'SVC-AN'|'SVC-RS'|'EPEC'|'FS-DA' }
ContingenciaEncerrada   { empresaId, modoAnterior }
AlertaFiscalDisparado   { tipo, severidade: 'info'|'warn'|'crit', payload }
```

## Regras

1. Eventos são **fatos passados** — nome no pretérito.
2. Eventos **não substituem** commands. Consumidor de evento não pode ordenar; só reagir (auditar, notificar, agregar).
3. Payloads são **planos** (sem entidades). IDs em vez de objetos.
4. Eventos **não** trafegam XML completo — só hashes e chaves.
5. Adição de campo em evento é backward-compatible; remoção exige nova versão do evento (`DocumentoAutorizadoV2`).