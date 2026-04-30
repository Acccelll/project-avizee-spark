# Diagnóstico confirmado

O erro atual não é causado principalmente pelo seletor de ambiente da UI.

Estado real do projeto verificado:
- A busca em `BuscarPorChaveDialog` não usa `consulta.service.ts`; ela chama `sefaz-distdfe` com `action: "consultar-chave"`.
- Portanto, as correções anteriores em `consulta.service.ts` / `sefaz-proxy` para `consSitNFe` não resolvem este fluxo específico.
- O backend persistido ainda está com `empresa_config.ambiente_sefaz = '2'` / `ambiente_padrao = 'homologacao'`, mas o erro foi reproduzido manualmente tanto com `ambiente = '1'` quanto com `ambiente = '2'`.
- Chamada real testada no backend para `sefaz-distdfe` em produção devolveu exatamente `connection reset by peer`.
- Chamada real testada no `sefaz-proxy` para consulta UF/SP devolveu `invalid peer certificate: UnknownIssuer`.

Conclusão técnica:
1. O fluxo “Buscar por chave” continua preso no transporte mTLS do `sefaz-distdfe`.
2. Há um problema real de transporte TLS no backend atual:
   - nos endpoints UF: cadeia de confiança/CA (`UnknownIssuer`);
   - no Ambiente Nacional DistDFe: reset em nível de conexão, compatível com incompatibilidade do runtime Deno/rustls com servidores IIS/Schannel que pedem renegociação TLS.
3. O texto atual que sugere apenas “ambiente incompatível / certificado inválido” está mascarando a causa real.

# Plano de correção

## 1) Corrigir o transporte SOAP/mTLS conforme o manual NF-e
- Ajustar o `sefaz-distdfe` para envio estritamente compatível com SOAP 1.2.
- Corrigir a URL de homologação do Ambiente Nacional para `https://hom1.nfe.fazenda.gov.br/NFeDistribuicaoDFe/NFeDistribuicaoDFe.asmx`.
- Normalizar headers do request para o padrão esperado pelo serviço.
- Manter `HTTP/1.1` forçado.

Arquivos:
- `supabase/functions/sefaz-distdfe/index.ts`

## 2) Resolver a confiança TLS dos endpoints UF
- Adicionar suporte explícito a `caCerts` no cliente HTTP das funções fiscais.
- Embutir/fornecer a cadeia ICP-Brasil necessária para os endpoints SEFAZ que hoje falham com `UnknownIssuer`.
- Aplicar isso no `sefaz-proxy` para os fluxos assinados e sem assinatura.

Arquivos:
- `supabase/functions/sefaz-proxy/index.ts`
- possivelmente helper compartilhado em `supabase/functions/_shared/`

## 3) Reavaliar o DistDFe com o transporte corrigido
- Testar novamente `consultar-chave` após os ajustes de CA + SOAP 1.2 + URL correta.
- Se o Ambiente Nacional continuar resetando a conexão, tratar isso como limitação do runtime atual para esse webservice específico e encapsular um fallback de transporte compatível, sem alterar a arquitetura do módulo Fiscal nem criar tabelas novas.
- O contrato do frontend permanece o mesmo: `BuscarPorChaveDialog` continua chamando `sefaz-distdfe`.

Arquivos:
- `supabase/functions/sefaz-distdfe/index.ts`
- `src/pages/fiscal/components/BuscarPorChaveDialog.tsx` (apenas mensagens/UX, se necessário)

## 4) Corrigir a mensagem exibida ao usuário
- Remover a heurística atual que sugere como causa principal “ambiente incompatível / certificado inválido”.
- Exibir erro técnico honesto quando a falha for de transporte TLS.
- Manter separado o entendimento de:
  - DistDF-e = baixar XML/resumo destinado ao CNPJ do certificado;
  - Consulta SEFAZ = situação/protocolo da NF-e.

Arquivos:
- `supabase/functions/sefaz-distdfe/index.ts`
- `src/pages/fiscal/components/BuscarPorChaveDialog.tsx`

## 5) Validar persistência do ambiente administrativo
- Confirmar no fluxo de Administração/Configuração Fiscal se a troca para Produção está sendo realmente salva e refletida em `empresa_config`.
- Ajustar feedback da tela apenas se houver inconsistência real de persistência.

Arquivos:
- `src/pages/fiscal/ConfiguracaoFiscal.tsx` (somente se a inconsistência for confirmada)

## 6) Cobertura de testes
- Adicionar testes para:
  - resolução correta das URLs AN por ambiente;
  - montagem dos headers SOAP 1.2;
  - mapeamento de erros TLS (`UnknownIssuer`, `reset by peer`);
  - distinção entre falha de transporte e rejeição funcional SEFAZ.

Arquivos:
- testes de edge function / unitários relacionados ao transporte fiscal

# Detalhes técnicos relevantes
- O portal oficial NF-e confirma que `NFeDistribuicaoDFe` usa SOAP 1.2.
- A listagem oficial também aponta homologação do AN em `hom1.nfe.fazenda.gov.br`.
- O padrão do erro encontrado é consistente com limitação conhecida do stack TLS do Deno em alguns servidores IIS/Schannel com mTLS.
- Isso explica por que o ajuste anterior de assinatura XML não resolveu este caso: a falha agora acontece antes da resposta SOAP útil.

# Resultado esperado após a implementação
- `Buscar por chave` deixa de falhar por causa de configuração incorreta de transporte.
- Consultas UF via `sefaz-proxy` deixam de quebrar com `UnknownIssuer`.
- Se o Ambiente Nacional continuar incompatível com o runtime atual, o usuário passa a ter um fluxo funcional com fallback transparente, sem refatorar o módulo Fiscal inteiro.