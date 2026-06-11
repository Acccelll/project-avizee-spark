
## 1) Próximo número de orçamento = ORC100285

Estado atual:
- Último número em uso: **ORC100284**.
- `seq_orcamento.last_value = 100304` (sequence avançou além dos registros, provavelmente por rollbacks/inserts cancelados).
- A função `proximo_numero_orcamento()` só sincroniza a sequence quando `max(numero) >= last_value` — não é o caso aqui, então o próximo `nextval` retornaria 100305.

Ação: rodar um **data fix** (não migration de schema), via tool de insert:

```sql
SELECT setval('public.seq_orcamento', 100284, true);
-- nextval → 100285 → 'ORC100285'
```

Sem mudança em código. Verificação: `SELECT public.peek_proximo_numero_orcamento();` deve retornar `ORC100285`.

---

## 2) Vínculo bidirecional Orçamento ↔ NF emitida

Modelo atual no banco:
- `notas_fiscais.ordem_venda_id` (FK → `ordens_venda`) já existe.
- `ordens_venda` é o "pedido de venda" gerado quando o orçamento é convertido (campo `cotacao_id` na OV liga de volta ao orçamento).
- Orçamento não tem FK direta para NF — o caminho canônico é Orçamento → OV → NF.

### 2a) Em `NotaFiscalForm` / `NfeFormBody` (NF → vincular ao "Pedido")
Já existe `Select` "Vincular a um Pedido…" (`form.ordem_venda_id`) listando OVs ativas. Ajustes:
- Melhorar a busca: hoje é um `<Select>` simples; trocar por **combobox com busca** (mesmo padrão do `OrcamentoItemsGrid` produto picker) mostrando `numero — cliente — data — valor`.
- Filtrar OVs por status elegível (`em_separacao`, `aguardando_faturamento`, `pendente`) e que pertençam ao mesmo cliente já selecionado no destinatário (quando houver) — fallback para "ver todos".
- Ao vincular, **pré-preencher** itens da NF a partir dos itens da OV se a NF ainda não tem itens (mesma lógica já usada quando NF é criada via "Converter OV").
- Sem migração: campo `ordem_venda_id` já existe.

### 2b) No menu "3 pontos" do orçamento (Orçamento → vincular a NF emitida)
Em `src/pages/Orcamentos.tsx`, dentro de `rowExtraActions` e no overflow menu da `DataTable`, adicionar item:

- **"Vincular a NF já emitida…"** — visível apenas quando o orçamento está em status `aprovado` ou `convertido` e ainda não existe NF associada via a cadeia OV→NF.

Comportamento:
1. Abre dialog (`VincularNfDialog`) listando NFs emitidas (`status IN ('confirmada','autorizada','importada')`, `tipo='saida'`) **do mesmo cliente do orçamento** sem `ordem_venda_id`, com busca por número/chave.
2. Ao confirmar, executa RPC nova `vincular_orcamento_nf(p_orcamento_id, p_nf_id)` que:
   - Garante existência de uma OV "ponte": se o orçamento já tem OV (`SELECT id FROM ordens_venda WHERE cotacao_id = :orc`) usa ela; senão cria uma OV mínima com status `faturado` (espelhando o que `converter_orcamento_em_ov` faz) e marca orçamento como `convertido`.
   - Faz `UPDATE notas_fiscais SET ordem_venda_id = :ov_id WHERE id = :nf_id`.
   - Loga em `auditoria_logs`.
3. Toast cross-module com link "Abrir NF".

Sem novo campo em `orcamentos`: o vínculo continua materializado pela OV-ponte (mantém a doutrina atual e evita schema drift).

### 2c) Espelho em `NotaFiscalForm` (já coberto)
O combobox de pedido em 2a) atende à diretiva "na criação na NF também deve ser possível vincular ao pedido".

---

## 3) Revisão de filtros e cards do dashboard

Problemas encontrados ao reler `useDashboardData`, `useDashboardKpis`, `useDashboardFinanceiroData`, `useDashboardComercialData`, `FinanceiroBlock` e `ComercialBlock`:

