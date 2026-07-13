# 23 · Fluxos arquiteturais

Cada fluxo é descrito com **atores → passos → pontos de falha → recuperação**.
Diagramas em ASCII. Não há código.

## Legenda

```
UI      = ERP React (src/pages/**, src/components/fiscal/**)
FCD     = Fachada (src/services/fiscal/*)
EDG     = Edge (supabase/functions/fiscal-*/)
APP     = Application Layer (use case)
DOM     = Domain Module (fiscal-module-nfe, etc.)
ENG     = Engines (xml, signature, schema, soap, transport)
CROSS   = Cross (cert, endpoint, audit, queue, cache)
DB      = Postgres (tabelas fiscal_*, notas_*)
STG     = Storage bucket dbavizee
VLT     = Supabase Vault
SEFAZ   = Autorizador (UF/SVAN/SVRS/AN)
```

## 1. Autorização de NF-e (síncrono lote 1)

```
UI ─► FCD.emitir(nota)
       │
       ▼
     EDG fiscal-nfe (action=autorizar)
       │  RBAC(fiscal:emitir) · empresa_id derivado do JWT
       ▼
     APP.AutorizarNFe
       │  correlationId = flx-<ts>-<rnd>
       │  idempotencyKey = (empresaId, chaveAcesso)
       ├─► DOM.serialize(nota)              ──► xml
       ├─► CROSS.cert.carregar(empresaId)   ──► certA1
       ├─► ENG.signature.sign(xml, certA1)  ──► xmlAssinado
       ├─► ENG.schema.validate(xmlAssinado) ──► [] | violações
       ├─► CROSS.endpoint.resolve(NFe, UF, amb, autorizacao)
       ├─► ENG.soap.envelopar(descriptor, xmlAssinado)
       ├─► ENG.transport.send(url, envelope, mTLS) ─► resposta
       ├─► DOM.parseRetorno(resposta)       ──► { cstat, nRec | protocolo }
       │
       ├─► CROSS.audit.registrar(...)       (write-only)
       └─► DB.notas_fiscais.upsert(status, protocolo, xml_path)
              STG.upload(fiscal/YYYY/MM/saida/{chave}.xml)
       │
       ▼
     Resultado ao ERP
       ├── cstat=100  → Autorizado
       ├── cstat=103  → Lote em processamento → enfileira retAutorizacao
       ├── cstat=110/301/302 → Denegado (persiste, não retentável)
       └── outros     → Rejeitado (com xMotivo), permite corrigir
```

**Pontos de falha**:
- Certificado ausente/expirado → aborta antes de enviar.
- XSD ausente → warning, prossegue (comportamento definido no doc 07).
- Timeout transport → não persiste como rejeitado; enfileira retry `fiscal.retry.autorizacao`.
- SEFAZ 5xx → circuit breaker abre por (UF, amb, 60s).

## 2. Consulta protocolo (retAutorizacao — lote assíncrono)

```
cron fiscal-cron ──► fila fiscal.retry.autorizacao
                          │  { nRec, empresaId, tentativa }
                          ▼
                     APP.ConsultarRetorno
                          │ (mesma pipeline, action=retAutorizacao)
                          ▼
                     cstat=105 → reenfileira com backoff exponencial
                     cstat=104 → parseia lote, aplica cstat de cada nota
                     esgotou tentativas (10) → marca rejeitado + notifica
```

## 3. Cancelamento (evento tpEvento=110111)

```
UI ─► FCD.cancelar(chave, justificativa)
       └─► EDG fiscal-events (action=cancelar)
            └─► APP.CancelarNFe
                 │ Regras: chave existe, status=Autorizada, < 24h autorização
                 ├─► DOM.eventos.montar(cancelamento, chave, justif, nSeq=1)
                 ├─► ENG.signature.sign(evento)
                 ├─► ENG.transport.send(recepcaoEvento)
                 ├─► parseRetorno → cstat=135 (registrado) | 155 (fora prazo)
                 └─► DB.nota_fiscal_eventos.insert + UPDATE notas_fiscais SET status='Cancelada'
```

## 4. Carta de Correção (tpEvento=110110)

Similar ao cancelamento, com:
- validação de comprimento (15..1000 chars),
- proibição de correção de valores/CFOP/emitente/destinatário/data (regra domínio),
- `nSeqEvento` incremental por chave (constraint UNIQUE).

## 5. Inutilização de numeração (110)

```
UI ─► FCD.inutilizar({ ano, serie, nInicial, nFinal, justificativa })
       └─► APP.InutilizarNumeracao
            │ Regras: faixa não emitida, mesma série, mesmo ano
            ├─► DOM.inutilizacoes.montar
            ├─► ENG.signature.sign
            ├─► ENG.transport.send(inutilizacao)
            └─► DB.inutilizacoes_numeracao.insert (UNIQUE(empresaId,ano,serie,nI,nF))
```

## 6. Distribuição DF-e (assíncrono agendado)

