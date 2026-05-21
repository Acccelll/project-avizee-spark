## Diagnóstico

O fluxo de auto-confirmação já existe e está documentado em `mem://features/auto-confirm-nf`:

- Ao salvar uma NF (`mode === "create"` em `src/pages/Fiscal.tsx`, linhas ~1096–1139), o ERP chama automaticamente `confirmarMutation.mutateAsync` → RPC `confirmar_nota_fiscal`, que movimenta estoque e gera o financeiro de acordo com `condicao_pagamento` / `parcelas`.
- O botão "Concluir lançamento" só aparece como **fallback** quando a NF fica pendente (faltou condição financeira).

O motivo pelo qual a NF aparece como **Pendente** hoje (e exige clicar em "Concluir lançamento" manualmente) é que tanto a auto-confirmação no salvar quanto a confirmação manual estão **falhando com o mesmo erro**:

```
42703: column "confirmada_em" of relation "notas_fiscais" does not exist
```

A RPC `public.confirmar_nota_fiscal` faz:

```sql
UPDATE public.notas_fiscais
   SET status = 'confirmada', confirmada_em = now(), updated_at = now()
 WHERE id = p_nf_id;
```

…mas a coluna `confirmada_em` nunca foi criada na tabela (consulta a `information_schema.columns` retorna vazio). Resultado: a auto-confirmação no salvar falha silenciosamente (cai no `logger.error("[fiscal] auto-confirmar NF:", confirmErr)` da linha 1132) e a NF fica gravada como `pendente`. Em seguida, o clique manual também falha e mostra o toast genérico de erro.

Portanto, **não é preciso mexer no fluxo da aplicação** — basta destravar a RPC para que a auto-confirmação que já existe volte a funcionar.

## Correção

Migração única adicionando a coluna usada pela RPC e fazendo backfill das NFs já confirmadas:

```sql
ALTER TABLE public.notas_fiscais
  ADD COLUMN IF NOT EXISTS confirmada_em timestamptz;

UPDATE public.notas_fiscais
   SET confirmada_em = updated_at
 WHERE status = 'confirmada'
   AND confirmada_em IS NULL;
```

Sem alterações em código TS/TSX — o serviço (`confirmarNotaFiscal` em `src/services/fiscal/lifecycle.service.ts`) e o handler de salvar em `src/pages/Fiscal.tsx` já chamam a RPC corretamente.

## Validação

1. Aplicar a migração.
2. Em `/fiscal?tipo=entrada`, **lançar uma nova NF manual** com forma e condição de pagamento preenchidas (`a_vista` ou parcelas completas).
3. Esperado: ao salvar, a NF já aparece **Confirmada**, com movimento de estoque e lançamento(s) em `financeiro_lancamentos` gerados automaticamente — sem necessidade do botão "Concluir lançamento".
4. Para NFs salvas como `pendente` (faltou condição financeira), o botão "Concluir lançamento" deve agora funcionar sem erro `42703`.
