# 45 · Máquinas de estado

Notação `Estado --gatilho--> Estado`. Estados finais em **UPPER**. Transições
não listadas são proibidas (violação = bug ou tampering).

## Documento fiscal (NF-e)

```
Rascunho --validar--> Validado
Rascunho --descartar--> DESCARTADO

Validado --serializar+assinar--> Assinado
Validado --editar--> Rascunho

Assinado --transmitir--> Transmitido
Assinado --editar--> Rascunho          (invalida assinatura)

Transmitido --cstat=100--> AUTORIZADA
Transmitido --cstat=103--> EmProcessamento
Transmitido --cstat rejeicao--> REJEITADA
Transmitido --cstat 110/301/302--> DENEGADA
Transmitido --timeout--> Transmitido    (retry via cron)
Transmitido --breaker aberto--> AguardandoRetry

EmProcessamento --cstat=104+100--> AUTORIZADA
EmProcessamento --cstat=104+rejeicao--> REJEITADA
EmProcessamento --cstat=105--> EmProcessamento (reagenda)

AguardandoRetry --breaker fechado--> Transmitido
AguardandoRetry --tentativas>10--> REJEITADA_DEFINITIVA

AUTORIZADA --evento cancelamento cstat=135--> CANCELADA
AUTORIZADA --evento cce--> AUTORIZADA           (permanece, +CCe)
AUTORIZADA --> AUTORIZADA                        (estado terminal para fluxo normal)

DENEGADA --> DENEGADA                            (terminal)
CANCELADA --> CANCELADA                          (terminal)
REJEITADA --editar+reenviar--> Rascunho
REJEITADA_DEFINITIVA --forcarRetry(admin)--> Transmitido

Contingencia (paralela):
  qualquer --ativar contingencia--> Contingencia_{modo}
  Contingencia_{modo} --autorizar via SVC/EPEC--> AUTORIZADA_CONTINGENCIA
  AUTORIZADA_CONTINGENCIA --regularizar 24h--> AUTORIZADA
```

### Invariantes
- Não há transição direta `Rascunho → AUTORIZADA` (sempre passa por Transmitido).
- `AUTORIZADA → REJEITADA` é impossível.
- `CANCELADA → AUTORIZADA` é impossível (só via nova nota).
- `DENEGADA` é sempre terminal (nem cancela).

## Documento fiscal (NFC-e — v2)

Semelhante à NF-e; acrescenta:
```
Rascunho --emissao offline--> OfflineAssinado
OfflineAssinado --transmitir diferido--> Transmitido
OfflineAssinado --24h sem transmissão--> INUTILIZADA_OBRIGATORIA
```

## Evento fiscal (cancel, CCe, manif, inut)

```
Pendente --montar+assinar--> Assinado
Assinado --transmitir--> Transmitido
Transmitido --cstat=135--> REGISTRADO
Transmitido --cstat=155/573/574--> REJEITADO
Transmitido --timeout--> AguardandoRetry
AguardandoRetry --> Transmitido
AguardandoRetry --tentativas>10--> REJEITADO_DEFINITIVO
```

## Certificado A1

```
Ausente --upload--> Valido
Valido --dias<=30--> AlertaVerde        (aviso info)
Valido --dias<=7--> AlertaAmarelo       (warn)
Valido --dias<=0--> EXPIRADO
Valido --remover(admin)--> REMOVIDO
Valido --upload novo--> Valido (substituído)
EXPIRADO --upload novo--> Valido
```

### Invariantes
- `EXPIRADO` bloqueia emissão e eventos; permite consulta (não usa cert).
- `AlertaVerde`/`Amarelo` são estados de notificação — não bloqueiam.

## Mensagem em fila (pgmq)

```
Enfileirada --read (vt)--> EmProcessamento
EmProcessamento --ack--> DELETADA
EmProcessamento --nack (fatal)--> ARQUIVADA
EmProcessamento --retry (transient)--> Enfileirada (com backoff)
EmProcessamento --vt expirado--> Enfileirada (readCt++)
Enfileirada --readCt>10--> ARQUIVADA (envenenamento)
```

## Processamento (execução de um use case)

```
Iniciado --pré-check ok--> Executando
Iniciado --pré-check falhou--> ERRO_VALIDACAO

Executando --sucesso--> CONCLUIDO
Executando --erro transient--> AguardandoRetry
Executando --erro fatal--> ERRO_FATAL

AguardandoRetry --backoff decorrido--> Executando
AguardandoRetry --tentativas esgotadas--> ERRO_FATAL
```

## Circuit breaker (por uf, ambiente, servico)

```
Closed --falha--> Closed (contador++)
Closed --contador>=5 em 60s--> Open
Open --60s decorridos--> HalfOpen
HalfOpen --sucesso teste--> Closed
HalfOpen --falha teste--> Open (renova 60s)
Closed --sucesso--> Closed (reset contador)
```

## Manifestação por chave

```
SemManifestacao --ciencia--> Ciente
SemManifestacao --desconhecimento (10d)--> DESCONHECIDA
SemManifestacao --nao-realizada--> NAO_REALIZADA
SemManifestacao --confirmacao--> CONFIRMADA

Ciente --confirmacao--> CONFIRMADA
Ciente --desconhecimento (10d)--> DESCONHECIDA
Ciente --nao-realizada--> NAO_REALIZADA

CONFIRMADA / DESCONHECIDA / NAO_REALIZADA são terminais.
```

### Invariantes
- `Desconhecimento` só até 10d da autorização; depois bloqueia.
- Sequência por tipo é única por chave.

## Contingência (por empresa)

```
Normal --ativar (admin, motivo)--> Contingencia_{modo}
Contingencia_{modo} --encerrar (admin)--> RegularizacaoPendente
RegularizacaoPendente --todas transmitidas ao autorizador principal--> Normal
RegularizacaoPendente --24h sem regularização--> ALERTA_CRITICO (continua pendente)
```

## Idempotência

```
Ausente --primeira requisição--> Reservada
Reservada --response ok--> Registrada (24h)
Reservada --response erro--> Ausente (libera)
Registrada --mesma key, mesmo payload--> Registrada (replay)
Registrada --mesma key, payload diferente--> Conflito (409)
Registrada --24h decorridas--> EXPIRADA (limpa)
```

## Job de exportação/lote

```
Enfileirado --picked--> Executando
Executando --sucesso--> CONCLUIDO (url disponível)
Executando --erro--> FALHOU
CONCLUIDO --url expirada 7d--> ARQUIVADO
```

## Sincronização DFe (por empresa)

```
Ocioso --cron dispara--> Executando
Executando --cstat=138 lote--> Executando (loop)
Executando --cstat=137 nada mais--> Ocioso (agenda 30min)
Executando --cstat=656--> BackoffLongo (60min)
Executando --timeout--> AguardandoRetry
AguardandoRetry --> Executando
```

## Regras gerais de máquina de estado

1. Toda transição registra evento em `fiscal_auditoria`.
2. Estado é sempre gravado atomicamente com a evidência (protocolo, cStat).
3. Não há transição "para trás" arbitrária — só via fluxo definido (ex.: `REJEITADA → Rascunho` via edição explícita).
4. Estados terminais (UPPER) exigem intervenção admin para reverter (se possível).
5. Transições impossíveis lançam `INVALID_STATE_TRANSITION` (erro programação).