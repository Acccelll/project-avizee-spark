

## Revisão estrutural do módulo de Cadastros

Plano dividido em duas partes: (A) correção imediata dos erros de build que estão bloqueando o projeto, e (B) a revisão estrutural completa solicitada.

---

### Parte A — Correções de build (bloqueantes)

**A1. `src/components/DataTable.tsx` linha 213** — o `upsert` está com cast `'user_preferences' as never`, o que colapsa o tipo do payload para `never[]`. Trocar por `supabase.from('user_preferences').upsert({...} as never, {...})` usando cast apenas no payload, ou remover o cast (a tabela já existe nos types).

**A2. `src/pages/Funcionarios.tsx` linha 112** — `useDocumentoUnico(..., "funcionarios")` falha porque `DocumentoTable` só aceita `"clientes" | "fornecedores" | "transportadoras"`. Ampliar a união em `src/hooks/useDocumentoUnico.ts` para incluir `"funcionarios"` e adicionar um bloco de verificação nessa tabela (mesmo padrão dos demais).

---

### Parte B — Revisão estrutural do módulo de Cadastros

#### B1. Clientes × Formas de Pagamento — consolidar `forma_pagamento_id`

Migration `consolidar_forma_pagamento_clientes.sql`:

1. Garantir índice em `formas_pagamento(lower(descricao))` para match case-insensitive.
2. Backfill:
   ```sql
   UPDATE clientes c
     SET forma_pagamento_id = fp.id
     FROM formas_pagamento fp
     WHERE c.forma_pagamento_id IS NULL
       AND c.forma_pagamento_padrao IS NOT NULL
       AND lower(trim(c.forma_pagamento_padrao)) = lower(trim(fp.descricao));
   ```
3. Criar tabela `cadastros_pendencias_migracao (id, entidade, entidade_id, campo, valor_origem, motivo, created_at)` para registrar:
   - clientes cujo `forma_pagamento_padrao` não achou match (motivo `sem_match`);
   - clientes cujo texto casou com >1 forma (motivo `ambiguo`).
4. FK `clientes_forma_pagamento_id_fkey → formas_pagamento(id) ON UPDATE CASCADE ON DELETE SET NULL`.
5. Manter `forma_pagamento_padrao` como coluna legada (sem drop), marcada por comentário SQL `COMMENT ON COLUMN ... IS 'DEPRECATED: usar forma_pagamento_id'`.
6. Atualizar UI (`Clientes.tsx`, `FormularioCliente`, `QuickAddClientModal`, `ClienteView`) para ler/gravar via `forma_pagamento_id` + `useFormasPagamentoRef()`. Views de leitura passam a fazer `join` pelo ID.

#### B2. Semântica de Formas de Pagamento

Sem quebrar dados atuais:

- `formas_pagamento.tipo` passa a representar **categoria de meio** (`pix | boleto | cartao | dinheiro | transferencia | outro`) via `CHECK chk_forma_pagamento_tipo`.
- `formas_pagamento.descricao` permanece como **condição comercial** (ex.: "Boleto 30/60/90").
- Adicionar coluna `categoria text` se houver necessidade de separar meio vs. condição — **decisão**: manter `tipo` como categoria (já é o uso real) e apenas formalizar via CHECK. Documentar em `docs/cadastros-formas-pagamento.md`.
- Unificar referência: `financeiro_lancamentos.forma_pagamento` (texto) ganha coluna paralela `forma_pagamento_id uuid REFERENCES formas_pagamento(id)`. Backfill por descrição; manter texto como fallback visual.

#### B3. Grupos Econômicos — FK para empresa matriz

Migration `fk_grupos_economicos_matriz.sql`:

1. Detectar órfãos: `SELECT id FROM grupos_economicos WHERE empresa_matriz_id IS NOT NULL AND empresa_matriz_id NOT IN (SELECT id FROM clientes);` → setar `NULL` e registrar em `cadastros_pendencias_migracao` (motivo `matriz_orfa`).
2. `ALTER TABLE grupos_economicos ADD CONSTRAINT grupos_economicos_matriz_fkey FOREIGN KEY (empresa_matriz_id) REFERENCES clientes(id) ON UPDATE CASCADE ON DELETE SET NULL;`
3. Índice em `grupos_economicos(empresa_matriz_id)`.
4. Validar também `clientes.grupo_economico_id → grupos_economicos(id)` com `ON DELETE SET NULL` (se ainda não existir FK real).

#### B4. Documentos únicos (CPF/CNPJ)

Migration `unicidade_documentos.sql`:

