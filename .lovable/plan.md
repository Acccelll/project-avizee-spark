

# 1. RESUMO EXECUTIVO

O anexo (Revisão 02 – Prioridade Alta Parte 1) cobre **17 arquivos** em 3 módulos:
- **Cadastros**: Produtos (1143 linhas), Clientes (1632), Fornecedores (814), Transportadoras (1022), FormasPagamento (816), Funcionarios, GruposEconomicos, UnidadesMedida.
- **Comercial**: Orcamentos.tsx, OrcamentoForm.tsx, OrcamentoItemsGrid, OrcamentoTotaisCard, OrcamentoPdfTemplate, hooks (useConverterOrcamento, useFaturarPedido, useGerarPedidoCompra).
- **Compras**: usePedidosCompra (hook), CotacaoCompraDrawer, PedidoCompraDrawer, cotacoes.service.

Total ~85 pontos. Cruzando com código real:

- **Confirmados**: ~22 — `window.confirm` em 5 páginas (Clientes, Fornecedores, Produtos, GruposEconomicos, OrcamentoForm); `(supabase as any).from("unidades_medida")` em Produtos (tabela fora do `Database` gerado); `as unknown as`/`as any` em OrcamentoForm.tsx (16 ocorrências em 1 arquivo); `eslint-disable` em `useEffect([location.state])` repetido em 4+ páginas; `variacoes_texto` como campo derivado em Produtos; `key={idx}` em OrcamentoItemsGrid e PedidoCompraDrawer; `unknown[]` em props do PedidoCompraDrawer; comparação `isOverdue` sem normalização de timezone.
- **Parciais**: ~28 — sugestões válidas mas custo alto (refator de monolitos em hooks+abas, react-hook-form+Zod, virtualização, AbortController em todos os efeitos, refinar `invalidateQueries` por chave hierárquica, RPC transacional para `darEntrada`, coluna `pedido_compra_id` em `financeiro_lancamentos`).
- **Já resolvidos / não aplicáveis**: ~15 — `gerar_financeiro_folha` **já existe como RPC** (anexo recomenda criar); `proximo_numero_*` **já são RPCs com sequence**; `OrcamentoForm` **já usa react-hook-form** (anexo sugere adotar); `ConfirmDialog`/`AlertDialog` já existem no design system; tipos do Supabase já são gerados (anexo insiste em `supabase gen types`); `gerar_nf_de_pedido` já é RPC atômica.
- **Opcionais/cosméticos**: ~20 — testes unitários massivos, ARIA refinado, aritmética de centavos com `decimal.js`, `@dnd-kit/sortable`, fontes embedadas no PDF, virtualização de listas pequenas.

**Áreas de maior risco**: OrcamentoForm.tsx (formulário transacional crítico, RPC `salvar_orcamento`, snapshots de cliente, templates), `usePedidosCompra` (toca estoque + financeiro juntos), `unidades_medida` (tabela fora dos tipos gerados). 

**Sensibilidade**: MÉDIA-ALTA. Cadastros são CRUDs estáveis (risco menor); Comercial e Compras tocam fluxos transacionais, RPCs e snapshots — risco maior.

# 2. LEITURA CRÍTICA DO ANEXO

**Bem aderentes**: pontos sobre `window.confirm` (confirmados em 6 lugares), tabela `unidades_medida` fora do `Database` gerado, casts `as any`/`as unknown as` em OrcamentoForm, `key={idx}` em listas reordenáveis, `eslint-disable` em efeitos `[location.state]`.

**Parcialmente aderentes**: refatoração em hooks específicos (`useProdutoForm`, `useClienteForm` etc.) — ganho real existe mas o custo é alto e o anexo não diferencia páginas estáveis (Produtos, Clientes funcionam) das que sangram (OrcamentoForm). A refatoração deve ser **cirúrgica**, não em massa.

**Desatualizados / incorretos**:
- Anexo recomenda "criar RPC `gerar_financeiro_folha`" — **já existe** no banco (vide db-functions).
- Anexo sugere "criar `proximo_numero_*` atômico" — **já implementado via SEQUENCES** (memória `numeracao-atomica-documentos`).
- Anexo recomenda "adotar react-hook-form em OrcamentoForm" — **já adotado** (vide `reset/setValue are stable react-hook-form refs` no eslint-disable).
- Anexo sugere "rodar `supabase gen types`" repetidamente — tipos já são auto-gerados pela infra Lovable; o problema é que `unidades_medida` e algumas colunas (`funcionario_id` em `financeiro_lancamentos`) não estão no schema/types — exige migração, não regeneração.

