## Diagnóstico

Quando a forma de pagamento é **Cartão de Crédito**, o `ParcelasFiscalEditor` (`src/pages/fiscal/components/ParcelasFiscalEditor.tsx`) continua calculando vencimentos como boleto — `primeiroVencimento + intervaloDias × i` —, ignorando `dia_fechamento`/`dia_vencimento` do cartão. O preview "Faturas previstas para este cartão" (em `NfeFormBody.tsx:247-264`) já mostra as datas corretas via `calcularFaturasParcelas`, mas é só visualização: a tabela editável usada para persistir continua errada. Resultado: o usuário vê dois cronogramas conflitantes (27/05, 26/06, 26/07… na tabela vs. 10/05, 10/06, 10/07… no preview), e o que persiste é o errado.

## Plano

### 1) `ParcelasFiscalEditor.tsx` — aceitar contexto de cartão

Adicionar prop opcional:

```ts
cartao?: { dia_fechamento: number; dia_vencimento: number } | null;
```

Quando `cartao` estiver presente:
- Substituir o `useEffect` que chama `gerarPlanoParcelas` por um caminho que usa `calcularFaturasParcelas(dataEmissao, cartao.dia_fechamento, cartao.dia_vencimento, qtdParcelas)` e distribui o `total` em parcelas com mesma regra de centavos (último absorve resto).
- Forçar `primeiroVencimento` para a `dataVencimento` da 1ª fatura (chamar `onPrimeiroVencimentoChange`) — mantém o estado do pai coerente para persistência.
- Desabilitar os inputs **1º Vencimento** e **Intervalo entre parcelas**, com hint: *"Definidos pela fatura do cartão (fechamento dia X, vencimento dia Y)."*
- Desabilitar o input de **Vencimento** de cada linha de parcela (valor segue editável para ajuste de centavos). Tooltip: *"Vencimento determinado pela fatura."*

### 2) `NfeFormBody.tsx` — passar o cartão e remover duplicação

- Resolver o objeto `cartaoSelecionado = cartoes.find(c => c.id === form.cartao_id)` quando `forma_pagamento === "cartao_credito"`.
- Passar `cartao={cartaoSelecionado}` ao `<ParcelasFiscalEditor>` (linhas 234-246).
- Manter o bloco "Faturas previstas" como **hint** apenas quando `condicao_pagamento === "a_vista"` ou enquanto o editor de parcelas não estiver visível; quando o editor estiver visível com `cartao`, remover o bloco para não duplicar. Alternativa mais simples: manter o hint pequeno acima da tabela, com texto encurtado ("Vencimentos seguem fatura do cartão · fecha dia X · vence dia Y"). Vou adotar esta alternativa.

### 3) À vista + cartão (1 parcela)

Quando `condicao_pagamento === "a_vista"` e `forma_pagamento === "cartao_credito"`, a NF gera um único lançamento. Hoje o `form.data_vencimento` é setado em outro ponto (resolvido na confirmação pela `useFinanceiroActions`/RPC do financeiro via `cartao_fatura_para_data`). Não há mudança necessária aqui — a NF passa `forma_pagamento` e `cartao_id` para o lançamento e a resolução de fatura acontece no momento da criação do lançamento (já corrigido em turno anterior).

### 4) Persistência

Nenhuma mudança no schema/RPC. O `parcelasPlano` já é JSON livre `[{numero, vencimento, valor}]` em `notas_fiscais.parcelas` (memo `fiscal-vencimento-parcelas`). A única mudança é o cálculo dos `vencimento` antes de persistir.

## Validação

- Editar NF de saída com `forma_pagamento=cartao_credito`, cartão "C6 ····3710" (fechamento 04, vencimento 10), data emissão 27/04/2026, 9 parcelas → tabela deve mostrar 10/05, 10/06, …, 10/01/2027 — alinhado com o preview "Faturas previstas".
- Trocar cartão → datas recalculam.
- Trocar `forma_pagamento` para `boleto` → editor volta a permitir 1º vencimento/intervalo livres e usa cálculo antigo.
- Valor total batendo (soma das parcelas = total NF, último absorve resto).
- À vista + cartão: NF salva normalmente; lançamento criado na confirmação herda o vencimento da fatura.

## Arquivos afetados

- `src/pages/fiscal/components/ParcelasFiscalEditor.tsx`
- `src/pages/fiscal/components/NfeFormBody.tsx`
