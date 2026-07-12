## Backlog de Conciliação de Cartão — plano de execução

Do backlog de 5 itens levantado, um já está parcialmente coberto pelo backend (idempotência de linha via `cartao_fatura_lancamentos.hash` — a RPC `cartao_importar_fatura` já retorna `duplicadas`). Sobram 4 frentes; proponho executá-las em **3 fases** por afinidade técnica.

### Fase 1 — Guard-rails do import (rápido, sem migração)

**Item 4 — Validação de cartão errado no PDF**
- No `ImportarFaturaCartaoDialog`, comparar os `ultimos4` extraídos do PDF com o `ultimos4` do cartão selecionado. Se divergirem, exibir aviso bloqueante com opção "Importar mesmo assim" (mesmo padrão do FITID no OFX).
- Extrair `ultimos4` predominante do `FaturaImportInput.lancamentos[].ultimos4` (moda) e comparar com `cartoes_credito.ultimos4`.

**Item 3 — Reimport idempotente do header**
- Adicionar coluna `arquivo_hash text` em `cartao_faturas` (migração).
- No frontend, calcular SHA-256 do PDF antes de chamar a RPC e passar como novo parâmetro `p_arquivo_hash`.
- Ajustar `cartao_importar_fatura` para reutilizar `cartao_faturas` existente quando `(cartao_id, arquivo_hash)` já existe (em vez de criar segunda fatura para o mesmo arquivo).

### Fase 2 — Fechar o ciclo com a conciliação bancária

**Item 1 — Pareamento automático baixa da fatura ↔ linha OFX**
- Hoje `baixar_fatura_cartao` cria um `financeiro_baixas` com `grupo_baixa_id`; o débito aparece no extrato mas o pareamento na tela de conciliação bancária depende do matcher genérico.
- Reforçar o matcher (`scoreExtratoPendentes.service` / `rulesEngine`) para priorizar baixas de fatura de cartão: match forte por (`data_baixa` ± 3d, `valor` exato, `conta_bancaria_id`). Score >= 0.9.
- Exibir badge "Fatura de cartão" na `OFXMatchingPane` quando o candidato vier de `grupo_baixa_id` de fatura.

### Fase 3 — Conciliação linha-a-linha e OFX de cartão

**Item 2 — UI de conciliação linha-a-linha da fatura**
- Nova aba/dialog "Conciliar lançamentos" na `ConciliacaoCartao.tsx`, listando `cartao_fatura_lancamentos` (via nova RPC `cartao_fatura_listar_linhas`).
- Cada linha pode ser: (a) vinculada a um `financeiro_lancamentos` existente (compras parceladas), (b) transformada em novo lançamento a pagar, (c) marcada como pessoal/desconsiderar.
- Persistir vínculo em `cartao_fatura_lancamentos.lancamento_id` e `status` (`pendente|vinculada|criada|ignorada`).

**Item 5 — Adapter OFX para faturas de cartão**
- Reaproveitar `adaptOFX` e adicionar detecção pelo header OFX (`<CCSTMTRS>` = cartão vs `<STMTRS>` = conta corrente).
- Novo diálogo unificado ou botão adicional "Importar OFX de cartão" chamando a mesma RPC `cartao_importar_fatura` com origem `ofx_cartao`.

### Ordem de execução

1. Fase 1 (Itens 4 + 3) — entrega imediata, baixo risco.
2. Fase 2 (Item 1) — depende de migração leve (nenhuma), só matcher.
3. Fase 3 (Itens 2 + 5) — maior escopo, entregar por último.

Cada fase será verificada com build limpo antes de seguir para a próxima. Sem alteração de outros módulos além dos arquivos de conciliação de cartão, matcher financeiro e uma migração SQL de coluna.