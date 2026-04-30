
## Diagnóstico (confirmado em banco e código)

### 1. Importação CR/CP — divergências encontradas

Comparação Excel × banco (`origem_tipo='manual'`):

| | Excel | Banco | Diferença |
|---|---|---|---|
| CP pago | 165 | 161 | **−4** |
| CR pago | 38  | 40  | +2 (duplicações) |
| Erros em `stg_financeiro_aberto` | — | **52** | rejeitados |

**Causa raiz** (RPC `carga_inicial_conciliacao`, linhas 254-261):
A função tenta inserir `status = 'vencido'` quando `data_vencimento < hoje` e não há pagamento. Mas o `chk_financeiro_lancamentos_status` só aceita `aberto/parcial/pago/cancelado` (modelo canônico — `vencido` é derivado, nunca persistido). Resultado: **52 títulos foram silenciosamente descartados** (`new row violates check constraint`).

A `merge_lote_conciliacao` já está correta (usa `aberto/parcial/pago`), mas a primeira carga foi feita pela `carga_inicial`.

### 2. Cliente/Fornecedor faltando
Hoje, todos os 415 lançamentos importados têm cliente/fornecedor vinculado (verificado). Porém, a próxima reimportação pode ter pessoas no CR/CP sem registro nas abas `CLIENTES`/`FORNECEDORES` — atualmente o código só **loga aviso** ("Pessoa não vinculada"), deixa o lançamento órfão.

### 3. NF de entrada — vencimento e parcelamento

`src/pages/Fiscal.tsx` (form de entrada) e `confirmar_nota_fiscal` RPC:
- O form tem condição "À Prazo" + "Nº Parcelas", mas **nenhum campo de data de vencimento nem de valor por parcela**.
- A RPC gera **1 único lançamento** com `data_vencimento = data_emissao` — ignora `parcelas`, não respeita prazo, não cria N parcelas.

## O que será feito

### A) Corrigir RPC `carga_inicial_conciliacao`
Trocar a derivação de status para o modelo canônico:
```
pago    → tem data_pagamento
parcial → valor_pago > 0 e < valor
aberto  → demais (vencido é calculado em runtime via financeiro_status_efetivo)
```

### B) Reprocessar os 52 lançamentos rejeitados
Migration faz `INSERT ... SELECT` direto de `stg_financeiro_aberto` onde `status='erro'` para `financeiro_lancamentos` com status canônico, marcando `origem_tipo='manual'` e `codigo_fluxo_origem` preservado para rastreabilidade. Após sucesso, marca staging como `consolidado`.

### C) Auto-criar pessoas faltantes na importação
Em `carga_inicial_conciliacao` e `merge_lote_conciliacao`: quando `codigo_legado_pessoa` existe mas não há cliente/fornecedor cadastrado, criar registro mínimo a partir do `nome_abreviado` (campo já presente no staging) com `tipo_pessoa='juridica'`, `codigo_legado` = código original. Vincula imediatamente.

### D) Limpar duplicações CR (+2 a mais que o Excel)
Identificar via SQL pares `(tipo, valor, data_vencimento, cliente_id, parcela_numero)` repetidos em `origem_tipo='manual'` e remover o duplicado mais recente (sem baixas).

### E) Entrada de NF — vencimento + parcelamento real

**UI** (`src/pages/Fiscal.tsx`):
- Quando `condicao_pagamento = 'a_prazo'`:
  - Adicionar campo **"Data 1º Vencimento"** (default: emissão + 30d)
  - Adicionar campo **"Intervalo entre parcelas (dias)"** (default 30)
  - Quando `parcelas > 1`: gerar dinamicamente N linhas editáveis com `[Nº | Vencimento | Valor]`, pré-preenchidas igualmente (`total/N`) e datas em sequência. Soma deve fechar com total da NF (validação visual).
  - Persistir array `parcelas_plano` nas observações estruturadas / nova coluna em `notas_fiscais` (`parcelas_plano jsonb`).

**RPC `confirmar_nota_fiscal`**:
- Se `condicao_pagamento='a_prazo'` e existe `parcelas_plano`: iterar e gerar N `financeiro_lancamentos` com `parcela_numero`, `parcela_total`, `data_vencimento` e `valor` por parcela.
- Se `a_prazo` sem plano: fallback gera N parcelas iguais com intervalo 30d a partir de `data_emissao`.
- `a_vista`: comportamento atual (1 lançamento status `pago`).
- Continua idempotente (`NOT EXISTS` por `nota_fiscal_id`).

### F) Garantir espelhamento futuro CR/CP
Adicionar log estruturado pós-importação com diff Excel × banco (contagens por status), exibido na tela de Importação. Permite o usuário ver imediatamente "X linhas do Excel vs Y inseridas".

## Arquivos afetados

**Migrations (nova):**
- Corrige `carga_inicial_conciliacao` (status canônico + auto-criação de pessoa)
- Corrige `merge_lote_conciliacao` (auto-criação de pessoa)
- Reprocessa os 52 erros existentes
- Remove 2 duplicatas de CR
- Adiciona coluna `parcelas_plano jsonb` em `notas_fiscais`
- Atualiza `confirmar_nota_fiscal` para gerar N parcelas

**Código:**
- `src/pages/Fiscal.tsx` — campos de vencimento/intervalo + grid dinâmico de parcelas (nova subcomponent `ParcelasFiscalEditor`)
- `src/pages/fiscal/components/NotaFiscalEditModal.tsx` — mesmo editor reaproveitado
- `src/types/fiscal.ts` — tipo `ParcelaPlano { numero, vencimento, valor }`
- `src/hooks/importacao/useCargaInicial.ts` — exibir contagem rejeitados/criados-auto

## Validação pós-implementação

1. Reexecutar o flag de divergência: total CP pago == 165, CR pago == 38, total CP+CR == 415.
2. Nenhum lançamento com `status='aberto'` e `data_pagamento IS NOT NULL`.
3. Confirmar NF de entrada "à prazo 3x" cria 3 financeiros com vencimentos sequenciais e soma == total NF.
4. Importar planilha com fornecedor novo (não cadastrado) → registro auto-criado e vinculado.
