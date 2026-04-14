

# Plan: Migração de Dados Completa — 6 Fases

## Diagnóstico Atual

**Problemas confirmados:**
- `processImport` grava **diretamente nas tabelas finais** (produtos, clientes, fornecedores, financeiro_lancamentos, notas_fiscais) — NÃO há staging real
- `finalizeImport` é um no-op em todos os 4 hooks (apenas exibe toast)
- Colunas `codigo_legado`, `variacoes`, `tipo_item` **NÃO existem** em `produtos`, `clientes`, `fornecedores`
- Tabelas `stg_*` existem mas são genéricas (apenas `id`, `lote_id`, `dados` jsonb, `status`, `erro`) — suficiente para staging real
- `produtos_fornecedores` já existe com schema adequado
- `importacao_lotes` não tem status granulares (faltam `staging`, `pronto_para_consolidar`)

---

## Fase 1 — Saneamento Estrutural

### Migration SQL

Adicionar colunas faltantes e staging para cadastros:

```sql
-- produtos: codigo_legado, variacoes, tipo_item
ALTER TABLE produtos ADD COLUMN IF NOT EXISTS codigo_legado text;
ALTER TABLE produtos ADD COLUMN IF NOT EXISTS variacoes text;
ALTER TABLE produtos ADD COLUMN IF NOT EXISTS tipo_item text DEFAULT 'produto';

-- clientes/fornecedores: codigo_legado
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS codigo_legado text;
ALTER TABLE fornecedores ADD COLUMN IF NOT EXISTS codigo_legado text;

-- Staging para cadastros (mesmo padrão das stg_* existentes)
CREATE TABLE IF NOT EXISTS stg_cadastros (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lote_id uuid NOT NULL,
  dados jsonb NOT NULL,
  status text DEFAULT 'pendente',
  erro text,
  created_at timestamptz DEFAULT now()
);

-- Índices de deduplicação
CREATE INDEX IF NOT EXISTS idx_produtos_codigo_legado ON produtos(codigo_legado);
CREATE INDEX IF NOT EXISTS idx_clientes_codigo_legado ON clientes(codigo_legado);
CREATE INDEX IF NOT EXISTS idx_fornecedores_codigo_legado ON fornecedores(codigo_legado);

-- RLS para stg_cadastros (mesma pattern das stg_* existentes)
ALTER TABLE stg_cadastros ENABLE ROW LEVEL SECURITY;
CREATE POLICY stg_cad_select ON stg_cadastros FOR SELECT TO authenticated USING (true);
CREATE POLICY stg_cad_insert ON stg_cadastros FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY stg_cad_update ON stg_cadastros FOR UPDATE TO authenticated USING (true);
CREATE POLICY stg_cad_delete ON stg_cadastros FOR DELETE TO authenticated USING (true);
```

### RPC de Consolidação

Criar função SQL `consolidar_lote_cadastros(p_lote_id uuid)` que:
1. Lê registros de `stg_cadastros` com `status = 'pendente'` para o lote
2. Para cada registro, faz upsert na tabela destino (produtos/clientes/fornecedores) usando codigo_legado ou cpf_cnpj/codigo_interno como chave
3. Atualiza `stg_cadastros.status` para `consolidado` ou `erro`
4. Atualiza contadores em `importacao_lotes`
5. Retorna resumo (inseridos, atualizados, erros)

Criar RPCs análogas: `consolidar_lote_estoque`, `consolidar_lote_financeiro`, `consolidar_lote_faturamento`.

### Refatoração dos 4 Hooks

Todos os hooks seguirão o mesmo padrão:

- **`generatePreview`** — valida, resolve lookups, monta preview (sem escrita)
- **`processImport`** — grava apenas em `stg_*` + `importacao_lotes` (status `staging`)
- **`finalizeImport(loteId)`** — chama RPC de consolidação, atualiza status para `concluido`/`parcial`/`erro`

**Arquivos alterados:**
- `src/hooks/importacao/useImportacaoCadastros.ts`
- `src/hooks/importacao/useImportacaoEstoque.ts`
- `src/hooks/importacao/useImportacaoFinanceiro.ts`
- `src/hooks/importacao/useImportacaoFaturamento.ts`

### Status de Lote

Usar os status: `rascunho`, `validado`, `staging`, `consolidando`, `concluido`, `parcial`, `erro`, `cancelado`.

---

