

# Implementação das correções da Revisão de Migração

Aplicar as 11 correções identificadas no documento de revisão, organizadas por criticidade. Foco em destravar a deduplicação por `codigo_legado`/`cpf_cnpj`, completar abas hoje ignoradas (Centro de Custo, Sintéticas, Insumos) e enriquecer relacionamentos perdidos (produto↔fornecedor, lançamento↔conta bancária).

---

## Fase 1 — Aliases e inferência de tipo (críticas, sem schema)

**`src/lib/importacao/aliases.ts`** — adicionar entradas faltantes em `FIELD_ALIASES`:
- `'CNPJ/CPF' → cpf_cnpj`, `'CNPJ' → cpf_cnpj`
- `'COD.' → codigo_legado`, `'COD' → codigo_legado`
- `'FANTASIA' → nome_fantasia`
- `'VARIACOES' / 'VARIAÇÕES' → variacoes`
- `'PAGT.' / 'PAGAMENTO' / 'COND. PAGAMENTO' → forma_pagamento_padrao`
- `'REF. FORNECEDOR' / 'REF FORNECEDOR' → referencia_fornecedor`
- `'COMPLEMENTO' → complemento` (já existe em FIELD_ALIASES — confirmar e estender ao parser de fornecedores)

**`src/hooks/importacao/useImportacaoCadastros.ts`** — em `onSheetChange` e `generatePreview`, forçar `tipo_item = 'insumo'` quando `sheetName.toUpperCase().includes('INSUMO')`.

**`src/lib/importacao/conciliacaoParser.ts`** — em `parsePessoasAux` (fornecedores), ler `Complemento`/`COMPLEMENTO` quando presente.

---

## Fase 2 — Schema: Centro de Custo e Sintéticas (crítico)

Migration SQL:
- Criar `centros_custo` (id, codigo unique, descricao, responsavel, ativo).
- `ALTER TABLE financeiro_lancamentos ADD COLUMN centro_custo_id uuid REFERENCES centros_custo(id)`.
- Criar `contas_contabeis_sinteticas` (codigo unique, descricao, nivel, conta_pai_codigo self-FK, ativo).
- `ALTER TABLE contas_contabeis ADD COLUMN conta_sintetica_codigo text REFERENCES contas_contabeis_sinteticas(codigo)`.
- `ALTER TABLE notas_fiscais_itens ADD COLUMN custo_historico_unitario numeric` (para Fase 4).
- RLS em `centros_custo` e `contas_contabeis_sinteticas` (admin/financeiro write, autenticado read).

Parser/Hooks:
- `parseConciliacaoWorkbook`: ler abas `Centro de Custo` e `Sinteticas`; expor em `ConciliacaoBundle`.
- Novo `useImportacaoCentrosCusto.ts` (padrão preview→staging→RPC).
- `useCargaInicial`: encadear sintéticas **antes** das analíticas, e centros de custo antes do financeiro.
- RPC `carga_inicial_conciliacao`: processar sintéticas → analíticas (linkando `conta_sintetica_codigo`) e inserir centros de custo.

---

## Fase 3 — Enriquecimentos do Financeiro e Produtos (moderado)

**Banco → conta bancária** (`useImportacaoConciliacao` + RPC `consolidar_lote_financeiro`):
- Carregar `contas_bancarias` (id, apelido/nome) e construir Map normalizado.
- Resolver `conta_bancaria_id` por nome/apelido a partir do campo `Banco` antes de gravar em `stg_financeiro_aberto`.

**`produtos_fornecedores` a partir da aba PRODUTOS:**
- Parser captura `referencia_fornecedor` e `fornecedor_nome`.
- RPC `consolidar_lote_cadastros`: após upsert de produto, resolver fornecedor e fazer upsert em `produtos_fornecedores` com `ON CONFLICT (produto_id, fornecedor_id) DO UPDATE`.

**Custo zero em INSUMOS** (`validators.ts`): `validateEstoqueInicialImport` aceita `custo_medio` ausente como warning, gravando `0`.

---

## Fase 4 — Qualidade e validação (melhoria)

- RPC `consolidar_lote_faturamento`: gravar `custo_unitario` da planilha em `notas_fiscais_itens.custo_historico_unitario` (preserva margem histórica).
- Confirmar dedup `ON CONFLICT (chave_acesso) DO NOTHING` na consolidação de faturamento (evita colisão com `useImportacaoXml`).
- `docs/MIGRACAO.md`: adicionar seção "Smoke tests pós-migração" com as 4 queries de validação do prompt.

---

## Detalhes Técnicos

**Tabelas/Colunas novas:**
```text
centros_custo(id, codigo UQ, descricao, responsavel, ativo)
contas_contabeis_sinteticas(id, codigo UQ, descricao, nivel, conta_pai_codigo FK self, ativo)
financeiro_lancamentos.centro_custo_id  → centros_custo.id
contas_contabeis.conta_sintetica_codigo → contas_contabeis_sinteticas.codigo
notas_fiscais_itens.custo_historico_unitario numeric
```

**RPCs afetadas (todas com `SET search_path = public`):**
- `carga_inicial_conciliacao` — adicionar processamento de sintéticas e centros de custo na ordem correta.
- `consolidar_lote_cadastros` — upsert em `produtos_fornecedores`.
- `consolidar_lote_financeiro` — aceitar `conta_bancaria_id` e `centro_custo_id` no JSONB.
- `consolidar_lote_faturamento` — gravar custo histórico, garantir idempotência por `chave_acesso`.

**Arquivos editados:**
- `src/lib/importacao/aliases.ts`
- `src/lib/importacao/conciliacaoParser.ts`
- `src/lib/importacao/validators.ts`
- `src/hooks/importacao/useImportacaoCadastros.ts`
- `src/hooks/importacao/useImportacaoConciliacao.ts`
- `src/hooks/importacao/useCargaInicial.ts`
- `src/hooks/importacao/useImportacaoCentrosCusto.ts` (novo)
- `src/hooks/importacao/types.ts`
- `docs/MIGRACAO.md`
- Migrations SQL (schema + RPCs).

**Fora de escopo:** UI de gestão de centros de custo e plano sintético (apenas importação/persistência); refazer migração dos dados já importados (rodar separadamente após o código estar pronto).

