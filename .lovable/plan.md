

# Separar histórico em Compras e Vendas no ProdutoView

Hoje a aba **Compras** mostra fornecedores + últimas notas de entrada, e a aba **Hist.** mistura tudo. Vamos: (1) buscar histórico separado por tipo no backend, (2) renomear/criar abas dedicadas, (3) enriquecer cada uma com KPIs próprios.

## 1. Fetch — separar entradas e saídas

Em `src/components/views/ProdutoView.tsx`, no `useDetailFetch`:

- Trocar a única query `notas_fiscais_itens` por **duas queries** dentro do `Promise.allSettled`:
  - **Entradas** (compras): `tipo IN ('entrada','compra')`, join com `fornecedores`, ordem `data_emissao DESC`, limit 30.
  - **Saídas** (vendas): `tipo IN ('saida','venda')`, join com `clientes(id, nome_razao_social)`, ordem `data_emissao DESC`, limit 30.
- Em `ProdutoDetail`, separar em `historicoCompras: HistoricoNfItemRow[]` e `historicoVendas: HistoricoNfVendaRow[]`.
- Adicionar tipo `HistoricoNfVendaRow` em `src/types/cadastros.ts` (mesmo shape do existente, mas com `clientes` no lugar de `fornecedores`).

## 2. Reestruturar abas

Trocar grid `grid-cols-7` por `grid-cols-7` com novos rótulos:

| Antes | Depois |
|---|---|
| Geral | Geral |
| Compras | **Compras** (fornecedores + NFs entrada) |
| Preço | Preço |
| Estoque | Estoque |
| Fiscal | Fiscal |
| Espec. | Espec. |
| Hist. | **Vendas** (NFs saída) |

**Aba Compras** (mantém estrutura atual, mas usa `historicoCompras`):
- Fornecedores vinculados (igual hoje).
- "Últimas Compras" — usa `historicoCompras` direto, sem o filtro `.filter()`.
- KPIs no topo: total comprado (qtd + valor) e custo médio ponderado das últimas N entradas.

**Aba Vendas** (substitui "Hist."):
- KPIs no topo: total vendido (qtd + valor), ticket médio unitário, margem média (venda − custo).
- Lista de NFs de saída com: número (link drawer NF), data, **cliente** (link drawer cliente), qtd, valor unitário, valor total da linha.
- `EmptyState` quando não houver vendas.

## 3. Composição de KPIs

Calcular via `useMemo` (ou inline):
```
totalComprado = Σ historicoCompras[i].quantidade
valorComprado = Σ historicoCompras[i].quantidade × valor_unitario
custoMedioCompras = valorComprado / totalComprado

totalVendido = Σ historicoVendas[i].quantidade
valorVendido = Σ historicoVendas[i].quantidade × valor_unitario
ticketMedioVenda = valorVendido / totalVendido
```

## Detalhes técnicos

**Arquivos editados**
- `src/components/views/ProdutoView.tsx` — split do fetch, novas abas, novos KPIs.
- `src/types/cadastros.ts` — adicionar `HistoricoNfVendaRow`.

**Filtros de tipo no banco**: usaremos `.in('tipo', ['entrada','compra'])` e `.in('tipo', ['saida','venda'])` para cobrir variações históricas. Quando vier `tipo='devolucao'`, será classificada pela `tipo_operacao` da NF — fora do escopo deste passo (continuará invisível, igual ao comportamento atual).

**Performance**: dois selects pequenos com limit 30 em paralelo dentro do mesmo `Promise.allSettled` — mesmo padrão já usado, sem custo extra perceptível.

**Fora de escopo**
- Filtro por período dentro das abas (pode vir depois com `PeriodFilter`).
- Exportar CSV das listas.
- Snapshot legacy (`*_origem`): será exibido o `quantidade`/`valor_unitario` corrente da `notas_fiscais_itens`, que para itens migrados já é cópia do snapshot.

