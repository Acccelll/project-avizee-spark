## Editar Lançamento — Melhorias do formulário

Escopo: `src/pages/financeiro/components/FinanceiroLancamentoForm.tsx` (UI) + uso de helper existente `displayObservacoes` (já criado). Sem mudanças de schema, RPCs ou services.

### Alta prioridade

1. **Status já é parcialmente protegido — reforçar microcopy**
   - O componente já bloqueia `pago/parcial` (readonly) e oferece apenas `Aberto` e `Cancelado` no Select. Manter.
   - Trocar a frase explicativa por algo mais direto: *"Pago/Parcial são definidos automaticamente pelas baixas. Para liquidar, use **Registrar Baixa**."*
   - Adicionar tooltip no label "Status" com o mesmo texto.

2. **Data Pagamento desabilitada em lançamento aberto**
   - Quando `form.status !== "pago" && form.status !== "parcial"`, desabilitar o `Input type="date"` de `data_pagamento`.
   - Substituir o valor visual por placeholder "Preenchida na baixa".
   - Microcopy abaixo do campo: *"Preenchida automaticamente ao registrar baixa."*
   - Em modo `edit`, se já houver `data_pagamento` (caso histórico), mostrar readonly em vez de input editável.

3. **"Ler boleto" só para boleto/boleto_dda**
   - Trocar a condição `form.tipo === "pagar"` por `form.tipo === "pagar" && (form.forma_pagamento === "boleto" || form.forma_pagamento === "boleto_dda" || !form.forma_pagamento)`.
   - Mantém o botão visível antes de escolher forma (default plausível); some quando o usuário escolhe PIX/Cartão/Transferência/Dinheiro.

4. **Cartão obrigatório quando forma = cartão de crédito**
   - Remover o fallback `<Input placeholder="Nome do cartão">` quando `cartoes.length === 0`. Em vez disso, exibir um aviso: *"Nenhum cartão cadastrado. Cadastre em **Financeiro → Cartões** para usar esta forma de pagamento."* com link/botão para a rota de cartões.
   - Bloquear submit (validação local) quando `forma_pagamento === "cartao_credito"` e `!form.cartao_id` — toast de erro.
   - Ocultar o campo "Cartão" quando a forma de pagamento **não** for `cartao_credito` (hoje ele aparece sempre).

5. **Conta Bancária condicional à forma**
   - Ocultar o campo "Conta Bancária" quando `forma_pagamento === "cartao_credito"` (a conta é definida na fatura do cartão).
   - Manter visível para: vazio, pix, boleto, boleto_dda, transferencia, debito, dinheiro, outros.
   - Microcopy: *"Conta prevista para liquidação. Não obrigatório."*

6. **Observações — eliminar `[object Object]` na exibição**
   - O `Textarea` mostra `form.observacoes` cru. Quando o valor inicial vier com `"[object Object]"` ou JSON serializado, normalizar **uma vez** ao carregar para edição com `displayObservacoes` (helper já existente em `src/lib/displayLancamento.ts`).
   - Aplicação: no ponto onde o form é populado para edição (provavelmente `useFinanceiroActions`/`Financeiro.tsx` onde se faz `setForm({...lancamento})`). Tratamento puramente cosmético — não altera valor no banco até o usuário salvar.
   - Alternativa simpler se preferir manter escopo só no form: aplicar `displayObservacoes` ao receber `form.observacoes` via `useMemo` para exibição inicial e gravar a versão normalizada de volta no form na primeira renderização (efeito controlado por `mode === "edit"`).

### Média prioridade

7. **Valor com prefixo R$**
   - Envolver o `Input type="number"` numa div com prefix visual `R$` (estilo `pl-9` + span absoluto), mantendo o `type=number` para compatibilidade com `step=0.01`. Sem trocar para mascara customizada (evita regressão).

8. **Fornecedor/Cliente dinâmico — já está correto**
   - Já há renderização condicional (`form.tipo === "receber"` → Cliente; `=== "pagar"` → Fornecedor). Sem mudança.

9. **Indicador de alterações não salvas**
   - Comparar `form` com snapshot inicial via `useMemo` + `JSON.stringify`. Quando dirty, mostrar dot/pulso ao lado do botão "Salvar" e usar `useBeforeUnloadGuard` (hook já existente) para alertar fechamento.

### Baixa prioridade

10. **Tooltips** em "Status" e "Data Pagamento" (já cobertos nos itens 1 e 2).
11. **Microcopy** dos campos condicionais (já cobertos nos itens 4 e 5).

### Arquivos alterados

- `src/pages/financeiro/components/FinanceiroLancamentoForm.tsx` — todas as mudanças de UI/visibilidade/validação.
- Possivelmente `src/pages/financeiro/hooks/useFinanceiroActions.ts` ou `src/pages/Financeiro.tsx` — apenas para normalizar `observacoes` ao popular o form em edição (item 6, se escolhermos o caminho "na entrada").

### Fora do escopo

- Trigger de banco já garante que `pago/parcial` só via baixa (mem `lancamento-pago-requer-baixa`).
- Não há mudança em RPCs, services, schema, ou no fluxo de baixa.
- Não tocaremos no Drawer (já tratado em ciclo anterior).

### Validação

- `tsc` clean.
- Smoke manual: abrir form em `create` e `edit`; alternar formas de pagamento (pix → boleto → cartao_credito) e verificar visibilidade de Cartão / Conta Bancária / Ler boleto; tentar salvar cartão sem `cartao_id`; abrir lançamento com `observacoes = "[object Object]"` legado e confirmar renderização limpa.
