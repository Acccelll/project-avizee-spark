## Objetivo

Permitir que usuários **admin** editem qualquer campo de **notas de entrada** já lançadas — inclusive quando `status ∈ {confirmada, importada, cancelada}` ou `status_sefaz ∈ {autorizada, cancelada_sefaz, denegada}` — mantendo o bloqueio para os demais perfis e preservando integridade contábil/fiscal.

## Escopo

- Apenas `tipo = 'entrada'` (NFs de saída/emissão própria continuam protegidas pelas regras SEFAZ).
- Apenas `role = admin` (via `has_role(auth.uid(),'admin')`).
- Edição estrutural total: fornecedor, números, valores, chave, datas, itens, financeiro vinculado.

## Mudanças

### 1. Backend — trigger `trg_nf_protege_edicao`

Adicionar bypass quando o operador é admin **e** a NF é de entrada:

```sql
IF v_internal_op = '1'
   OR (OLD.tipo = 'entrada' AND public.has_role(auth.uid(),'admin'))
THEN
  RETURN NEW;
END IF;
```

Resultado: admin consegue alterar `valor_total`, `chave_acesso`, `fornecedor_id`, `numero`, `serie`, `modelo_documento`, `tipo_operacao` em NF de entrada confirmada/importada/cancelada. Para demais usuários e para NFs de saída, comportamento atual permanece intacto.

### 2. Backend — trigger `trg_nf_protege_delete` (escopo controlado)

Não alterado por padrão. O hard delete continua exigindo `app.hard_delete=on` (já gated por admin via `useCanHardDelete`). Edição não implica delete.

### 3. Backend — itens (`trg_nf_itens_protege_edicao`)

Aplicar o mesmo bypass para admin em itens de NF cuja `tipo='entrada'`, para que a edição estrutural propague aos itens. Será uma cópia simétrica do padrão acima referenciando `notas_fiscais.tipo` da NF pai.

### 4. Frontend — `src/pages/fiscal/NotaFiscalForm.tsx`

- Importar `useCan` (ou `useIsAdmin`) e `nfRow.tipo`.
- Ajustar `readOnly`:

```ts
const isAdminOverride = isAdmin && nfRow?.tipo === "entrada";
const readOnly = !isCreate && !!statusSefaz
  && STATUS_SEFAZ_TRAVADOS.has(statusSefaz)
  && !isAdminOverride;
```

- Quando `isAdminOverride && readOnly-original`, exibir um `Alert variant="destructive"` com tom de aviso:
  > **Modo administrador:** você está editando uma NF de entrada já confirmada/importada. Alterações afetam estoque e financeiro — confirme com cuidado.
- Substituir o `Alert` "Somente leitura" por esse aviso quando o override estiver ativo.

### 5. Sem mudança em `salvar_nota_fiscal`

A RPC já roda como `SECURITY DEFINER` mas o trigger usa `auth.uid()` — que dentro de uma RPC `SECURITY DEFINER` continua retornando o usuário autenticado da sessão (`auth.uid()` lê do JWT, não do owner). Portanto `has_role(auth.uid(),'admin')` funciona corretamente sem ajustes na RPC.

### 6. Memória de projeto

Atualizar `mem://security/restricoes-escrita-exclusao` (ou criar nota em `mem://features/`) registrando: "Admin pode editar qualquer campo de NF de entrada (incluindo confirmada/importada/cancelada). Bloqueio mantido para NF de saída e perfis não-admin."

## Fora de escopo

- NFs de saída (emissão própria) — bloqueio SEFAZ permanece absoluto.
- Re-execução automática de estornos contábeis. Admin é responsável por revisar lançamentos financeiros e movimentos de estoque após a edição (toast de aviso já cobre).
- Auditoria detalhada de campos alterados (pode entrar em iteração futura via `nf_eventos`).

## Validação

1. Login como admin → abrir NF de entrada `confirmada` → editar `valor_total` e `fornecedor_id` → salvar → sem erro do trigger, registro atualizado.
2. Login como `financeiro` → abrir mesma NF → permanece read-only com banner original.
3. Login como admin → abrir NF de **saída** autorizada → permanece read-only (bypass não se aplica).
