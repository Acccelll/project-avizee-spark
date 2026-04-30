Diagnóstico confirmado

A falha não está no modal nem no parser do XML. O fluxo front → backend está chegando até a função de backend, mas a consulta está sendo disparada no ambiente errado.

Evidências encontradas
- O fluxo da tela está correto: `BuscarPorChaveDialog` faz primeiro a busca local em `nfe_distribuicao` e, se não achar, chama a função `sefaz-distdfe` com `action: "consultar-chave"`.
- Os logs da função confirmam requisições reais com a chave informada e `ambiente: "2"`.
- No banco, `empresa_config` está salvo com:
  - `ambiente_padrao = 'homologacao'`
  - `ambiente_sefaz = '2'`
- O certificado configurado existe e, pelos metadados salvos, está válido até `2026-12-26`.
- `nfe_distribuicao` está vazio e `nfe_distdfe_sync` também está vazio, então o problema não é cache local, duplicidade nem XML já sincronizado.
- O erro exibido pelo sistema aponta exatamente para o endpoint de homologação:
  `https://hom.nfe.fazenda.gov.br/NFeDistribuicaoDFe/NFeDistribuicaoDFe.asmx`
  com `Connection reset by peer`.

Causa real
- A busca por chave está sendo enviada para homologação porque a configuração fiscal da empresa está em homologação.
- Para notas reais de entrada, isso bloqueia a consulta no handshake/conexão com o endpoint de homologação, antes mesmo de haver retorno SOAP útil.
- Ou seja: hoje o sistema está obedecendo a configuração salva, mas essa configuração está incompatível com o uso esperado do recurso.

O que vou corrigir
1. Ajustar a configuração fiscal para que a consulta por chave use o ambiente correto da empresa.
2. Endurecer o fluxo da busca por chave para não depender silenciosamente de uma configuração errada:
   - exibir claramente o ambiente ativo dentro do diálogo;
   - melhorar a mensagem de erro para deixar explícito quando a consulta foi feita em homologação;
   - permitir tentativa guiada no ambiente correto quando houver indício de incompatibilidade.
3. Revisar a função `sefaz-distdfe` para retornar diagnóstico mais objetivo no caso de reset de conexão, incluindo ambiente efetivo usado e contexto do certificado.
4. Validar o fluxo completo: cache local → chamada da função → retorno do XML → processamento da NF de entrada.

Arquivos/áreas a revisar na implementação
- `src/pages/fiscal/components/BuscarPorChaveDialog.tsx`
- `src/pages/fiscal/ConfiguracaoFiscal.tsx`
- `src/services/fiscal.service.ts`
- `supabase/functions/sefaz-distdfe/index.ts`

Detalhes técnicos
- Hoje o front lê `empresa_config.ambiente_sefaz` e, quando ele vale `2`, força a consulta para homologação.
- A função `sefaz-distdfe` recebeu exatamente esse valor nos logs recentes.
- O certificado não aparenta estar expirado, então a hipótese principal não é vencimento do A1, e sim ambiente incorreto para a consulta que está sendo tentada.
- Não há evidência de quebra no parser, no modal ou no armazenamento local da distribuição.

Se aprovar, eu aplico a correção completa no fluxo e deixo a busca por chave mais robusta para não voltar a falhar de forma silenciosa.