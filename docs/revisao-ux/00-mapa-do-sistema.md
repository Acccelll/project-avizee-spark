# Revisão UX/Fluxos — Etapa 0: Mapa do sistema

> Documento-base para as revisões de **qualidade de vida, intuitividade (UI/UX),
> recursos novos e ligações de fluxo de informação** do ERP AviZee.
> Gerado em 16/11/2026 a partir do código (branch `main`) e de contagens
> agregadas do banco de produção (sem dados pessoais).
>
> **Fora de escopo:** integração com a SEFAZ (emissão/transmissão de NF-e, DistDF-e,
> certificado, framework fiscal em `src/modules/fiscal`). Ela não está ativa e não
> será ativada. A **importação de XML** de notas emitidas fora do ERP continua
> **dentro** do escopo, porque é dela que nasce quase todo o financeiro.

---

## 1. Quem usa e o que é usado de fato

**Usuários:** 5 perfis. Papéis atribuídos (cumulativos): vendedor ×3, admin ×2,
operador_logistico ×2, gestor_compras ×2, estoquista ×2, financeiro ×1.
Ou seja, é uma equipe pequena em que as mesmas pessoas acumulam várias funções.

**Volume por módulo (total / últimos 90 dias):**

| Módulo / tabela | Total | 90 dias | Leitura |
|---|---:|---:|---|
| Orçamentos | 259 | 26 | Usado, mas pouco |
| ↳ status `aprovado` (= "Pedido" no fluxo novo) | **0** | 0 | **"Registrar pedido" nunca foi usado** |
| ↳ status `historico` (migrados) | 203 | — | A maior parte da base veio de migração |
| Ordens de venda (legado) | 2 | 0 | Abandonado |
| NF de saída (importadas por XML) | 303 | 47 | **Uso central** |
| ↳ NF de saída dos últimos 90 dias vinculadas a orçamento/pedido | — | **1 de 47** | Venda e faturamento não se conectam |
| NF de entrada | 257 | 44 | Uso central |
| Lançamentos financeiros | 1.045 | 243 | **Módulo mais usado** |
| ↳ origem `fiscal_nota` (gerados da NF) | — | 172 | 70% do financeiro vem do XML |
| ↳ origem `manual` | — | 40 | |
| ↳ origem `cartao_fatura` | — | 13 | Cartões em uso (21 faturas) |
| Baixas financeiras | 448 | 131 | 213 pendentes de conciliação, 35 divergentes |
| Importações de extrato (OFX/CSV) | 356 | — | Usado (motor `financeiro_extrato_*`) |
| `conciliacao_extratos` / `conciliacao_matches` | 0 | 0 | Tela antiga de conciliação sem uso |
| Recorrências financeiras | 0 | 0 | Sem uso, mesmo com 29 contas a pagar manuais em 90 dias |
| Movimentos de estoque | 354 | 77 | **Mantido manualmente** (ver §5) |
| Cotações de compra / pedidos de compra / recebimentos | 1 / 0 / 0 | 0 | **Módulo de Compras sem uso** |
| Remessas (logística) | 2 | 0 | **Logística sem uso** |
| Social (posts) | 0 | 0 | Sem uso |
| Chamados de suporte | 2 | 2 | Começando |
| Clientes / Produtos | 134 / 294 | 14 / 27 | |

**Lançamentos sem classificação (90 dias):** 242 de 243 sem centro de custo e
65 sem conta contábil. **Títulos vencidos em aberto/parcial:** 157.

**Conclusão de uso:** na prática, o ERP é hoje um **financeiro alimentado por XML
de NF** com cadastros e estoque manual. O comercial é usado só para orçamentos
(propostas). Compras, logística e social existem, mas não entraram na rotina.

---

## 2. Fluxos de informação: como foram desenhados × como acontecem

### 2.1 Venda (desenhado — `docs/comercial-modelo.md`)
```
Cliente → Orçamento (rascunho → enviado/pendente)
        → "Registrar pedido" (status aprovado = Pedido)
        → NF emitida fora (Sebrae) → XML importado
        → vincular_nf_automatico (xPed / "PEDIDO:" / "ORC…" no infCpl)
        → orcamentos.faturamento_status (aberto → parcial → faturado)
        → gerar_financeiro_nfe_saida → contas a receber → baixa → conciliação
        → (Remessa → entrega)  ← ligada a ordens_venda (legado)
```
### 2.2 Venda (real)
```
Orçamento (às vezes) ┄┄ sem ligação ┄┄ NF de saída importada → contas a receber → baixa
```
- O pedido do cliente não é registrado no ERP, e 46 de 47 NFs ficam sem vínculo.
  Por isso o saldo a faturar, o "Pedidos a faturar" e o funil orçamento → faturamento
  ficam sem dados.
