

# Padronização "Orçamento" + numeração ORC + revisões + PDF

## 1. Nomenclatura: Cotação → Orçamento (apenas lado vendas)

**Regra**: o que vai para CLIENTE = "Orçamento". O que recebemos de FORNECEDOR continua "Cotação de Compra" (intacto).

**Não mexer** (compras / fornecedores):
- `src/pages/CotacoesCompra.tsx`, `CotacaoCompraForm.tsx`
- `src/components/compras/CotacaoCompra*.tsx`, `PedidoCompraDrawer/View`
- `src/lib/cotacaoCompraSchema.ts`, `src/services/comercial/cotacoes.service.ts` (lógica), rota `/cotacoes-compra`
- Coluna DB `ordens_venda.cotacao_id` (nome técnico, fica)

**Renomear textos visíveis (lado vendas)** em:
- `src/lib/comercialWorkflow.ts` → `quote: "Orçamento"`, `quotes: "Orçamentos"`
- `src/pages/OrcamentoForm.tsx` → títulos "Editando Cotação" → "Editando Orçamento", "Nova Cotação" → "Novo Orçamento", labels "Identificação da Cotação" → "Identificação do Orçamento", "Cotação" → "Orçamento" no header card, toasts "Cotação não encontrada" → "Orçamento não encontrado"
- `src/pages/Orcamentos.tsx` → KPIs, colunas, ARIA, `aria-label`
- `src/components/views/OrcamentoView.tsx` → todos os textos "Cotação"
- `src/components/dashboard/ComercialBlock.tsx` → "Cotações em aberto" → "Orçamentos em aberto"
- `src/pages/dashboard/hooks/useDashboardComercialData.ts` → comentários
- `src/pages/PedidoForm.tsx` → "Cotação origem" → "Orçamento origem", "Cotação ${num}" → "Orçamento ${num}"
- `src/lib/dashboard/widgets.ts` → descrição widget comercial
- `src/lib/navigation.ts` → keywords mantém `cotacoes` para busca, label fica "Orçamentos" (já está); ajustar `getRouteLabel` para `/cotacoes/:id` continuar mapeando "Orçamento" (já faz)
- `src/services/orcamentos.service.ts` e `enviarOrcamentoPorEmail` → toasts/subjects "Cotação X enviada" → "Orçamento X enviado"
- `src/components/Orcamento/OrcamentoSidebarSummary.tsx`, `OrcamentoPdfTemplate.tsx` → labels visíveis

**Rota legada `/cotacoes/:id`**: mantém o redirect existente em `App.tsx` (`CotacaoIdRedirect → /orcamentos/:id`) para não quebrar links salvos. Sem nova rota.

## 2. Numeração ORCXXXXXX + revisões

### Schema (migration)
```sql
-- novas colunas para suportar revisões
ALTER TABLE orcamentos
  ADD COLUMN numero_base text,           -- 'ORC000001'
  ADD COLUMN revisao integer DEFAULT 0,  -- 0 = original, 1+ = revisões
  ADD COLUMN orcamento_pai_id uuid REFERENCES orcamentos(id) ON DELETE SET NULL;

-- unicidade do número final (numero já é único? garantir)
CREATE UNIQUE INDEX IF NOT EXISTS uq_orcamentos_numero ON orcamentos(numero);
CREATE INDEX IF NOT EXISTS idx_orcamentos_numero_base ON orcamentos(numero_base);
CREATE INDEX IF NOT EXISTS idx_orcamentos_pai ON orcamentos(orcamento_pai_id);
```

### RPC `proximo_numero_orcamento` (substituir)
Retorna `'ORC' || LPAD(nextval('seq_orcamento'),6,'0')`. Mantém a sequence (continua de 51 → `ORC000051`).

### RPC nova `criar_revisao_orcamento(p_orcamento_id uuid)`
- Localiza `numero_base` (ou usa `numero` se for original) do orçamento alvo
- Conta revisões existentes (`SELECT MAX(revisao)+1 FROM orcamentos WHERE numero_base = X`)
- Clona cabeçalho + itens em novo registro com:
  - `numero = numero_base || '.' || nova_revisao` (ex: `ORC000051.1`)
  - `numero_base = base`
  - `revisao = N`
  - `orcamento_pai_id = id original`
  - `status = 'rascunho'`
- Retorna o novo `id`. Mantém o original intocado (histórico).

### Backfill (data update)
Para os 204 registros existentes:
- 203 históricos `H-100xxx` → **manter como estão** (são importação histórica, status `historico`, não devem entrar no padrão ORC). Observar `origem='importacao_historica'` justifica.
- 1 registro `COT000XXX` → renomear para `ORC000XXX` (mesma sequência), preencher `numero_base = numero` e `revisao = 0`.
- Avançar `seq_orcamento` para `MAX(28, last_value)` para evitar colisão futura.

Para todos não-históricos: `UPDATE orcamentos SET numero_base = numero, revisao = 0 WHERE revisao IS NULL AND origem <> 'importacao_historica'`.

### UI revisões
- Em `OrcamentoView.tsx`: botão **"Criar revisão"** (visível para status `aprovado|rejeitado|expirado` ou `convertido`) → chama RPC, navega para `/orcamentos/:novoId`.
- Card lateral mostra "Revisão N de ORCXXXXXX" + lista de revisões irmãs (link para cada).
- `OrcamentoForm.tsx`: badge `Revisão N` ao lado do número quando `revisao > 0`.

## 3. PDF: nome do arquivo

Em `OrcamentoForm.tsx` `handleGeneratePdf`:
```ts
const safe = (clienteNome || 'Cliente').toUpperCase().replace(/[\\/:*?"<>|]/g, '').trim();
pdf.save(`${numero || 'ORCAMENTO'} - ${safe}.pdf`);
```
Aplicar mesma lógica em `OrcamentoView.tsx` (se gera PDF) e em qualquer outro ponto que salve PDF do orçamento.

## Resumo de arquivos

**Migrations (1)**:
- Renomear seq numbering RPC (`COT` → `ORC`), adicionar colunas de revisão, criar RPC `criar_revisao_orcamento`, ajustar `seq_orcamento`.

**Data update (1)**:
- Renomear `COT*` → `ORC*`, popular `numero_base/revisao` em registros não-históricos.

**Código (≈12 arquivos, só strings + 2 pequenos blocos lógicos)**:
- `src/lib/comercialWorkflow.ts`, `src/lib/dashboard/widgets.ts`
- `src/pages/Orcamentos.tsx`, `src/pages/OrcamentoForm.tsx`, `src/pages/PedidoForm.tsx`
- `src/components/views/OrcamentoView.tsx` (+ botão "Criar revisão")
- `src/components/dashboard/ComercialBlock.tsx`
- `src/components/Orcamento/OrcamentoSidebarSummary.tsx`, `OrcamentoPdfTemplate.tsx`
- `src/services/orcamentos.service.ts`
- `src/pages/dashboard/hooks/useDashboardComercialData.ts` (comentários)
- Fallback no `Orcamentos.tsx` linha 185: `\`COT${...}\`` → `\`ORC${...}\``

## Fora de escopo
- Renomear coluna DB `ordens_venda.cotacao_id` (técnico, evita refactor amplo).
- Mexer em qualquer arquivo do módulo de **Compras** (continua "Cotação" = fornecedor).
- Renumerar os 203 históricos `H-*` (são imports e o prefixo H já os identifica).

