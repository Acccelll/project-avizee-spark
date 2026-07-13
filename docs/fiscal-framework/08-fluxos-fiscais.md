# 08 · Fluxos fiscais

Todos os fluxos passam pelo `FiscalRuntime` e produzem `FiscalResult<T>`. A
persistência é responsabilidade do chamador (fachada / edge / service).

## 1. Emissão de NF-e (síncrona)

```
UI ──▶ services/fiscal/emitirNfe ──▶ edge fiscal-nfe
                                       │
                                       ▼
                       [1] proximo_numero_nfe (RPC — SEQUENCE)
                       [2] runtime.nfe.montar(nota)          → NFe (obj)
                       [3] runtime.nfe.serialize(NFe)        → xml (bytes)
                       [4] runtime.signature.sign(xml,       → xmlAssinado
                                             cert, id="infNFe")
                       [5] runtime.schema.validate(xmlAssinado, "leiauteNFe_v4.00")
                             ├─ ok      → segue
                             └─ falha   → FiscalResult.erro(violacoes)  → persistir nfe rejeitada
                       [6] runtime.nfe.montarLote(xmlAssinado)  → enviNFe (sem <?xml?>)
                       [7] runtime.soap.wrap(enviNFe, descriptor NFeAutorizacao4)
                       [8] endpoints.resolve("NFe", Autorizacao, ctx)  → URL
                       [9] runtime.transport.send(url, envelope, mTLS)
                      [10] parse retEnviNFe
                            ├─ cStat=104 (lote processado)
                            │    └─ compõe nfeProc, persiste, retorna FiscalResult.ok(protocolo)
                            ├─ cStat=103 (em processamento)
                            │    └─ enfileira RetAutorizacao (fila fiscal.retry.autorizacao)
                            └─ cStat rejeição
                                 └─ persiste com motivo, retorna FiscalResult.erro
                      [11] xmlStorage.upload(xmlAssinado ou nfeProc)  → dbavizee/fiscal/YYYY/MM/saida/CHAVE.xml
                      [12] fiscal_auditoria insert
```

## 2. RetAutorizacao (polling de lote assíncrono)

```
Consumidor cron ──▶ pgmq fiscal.retry.autorizacao
   loop:
     backoff 5s, 15s, 45s, 2m, 10m
     runtime.nfe.consultarRecibo(nRec)
       cStat=104 → busca protNFe do primeiro item, atualiza NF, encerra
       cStat=105 → em processamento, requeue
       cStat rejeição → persiste erro, encerra
```

## 3. Consulta de situação da NF-e

```
edge fiscal-nfe (rota /consultar) ──▶ runtime.nfe.consultarSituacao(chave)
   monta consSitNFe → SOAP → transport → parse retConsSitNFe
   atualiza status_sefaz na nota (ou apenas retorna se for consulta pura)
```

## 4. Cancelamento

```
UI ──▶ edge fiscal-events (rota /cancelar)
       validações prévias:
         - status = autorizada
         - dentro do prazo (24h SP; 30d outros)
         - justificativa 15-255 chars
       [1] runtime.eventos.montar({ tpEvento: 110111, chave, protocolo, justificativa })
       [2] sign(id="ID110111{chave}{nSeqEvento}")
       [3] wrap SOAP RecepcaoEvento4
       [4] transport
       [5] parse retEvento → cStat=135 (evento registrado) ou erro
       [6] persiste em eventos_fiscais + atualiza notas_fiscais.status
       [7] arquiva procEventoNFe no bucket
```

## 5. Carta de Correção (CCe)

Idêntico ao cancelamento, com `tpEvento=110110`, `xCorrecao`,
`nSeqEvento` incrementado por chave (limite 20).

## 6. Inutilização de numeração

```
edge fiscal-events (rota /inutilizar)
   [1] runtime.nfe.montarInut({ ano, serie, nInicial, nFinal, justificativa })
   [2] sign(id="ID{cUF}{ano}{cnpj}{mod}{serie}{nIni}{nFim}")
   [3] wrap NFeInutilizacao4
   [4] transport
   [5] parse retInutNFe → cStat=102 (homologado)
   [6] persiste em inutilizacoes_numeracao
```