- `remessas` referencia `ordem_venda_id` (legado) e o `RemessaForm` oferece "Ordem de
  venda". Mas o fluxo atual não cria mais OV, o pedido agora é o próprio orçamento.
  **Não existe forma de ligar uma remessa ao pedido atual.** `vw_entregas_consolidadas`
  também agrega por OV.

### 2.3 Compra (desenhado — `docs/compras-modelo.md`)
```
Cotação → propostas → aprovação → Pedido de compra → recebimento (estoque) → NF entrada → contas a pagar
```
### 2.4 Compra (real)
```
NF de entrada importada (XML) → contas a pagar (gerar_financeiro_nfe_entrada) → baixa
```
Cotação, pedido e recebimento não são usados.

### 2.5 Financeiro (real e central)
```
XML NF (entrada/saída) ─┐
Fatura de cartão ───────┼→ financeiro_lancamentos → baixas (individual / lote)
Manual ─────────────────┘         │                    │
                                  └→ fluxo de caixa    └→ extrato importado → matching/aprendizado → conciliação
Fechamento do mês / Workbook / Apresentação gerencial ← views vw_workbook_* / vw_apresentacao_*
```

### 2.6 Estoque
```
Desenhado: NF entrada/saída e recebimento de compra geram estoque_movimentos.
Real:      movimentos por documento "nota_fiscal" pararam em jun–jul/2026;
           desde então tudo é manual (134 saídas e 55 entradas manuais).
```

---

## 3. Navegação e ligações entre registros (UI)

**Menu** (`src/lib/navigation`): Cadastros · Comercial · Compras · Estoque e
Logística · Financeiro · Fiscal · Social · Relatórios · Administração.
Atalhos rápidos: Novo Orçamento, Novo Cliente, Novo Produto, **"Novo Pedido"
(abre pedido de *compra*)**, Nova Nota, Baixa Financeira.

**Drawers relacionais** (`RelationalNavigationContext`, até 5 níveis de pilha).
Tipos de entidade suportados: produto, cliente, fornecedor, orcamento,
pedido_compra, nota_fiscal, remessa, ordem_venda, grupo_economico,
forma_pagamento, transportadora, funcionario.

**Não são entidades navegáveis:** lançamento financeiro (título), baixa,
cotação de compra, recebimento, conta bancária, cartão/fatura, sócio,
extrato/conciliação.

Ligações de um drawer para outro encontradas no código (`src/components/views`):

| Drawer | Abre | Observação |
|---|---|---|
| ClienteView | orçamento, NF | tem aba financeiro (lista, sem abrir o título) |
| FornecedorView | pedido de compra, produto | tem aba financeiro |
| OrcamentoView | cliente, ordem_venda, produto | **não mostra financeiro, NFs nem entregas** do pedido diretamente (aba "vínculos" a conferir) |
| OrdemVendaView | cliente, NF, orçamento, produto | legado |
| NotaFiscalView | ordem_venda, produto | **não abre o orçamento/pedido vinculado nem os títulos gerados** |
| ProdutoView | cliente, fornecedor, NF, produto | aba estoque |
| PedidoCompraView | fornecedor, produto | |
| RemessaView, TransportadoraView, FormaPagamentoView, GrupoEconomicoView, FuncionarioView | — | sem navegação para outros registros |

Views de trilha no banco **não usadas pela UI**: `v_trilha_comercial`,
`v_trilha_compras`, `v_trilha_fiscal`, `v_trilha_logistica`.

---

## 4. Padrões de UX por tela de lista

O `DataTable` já suporta seleção em lote (`selectable`), estado vazio
(`emptyTitle/Description/Action`) e clique na linha.

| Tela | Linhas | Ações em lote | Exportação | Filtros na URL | Estado vazio próprio | Layout mobile |
|---|---:|:-:|:-:|:-:|:-:|:-:|
| Clientes | 1375 | – | ✓ | ✓ | – | ✓ |
| Fornecedores | 1049 | – | ✓ | ✓ | – | ✓ |
| Produtos | 613 | – | ✓ | ✓ | – | ✓ |
| Transportadoras | 1125 | – | ✓ | ✓ | – | ✓ |
| Orçamentos | 708 | – | ✓ | ✓ | – | ✓ |
| Pedidos de compra | 212 | – | ✓ | – | – | ✓ |
| Cotações de compra | 433 | – | ✓ | – | – | – |
| Estoque | 1208 | – | ✓ | – | – | ✓ |
| Logística | 1280 | ✓ | ✓ | – | ✓ | ✓ |
| Financeiro | 1128 | ✓ | ✓ | ✓ | ✓ | ✓ |
| Fluxo de caixa | 1061 | – | ✓ | – | – | ✓ |
| Conciliação | 323 | – | ✓ | – | ✓ | – |
| Contas bancárias | 1095 | – | ✓ | – | – | ✓ |
| Cartões de crédito | 854 | – | ✓ | – | – | ✓ |
| Relatórios | 545 | – | ✓ | – | ✓ | ✓ |

