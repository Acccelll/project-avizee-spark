---
name: Vencimento e parcelas na NF
description: Campos data_vencimento, numero_parcelas, intervalo_parcelas_dias e parcelas (jsonb) em notas_fiscais; UI no PagamentoNFe gera tabela editável; soma das parcelas validada pelo schema Zod
type: feature
---
- Tabela `notas_fiscais` ganhou: `data_vencimento DATE`, `numero_parcelas INT >=1`, `intervalo_parcelas_dias INT >=0`, `parcelas JSONB` ([{numero,vencimento,valor}]).
- UI: `src/pages/fiscal/components/NFeForm/PagamentoNFe.tsx`. Switch `geraFinanceiro` controla visibilidade. Botão "Recalcular parcelas" e auto-gera quando vazio.
- Schema Zod (`schema.ts`) valida soma(parcelas) == total NF (tolerância 0,01).
- Quando `parcelas` é null, o financeiro deve calcular determinísticamente a partir de `data_vencimento + intervalo_parcelas_dias × n`. Idempotência: chave lógica `(nota_fiscal_id, numero_parcela)`.
