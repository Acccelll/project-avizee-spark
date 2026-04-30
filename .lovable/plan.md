## Objetivo
Restabelecer a consulta por chave no módulo Fiscal antes de qualquer avanço no QR Code. O critério de sucesso será: a busca deixar de falhar por transporte e passar a devolver resposta oficial do Ambiente Nacional — seja XML disponível, seja retorno fiscal legítimo como cStat 137/138/640/656 etc.

## Diagnóstico confirmado
- A falha atual não está no portal público da NF-e. O erro ocorre no nosso canal técnico de integração.
- A edge `sefaz-distdfe` está recebendo a requisição (`consultar-chave`, ambiente produção, chave informada), mas não chega ao log de `retDistDFeInt`. Ou seja: o problema acontece antes do parsing da resposta.
- O erro exibido ao usuário é de transporte (`connection reset by peer`) contra `https://www1.nfe.fazenda.gov.br/NFeDistribuicaoDFe/NFeDistribuicaoDFe.asmx`.
- Pelos anexos/manuais, a consulta por DistDFe precisa aderir estritamente ao contrato do webservice do Ambiente Nacional.
- Revendo o código atual, há dois pontos de risco fortes:
  1. o envelope do `sefaz-distdfe` não envia `nfeCabecMsg` no SOAP Header;
  2. o `pfxToPem` hoje extrai só um certificado do PFX, não a cadeia completa do cliente A1.

## O que vou implementar
### 1) Corrigir a edge `sefaz-distdfe` para aderência completa ao webservice
Arquivo principal: `supabase/functions/sefaz-distdfe/index.ts`

Ajustes:
- Montar o SOAP com `Header` explícito (`nfeCabecMsg`) conforme os manuais/anexos:
  - `cUF`
  - `versaoDados`
  - `indComp` quando aplicável ao contrato do DistDFe
- Manter `SOAP 1.1` e `http1: true / http2: false`.
- Preservar `distDFeInt versao="1.01"` e `consChNFe`.
- Garantir coerência entre:
  - URL chamada
  - ambiente (`tpAmb`)
  - cabeçalho SOAP
  - `cUFAutor`

### 2) Corrigir o uso do certificado A1 no mTLS
Ainda em `supabase/functions/sefaz-distdfe/index.ts`

Ajustes:
- Alterar a extração do PFX para montar o PEM com a cadeia completa do certificado cliente (leaf + intermediários), não apenas o primeiro `certBag`.
- Manter a extração do CNPJ a partir do certificado principal.
- Se necessário, alinhar essa mesma correção no `sefaz-proxy`, para não deixar dois comportamentos diferentes no backend fiscal.

### 3) Instrumentar logs técnicos úteis para fechar a causa raiz
Arquivos:
- `supabase/functions/sefaz-distdfe/index.ts`
- possivelmente `supabase/functions/sefaz-proxy/index.ts`

Ajustes:
- Logar, sem expor segredos:
  - URL final
  - ambiente
  - tipo de ação
  - tamanho do envelope
  - status HTTP
  - headers relevantes de resposta
  - trecho controlado do XML retornado, quando houver
  - classificação precisa do erro de TLS/handshake/reset
- Isso permitirá separar com clareza:
  - erro de contrato SOAP
  - rejeição de mTLS/cadeia
  - rejeição fiscal oficial com `cStat`

### 4) Ajustar a UI para refletir o resultado real do serviço
Arquivo principal: `src/pages/fiscal/components/BuscarPorChaveDialog.tsx`

Ajustes:
- Manter a busca local primeiro.
- Quando for à SEFAZ, tratar como sucesso funcional qualquer resposta oficial do serviço, mesmo sem XML:
  - exibir `cStat` e `xMotivo` com clareza
  - diferenciar erro técnico de erro fiscal
- Remover mensagens genéricas demais quando já existir retorno oficial.
- Critério esperado para o usuário:
  - ou baixa o XML;
  - ou informa corretamente por que o XML não pode ser obtido.

## Validação que farei após implementar
1. Executar a consulta pela mesma chave real usada no erro.
2. Confirmar que o retorno deixa de ser “connection reset by peer”.
3. Validar um destes desfechos aceitáveis:
   - XML retornado e cacheado em `nfe_distribuicao`;
   - retorno oficial do Ambiente Nacional com `cStat/xMotivo`.
4. Revisar logs da edge para comprovar que o fluxo completou handshake + request + resposta.
5. Só depois disso retomar a etapa de QR Code.

## Resultado esperado desta etapa
- A funcionalidade “Buscar por chave” ficará operacional e auditável.
- O scanner/QR Code passará a depender de um backend já confiável, em vez de herdar uma integração instável.

## Arquivos previstos
- `supabase/functions/sefaz-distdfe/index.ts`
- `supabase/functions/sefaz-proxy/index.ts` (se necessário para alinhar mTLS/cadeia)
- `src/pages/fiscal/components/BuscarPorChaveDialog.tsx`
- `mem/features/fiscal-consulta-por-chave.md`

## Aceite
Considerarei esta etapa concluída somente quando a consulta por chave parar de falhar por transporte e passar a entregar resposta fiscal oficial utilizável.