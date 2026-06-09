# Botão "Testar Worker" no DistDFe Histórico

Adicionar um teste leve do Cloudflare Worker mTLS que isola se o 520 vem de binding/allowlist (mTLS para `www1`) ou do envelope SOAP. Faz um `GET` simples ao WSDL via o Worker, sem montar envelope, sem assinar XML.

## 1. Edge function — nova action `worker-ping`

`supabase/functions/sefaz-distdfe/index.ts`

- Adicionar `action: "worker-ping"` aceitando `ambiente: "1" | "2"`.
- Resolver a URL alvo:
  - Hom: `https://hom1.nfe.fazenda.gov.br/NFeDistribuicaoDFe/NFeDistribuicaoDFe.asmx?wsdl`
  - Prod: `https://www1.nfe.fazenda.gov.br/NFeDistribuicaoDFe/NFeDistribuicaoDFe.asmx?wsdl`
- Validar `SEFAZ_USE_MTLS_PROXY` / `SEFAZ_MTLS_PROXY_URL` / `SEFAZ_MTLS_PROXY_SECRET` (mesma checagem do `status`).
- Fazer `fetch(proxyUrl, { method: "GET", headers: { "x-proxy-secret": secret, "x-target-url": url } })` com timeout de 15s.
- Devolver JSON com:
  - `sucesso` (boolean), `ambiente`, `targetUrl`
  - `statusHttp`, `statusText`
  - `bytes`, `preview` (primeiros 240 chars do body)
  - `diagnostico`: classificação simples
    - 200 + `definitions`/`wsdl` no preview → `"OK — Worker alcança o endpoint e mTLS funciona"`
    - 520 → `"Worker lança exceção — provável binding mTLS não cobre este hostname"`
    - 525/526 → `"Falha TLS no Worker — verifique cadeia ICP-Brasil"`
    - 401/400 com corpo curto → `"Worker rejeitou (secret ou header)"`
    - Outros → mensagem genérica com o status
  - `erro` quando aplicável
- Permissão: reusa a mesma autorização de `visualizar` fiscal já existente.
- Sem chamar a SEFAZ por SOAP, sem persistir nada, sem throttle.

## 2. Service cliente

`src/services/fiscal/sefaz/distdfe.service.ts`

- Exportar `testarWorkerDistDFe(ambiente: "1" | "2")` que invoca `sefaz-distdfe` com `{ action: "worker-ping", ambiente }` e retorna o JSON tipado.
- Reexportar via `src/services/fiscal/sefaz/index.ts`.

## 3. UI — botão e painel de resultado

`src/pages/fiscal/DistDFeHistorico.tsx`

- Ao lado do botão "Sincronizar", adicionar **dois botões**:
  - "Testar Worker (Hom.)" → chama `testarWorkerDistDFe("2")`
  - "Testar Worker (Prod.)" → chama `testarWorkerDistDFe("1")`
- Loading independente do botão de sincronizar.
- Mostrar resultado no mesmo painel inline já existente:
  - Ambiente, URL alvo, status HTTP, diagnóstico, preview (monospace, truncado).
  - Cor verde quando 200 + WSDL detectado; destrutivo nos demais.
- Toast curto: sucesso ou falha com o diagnóstico.

## Detalhes técnicos

- Sem migrações de banco.
- Sem mudar contrato do Worker — apenas exercita `x-target-url` com método `GET`.
- Logs do edge function via `log.info("worker-ping", { ambiente, statusHttp, bytes })` para correlacionar com a UI.

## Como interpretar o resultado

```text
Hom 200 + WSDL  e  Prod 520  →  binding mTLS no Worker cobre só hom1.nfe.fazenda.gov.br
Hom 200         e  Prod 525  →  cadeia ICP-Brasil ausente na rota Prod do Worker
Ambos 401/400   →  secret/headers errados no edge function
Ambos 520       →  Worker está com exception em todo request (verificar wrangler tail)
```
