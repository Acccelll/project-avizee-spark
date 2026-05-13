## Objetivo
Corrigir o fluxo completo de lançamento de NF de saída para que uma NF importada por XML com protocolo seja salva sem disparar o bloqueio indevido de itens, preservando as travas normais após a gravação.

## Problema encontrado
O erro real está no backend: a RPC `salvar_nota_fiscal` grava a NF com `status='importada'` e em seguida tenta substituir os itens da mesma NF. Como o trigger `trg_nf_itens_protege_edicao` bloqueia alterações em itens quando a NF já está `importada`, a própria operação atômica se auto-bloqueia.

## Plano
1. Ajustar a RPC atômica de salvamento
- Atualizar `public.salvar_nota_fiscal` para executar o fluxo interno de salvar cabeçalho + substituir itens com a flag transacional `app.nf_internal_op='1'` ativa.
- Garantir limpeza segura dessa flag ao final e em caso de exceção, para não vazar estado entre operações.
- Manter a normalização canônica de `origem` já adicionada.

2. Validar a coerência do fluxo de NF de saída importada
- Revisar o payload enviado por `src/pages/Fiscal.tsx` no fluxo de importação XML de saída para manter a semântica correta: `status='importada'`, `status_sefaz='importada_externa'`, `origem='xml_importado'`.
- Confirmar que não há outro ponto do fluxo tentando contornar as travas pelo front em vez de usar a RPC corretamente.

3. Cobrir os dois caminhos de UI que usam a mesma RPC
- Verificar o modal/listagem em `src/pages/Fiscal.tsx`.
- Verificar o formulário dedicado em `src/pages/fiscal/hooks/useFiscalNotaForm.ts` para garantir que a correção centralizada no backend protege ambos os caminhos.

4. Adicionar validação de regressão
- Incluir cobertura de regressão para o caso “NF importada via XML com itens + status importada” salvando com sucesso.
- Validar também que a trava continua funcionando para edição estrutural posterior de NF já importada fora da operação interna.

5. Validar end-to-end após a correção
- Reexecutar o cenário de lançamento de NF de saída importada por XML.
- Confirmar que a NF salva, os itens persistem, o evento fiscal continua sendo registrado e a geração financeira de saída continua funcionando quando houver duplicatas.

## Detalhes técnicos
- Arquivo de banco principal: função `public.salvar_nota_fiscal`.
- Gatilho que hoje falha corretamente, mas no momento errado: `public.trg_nf_itens_protege_edicao()`.
- Caminhos de frontend impactados: `src/pages/Fiscal.tsx` e `src/pages/fiscal/hooks/useFiscalNotaForm.ts`.
- Estratégia preferida: corrigir no backend, não afrouxar o trigger nem maquiar o status no frontend.