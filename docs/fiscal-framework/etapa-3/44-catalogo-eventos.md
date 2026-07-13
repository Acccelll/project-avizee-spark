# 44 · Catálogo de eventos do sistema

Refina o doc 24 (Etapa 2). Cada evento: **nome canônico · produtor · payload
conceitual · consumidores · semântica**.

Convenções:
- Passado (fato ocorrido).
- `id: ULID`, `occurredAt: ISO8601`, `correlationId`, `empresaId?` sempre presentes (omitidos abaixo).
- Backward-compatible; versionamento por `EventoV2` quando breaking.

## Ciclo do documento

### `DocumentoCriado`
- **Produtor**: ERP (vendas/compras) via fachada.
- **Payload**: `{ documento, notaId (draft), origem, ator }`.
- **Consumidores**: `AuditoriaService`, `MonitoramentoService`.
- **Semântica**: rascunho gerado; ainda não serializado.

### `DocumentoValidado`
- **Produtor**: `AutorizacaoService.pré-check` (XSD + regras negócio).
- **Payload**: `{ documento, notaId, versaoPL, violacoes[]:[] }`.
- **Consumidores**: Monitoramento.
- **Semântica**: passou validação — pode assinar.

### `DocumentoSerializado`
- **Produtor**: `fiscal-module-nfe.serialize`.
- **Payload**: `{ chave, documento, versao, tamanhoBytes }`.

### `DocumentoAssinado`
- **Produtor**: `fiscal-signature.sign`.
- **Payload**: `{ chave, digest:sha1|sha256, suite }`.

### `DocumentoTransmitido`
- **Produtor**: `fiscal-transport.send`.
- **Payload**: `{ chave, endpoint, servico, requestHash }`.

### `DocumentoAutorizado`
- **Produtor**: `AutorizacaoService` (após cStat=100).
- **Payload**: `{ chave, protocolo, dhAutorizacao, ambiente }`.
- **Consumidores**: Estoque (baixa), Financeiro (lançamentos), Vendas (fecha pedido), Auditoria, Monitoramento, NotificacaoFiscal.

### `DocumentoRejeitado`
- **Payload**: `{ chave?, cstat, xmotivo, corrigivel:boolean }`.
- **Consumidores**: NotificacaoFiscal (se em massa), Monitoramento.

### `DocumentoDenegado`
- **Payload**: `{ chave, cstat, xmotivo }`.
- **Semântica**: irretratável; nota persiste como `Denegada`.

### `DocumentoCancelado`
- **Produtor**: `EventoService.cancelar` sucesso.
- **Payload**: `{ chave, nProt, dhEvento, justificativa }`.
- **Consumidores**: Estoque (estorno), Financeiro (estorno se aplicável).

### `DocumentoInutilizado`
- **Payload**: `{ ano, serie, nInicial, nFinal, nProt }`.

### `DocumentoRecebido`
- **Produtor**: `DistribuicaoDFeService`.
- **Payload**: `{ chave, cnpjEmitente, documento }`.

## Eventos NFe/Manifestação

### `EventoRegistrado`
- **Produtor**: `EventoService.*`.
- **Payload**: `{ chave, tpEvento, nSeq, nProt, dhEvento }`.

### `CartaCorrecaoRegistrada`
- **Payload**: `{ chave, nSeq, texto, dhEvento, nProt }`.

### `ManifestacaoRegistrada`
- **Payload**: `{ chave, tipo, nSeq, dhEvento }`.

### `InutilizacaoAutorizada`
- **Alias** de `DocumentoInutilizado` (semântica idêntica).

## DF-e

### `DFeSincronizado`
- **Payload**: `{ nsuInicio, nsuFim, novasChaves:int, ambiente }`.

### `DFeNSUAvancado`
- **Payload**: `{ nsuAntigo, nsuNovo }`.

### `DistribuicaoAtualizada`
- **Alias** operacional de `DFeSincronizado` para o dashboard.

## XML

### `XMLImportado`
- **Produtor**: `ImportacaoService`.
- **Payload**: `{ chave, notaId, origem:'upload'|'zip'|'dfe', duplicada }`.

### `XMLExportado`
- **Produtor**: `ExportacaoService`.
- **Payload**: `{ chave?, jobId?, quantidade, destinatario? }`.

## Certificado

### `CertificadoCarregado`
- **Payload**: `{ validadeInicio, validadeFim, cnpj, subjectCN }`.

### `CertificadoProximoDoVencimento`
- **Produtor**: cron diário.
- **Payload**: `{ diasRestantes, severidade:'info'|'warn'|'crit' }`.
- **Consumidores**: NotificacaoFiscal.

### `CertificadoExpirando`
- **Alias** operacional (compatível com nomenclatura da UI).