| # | Cartão / Filtro | Problema | Correção |
|---|---|---|---|
| 1 | **Vencidos** (header Financeiro KPI) | `vencidasResult` filtra só `status='vencido'` sem filtrar `tipo` — soma vencidos de **receber e pagar juntos**. Label diz "em atraso" sem dizer o quê. | Adicionar `.eq('tipo','receber')` (vencidos do A Receber é o KPI clássico). Opcional: incluir contador separado para A Pagar atrasado em outro card/tooltip. |
| 2 | **Scope badge do bloco Financeiro** | `useDashboardData.scopes.financeiro = global-range/data_vencimento`, mas as queries A Receber / A Pagar / Vencidos foram convertidas em **snapshot** na rodada anterior. Inconsistência. | Mudar `scopes.financeiro` para `{ kind: 'snapshot' }`. (FinanceiroBlock já mostra "snapshot" no cabeçalho — alinhar metadata.) |
| 3 | **Saldo Projetado** (subtitle) | Diz `receber − pagar (período global)`, mas ambos são snapshot agora. | Trocar subtitle para `receber − pagar (saldo atual em aberto)`. |
| 4 | **Bloco Comercial** | `cotacoesAbertas` é filtrado por período (`data_orcamento`), mas `pedidosPendentes` (=`backlogOVsCount`) é snapshot all-time. Dois KPIs lado-a-lado com escopos diferentes sem badge distinguindo. | (a) Acrescentar `ScopeBadge` por KPI: "Orçamentos em aberto" → global-range; "Pedidos pendentes" → snapshot. (b) Ou padronizar ambos como snapshot (recomendado — orçamento aberto antigo continua sendo backlog real). |
| 5 | **Últimos Orçamentos** | Lista é filtrada pelo período global, mas o título não diz isso — quando o usuário escolhe "Hoje" o painel mostra "Nenhum orçamento no período" e parece bug. | Renomear para "Orçamentos do período" + caption pequena com o range; ou listar sempre os **5 mais recentes** independente do período. |
| 6 | **Faturamento (mês)** / **Ticket médio** | Janela fixa `mes-atual`; ScopeBadge presente — OK. | Manter, apenas explicitar no tooltip que "não respeita o filtro do header". |
| 7 | **Pedidos a Faturar / Compras em Atraso / Remessas Atrasadas** | Operacionais, snapshot — OK. | Sem ação. |
| 8 | **Estoque Crítico** | Snapshot — OK. | Sem ação. |
| 9 | **Bloco Fiscal** | Janela fixa `mes-atual` (alinhada a apuração). | OK, manter. |
| 10 | **Pendências (próximos 7 dias)** | Lógica do `scopes.pendencias` faz toggle baseado em `usingGlobal`, alternando entre janela fixa e global — confunde. | Travar em `fixed-window/next-7d`. Pendências = próximos 7 dias sempre. |
| 11 | **Header — seletor de período global** | Após a rodada anterior, o seletor afeta apenas: Top Clientes, gráficos diários de receber/pagar (mas estes usam `next-7d` fixo, não global ← bug latente), `cotacoesAbertas`, lista "Últimos Orçamentos", `topProdutos`. Pouca coisa. | Adicionar tooltip no `DashboardHeader` explicando "Afeta orçamentos do período, top clientes e top produtos. Demais cards usam janela fixa ou snapshot." |
| 12 | **Drilldowns** | Já corrigidos na rodada anterior (sem `from/to` para snapshots). | Verificar que os 3 cards financeiros snapshot e o card "Vencidos" não passem `range` ao drilldown. |

### Implementação concreta

Arquivos a editar:
- `src/pages/dashboard/hooks/useDashboardFinanceiroData.ts` — `vencidasResult` ganha `.eq('tipo','receber')`.
- `src/pages/dashboard/hooks/useDashboardData.ts` — `scopes.financeiro` vira `snapshot`; `scopes.pendencias` fixa `next-7d`.
- `src/pages/dashboard/hooks/useDashboardKpis.ts` — subtitle do "Saldo Projetado".
- `src/pages/dashboard/hooks/useDashboardComercialData.ts` — remover filtro de período de `orcamentosResult` (vira snapshot, alinhado com `pedidosPendentes`); deixar `orcRecentResult` sem filtro de período e limitado a 5 últimos.
- `src/components/dashboard/ComercialBlock.tsx` — ScopeBadge do cabeçalho passa a `snapshot`; remover badge `global-range/data_orcamento`.
- `src/components/dashboard/DashboardHeader.tsx` — tooltip explicando o escopo do seletor.
- `docs/dashboard-modelo.md` — atualizar tabela "Mapa atual" com Financeiro=snapshot, Comercial=snapshot, Pendências=fixed-window.

Sem migrations de schema. Sem mudanças em RLS. Sem mudanças em outros módulos.

---

## Ordem de execução
1. Rodar `setval` da sequence (item 1).
2. Criar dialog + RPC `vincular_orcamento_nf` (item 2b) e atualizar combobox da NF (item 2a). RPC requer migration.
3. Aplicar os 6 ajustes do dashboard (item 3) — somente frontend.

## Pergunta de confirmação
No item **3#4**, prefere **padronizar Comercial como snapshot** (recomendado, alinha "Orçamentos em aberto" com "Pedidos pendentes" e elimina confusão de escopos) ou **manter escopos distintos com badges separadas**?