**Excessivos para o momento**:
- Migrar formulários para react-hook-form + Zod em **todas** as páginas (Clientes 1632 linhas, Fornecedores 814) — refactor massivo sem ganho mensurável (formulários funcionam).
- Substituir `draggable` nativo por `@dnd-kit` — funciona em desktop, baixo retorno.
- Decimal.js para aritmética monetária — Brasil opera com 2 casas e arredondamento padrão funciona.
- Testes E2E e snapshot massivos.
- Virtualização de listas pequenas (grupos, formas de pagamento).

**Corretos mas dependentes de contexto**:
- Coluna `pedido_compra_id` em `financeiro_lancamentos` para evitar match por `observacoes ilike` — **válido**, mas exige migração + backfill + ajuste no fluxo `darEntrada`. Sensível.
- RPC transacional para `darEntrada` (estoque + financeiro atomicamente) — válido conceitualmente, mas duplica lógica que hoje funciona via JS; risco-benefício depende de incidência de falhas.
- Refinar `invalidateQueries` por chave hierárquica — depende de auditar quais queries usam chaves compostas hoje.

# 3. PLANO POR FASES

**FASE A — Substituir `window.confirm` por `ConfirmDialog`/`AlertDialog` (UX consistente, baixo risco)**
- **Objetivo**: padronizar confirmações usando o componente do design system já existente.
- **Escopo**: 6 ocorrências em `Clientes.tsx` (2), `Fornecedores.tsx` (2), `GruposEconomicos.tsx` (1), `OrcamentoForm.tsx` (1 — sobrescrever template), `Produtos.tsx` (1 — mudança de tipo).
- **Áreas**: páginas listadas + import de `AlertDialog` ou `ConfirmDialog` existente.
- **Dependências**: nenhuma.
- **Riscos**: baixos — fluxo síncrono vira assíncrono (estado `pendingAction`). Validar que `isDirty` ainda funciona.
- **Por que primeiro**: muda só UI/UX, sem tocar dados; ganha consistência imediata.
- **Conclusão**: nenhum `window.confirm` no `src/pages/`.

**FASE B — Tipagem segura de `unidades_medida` e remoção de `(supabase as any)`**
- **Objetivo**: eliminar 3 ocorrências de `(supabase as any).from("unidades_medida")` em `Produtos.tsx`.
- **Escopo**: confirmar via `supabase--read_query` se a tabela `unidades_medida` existe; se sim, regenerar types (auto); se não existir no schema gerado mas existir no banco, criar tipo helper local com `Tables<...>` ou interface `UnidadeMedida` + cast único centralizado.
- **Áreas**: `src/pages/Produtos.tsx` (linhas 138-143, 310-312); possivelmente `src/types/domain.ts`.
- **Dependências**: leitura do banco.
- **Riscos**: BAIXOS-MÉDIOS — se a tabela não estiver no schema público, manter cast local com comentário é aceitável.
- **Por que aqui**: isolado, ganho de tipagem real, sem mudar comportamento.
- **Conclusão**: zero `as any` envolvendo `unidades_medida`.

**FASE C — Saneamento de tipagem em OrcamentoForm.tsx (cirúrgico)**
- **Objetivo**: reduzir os ~16 `as any`/`as unknown as` em `OrcamentoForm.tsx` para o mínimo justificado.
- **Escopo**: 
  - Linhas 273-277 `(orc as any).desconto/imposto_st/etc` → confirmar se essas colunas existem em `Tables<'orcamentos'>`. Se sim, remover cast; se não, é gap de schema (decidir adicionar coluna ou guardar em jsonb).
  - Linha 284 `cliente_snapshot as any` → tipar como `Json | ClienteSnapshot`.
  - Linha 316 `as unknown as Record<string, string>` → tipar `clientes` corretamente.
  - Linhas 533/598 `payload as any, itemsPayload as any` na RPC `salvar_orcamento` → criar interface `SalvarOrcamentoPayload` e usar.
  - Linha 686 `row.valor as unknown as OrcamentoTemplate` → narrow seguro com type guard.