### `CertificadoExpirado`
- **Payload**: `{ expiradoEm }`.

### `CertificadoRemovido`
- **Payload**: `{ removidoPor, motivo? }`.

## SEFAZ / Infraestrutura

### `SefazRequisitado`
- **Payload**: `{ endpoint, servico, requestHash }`.

### `SefazRespondeu`
- **Payload**: `{ endpoint, servico, status, cstat, duracaoMs }`.

### `SefazTimeout`
- **Payload**: `{ endpoint, servico, timeoutMs }`.

### `ErroSEFAZ`
- **Produtor**: qualquer serviço ao classificar resposta como erro técnico.
- **Payload**: `{ endpoint, servico, categoria:'transporte'|'protocolo'|'infra', detalhe }`.

### `SefazIndisponivel`
- **Payload**: `{ uf, ambiente, motivo, duracaoMinutos }`.

### `EndpointResolvido`
- **Payload**: `{ documento, uf, ambiente, servico, url, cacheHit }`.

### `EndpointAlterado`
- **Produtor**: RPC admin de endpoints.
- **Payload**: `{ documento, uf, ambiente, servico, urlAntiga, urlNova, ator }`.

## Filas / Reprocessamento

### `FilaProcessada`
- **Produtor**: `fiscal-cron`.
- **Payload**: `{ fila, processadas:int, arquivadas:int, duracaoMs }`.

### `RetryExecutado`
- **Payload**: `{ operacao, tentativa, sucesso:boolean }`.

### `RetryEsgotado`
- **Payload**: `{ operacao, tentativas, ultimoErro }`.
- **Semântica**: mensagem foi para `pgmq.archive`.

### `MensagemArquivadaDLQ`
- **Payload**: `{ fila, msgId, motivo }`.

## Circuit breaker

### `CircuitBreakerAberto`
- **Payload**: `{ uf, ambiente, servico, falhas }`.

### `CircuitBreakerFechado`
- **Payload**: `{ uf, ambiente, servico }`.

### `CircuitBreakerMeioAberto`
- **Payload**: `{ uf, ambiente, servico }`.

## Contingência

### `ContingenciaAtivada`
- **Payload**: `{ modo:'SVC-AN'|'SVC-RS'|'EPEC'|'FS-DA', ativadaPor, motivo }`.

### `ContingenciaEncerrada`
- **Payload**: `{ modoAnterior, encerradaPor }`.

## Configuração

### `EmpresaFiscalConfigurada`
- **Payload**: `{ cnpj, ie, crt, ambientePadrao }`.

### `AmbienteAlterado`
- **Payload**: `{ anterior, novo, ator }`.

### `SerieRotacionada`
- **Payload**: `{ anterior, nova }`.

## Alertas

### `AlertaFiscalDisparado`
- **Payload**: `{ tipo, severidade, entidade, contexto }`.

## Novos identificados nesta etapa

### `DocumentoValidadoLocalmente`
- **Produtor**: `ValidacaoService` standalone.
- **Distingue** de `DocumentoValidado` (que ocorre dentro de F-001).

### `AuditoriaConsultada`
- **Payload**: `{ ator, filtro, itensRetornados, motivo? }`.
- **Semântica**: acesso a rastro fiscal (LGPD/auditoria de auditoria).

### `WebhookEntregue` / `WebhookFalhou` (v3)
- Reusa infra webhooks.

## Regras

1. Nomeação: `SubstantivoParticípio` sempre em português.
2. Payload plano (IDs, não entidades).
3. Sem XML/senha/PFX no payload.
4. Consumidor não ordena — apenas reage.
5. Falha de consumidor não deve reverter produtor (fire-and-forget).
6. Ordenação garantida por `occurredAt` + `correlationId`.
7. Não há garantia de exactly-once no bus (nível AVIZEE) — idempotência do consumidor é dele.

## Mapa consumo por serviço

| Serviço | Consome |
|---|---|
| AuditoriaService | todos (write-only) |
| MonitoramentoService | todos (métrica/dashboard) |
| NotificacaoFiscalService | `CertificadoProximoDoVencimento/Expirado`, `SefazIndisponivel`, `DocumentoRejeitado` (thresholds), `ContingenciaAtivada`, `RetryEsgotado` |
| ManifestacaoService | `DocumentoRecebido` (para sugerir/executar auto-ciência) |
| EstoqueService | `DocumentoAutorizado`, `DocumentoCancelado`, `ManifestacaoRegistrada` (confirmação → entrada) |
| FinanceiroService | `DocumentoAutorizado`, `DocumentoCancelado` |
| VendasService | `DocumentoAutorizado`, `DocumentoDenegado` |