(Detecção por padrões no código. Confirmar visualmente antes de concluir.)

Várias páginas têm mais de 1.000 linhas em um único arquivo (Clientes,
Estoque, Logística, Financeiro, ContasBancarias...), o que costuma indicar
telas com muitas responsabilidades.

**Recursos de qualidade de vida que já existem** (não sugerir de novo, avaliar
se funcionam e se são fáceis de descobrir): busca global (`GlobalSearch` +
RPC `global_search`), atalhos de teclado (`useGlobalHotkeys`), favoritos e
rotas recentes, preferências de tabela salvas, deep link de edição, cadastro
rápido a partir de XML/autocomplete, duplicar orçamento e revisão, link
público de orçamento, alertas e badges na sidebar, PWA/offline, ajuda
contextual com progresso e chamados de suporte, aprendizado de matching na
conciliação, IA de extração de documentos e sugestões, conector MCP do ERP,
workbook e apresentação gerencial, fechamento do mês.

---

## 5. Achados preliminares (hipóteses para a revisão validar)

1. **Venda desconectada do faturamento.** Só 1 de 47 NFs de saída recentes está
   ligada a um orçamento, e nenhum pedido foi registrado. Verificar por que o vínculo
   automático não acontece (o número do ORC/pedido não vai no XML do Sebrae?) e se
   o passo "Registrar pedido" é burocrático demais para a rotina.
2. **Remessa sem como apontar para o pedido atual** (só OV legado). Logística
   inutilizável no modelo novo, o que pode explicar o abandono.
3. **Estoque deixou de ser movido pelas NFs** a partir de jun–jul/2026. É preciso
   entender se foi decisão ou regressão. A consequência é o trabalho manual em dobro.
4. **Compras inteiro sem uso.** Avaliar se deve ser simplificado (ex.: lista de
   necessidades → pedido simples), escondido do menu ou integrado à NF de entrada.
5. **Financeiro sem classificação.** Centro de custo quase nunca é preenchido e conta
   contábil falta em 27% dos lançamentos, o que enfraquece DRE, workbook e budget.
   Caberiam sugestão automática e regras por fornecedor ou histórico.
6. **157 títulos vencidos em aberto.** Pode ser cobrança atrasada ou títulos
   "fantasma" que precisam de ferramenta de limpeza ou baixa em lote.
7. **213 baixas sem conciliação e 35 divergentes.** O fluxo de conciliação existe,
   mas o volume pendente sugere atrito.
8. **Recorrências nunca usadas** apesar de contas a pagar manuais repetitivas.
9. **Duas conciliações** (`/conciliacao` antiga sem dados × motor de extratos
   ativo, além de `/financeiro/conciliacao-v2` e conciliação de cartão). Possível
   confusão de navegação.
10. **Atalho "Novo Pedido" abre pedido de compra.** Provavelmente o usuário
    espera um pedido de venda.
11. **Título financeiro e cotação não são navegáveis** na pilha de drawers, e NF →
    pedido → títulos não forma uma trilha clicável. As views `v_trilha_*` existem
    e não são usadas.
12. **Ações em lote só em Financeiro e Logística.** Cadastros, orçamentos e estoque
    não têm.
13. **Módulo Social sem uso** ocupando espaço no menu.

---

## 6. Perguntas em aberto para o dono do sistema

- Qual é a rotina diária de cada uma das 5 pessoas? Quais telas abrem primeiro?
- Compras, logística e social: vão ser usados ou podem sair do menu/caminho?
- O XML do Sebrae consegue levar o número do ORC/pedido no `infCpl`?
- A parada do estoque automático por NF foi intencional?
- Quais são as reclamações e os incômodos mais frequentes?

---

## 7. Mapa rápido do código

- Rotas: `src/routes/*.routes.tsx` · Menu: `src/lib/navigation*`
- Páginas: `src/pages/*` (+ subpastas por módulo) · Drawers: `src/components/views`
- Serviços: `src/services/*` (contratos em `src/services/CONTRACTS.md`)
- Regras: `src/lib/comercialWorkflow.ts`, `comprasTransitions.ts`, `financeiro.ts`
- Banco: `supabase/migrations` (tipos em `src/integrations/supabase/types.ts`)
- Modelos de domínio: `docs/*-modelo*.md` · Memória de decisões: `mem/`
