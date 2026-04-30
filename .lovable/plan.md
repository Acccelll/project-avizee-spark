## Diagnóstico confirmado no estado atual do projeto

A causa raiz está consistente com o que você descreveu e foi validada no código atual:

- `src/services/fiscal/sefaz/consulta.service.ts` monta `consSitNFe`, mas hoje chama `enviarParaSefaz(...)`.
- `src/services/fiscal/sefaz/httpClient.service.ts` só conhece dois caminhos: `assinar-e-enviar` e `assinar-e-enviar-vault`.
- `supabase/functions/sefaz-proxy/index.ts` implementa esses dois caminhos sempre passando por `assinarXml(...)`.
- `assinarXml(...)` exige `<infNFe>`, o que não existe em `consSitNFe`.
- Além disso, `consulta.service.ts` hoje fixa `<tpAmb>2</tpAmb>`, enquanto `useSefazAcoes.consultar` resolve a URL pelo ambiente configurado mas não repassa `cfg.ambiente` à consulta.

Resultado: a consulta de protocolo por chave está usando um fluxo pensado para documentos que exigem XMLDSig, e falha antes de chegar corretamente ao webservice `NFeConsultaProtocolo4`.

Também confirmei que `BuscarPorChaveDialog.tsx` hoje não usa consulta de protocolo; ele faz busca local + `sefaz-distdfe` (`consChNFe` via DistDFe), então o texto da UI precisa deixar essa distinção mais explícita.

## Plano de correção

### 1. Separar explicitamente os dois fluxos SEFAZ

Manter dois caminhos distintos, sem mudar a arquitetura geral do módulo:

- **Consulta de situação/protocolo por chave**
  - serviço `NFeConsultaProtocolo4`
  - XML `consSitNFe`
  - mTLS com certificado A1
  - **sem assinatura XMLDSig**

- **Busca/importação de XML/resumo**
  - serviço `NFeDistribuicaoDFe`
  - XML `consChNFe` / `distNSU`
  - manter comportamento atual e limitação de destinatário do certificado

### 2. Adicionar action sem assinatura na edge function fiscal

Arquivo:
- `supabase/functions/sefaz-proxy/index.ts`

Implementação planejada:
- criar action dedicada, preferencialmente `enviar-sem-assinatura-vault` (ou `consultar-nfe-protocolo`, se for melhor para deixar o contrato mais explícito)
- exigir JWT igual às demais actions
- ler `CERTIFICADO_PFX_SENHA`
- baixar `dbavizee/certificados/empresa.pfx`
- converter PFX para PEM
- criar client mTLS
- montar e enviar o envelope SOAP para a URL recebida
- **não** chamar `assinarXml()`
- retornar contrato padronizado:
  - `{ sucesso, xmlRetorno, erro, statusHttp? }`

A implementação vai reaproveitar a autenticação e a leitura do certificado já existentes, extraindo apenas a parte de transporte mTLS para não duplicar lógica desnecessariamente.

### 3. Ajustar o cliente fiscal para suportar envio sem assinatura

Arquivo:
- `src/services/fiscal/sefaz/httpClient.service.ts`

Mudança planejada:
- manter `enviarParaSefaz(...)` para fluxos que exigem assinatura
- adicionar um caminho dedicado para SOAP sem assinatura em Vault, sem quebrar os serviços atuais
- esse caminho novo chamará a nova action da edge function em vez de `assinar-e-enviar-vault`

Objetivo:
- consulta/protocolo não passa mais pelo fluxo de assinatura
- autorização, cancelamento, inutilização, CC-e e manifestação continuam no fluxo atual

### 4. Corrigir `consulta.service.ts`

Arquivo:
- `src/services/fiscal/sefaz/consulta.service.ts`

Mudanças planejadas:
- remover `tpAmb` hardcoded como `2`
- receber `ambiente: "1" | "2"` do caller
- montar `consSitNFe` com o ambiente real
- enviar pelo novo fluxo sem assinatura
- continuar usando `SOAPAction` de `NFeConsultaProtocolo4`
- enriquecer o parse de `retConsSitNFe` para expor:
  - `cStat`
  - `xMotivo`
  - `nProt`
  - `dhRecbto`
  - `tpAmb`
  - possíveis mensagens de erro úteis para UI