- **Áreas**: `src/pages/OrcamentoForm.tsx`, possivelmente `src/types/domain.ts`.
- **Dependências**: Fase B (padrão de tipagem).
- **Riscos**: MÉDIOS — RPC `salvar_orcamento` é central e qualquer divergência de payload quebra criação/edição.
- **Validar antes**: ler assinatura real da RPC `salvar_orcamento` no banco; conferir colunas reais de `orcamentos`.
- **Conclusão**: ≤3 casts remanescentes, todos justificados em comentário.

**FASE D — Tipagem do PedidoCompraDrawer (`unknown[]` → interfaces)**
- **Objetivo**: substituir props `viewItems`/`viewEstoque`/`viewFinanceiro: unknown[]` por interfaces tipadas; corrigir `key={idx}` para `key={item.id}`; normalizar `isOverdue` para evitar timezone bug.
- **Escopo**: `src/components/compras/PedidoCompraDrawer.tsx` + ajustar quem passa essas props (`usePedidosCompra`).
- **Dependências**: Fase C (padrão).
- **Riscos**: BAIXOS — apenas tipagem; comportamento idêntico.
- **Conclusão**: zero `unknown[]` nessas props.

**FASE E — Robustez de `useEffect([location.state])` (race + memory leak)**
- **Objetivo**: padronizar o efeito de "abrir edição via location.state" em Produtos, Clientes, Fornecedores, Transportadoras com flag `isMounted` (não é necessário AbortController para uma single-row query Supabase).
- **Escopo**: ~5 páginas. Criar pequeno helper `useEditFromLocationState(table, openEdit)` opcional, ou simplesmente adicionar `let cancelled = false; return () => { cancelled = true }` em cada efeito.
- **Dependências**: nenhuma.
- **Riscos**: BAIXOS — o efeito só dispara em `location.state` mudar; padrão `cancelled` é amplamente usado no projeto.
- **Conclusão**: nenhum `eslint-disable` em efeito de `location.state` sem justificativa.

**FASE F — Refinos pontuais Comercial/Compras (opcionais, validar antes)**
- **Escopo seletivo**:
  - Memoizar `productCostMap` e `totalAprovado` no CotacaoCompraDrawer (real ganho perceptível).
  - Validar `desconto_percentual` (0-100) e `quantidade ≥ 0` em `OrcamentoItemsGrid.recalc`.
  - Trocar `key={idx}` por `key={item.id || item._tempId}` em `OrcamentoItemsGrid` e PedidoCompraDrawer (impede perda de foco).
  - Validar competência duplicada na folha de `Funcionarios.tsx` (regra de negócio simples).
- **Dependências**: D.
- **Riscos**: BAIXOS — mudanças locais.

**FASE G (NÃO PRIORIZAR agora)**: refator de monolitos (Clientes 1632 → hooks + 7 abas), migração para react-hook-form em todos os cadastros, coluna `pedido_compra_id` em `financeiro_lancamentos`, RPC transacional `receber_pedido_compra`, virtualização, testes unitários massivos. Cada um desses merece um planejamento próprio com auditoria de impacto.

# 4. MUDANÇAS SENSÍVEIS

1. **Tipagem da RPC `salvar_orcamento` (Fase C)**.
   - Por quê: chamada em 2 lugares (criar/editar); payload errado quebra todo o módulo de orçamentos.
   - Verificar antes: assinatura exata da RPC no banco (`supabase--read_query` em `pg_proc`); colunas reais de `orcamentos`.
   - Risco: regressão no salvamento; perda de campos novos do orçamento.
   - Dependências: tipos gerados em `src/integrations/supabase/types.ts`.

2. **Tabela `unidades_medida` (Fase B)**.
   - Por quê: se a tabela existe no banco mas não no schema gerado, há divergência estrutural. Pode haver RLS ausente.
   - Verificar antes: existência no `information_schema`; presença em `Database` types; políticas RLS.
   - Risco: criar interface manual que diverge do banco real.
   - Dependências: schema Supabase, tipos gerados.