1. Normalizar: `UPDATE clientes SET cpf_cnpj = regexp_replace(cpf_cnpj, '\D', '', 'g') WHERE cpf_cnpj ~ '\D';` (idem fornecedores, transportadoras, funcionarios p/ CPF).
2. Detectar duplicatas ativas e registrar em `cadastros_pendencias_migracao` (motivo `documento_duplicado`) **sem apagar dados**.
3. Índice único **parcial** (documento inativo pode ser reutilizado):
   ```sql
   CREATE UNIQUE INDEX ux_clientes_cpf_cnpj_ativo
     ON clientes (cpf_cnpj) WHERE ativo = true AND cpf_cnpj IS NOT NULL AND cpf_cnpj <> '';
   ```
   Mesma lógica para `fornecedores`, `transportadoras`, `funcionarios.cpf`.
4. Trigger `trg_normaliza_documento` em INSERT/UPDATE: strip de caracteres não-numéricos antes de persistir.
5. Ampliar `useDocumentoUnico` para aceitar `"funcionarios"` (já coberto em A2) e fazer a checagem **cross-table** para CPF (clientes PF + funcionarios + fornecedores PF + transportadoras PF).

#### B5. Política oficial de inativação (soft delete)

Migration `politica_soft_delete.sql`, aplicada às tabelas-mestre (`clientes`, `fornecedores`, `transportadoras`, `produtos`, `funcionarios`):

1. Adicionar `deleted_at timestamptz NULL`, `deleted_by uuid NULL REFERENCES auth.users(id)`, `motivo_inativacao text NULL`.
2. `ativo` continua como status operacional primário (compatibilidade com todo o código existente).
3. Trigger `trg_registrar_inativacao`: quando `ativo` passa de `true`→`false`, preencher `deleted_at = now()` e `deleted_by = auth.uid()` se estiverem nulos. Quando volta para `true`, limpar os três campos.
4. Nenhuma mudança de RLS ou de UI obrigatória — é enriquecimento de auditoria.

#### B6. Auditoria e FKs faltantes

Varredura e, onde ausente, adicionar FKs com `ON DELETE RESTRICT` (ou `SET NULL` em opcionais):

- `clientes.grupo_economico_id → grupos_economicos(id)` (SET NULL)
- `clientes.forma_pagamento_id → formas_pagamento(id)` (SET NULL)
- `cliente_transportadoras.{cliente_id, transportadora_id}` (CASCADE/RESTRICT)
- `clientes_enderecos_entrega.cliente_id` (CASCADE)
- `cliente_registros_comunicacao.cliente_id` (CASCADE)
- `financeiro_lancamentos.{cliente_id, fornecedor_id, conta_contabil_id, conta_bancaria_id}` (RESTRICT)
- `produtos_fornecedores.{produto_id, fornecedor_id}` (CASCADE)

Cada FK é precedida por um `SELECT` que move órfãos para `cadastros_pendencias_migracao` antes de criar a constraint, para não falhar idempotência.

---

### Migrations entregues (ordem)

1. `fix_build_funcionarios_documento_unico` (tipagem de DocumentoTable — só código)
2. `consolidar_forma_pagamento_clientes`
3. `formas_pagamento_categoria_check`
4. `financeiro_lancamentos_forma_pagamento_id`
5. `fk_grupos_economicos_matriz`
6. `unicidade_documentos_cadastros`
7. `politica_soft_delete_cadastros`
8. `fks_integridade_cadastros`

Todas idempotentes (`IF NOT EXISTS` / `DO $$ ... EXCEPTION WHEN duplicate_object`), `SET search_path = public` em qualquer function/trigger criada.

### Código afetado

- `src/hooks/useDocumentoUnico.ts` — união ampliada + checagem cross-table opcional para CPF.
- `src/components/DataTable.tsx` — ajuste do cast do upsert.
- `src/pages/Clientes.tsx`, `src/pages/cadastros/clientes/*`, `src/components/QuickAddClientModal.tsx`, `src/components/views/ClienteView.tsx` — passar a ler/gravar `forma_pagamento_id`; label via join.
- `src/hooks/useReferenceCache.ts` — adicionar `useFormasPagamentoRef()`.
- `src/types/cadastros.ts` — refletir novos campos (`deleted_at`, `forma_pagamento_id` já existe).
- `docs/cadastros-formas-pagamento.md` e `docs/MIGRACAO.md` atualizados com decisões.

### Saída final (após execução)

Relatório com: migrations criadas, tabelas/colunas alteradas, contagens de backfill por regra, e lista de pendências registradas em `cadastros_pendencias_migracao` (ambíguos, órfãos, duplicados) para tratamento manual.

### Fora de escopo

- Nenhuma mudança visual.
- Nenhuma alteração de RLS existente.
- Nenhum drop de coluna legada nesta fase (`forma_pagamento_padrao` permanece com comentário `DEPRECATED`).