### 5. Corrigir o caller do módulo Fiscal

Arquivo:
- `src/pages/fiscal/hooks/useSefazAcoes.ts`

Mudanças planejadas:
- em `consultar`, continuar resolvendo a URL por `resolverUrlSefaz(cfg.uf, cfg.ambiente, "consulta")`
- passar também `cfg.ambiente` para `consultarNFe(...)`
- preservar o comportamento atual do painel de ações da SEFAZ

Também vou revisar `src/pages/fiscal/hooks/useSefazConsulta.ts` porque ele consome `consultarNFe(...)` e a assinatura da função mudará.

### 6. Melhorar mensagens de erro e retorno real da SEFAZ

Escopo da melhoria:
- certificado ausente ou não encontrado no storage
- senha do certificado ausente
- ambiente incompatível
- UF não mapeada
- nota não localizada
- retorno real de `cStat/xMotivo`

Abordagem:
- priorizar a mensagem oficial vinda da SEFAZ quando existir
- só usar mensagens heurísticas quando não houver retorno útil do webservice
- manter distinção clara entre:
  - erro de transporte/certificado
  - erro de ambiente/configuração
  - rejeição/resultado funcional da SEFAZ

### 7. Revisar a UX do diálogo “Buscar por chave”

Arquivo:
- `src/pages/fiscal/components/BuscarPorChaveDialog.tsx`

Mudanças planejadas:
- deixar explícito que esse diálogo faz:
  - busca local em XMLs já recebidos
  - tentativa de obtenção via DistDFe
- deixar explícito que **não é** uma consulta pública universal de qualquer NF-e por chave
- preservar o comportamento de DistDFe, apenas corrigindo a comunicação ao usuário
- alinhar os textos com a limitação real do Ambiente Nacional e do certificado A1

### 8. Adicionar testes unitários cobrindo a separação dos fluxos

Arquivos previstos:
- `src/services/fiscal/sefaz/__tests__/consulta.test.ts`
- possivelmente ajuste em mocks compartilhados dos serviços de SEFAZ

Coberturas planejadas:
- `consultarNFe` monta `consSitNFe` com `tpAmb` correto
- consulta usa o caminho sem assinatura
- parse de `retConsSitNFe` retorna `cStat`, `xMotivo`, `nProt`
- DistDFe permanece separado e não é afetado pela correção
- `useSefazAcoes.consultar` passa o ambiente configurado ao serviço

## Detalhes técnicos

```text
UI Fiscal (consultar)
  -> useSefazAcoes.consultar(nf)
    -> resolverUrlSefaz(cfg.uf, cfg.ambiente, "consulta")
    -> consultarNFe(chave, ambiente, url)
      -> httpClient sem assinatura
        -> sefaz-proxy action enviar-sem-assinatura-vault
          -> lê PFX + senha
          -> converte PFX -> PEM
          -> cria client mTLS
          -> envia SOAP NFeConsultaProtocolo4
          -> retorna xmlRetorno
      -> parse retConsSitNFe
      -> devolve cStat/xMotivo/nProt
```

## Arquivos que pretendo alterar

- `supabase/functions/sefaz-proxy/index.ts`
- `src/services/fiscal/sefaz/httpClient.service.ts`
- `src/services/fiscal/sefaz/consulta.service.ts`
- `src/pages/fiscal/hooks/useSefazAcoes.ts`
- `src/pages/fiscal/hooks/useSefazConsulta.ts`
- `src/pages/fiscal/components/BuscarPorChaveDialog.tsx`
- `src/services/fiscal/sefaz/__tests__/consulta.test.ts`
- possivelmente um arquivo de export/index se a assinatura pública do serviço mudar

## Resultado esperado

Após a correção:
- consulta por chave no módulo Fiscal passa a usar o webservice correto de protocolo, com mTLS e sem XMLDSig
- DistDFe continua responsável apenas por busca/importação de XML/resumo destinado ao CNPJ do certificado
- o ambiente usado na consulta passa a respeitar a configuração real da empresa
- o usuário recebe o `cStat/xMotivo` real da SEFAZ quando houver resposta funcional
- os testes impedem regressão desse acoplamento indevido entre consulta e assinatura