```
cron a cada 30 min ─► fila fiscal.dfe.sync
                        │  { empresaId }
                        ▼
                     APP.SincronizarDFe
                        ├─► DB.nfe_distdfe_sync SELECT nsu atual
                        ├─► loop até cstat=137 (nada mais):
                        │    ENG.transport.send(distDFeInt, AN, mTLS via proxy)
                        │    DOM.dfe.decodificarDocZip → NFe/CTe/eventos
                        │    DB.nfe_distribuicao.upsert (UNIQUE empresa,chave)
                        │    DB.nfe_distribuicao_itens.insert
                        │    UPDATE nsu = maxNSU
                        ├─► se fiscal_runtime_config.sync_auto_ciencia = true:
                        │    enfileira fiscal.eventos.ciencia por chave
                        └─► audit.registrar
```

## 7. Manifestação do destinatário (210200/210210/210220/210240)

```
UI (ou fila fiscal.eventos.ciencia)
  └─► FCD.manifestar(chave, tipo)
       └─► APP.ManifestarDestinatario
            │ Regras: chave em nfe_distribuicao; prazo (180d ciência, etc.)
            ├─► DOM.eventos.montar(tipoEvento)
            ├─► ENG.signature.sign
            ├─► ENG.transport.send(recepcaoEvento, AN)
            └─► DB.nota_fiscal_eventos.insert
```

## 8. Download XML por chave

```
UI ─► FCD.baixarXml(chave)
  └─► EDG fiscal-dfe (action=download)
       ├─► DB.notas_fiscais WHERE chave → se caminho_xml existir: STG.getSignedUrl → 302
       └─► senão: APP.BaixarPorChave → DistDFe consultaChNFe → grava STG → retorna URL
```

## 9. Importação de XML (upload manual ou DF-e)

```
UI upload .xml
  └─► FCD.importarXml(file|string)
       └─► APP.ImportarNFe
            ├─► DOM.parse(xml)  → estrutura tipada
            ├─► valida assinatura (ENG.signature.validate)
            ├─► deduplica (chave já existe?)
            ├─► resolve produtos/fornecedor (autocomplete + cadastro rápido)
            ├─► DB.notas_fiscais + notas_fiscais_itens
            └─► STG.upload(fiscal/YYYY/MM/entrada/{chave}.xml)
```

## 10. Exportação de XML

```
UI ─► FCD.exportarXml(chave | filtro)
  └─► EDG fiscal-nfe (action=exportar)
       ├─► STG.download(caminho_xml) ou monta zip
       └─► signedUrl temporária (10min)
```

## 11. Validação XSD standalone

```
APP.ValidarDocumento(xml, documento, versaoPL)
  ├─► CROSS.schema_registry.resolver(documento, versaoPL)
  ├─► ENG.schema.validate(xml, schemaRoot)
  └─► retorna violações [] ou lista
```

## 12. Assinatura standalone (testes / reassinatura)

```
APP.AssinarDocumento(xml, empresaId, elementId, suite?)
  ├─► CROSS.cert.carregar(empresaId)
  ├─► ENG.signature.sign(xml, elementId, cert, suite)
  └─► retorna xmlAssinado (não envia)
```

## 13. Reprocessamento (retry manual/automático)

```
cron consome fila fiscal.retry.*
  ├─► verifica tentativa <= 10
  ├─► calcula backoff = min(60 * 2^tentativa, 3600) segundos
  ├─► re-executa APP correspondente com o mesmo correlationId
  └─► sucesso → remove da fila | falha → reenfileira com tentativa+1
```

Reprocessamento manual: UI dispara APP com `forcarRetry=true` (limpa contador).

## 14. Tratamento de falhas (taxonomia cStat)

Ver doc 12 da Etapa 1. Complemento Etapa 2:

| Categoria | Ação |
|---|---|
| **Transitória** (108/109/timeout/5xx) | retry com backoff, ativa circuit breaker |
| **Rejeição corrigível** (esquema/valor) | não retry; devolve à UI |
| **Rejeição não-corrigível** (denegação 110/301/302) | persiste, encerra fluxo |
| **Duplicidade** (204/539) | idempotência: trata como sucesso se protocolo local existe |
| **Contingência** (108/109 persistente) | ativa `fiscal-contingency-manager` |

## 15. Recuperação automática

Após indisponibilidade prolongada:

```
cron fiscal-cron (a cada 5 min):
  ├─► lê circuit breaker aberto há > 60s → tenta status-serviço
  ├─► cStat=107 → fecha breaker, drena fila de retry
  ├─► cStat≠107 → mantém breaker, agenda próximo poll
  └─► > 60min contínuos indisponível → sugere contingência (notificação admin)
```

## Correlação end-to-end

Todo fluxo carrega um único `correlation-id` em:
- header HTTP (`x-correlation-id`) entre ERP → Edge,
- campo `correlation_id` em `fiscal_auditoria`,
- tag em `logger.*`,
- payload da fila (`{ correlationId, tentativa, ... }`),
- resposta ao ERP para exibição em toast/log.