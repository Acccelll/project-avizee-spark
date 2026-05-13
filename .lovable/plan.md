## Problema confirmado
O erro não está nas parcelas nem na nova busca de conta contábil. O log mostra que o `POST salvar_nota_fiscal` falha com `23514` na constraint `chk_nf_origem` porque o frontend envia `origem: "importacao_xml"`, enquanto o banco aceita o valor canônico `xml_importado` (entre outros).

## Plano
1. **Normalizar a origem no fluxo de importação de NF**
   - Ajustar o preenchimento do formulário em `Fiscal.tsx` para usar o valor canônico aceito pelo banco ao importar XML.
   - Preservar o comportamento funcional do restante do fluxo (salvar NF, gerar financeiro, registrar evento de importação).

2. **Remover a divergência entre UI e persistência**
   - Atualizar as checagens do frontend que hoje dependem de `form.origem === "importacao_xml"` para usar uma comparação centralizada/compatível com o valor canônico.
   - Revisar rótulos/filtros de origem onde hoje aparece `importacao_xml`, para que a interface continue exibindo “Importação XML” sem depender do valor inválido salvo no banco.

3. **Blindar contra regressão no backend**
   - Revisar a RPC/migrações relacionadas a `salvar_nota_fiscal` e à constraint `chk_nf_origem`.
   - Se necessário, adicionar uma normalização defensiva no backend para converter o alias legado `importacao_xml` em `xml_importado`, evitando nova quebra caso algum outro ponto antigo ainda envie o alias.

4. **Validar o fluxo real que está quebrando**
   - Confirmar que o salvamento da NF de saída importada via XML deixa de retornar 400.
   - Verificar que a geração de financeiro e os eventos de auditoria continuam funcionando após a normalização.

## Detalhes técnicos
- **Frontend afetado:** `src/pages/Fiscal.tsx`, `src/pages/fiscal/hooks/useFiscalFilters.ts` e pontos relacionados a exibição/checagem de origem.
- **Backend afetado:** RPC `salvar_nota_fiscal` e/ou migração defensiva para compatibilizar valores legados.
- **Causa raiz:** incompatibilidade entre valor de enum/check usado no app (`importacao_xml`) e o valor canônico aceito na tabela (`xml_importado`).