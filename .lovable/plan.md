## Causa raiz (confirmada por logs reais)

Analisei o request `accecbb5-2967-4d4e-8f3f-48c1aeb4cc65` em `sefaz-distdfe`:

| Tentativa | Variante | Worker → Worker→SEFAZ |
|---|---|---|
| 1 | soap12 | `{status:500, contentType:null, body:""}` |
| 2 | soap11 | `{status:500, contentType:null, body:""}` |
| 3 | soap12 | `{status:520, contentType:"text/plain", body:"error code: 520"}` |

**O binding mTLS do Cloudflare está OK.** Se o certificado A1 estivesse expirado/desassociado, **todas** as tentativas voltariam `error code: 520`. As 2 primeiras chegaram ao BIG-IP do AN (HTTP 500 vazio — instabilidade conhecida do `www1.nfe.fazenda.gov.br`).

**Causa real:** instabilidade transitória do Ambiente Nacional (mix 500 vazio + 1 CF 520 isolado).

**Bug nosso:** em `supabase/functions/sefaz-distdfe/index.ts` (linhas 818‑828), assim que a 3ª tentativa retorna a página 520, o handler dá `break` com `codigoTransporte=CLOUDFLARE_ORIGIN_FAIL` e mostra a mensagem "certificado A1 expirado / binding mtls desconfigurado". Isso descarta a evidência das tentativas anteriores e exibe diagnóstico falso ao usuário.

## Correção

Editar apenas `supabase/functions/sefaz-distdfe/index.ts`, dentro do loop de tentativas em `consultar-nsu`/`consultar-chave`:

1. **Coletar telemetria por tentativa** num array `tentativasUpstream: { status, cfOriginFail }[]`.
2. **Remover o `break` antecipado** no ramo `isCloudflareOriginFail`. Em vez de abortar, marca o `codigoTransporte` como `CLOUDFLARE_ORIGIN_FAIL` e segue para a próxima variante (com backoff curto, igual aos demais 5xx).
3. **Reclassificar no diagnóstico final** quando `!respondeu`:
   - Se **todas** as tentativas com upstream foram `cfOriginFail` ⇒ mantém `CLOUDFLARE_ORIGIN_FAIL` (mensagem atual sobre A1/binding está correta).
   - Se **pelo menos uma** tentativa devolveu HTTP da SEFAZ (500/4xx) ⇒ novo código `AN_INSTAVEL` com mensagem honesta: "Worker mTLS conseguiu falar com a SEFAZ (caso contrário todas as 4 tentativas retornariam 520 do Cloudflare). O BIG-IP do AN devolveu HTTP 500/520 intermitentes. Aguarde 1‑2 min e tente de novo."
4. **Expor `tentativasUpstream`** no JSON de resposta (já é consumido por `DistDFeHistorico` no toast — facilita diagnóstico futuro sem precisar abrir logs).

## Fora de escopo

- Alterar o Worker do Cloudflare (não há indício de problema).
- Mexer em `sefaz-proxy/index.ts` (caminho de autorização/cancelamento usa uma única chamada — não há padrão de tentativas para reclassificar).
- Mexer em frontend (`DistDFeHistorico.tsx` já mostra `erro` retornado pela função).

## Verificação após implementar

1. Build/typecheck passa.
2. Acionar manualmente "Sincronizar agora" no Portal Fiscal:
   - Se AN voltar a responder normal ⇒ sync completa OK.
   - Se persistir instabilidade ⇒ toast mostra "AN instável" com o resumo das tentativas, não a mensagem falsa sobre certificado A1.
3. Verificar nos logs da função que `tentativasUpstream` aparece na resposta final de falha.
