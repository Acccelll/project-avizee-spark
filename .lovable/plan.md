

Análise rápida:

1. **`ajustar_estoque_manual`** já existe como RPC no banco (vista em db-functions) e já é usada por `useAjustarEstoque.ts`. Faz exatamente o que o usuário pediu: `FOR UPDATE`, calcula novo saldo, insere movimento, atualiza `produtos.estoque_atual`. **Correção 2 já está implementada** — não há nada a fazer além de validar.

2. **`receber_compra`** já existe como RPC (vista em db-functions) e cobre o fluxo de recebimento, MAS:
   - Foi desenhada para `compras` (recebimento parcial/total via tabela `compras` + `compras_itens`).
   - Recebe `p_itens jsonb` (recebimento parcial), não apenas `p_pedido_id`.
   - Já tem hook `useReceberCompra` em `src/pages/comercial/hooks/useReceberCompra.ts`.
   - O `darEntrada` em `src/hooks/usePedidosCompra.ts` ainda faz lógica sequencial JS antiga (insere `estoque_movimentos` + opcionalmente `financeiro_lancamentos` + atualiza status), **não** usa essa RPC. Esse é o gap real.

Portanto, o trabalho real é:

- **Não criar `receber_pedido_compra` nova** — usar a `receber_compra` existente (já transacional, já testada). Refatorar `darEntrada` para chamá-la, montando `p_itens` com a quantidade total dos itens do pedido (recebimento total simples).
- **Não criar `ajustar_estoque_manual`** — já existe e já é usada.

Preciso investigar o código atual de `darEntrada` e `useAjustarEstoque` para confirmar.

# Plano

## Diagnóstico

| Item solicitado | Estado real | Ação |
|---|---|---|
| RPC `ajustar_estoque_manual` | **Já existe e já é usada** por `useAjustarEstoque.ts` com `SELECT FOR UPDATE`, lock atômico, atualização de saldo. | Validar (ler hook + RPC) e reportar — nada a fazer. |
| RPC transacional para receber pedido | **`receber_compra` já existe** e é transacional (cria `compras`, itens, movimentos de estoque, financeiro, atualiza status do pedido). | Refatorar `darEntrada` para usar essa RPC em vez de criar nova. |
| `darEntrada` em `usePedidosCompra.ts` | Ainda faz fluxo sequencial JS antigo (inserts manuais, sem atomicidade). | Substituir por chamada à `receber_compra` com `p_itens` montado a partir dos itens do pedido. |

## Fase única — Refatorar `darEntrada` para usar `receber_compra`

**Escopo**:
1. Ler `src/hooks/usePedidosCompra.ts` (`darEntrada` atual) para entender o que precisa ser preservado (toasts, `navigate('/fiscal')`, invalidações).
2. Buscar itens do pedido (`pedidos_compra_itens`) — montar `p_itens` JSON com `produto_id`, `quantidade_recebida = quantidade pedida`, `valor_unitario`. Recebimento total.
3. Chamar `supabase.rpc('receber_compra', { p_pedido_id, p_data_recebimento: today, p_itens, p_observacoes: null })`.
4. Remover todos os inserts manuais (`estoque_movimentos`, `financeiro_lancamentos`, update de status). A RPC faz tudo.
5. Manter `refreshAll()`, toast de sucesso, `navigate('/fiscal?source=pedido_compra&id=...')`.
6. **Não** mexer em `useAjustarEstoque.ts` — já está correto.

**Arquivos**:
- `src/hooks/usePedidosCompra.ts` (única edição).

**Riscos**:
- `receber_compra` retorna `{ compra_id, numero, status_pedido, valor_total }` — confirmar que a navegação `/fiscal` não depende do antigo objeto retornado.
- Se houver pedidos com `condicao_pagamento` específica, a RPC cria financeiro com base na lógica interna dela (verificar se gera 1 título único ou parcelas).
- Validar antes: ler RPC `receber_compra` por completo para confirmar criação de financeiro (a versão truncada no contexto cortou no meio).

**Critério de conclusão**:
- `darEntrada` reduzida a ~15 linhas (buscar itens + chamar RPC + redirecionar).
- Zero inserts diretos em `estoque_movimentos` ou `financeiro_lancamentos` no hook.
- Compilação OK (`tsc --noEmit`).

## Comunicação ao usuário

Após aprovação, vou explicar que:
- A RPC `ajustar_estoque_manual` **já existia** e já estava em uso — não foi necessário criar.
- A RPC `receber_compra` **já existia** e já era transacional — apenas refatorei `darEntrada` para usá-la em vez de criar uma duplicata.
- O ganho real é eliminar o fluxo sequencial antigo em `darEntrada`.

Posso prosseguir?