3. **Coluna `funcionario_id` em `financeiro_lancamentos`** (mencionada no anexo para Funcionarios).
   - Por quê: anexo afirma "existe no banco mas não nos tipos". Precisa confirmar; se for verdade, é gap a ser resolvido com regeneração ou migração.
   - Verificar antes: `\d financeiro_lancamentos`.
   - Risco: cast `as never` no insert; se a coluna não existir, insert silenciosamente ignora ou falha.
   - **NÃO incluído nas fases A-F** — investigar isolado.

4. **`useEffect([location.state])` (Fase E)**.
   - Por quê: padrão replicado em 5+ páginas; mudança incorreta pode bloquear abertura de edição via deep-link.
   - Verificar antes: confirmar que cada página atualmente abre edição corretamente quando navegada com `state.editId`.
   - Risco: edição via navegação contextual deixa de abrir.

5. **`window.confirm` em `OrcamentoForm` (sobrescrever template)** (Fase A).
   - Por quê: bloqueia thread durante salvamento de template, parte do fluxo crítico.
   - Verificar antes: estado `templateName` precisa sobreviver ao diálogo assíncrono.
   - Risco: ao tornar assíncrono, garantir que `handleSave` reentre corretamente após confirmação.

6. **`PedidoCompraDrawer` (Fase D)**.
   - Por quê: o drawer reflete fluxo de recebimento que toca estoque/financeiro. Tipos errados podem mascarar bugs em produção.
   - Verificar antes: shape real retornado pelas queries em `usePedidosCompra` (`viewItems`, `viewEstoque`, `viewFinanceiro`).
   - Risco: casts trocando shape silenciosamente.

7. **NÃO TOCAR nesta etapa (ainda)**:
   - RPC transacional `receber_pedido_compra` — exige planejamento próprio.
   - Coluna `pedido_compra_id` em `financeiro_lancamentos` — exige migração + backfill.
   - Refator de monolitos — sem ganho imediato vs. risco de regressão.
   - `invalidateQueries` hierárquico — exige auditar todas as chaves.

# 5. SAÍDA FINAL CONSOLIDADA

**Prioridades da etapa**:
1. Substituir `window.confirm` (Fase A) — UX consistente, baixíssimo risco.
2. Resolver tipagem de `unidades_medida` (Fase B) — elimina `(supabase as any)`.
3. Sanear casts em `OrcamentoForm` (Fase C) — área crítica, ganho real de segurança.
4. Tipar props do `PedidoCompraDrawer` + corrigir `key={idx}` + `isOverdue` (Fase D).
5. Padronizar `useEffect([location.state])` com `cancelled` flag (Fase E).
6. Refinos pontuais Comercial/Compras (Fase F).

**Cautelas da etapa**:
- Validar payload exato da RPC `salvar_orcamento` antes de tipar.
- Confirmar existência real da tabela `unidades_medida` e suas RLS.
- Não migrar formulários para react-hook-form em massa (refactor massivo sem ganho).
- Não criar coluna `pedido_compra_id` ou RPC transacional sem planejamento próprio.
- Para `window.confirm` em fluxos assíncronos (sobrescrever template), garantir reentrância correta.

**Sequência futura sugerida** (após esta etapa):
- Investigar gap `funcionario_id` em `financeiro_lancamentos`.
- Auditoria de chaves de `invalidateQueries` para refinar invalidação.
- Avaliar coluna `pedido_compra_id` em `financeiro_lancamentos` (decisão de design).
- Em iteração separada: extrair `EnderecoDialog` e `ComunicacaoDialog` reutilizáveis (compartilhados entre Clientes/Fornecedores/Transportadoras) — único refator com ganho real de duplicação.

**Validar obrigatoriamente antes de avançar**:
- Existência de `unidades_medida` em `public` e em `Database` types.
- Assinatura da RPC `salvar_orcamento` (parâmetros e retorno).
- Existência de `funcionario_id` em `financeiro_lancamentos`.
- Que `ConfirmDialog`/`AlertDialog` aceitam o padrão de uso assíncrono que vamos adotar.
- Shape real retornado por `usePedidosCompra` para `viewItems`/`viewEstoque`/`viewFinanceiro`.