## Fase 2 — Cadastros-Base

Melhorias no `useImportacaoCadastros`:
- Importar grupos de produto automaticamente (auto-criar se não existir)
- Suportar `tipo_item` (produto/insumo)
- Suportar `variacoes`, `codigo_legado`
- Preview enriquecido: mostrar se é novo/atualização/duplicado
- Deduplicação: `codigo_legado` → `codigo_interno`/`cpf_cnpj` → insert

**Consolidação via RPC** faz upsert com prioridade de chave legada.

---

## Fase 3 — Enriquecimento Relacional

- Criar importador de `produtos_fornecedores` (novo hook `useImportacaoProdutosFornecedores` ou subtipo no cadastros)
- Importação de `formas_pagamento` e `contas_contabeis` via dados na planilha ou cadastro mínimo manual
- Popular `contas_bancarias` mínimas necessárias
- Adicionar card na UI de migração para "Vínculos e Auxiliares"

---

## Fase 4 — Estoque Inicial

Refatorar `useImportacaoEstoque`:
- `processImport` → grava em `stg_estoque_inicial`
- `finalizeImport` → chama RPC que:
  - Resolve produto por `codigo_legado` → `codigo_interno`
  - Gera `estoque_movimentos` (tipo `abertura`)
  - Atualiza `produtos.estoque_atual` via trigger existente
  - Bloqueia linhas sem produto
- Preview melhorado: saldo atual vs. novo, diferença, custo

---

## Fase 5 — Financeiro em Aberto

Refatorar `useImportacaoFinanceiro`:
- `processImport` → grava em `stg_financeiro_aberto`
- `finalizeImport` → RPC que:
  - Cria `financeiro_lancamentos` com campos completos
  - Para baixados: cria `financeiro_baixas`
  - Lookup de pessoa: `codigo_legado` → `cpf_cnpj`
- Preview: tipo CP/CR, vínculo, saldo, status
- Resumo: total CP, total CR, aberto, parcial, baixado

---

## Fase 6 — Faturamento Histórico

Refatorar `useImportacaoFaturamento`:
- `processImport` → grava em `stg_faturamento`
- `finalizeImport` → RPC que:
  - Cria `notas_fiscais` com `movimenta_estoque=false`, `gera_financeiro=false`, `origem='importacao_historica'`
  - Cria `notas_fiscais_itens`
  - Deduplicação por `chave_acesso` → `numero+serie+data`
- Relatório: total NFs, itens, valor, % com cliente, % com produto

---

## Melhorias na UI (MigracaoDados.tsx)

1. Atualizar step 3 para mostrar resumo de staging (novos/atualizados/erros)
2. Step 4 passa a ser confirmação real (chama `finalizeImport`)
3. Adicionar botão "Cancelar Lote" para staging
4. Mostrar status `staging` nos filtros
5. Adicionar grupo "Vínculos e Auxiliares" para Fase 3
6. Remover `@ts-nocheck` quando possível

---

## Arquivos a Criar/Alterar

| Arquivo | Ação |
|---------|------|
| `supabase/migrations/2026041400XX_*.sql` | Migration: colunas + stg_cadastros + RPCs |
| `src/hooks/importacao/useImportacaoCadastros.ts` | Refatorar staging real |
| `src/hooks/importacao/useImportacaoEstoque.ts` | Refatorar staging real |
| `src/hooks/importacao/useImportacaoFinanceiro.ts` | Refatorar staging real |
| `src/hooks/importacao/useImportacaoFaturamento.ts` | Refatorar staging real |
| `src/lib/importacao/validators.ts` | Melhorar validações |
| `src/lib/importacao/aliases.ts` | Novos aliases |
| `src/pages/MigracaoDados.tsx` | UI: staging real, confirmação |
| `src/hooks/importacao/types.ts` | Tipos atualizados |
| `src/components/importacao/PreviewImportacaoTable.tsx` | Mostrar novo/atualizado/duplicado |
| `docs/MIGRACAO.md` | Documentação técnica |

---

## Riscos e Validações Manuais

- Chaves legadas dependem da qualidade da planilha de origem
- Vínculo produto-fornecedor requer planilha estruturada com ambos os códigos
- Financeiro baixado precisa de conferência manual de saldos
- CHECK constraint existente em `financeiro_lancamentos.status` não inclui `baixado` — precisa ser adicionado ou usar `pago`