## 7. Manifestação do destinatário (ciência / confirmação / desconhecimento / não realizada)

```
UI (drawer) ──▶ edge fiscal-events (rota /manifestar)
   tpEvento ∈ {210210 ciência, 210200 confirmação, 210220 desconhecimento, 210240 não realizada}
   endpoint: RecepcaoEvento4 do Ambiente Nacional
   parse retEvento → atualiza nfe_distribuicao.status_manifestacao
```

Ciência automática: worker do `fiscal-module-dfe` chama `runtime.eventos.ciencia`
para todo `resNFe` novo se `SYNC_AUTO_CIENCIA=true` (setting por empresa).

## 8. Distribuição DF-e (sync NSU)

```
cron ──▶ edge fiscal-cron
   para cada empresa ativa:
     cursor = SELECT ult_nsu FROM nfe_distdfe_sync WHERE cnpj=... AND ambiente=...
     runtime.dfe.sync(empresaId, cursor)
       loop até maxNSU:
         [1] monta distDFeInt (consNSU se cursor=0, distNSU caso contrário)
         [2] sign
         [3] SOAP double-wrapper (nfeDistDFeInteresse > nfeDadosMsg) — descriptor cobre
         [4] transport → hom1./www1.nfe.fazenda.gov.br
         [5] parse retDistDFeInt → docZip[]
         [6] para cada docZip:
               gunzip → xml original
               classifica (resNFe, resEvento, procNFe, procEventoNFe)
               upsert nfe_distribuicao BY chave_acesso
               se procNFe: arquiva em fiscal/YYYY/MM/entrada/CHAVE.xml
         [7] atualiza cursor
         [8] se cStat=138 (documentos localizados) → continua; 137 (nada novo) → para
     opcional: ciência automática dos resNFe novos → agenda retry para XML completo
```

## 9. Download de XML (por chave)

```
edge fiscal-dfe (rota /download)
   runtime.dfe.download(chave)
     [1] monta distDFeInt com consChNFe
     [2] sign / SOAP / transport
     [3] parse; se cStat=138 e tipo=procNFe → salva no bucket + upsert nfe_distribuicao
```

## 10. Importação de XML (upload manual)

```
UI upload → edge fiscal-nfe (rota /importar)
   [1] parse XML → estrutura tipada
   [2] runtime.signature.validate(xml) → rejeita se assinatura inválida
   [3] verifica duplicidade por chave (sefaz.service.verificarDuplicidadeChave)
   [4] upsert em notas_fiscais (entrada), itens, eventos
   [5] arquiva no bucket
   [6] tenta match com pedido_compra (lookups.service)
```

## 11. Status serviço (health por autorizador)

```
dashboard ──▶ edge fiscal-nfe (rota /status)
   runtime.status.consultar(uf, ambiente)
     monta consStatServ → SOAP → transport → parse
     retorna cStat=107 (em operação) / 108/109 (paralisado)
     resultado cacheado 60s in-memory
```

## 12. Consulta cadastro contribuinte

```
edge fiscal-nfe (rota /cad)
   runtime.consultaCadastro({ uf, cnpj|cpf|ie })
     monta consCad_v2.00 → SOAP → transport → parse retConsCad
     retorna estado (ativo/inativo), regime, endereço, IE
```

## 13. Fluxo comum de erro

```
qualquer runtime call
   try:
     resposta = transport.send(...)
   catch (rede / tls / timeout):
     log(correlationId, 'transport-error', detail)
     audit(erro=transporte)
     return FiscalResult.erro({ tipo: 'transporte', retryable: true })

   parse resposta:
     cStat classifica em taxonomia (doc 12):
       - sucesso   → FiscalResult.ok
       - retryable → agenda retry na fila
       - definitivo→ persiste, marca falha permanente
```