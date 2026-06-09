## Diagnóstico (confirmado pelos logs)

Toda chamada do `sefaz-distdfe` falha em transporte com `Connection reset by peer (os error 104)` antes mesmo de a SEFAZ olhar o envelope SOAP. Isso ocorre porque o egress do edge runtime sai por IPs fora do Brasil, e a SEFAZ reseta a conexão TLS.

A linha `transporte resolvido` no log prova que o **Cloudflare Worker mTLS proxy já está provisionado** (`hasProxyUrl: true`, `hasProxySecret: true`, `proxySecretLen: 64`), mas a flag de ativação está com valor inválido:

```
"proxyEnabled": false,
"proxyFlagLen": 23,
"usarProxy": false,
"transporte": "deno-mtls"
```

`proxyFlagLen: 23` significa que o secret `SEFAZ_USE_MTLS_PROXY` contém 23 caracteres (provavelmente algo como `"ativar"`, um UUID curto, ou texto descritivo). O código só ativa o Worker quando o valor é exatamente `"true"`, `"1"` ou `"on"` — então cai no transporte direto `deno-mtls` e leva RST.

O mesmo defeito afeta `sefaz-proxy` (emissão de NF-e modelo 55), pois ambas as functions compartilham a mesma lógica de seleção de transporte. Nenhuma chamada à SEFAZ vai funcionar enquanto a flag não estiver correta.

## Correção

Atualizar o valor do secret `SEFAZ_USE_MTLS_PROXY` para exatamente `true` (sem aspas, sem espaços).

Passos:

1. Abrir o formulário seguro de update de secret para `SEFAZ_USE_MTLS_PROXY` e você digita `true`.
2. Aguardar o cold-start das edge functions (poucos segundos — o secret é lido a cada request).
3. Validar:
   - chamar `sefaz-distdfe` action `consultar-nsu` em homologação (`ambiente=2`) pela própria UI `/fiscal/distdfe-historico`;
   - inspecionar o log e confirmar que aparece `"proxyEnabled": true`, `"usarProxy": true`, `"transporte": "cf-worker"` (ou rótulo equivalente do Worker) e cStat válido (`137`/`138` se sem documentos, `656`/`108` se ambiente caiu — não mais `CONNECTION_RESET`);
   - testar o mesmo caminho em produção (`ambiente=1`).

## O que NÃO muda

- Nenhum arquivo de código é alterado.
- Nenhuma migração de banco.
- Nenhuma mudança no XML, C14N, certificado A1, schema da `nfe_distribuicao` ou no fluxo de Ciência automática.
- Worker no Cloudflare permanece como está (já provisionado e testado por `proxySecretLen: 64`).

## Risco

Baixíssimo: a única mudança é um secret de configuração. Se o valor ficar incorreto novamente, o comportamento volta ao estado atual (RST) — não há regressão silenciosa.

## Pós-correção (opcional, fora deste plano)

Se quiser, posso em um segundo passo tornar o código tolerante a `True`/`TRUE`/`yes`/`on` e logar explicitamente o valor recebido (mascarado) quando o proxy for ignorado, para evitar que este mesmo erro retorne. Diga depois se quer que eu faça.