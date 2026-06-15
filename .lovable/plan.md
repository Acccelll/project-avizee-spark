# Diagnóstico real do erro "Worker→SEFAZ HTTP 520"

## O que os logs realmente mostram

Logs de `sefaz-distdfe` (request_id `3dde0088-…`, 17:46:21–17:46:26 UTC):

- 4 tentativas (soap12/soap11 alternados) contra `https://www1.nfe.fazenda.gov.br/NFeDistribuicaoDFe/NFeDistribuicaoDFe.asmx` (ambiente=1, produção).
- Em todas, o Cloudflare Worker devolve **HTTP 200** com o JSON envelope:
  ```
  {"success":false,"status":520,"statusText":"<none>",
   "contentType":"text/plain; charset=UTF-8","contentLength":"15",
   "body":"error code: 520"}
  ```

A string `error code: 520` com `Content-Type: text/plain` e `Content-Length: 15` **não é resposta do BIG-IP da SEFAZ** — é a página de erro padrão que o **próprio Cloudflare** devolve quando o `fetch()` do Worker para a origem falha no nível de conexão/TLS. O BIG-IP da SEFAZ, quando recusa, devolve HTML, SOAP fault ou pelo menos `text/html` com tamanho > 15 bytes.

A mensagem mostrada ao usuário ("Aguarde alguns minutos…") está incorreta: ela é hardcoded em `sefaz-distdfe/index.ts:907-909` para o código `WORKER_UPSTREAM_520`, mesmo quando o 520 vem do Cloudflare e não da SEFAZ. O "ping ok" do texto também é hardcoded — **nenhum ping real foi feito** nessa transação.

## Causa raiz (hipótese forte, validável com 1 teste)

A própria memória do projeto (`mem://tech/sefaz-mtls-transporte`) já documenta esse cenário:

> "O binding do Worker precisa cobrir o hostname de PRODUÇÃO `www1.nfe.fazenda.gov.br` (não só hom1), senão o Worker devolve HTTP 520."

E o próprio código admite no diagnóstico do `worker-ping` (linha 494):

> "Worker respondeu 520 — o binding mTLS provavelmente não cobre este hostname."

Sintomas batem 1:1:
- Ambiente=1 → URL `www1.nfe.fazenda.gov.br` (não `hom1`).
- 4/4 falhas idênticas, sem variação por SOAP variant nem por tentativa → não é intermitência, é determinístico.
- Corpo exatamente "error code: 520" → Cloudflare-origin failure, não BIG-IP.

Causas possíveis no Cloudflare Worker:
1. **`mtls_certificate` binding sem `allowed_hosts` para `www1.nfe.fazenda.gov.br`** (só cobre `hom1`).
2. Certificado A1 expirado/revogado/substituído sem reupload no Cloudflare.
3. Worker referenciando outro binding name (typo) ao detectar produção.

## Passo 1 — Confirmar a causa com diagnóstico real (sem alterar nada ainda)

Antes de qualquer mudança, rodar o `worker-ping` apontando para **produção** e ver a resposta crua. Se devolver `statusHttp:520` com `preview:"error code: 520"`, está confirmado que é o binding/cert do Cloudflare, não a SEFAZ.

Será executado via `supabase--curl_edge_functions`:

```
POST /functions/v1/sefaz-distdfe
{ "action": "worker-ping", "ambiente": "1" }
```

E também ambiente 2 (homologação) como controle — se 2 passa e 1 falha, é prova final.

## Passo 2 — Correção (dependente do resultado)

### Caso A (esperado): ping prod = 520, ping hom = 200/SOAP

Não é código do app. Ação necessária no **Cloudflare Worker** (fora do repositório Lovable, gerenciado por você):

1. No painel do Cloudflare → Worker `sefaz-mtls-proxy` (ou o nome em uso) → **Settings → Variables → mTLS Certificates**.
2. Verificar o `mtls_certificate` binding ativo. Confirmar:
   - O certificado A1 atual está válido (data de validade > hoje).
   - O campo **Hostnames** / `allowed_hosts` inclui **exatamente** `www1.nfe.fazenda.gov.br` (além de `hom1.nfe.fazenda.gov.br`).
3. Se faltar, adicionar o hostname e redeployar o Worker.

No app: ajustes pequenos para parar de mentir para o usuário:

- `sefaz-distdfe/index.ts`: detectar o padrão `body === "error code: 520"` (`contentType` text/plain, length ≤ 32) e classificar como `CLOUDFLARE_ORIGIN_FAIL` em vez de `WORKER_UPSTREAM_520`. Para esse código, **não retentar 4×** (é determinístico) e retornar mensagem específica: "Falha no transporte do Worker mTLS para a SEFAZ produção (o Cloudflare não conseguiu estabelecer a conexão com a origem). Provável: o binding mTLS do Worker não cobre `www1.nfe.fazenda.gov.br` ou o certificado A1 instalado no Cloudflare expirou. Verifique no painel do Cloudflare."
- Remover o texto hardcoded "(ping ok)" do erro — só dizer "ping ok" quando um ping de verdade tiver rodado nessa sessão.
- Reduzir o backoff/tentativas quando o código for `CLOUDFLARE_ORIGIN_FAIL` (1 tentativa basta).

### Caso B: ping prod retorna SOAP fault / HTML > 100 bytes

Aí sim é intermitência do BIG-IP da SEFAZ AN. Mensagem atual é apropriada, mas vamos exibir o `preview` real (primeiros 120 chars do body) para o operador, em vez de texto genérico.

### Caso C: ping prod com erro de rede (`worker-unreachable`)

Worker offline. Reportar URL/secret e instruir a verificar o deploy do Worker.

## Detalhes técnicos

Arquivos potencialmente tocados (apenas no Caso A, mudanças cirúrgicas):

- `supabase/functions/sefaz-distdfe/index.ts`
  - Trecho `if (workerFail)` (linhas ~782-803): adicionar detecção `CLOUDFLARE_ORIGIN_FAIL` e `break` em vez de `continue` quando for esse código.
  - Trecho de tradução de erro final (linhas ~900-915): novo branch para `CLOUDFLARE_ORIGIN_FAIL` com mensagem precisa; remover "(ping ok)" do branch `WORKER_UPSTREAM_520`.

Nenhuma migração SQL, nenhuma mudança em RLS, nenhuma alteração no front-end (a UI já mostra `sucesso:false` + `erro` da edge function via toast).

## Entregável

1. Resultado bruto dos pings (prod e hom) colado na resposta para você ter prova documental.
2. Veredito: binding/certificado vs. SEFAZ.
3. Patch mínimo na edge function para a mensagem de erro corresponder à realidade (sem mascarar o problema infraestrutural, que precisa ser resolvido por você no Cloudflare).
