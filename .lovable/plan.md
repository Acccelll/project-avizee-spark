## Diagnóstico
A causa real não é mais o ambiente de homologação/produção.

A evidência está no erro atual exibido na tela:

```text
https://www1.nfe.fazenda.gov.br/NFeDistribuicaoDFe/NFeDistribuicaoDFe.asmx
client error (SendRequest): http2 error: stream error received: endpoint requires HTTP/1.1
```

Isso mostra que:
- a consulta já está indo para o endpoint de produção;
- a falha ocorre antes do processamento fiscal da NF-e;
- o problema está na camada de transporte HTTP da edge function `sefaz-distdfe`.

Hoje a função cria o cliente mTLS com `Deno.createHttpClient({ cert, key })`, sem restringir protocolo. O endpoint legado `NFeDistribuicaoDFe.asmx` está rejeitando a negociação em HTTP/2 e exige HTTP/1.1. Por isso trocar o ambiente na administração não resolve.

Também revisei a documentação/manual do serviço de distribuição da NF-e e o endpoint continua sendo o webservice SOAP legado do Ambiente Nacional; além disso, a documentação do Deno expõe exatamente os flags `http1` e `http2` para controlar esse comportamento.

## Plano de correção
1. Ajustar a edge function `supabase/functions/sefaz-distdfe/index.ts` para abrir o cliente mTLS forçando HTTP/1.1 e desabilitando HTTP/2.
2. Melhorar o tratamento de erro da função para devolver uma mensagem explícita quando o servidor rejeitar HTTP/2, evitando novo falso diagnóstico de “ambiente incompatível”.
3. Atualizar `src/pages/fiscal/components/BuscarPorChaveDialog.tsx` para exibir a causa correta quando a consulta falhar por protocolo, priorizando a mensagem do backend.
4. Validar o fluxo completo da busca por chave: cache local `nfe_distribuicao` -> consulta SEFAZ -> retorno do XML -> persistência local.
5. Revisar o caminho compartilhado de comunicação SOAP fiscal para evitar reincidência do mesmo problema em outros serviços que venham a usar `createHttpClient` com mTLS.

## Arquivos previstos
- `supabase/functions/sefaz-distdfe/index.ts`
- `src/pages/fiscal/components/BuscarPorChaveDialog.tsx`
- possível revisão auxiliar em serviços fiscais relacionados, se houver reaproveitamento do cliente HTTP

## Detalhes técnicos
- Alteração principal esperada no backend:
  ```ts
  Deno.createHttpClient({
    cert: certPem,
    key: keyPem,
    http1: true,
    http2: false,
  })
  ```
- Manter o restante do fluxo `consChNFe` intacto: geração do `distDFeInt`, envelope SOAP, parse de `retDistDFeInt` e cache em `nfe_distribuicao`.
- Ajustar a heurística atual do frontend, que hoje ainda sugere incompatibilidade de ambiente para erros de conexão; no cenário atual isso mascara a causa verdadeira.
- Não há necessidade de migração de banco para esta correção.

## Validação após a correção
- Testar a mesma chave de 44 dígitos usada no print.
- Confirmar que a chamada chega ao endpoint de produção sem erro de protocolo.
- Confirmar um dos resultados esperados:
  - XML retornado e salvo em cache local; ou
  - resposta fiscal válida da SEFAZ (`cStat`/`xMotivo`), sem erro de transporte.
- Garantir que o toast mostrado ao usuário reflita a causa real da falha, caso a NF-e não pertença ao CNPJ do certificado ou não esteja disponível.

## Resultado esperado
A consulta por chave volta a funcionar no serviço de distribuição da NF-e, e quando houver falha futura o sistema passará a informar corretamente se o problema é de protocolo, vínculo da NF-e com o certificado, indisponibilidade da SEFAZ ou ausência do XML.