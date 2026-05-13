## Problema 1 — Erro "invalid input syntax for type uuid: \"\""

**Causa:** `ProdutoForm` envia `grupo_id: ""` (string vazia) no payload de insert/update. Postgres rejeita ao tentar converter "" para `uuid` (coluna `produtos.grupo_id`). Acontece em qualquer produto criado sem grupo selecionado — só apareceu agora ao testar o fluxo de Serviço, mas afeta todos os tipos.

**Fix (frontend, 1 ponto):**
Em `src/pages/produtos/ProdutoForm.tsx`, no `handleSubmit`, normalizar o payload antes de enviar:
- `grupo_id: form.grupo_id || null`
- (defensivo) garantir que qualquer outro UUID opcional seja `null` quando vazio.

Sem mudanças de schema/RPC.

## Problema 2 — Cadastro de Grupos de Produto inline

Hoje a tela só permite **selecionar** um grupo existente e editar a sigla via popover (`updateGrupoSigla`). O usuário quer **criar grupo novo** direto da tela de Produtos, informando **Nome + Sigla** (sigla usada no SKU sequencial).

**Plano de UI (escopo: ProdutoForm, aba Dados Gerais):**
1. Ao lado do `Select` de "Grupo de Produto", adicionar botão `+` (ícone Plus) — mesmo padrão do botão `+` da Unidade de Medida logo abaixo.
2. Botão abre `Dialog` "Novo grupo de produto" com:
   - Campo **Nome** (obrigatório, max 80).
   - Campo **Sigla** (obrigatório, 2–6 letras maiúsculas, regex `^[A-Z0-9]{2,6}$`, usada como prefixo do SKU sequencial via `proximo_sku_grupo`).
   - Botões "Cancelar" / "Criar grupo".
3. Ao confirmar:
   - Insert em `grupos_produto` `{ nome, sigla, ativo: true }`.
   - Atualizar lista local `grupos` (estado já existente).
   - Selecionar automaticamente o grupo recém-criado em `form.grupo_id`.
   - Toast de sucesso.
4. Tratar conflito de sigla duplicada (já existe UNIQUE em `grupos_produto.sigla` — mostrar mensagem amigável).

**Camada de serviço:** adicionar `createGrupoProduto({ nome, sigla })` em `src/services/produtos.service.ts` (segue padrão dos demais helpers do arquivo) e exportar.

**RLS:** `grupos_produto` já tem políticas de insert para usuários autenticados (mesmo padrão usado pelo `updateGrupoSigla` atual). Sem migration.

## Arquivos afetados

- `src/pages/produtos/ProdutoForm.tsx` — normalização do payload + botão/Dialog "Novo grupo".
- `src/services/produtos.service.ts` — função `createGrupoProduto`.

## Critérios de aceite

- Salvar Serviço (ou Produto/Insumo) **sem grupo** selecionado funciona sem erro de UUID.
- Botão `+` ao lado do select de grupo abre Dialog; criar grupo o adiciona à lista e seleciona.
- Sigla criada já é utilizada pelo botão "Gerar SKU" (que chama `proximo_sku_grupo`).
- `tsc --noEmit` limpo.