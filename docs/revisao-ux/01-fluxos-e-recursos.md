# Revisão UX/Fluxos — Etapa 1: Fluxos de informação e recursos novos

> Sessão A. Revisão somente leitura feita em 16/11/2026 sobre o código do branch
> `claude/quirky-brown-czdda1` e contagens agregadas do banco de produção
> (projeto "ERP AviZee"). Nenhum dado pessoal foi consultado e nada foi escrito
> no banco. Integração com a SEFAZ está fora de escopo.
>
> Esforço: **P** = até 1 dia · **M** = 2 a 5 dias · **G** = mais de 1 semana.
> "90 dias" = registros criados desde ~18/08/2026.

---

## 0. Resumo

1. **O vínculo venda → faturamento não falha no XML, falha antes.** 33 das 34 NFs
   de saída importadas desde 26/09 trazem número de pedido no XML. O que falta é o
   outro lado: nenhum orçamento sai de `rascunho` (53 parados, 0 pedidos
   registrados), então não há com o que casar.
2. **O estoque parou por um valor padrão no formulário**, e não por falha no
   banco. O formulário de NF nasce com "Movimenta Estoque" desmarcado, enquanto o
   padrão da tabela é `true`. Desde meados de junho, toda NF importada entra com
   `movimenta_estoque = false`.
3. **Centro de custo não é preenchido porque não existe como recurso utilizável**:
   a tabela está vazia, não há tela de cadastro e o formulário de lançamento não
   tem o campo.
4. **Conta contábil falta por origem, não por descuido**: 100% dos títulos a
   receber gerados de NF (44 de 44) e 100% das faturas de cartão (13 de 13) nascem
   sem conta. Os manuais e os a pagar de NF estão quase todos classificados.
5. **Três números do mapa precisam de correção** (detalhe em H6 e H7):
   - Títulos vencidos em aberto: **51**, e não 157 (106 são registros inativos).
   - Baixas divergentes: **0** ativas (as 35 são baixas estornadas).
   - Baixas pendentes de conciliação: das 213, **167 não têm conta bancária** e
     123 são de cartão de crédito. Elas nunca vão aparecer num extrato.
6. **Recorrências e regras de classificação nunca foram usadas porque não têm
   porta de entrada**: não há tela de recorrências e a tela de regras
   (`/financeiro/regras`) não tem link em lugar nenhum.
7. **A conciliação está 6 semanas atrasada**: o último lançamento de extrato
   importado é de 30/09. Duas contas não recebem extrato desde maio e junho.

---

## 1. Hipóteses da §5 do mapa

### H1 — Venda desconectada do faturamento · **CONFIRMADA, causa diferente da suposta**

**Problema.** Nenhuma NF de saída importada depois da entrada do recurso de
vínculo (26/09) foi ligada a um pedido.

**Evidência.**
- NFs de saída desde 26/09: 34. Com `referencias_pedido` preenchido: **33**.
  Com vínculo: **0**.
- Formato das referências lidas: 20 com 10 dígitos, 7 com 6, 5 com 15, 5 com 4,
  2 no formato `ORC…`. Ou seja, quase todas são o **número do pedido do cliente**,
  e não o número do orçamento.
- Referências que batem com `orcamentos.pedido_cliente`: **0**. Só 2 orçamentos em
  toda a base têm `pedido_cliente`.
- Orçamentos por status: 53 `rascunho`, 1 `pendente`, 0 `aprovado`. Dos 53
  rascunhos, 44 têm mais de 30 dias, 0 foram enviados por e-mail pelo sistema e só
  3 têm link público.
- Os 83 vínculos existentes foram todos criados em 26 e 27/09 (carga do
  histórico): 60 por valor, 21 por número de orçamento, 2 de OV antiga.
- Regra no banco: o vínculo automático só liga quando o orçamento já é pedido
  (`supabase/migrations/20260926180000_orcamento_nf_vinculos.sql:514`), o vínculo
  manual recusa orçamento não registrado (`:250`) e a sugestão por valor só olha
  `aprovado`/`convertido` (`:444`).
- Quando nada bate, a importação não mostra nada: `resumoVinculoAutomatico`
  devolve `null` para `sem_pedido`
  (`src/services/comercial/vinculoNfPedido.service.ts:187`).

**Causa.** São duas quebras em sequência:
1. O orçamento é montado no ERP e enviado por fora (PDF, WhatsApp). Como ninguém
   clica em "Enviar" nem em "Registrar pedido", ele fica em rascunho para sempre.
2. O número que vem no XML é o do pedido do cliente. Esse número só entraria no
   ERP pelo "Registrar pedido", que não é usado. O casamento automático depende de
   um dado que ninguém digita.

**Impacto.** "Pedidos em aberto", "Pedidos a faturar", saldo por item, funil
orçamento → faturamento e a carteira de pedidos do fechamento ficam vazios. A
lista de orçamentos acumula rascunhos que já viraram venda.

**Proposta.** Inverter o sentido: a NF passa a registrar o pedido.
- **(a) Painel na importação da NF de saída** (M). Quando o resultado for
  `sem_pedido` ou `pedido_nao_registrado`, mostrar "De qual orçamento veio esta
  nota?" com os orçamentos em aberto do mesmo cliente (raiz do CNPJ), ordenados
  por cobertura de produtos e valor. Um clique registra o pedido (com o `xPed` do
  XML como `pedido_cliente` e a data de emissão) e liga a nota. Uma segunda opção,
  "Venda sem orçamento", fecha o painel.
  Alcance medido: das 34 NFs, **17** têm orçamento em aberto do mesmo cliente,
  **9** têm todos os produtos cobertos por um deles e **5** batem no valor exato.
- **(b) Sugestão por valor/produtos também para `rascunho` e `pendente`** (P).
  Ajuste na CTE `por_valor` de `sugerir_pedidos_nf`.
- **(c) Passar o orçamento para "Enviado" sozinho** ao baixar o PDF ou copiar o
  link público (P), e oferecer "arquivar rascunhos com mais de 60 dias" (P).
- **(d) Mudança de processo, sem código:** escrever `ORC100xxx` nas informações
  complementares ao emitir a nota no Sebrae. O ERP já lê esse formato.

**Esforço.** (a) M · (b) P · (c) P. **Dependências.** Nenhuma técnica. Confirmar
com o dono se as 17 NFs sem orçamento são vendas que realmente não passam por
proposta.

---

### H2 — Remessa sem como apontar para o pedido atual · **CONFIRMADA**

**Evidência.**
- `RemessaForm` só oferece "Pedido de Venda" ligado a `ordem_venda_id`
  (`src/pages/RemessaForm.tsx:358-359`). A tabela `remessas` não tem coluna de
  orçamento.
- `vw_entregas_consolidadas` agrega por `ordem_venda_id`
  (`supabase/migrations/20260420175335_….sql:150-167`).
- O gatilho `trg_remessa_entregue_sync` atualiza o status de OV.
- As 2 remessas existentes não têm OV, NF nem pedido de compra.

**Causa.** O modelo comercial trocou OV por orçamento-pedido em 26/09 e a
logística não acompanhou. Mas esse não é o único motivo do abandono, ver §2.2.

**Proposta.** Ligar a remessa à **NF de saída**, que é o documento que sempre
existe, e chegar ao pedido pela NF (`orcamento_nf_vinculos`). Detalhe em §2.2.
**Esforço.** M. **Dependências.** Decisão de manter ou esconder a Logística.

---

### H3 — Estoque deixou de ser movido pelas NFs · **CONFIRMADA: regressão de valor padrão**

**Evidência.**
- Padrão da coluna `notas_fiscais.movimenta_estoque` no banco: `true`.
- Padrão do formulário: `movimenta_estoque: false`
  (`src/pages/fiscal/hooks/useFiscalNotaForm.ts:63`). A importação de XML parte
  desse `emptyForm` (`src/pages/fiscal/hooks/useFiscalXmlImport.ts:208-210`).
- NFs importadas por XML com `movimenta_estoque = true`: maio 26 de 26; junho 4 de
  14; julho 1 de 36; de agosto a novembro **0 de 97**.
- Movimentos com `documento_tipo = 'nota_fiscal'`: 80 em maio, 16 em junho, 3 em
  julho, 0 depois.
- A RPC `confirmar_nota_fiscal` continua tratando `movimenta_estoque` e gravando
  em `estoque_movimentos`. Os gatilhos de saldo estão ativos.
- Trabalho em dobro nos últimos 90 dias: **67 saídas manuais** contra 109 itens de
  NF de saída, e 10 entradas manuais contra 58 itens de NF de entrada.

**Causa.** O padrão do formulário mudou para `false` em algum momento de junho. O
histórico do git deste clone começa em 24/09 e não mostra o commit, então não dá
para afirmar se foi decisão ou efeito colateral. O checkbox existe
(`src/pages/fiscal/components/NfeFormBody.tsx:336-342`), mas fica no fim do
formulário e desmarcado.

**Impacto.** O saldo depende de alguém lembrar de lançar cada saída. As entradas
quase não são lançadas (10 em 90 dias), então o saldo tende a ficar abaixo do
real. Custo médio, giro, estoque crítico e a variação de estoque do fechamento
perdem valor.

**Proposta.**
1. Padrão `true` para NF-e de mercadoria importada por XML e `false` para CT-e,
   NFS-e e notas sem item com produto (P).
2. Aviso ao salvar com o campo desmarcado: "Esta nota não vai mexer no estoque" (P).
3. Não reprocessar o passado automaticamente, porque o saldo já foi corrigido à
   mão. Oferecer um inventário de partida e ligar a automação dali em diante (P,
   o tipo `inventario` já existe).

**Esforço.** P. **Dependências.**
- Confirmar com o dono se a parada foi intencional (pergunta em aberto do mapa).
- 19 NFs de saída estão em status `importada` (não confirmadas). O financeiro
  delas é gerado por gatilho, mas o estoque só entra na confirmação. Verificar
  esse caminho antes de religar.
- Em setembro, 41 de 71 itens de NF ficaram sem produto vinculado. Item sem
  produto não movimenta estoque, e isso precisa aparecer para o usuário.

---

### H4 — Compras inteiro sem uso · **CONFIRMADA** → análise em §2.1

---

### H5 — Financeiro sem classificação · **CONFIRMADA, com duas causas distintas**

**5a. Centro de custo (242 de 243 sem preenchimento).**
- `centros_custo` tem **0 registros**.
- Não há tela de cadastro. A única referência em páginas é o seletor da tela de
  regras (`src/pages/financeiro/FinanceiroRegrasAliases.tsx:79`), e ele lista uma
  tabela vazia.
- O formulário de lançamento não tem o campo. Não há ocorrência de `centro_custo`
  em `src/pages/financeiro/components/` nem em `src/components/financeiro/`.
- `gerar_financeiro_nfe_entrada` e `gerar_financeiro_nfe_saida` não gravam centro
  de custo.

**Causa.** O recurso existe só no banco. O usuário não tem como preencher.

**Proposta.** Decidir primeiro se a empresa precisa de centro de custo. Com 5
pessoas e um plano de 134 contas, a conta contábil provavelmente já responde às
perguntas gerenciais.
- Se **não** precisa: tirar o centro de custo dos indicadores de "sem
  classificação" e do budget (P).
- Se **precisa**: cadastro simples, campo no formulário e centro padrão por
  fornecedor e por conta contábil (M).

**5b. Conta contábil (65 sem conta em 90 dias).**

| Origem | Títulos | Sem conta |
|---|---:|---:|
| NF de saída → a receber | 44 | **44** |
| Fatura de cartão → a pagar | 13 | **13** |
| NF de entrada → a pagar | 69 | 4 |
| Manual (pagar e receber) | 40 | 0 |
| Sistêmica (retiradas, rendimentos) | 17 | 0 |

- O gatilho de herança de conta só trata `tipo = 'pagar'`
  (`supabase/migrations/20261013100100_nf_entrada_conta_gatilhos.sql:13`). Não há
  equivalente para o a receber.
- 9 de 44 NFs de entrada dos últimos 90 dias estão sem conta.
- Previsibilidade: dos 37 fornecedores com 3 ou mais títulos classificados,
  **37 usam a mesma conta em pelo menos 80% das vezes**.
- `financeiro_regras`, `financeiro_aliases` e `budgets_mensais`: 0 registros.

**Causa.** Falta a regra de conta para receita de venda e para fatura de cartão.
Nos casos restantes falta um padrão por fornecedor.

**Impacto.** A receita não entra classificada na DRE e no workbook. O fechamento
exige classificar à mão ou cai em "sem categoria".

**Proposta.**
1. Conta de receita padrão para títulos a receber de NF de saída, configurável por
   natureza de operação ou CFOP, mais correção em lote dos existentes (P).
2. Conta da fatura de cartão: herdar a conta predominante dos itens da fatura ou
   usar uma conta transitória "Cartão a pagar" (P).
3. Conta padrão por fornecedor, sugerida pelo histórico e aplicada na importação
   da NF de entrada. `conta_nf_entrada_inferida` já deduz pelos itens. Falta o
   passo "último uso do fornecedor" (P/M).

**Esforço.** P cada. **Dependências.** Escolha das contas com quem faz o fechamento.

---

### H6 — 157 títulos vencidos em aberto · **PARCIALMENTE DERRUBADA**

**Evidência.**
- Vencidos em aberto e **ativos**: **51**. Os outros 106 têm `ativo = false`.
- Dos 51: 29 a pagar de NF (R$ 12,6 mil), 11 a pagar manuais (R$ 0,6 mil),
  9 a receber de NF (R$ 25,6 mil) e 2 a receber manuais (R$ 0,3 mil).
- 30 dos 51 venceram há menos de 30 dias. Nenhum tem mais de 90 dias.
- A base tem 136 títulos `aberto` com `ativo = false` e 177 cancelados inativos.

**Causa.** O número do mapa contou registros excluídos logicamente. Não há massa
de títulos "fantasma" ativos. O que existe é atraso normal de baixa e 9 recebíveis
vencidos de verdade.

**Impacto.** Pequeno. O risco está nas telas ou views que não filtram `ativo` e
mostram o número inflado. A Sessão B deve conferir os indicadores de "vencidos" do
dashboard e da sidebar.

**Proposta.** Garantir `ativo = true` em todo indicador de vencidos (P). Criar
uma régua simples de cobrança para os recebíveis vencidos, ver N9.

---

### H7 — 213 baixas sem conciliação e 35 divergentes · **REFORMULADA**

**Evidência.**
- As 35 "divergentes" são todas baixas **estornadas**. Divergentes ativas: 0.
- Das 213 pendentes, 123 são `cartao_credito`, **167 não têm conta bancária** e
  181 são anteriores a agosto.
- O padrão da coluna `financeiro_baixas.conciliacao_status` é `'pendente'` para
  qualquer baixa, inclusive as que nunca passam por banco.
- A tela de conciliação filtra por conta bancária
  (`src/services/financeiro/conciliacaoQueries.ts:16`), então essas baixas não
  aparecem lá. Elas só inflam contagens.
- Pendentes de verdade (com conta bancária): cerca de 46.
- Extrato: 356 linhas importadas, 202 conciliadas, 102 ignoradas (89 são
  transferências internas) e 51 pendentes. As 51 são de duas contas cujo último
  extrato é de 27/05 e 22/06.
- Conta principal: última linha de extrato em **30/09**. Não há extrato de outubro
  nem de novembro.

**Causa.**
1. O status "pendente" vale para baixas que não são conciliáveis em banco.
2. A importação de extrato é mensal e manual, e está 6 semanas atrasada.

**Proposta.**
1. Status `nao_aplicavel` para baixa sem conta bancária ou por cartão, com
   correção das 167 existentes (P).
2. Aviso "extrato desatualizado" por conta: último movimento importado há mais de
   N dias (P). Hoje seriam 3 contas.
3. Decidir o destino das 51 linhas antigas das duas contas paradas: conciliar ou
   ignorar em lote (P, é operação e não código).

**Esforço.** P.

---

### H8 — Recorrências nunca usadas · **CONFIRMADA: não há tela**

**Evidência.**
- O serviço existe (`src/services/recorrencias.service.ts`), mas `listRecorrencias`
  e `createRecorrencia` não são chamados por nenhuma tela.
- A única entrada é o checkbox "Cobrança recorrente" dentro do formulário de NF
  (`src/pages/fiscal/components/NfeFormBody.tsx:355, 419-445`).
- Não há item de menu nem rota de recorrências (`src/routes/financeiro.routes.tsx`).
- O motor está saudável: o cron `gerar-lancamentos-recorrentes-diario` roda todo
  dia, sem falhas nos últimos 14 dias.
- Demanda real: **10 fornecedores** têm contas a pagar manuais em 3 ou mais meses
  distintos dos últimos 6 (66 lançamentos). 75 contas a pagar manuais em 180 dias.

**Causa.** O recurso foi entregue pela metade: tem motor e não tem interface no
lugar onde o usuário cria a despesa.

**Proposta.**
1. Aba "Recorrências" no Financeiro: lista, pausar, encerrar, gerar agora (M).
2. Opção "Repetir todo mês" no formulário de lançamento manual (P, depois do 1).
3. Sugestão automática: "Você lançou este fornecedor em 3 meses seguidos. Tornar
   recorrente?" (P/M).

**Esforço.** M no total. **Dependências.** Nenhuma.

---

### H9 — Duas conciliações · **CONFIRMADA, com os papéis invertidos**

**Evidência.**
- `/conciliacao` (item do menu, `src/lib/navigation.ts:189`) é a tela **viva**.
  Ela usa `useConciliacao` sobre `financeiro_extrato_importacoes`.
- `/financeiro/conciliacao-v2` é a tela **morta**. Ela lê `conciliacao_extratos`
  (`src/pages/financeiro/ConciliacaoV2.tsx:54`), que tem 0 linhas, e nenhuma tela
  aponta para ela.
- `/financeiro/conciliacao/dashboard` só é alcançável a partir da V2.
- `/financeiro/regras` (regras e aliases de classificação) **não tem nenhum link**
  no sistema.
- `/financeiro/conciliacao/regras` também não tem link.
- "Aprendizado do matching" está no menu (`navigation.ts:190`), mas a tabela de
  feedback tem 0 linhas, então a tela aparece vazia.

**Causa.** Uma reescrita ficou pela metade. O motor novo foi ligado na tela antiga
e a tela nova ficou com o esquema antigo.

**Impacto.** O usuário não se confunde, porque não chega às telas órfãs. O custo é
de manutenção e de recursos invisíveis: as regras de classificação, que resolveriam
parte de H5, não podem ser encontradas.

**Proposta.**
- Remover `ConciliacaoV2`, `ImportarExtratoDialog` e as tabelas
  `conciliacao_extratos` e `conciliacao_matches`, depois de confirmar que não há
  outros leitores (P/M).
- Agrupar em `/conciliacao` as abas Banco, Cartão, Regras e Aprendizado.
- Tirar "Aprendizado do matching" do menu até existir dado.

**Esforço.** M.

---

### H10 — Atalho "Novo Pedido" abre pedido de compra · **CONFIRMADA**

**Evidência.** `src/lib/navigation.ts:110`: o título é "Novo Pedido" e o caminho é
`/pedidos-compra?new=1`. O módulo de compras tem 0 pedidos. Já existe o
`NovoPedidoDialog` de venda (`src/components/orcamentos/NovoPedidoDialog.tsx`).

**Proposta.** Apontar o atalho para o pedido de venda direto e renomear o de
compra para "Novo Pedido de Compra", ou removê-lo se Compras for escondido. Como
a rotina real é importar XML, vale trocar por **"Importar XML"** e **"Novo
lançamento"**. **Esforço.** P.

---

### H11 — Título financeiro e cotação não navegáveis · **CONFIRMADA EM PARTE**

**O que já funciona** (o mapa estava desatualizado):
- NF → pedido: `PedidosDaNfPanel` abre o orçamento
  (`src/components/fiscal/PedidosDaNfPanel.tsx:65`).
- Pedido → NFs: `FaturamentoPedido`
  (`src/components/orcamentos/FaturamentoPedido.tsx:186`).
- Título → NF: "Ver NF vinculada"
  (`src/components/financeiro/FinanceiroDrawer.tsx:428-430`).
- 288 de 288 títulos de origem fiscal têm `nota_fiscal_id`.

**O que falta:**
- NF → títulos: a aba mostra os lançamentos, mas as linhas não são clicáveis
  (`src/components/fiscal/NotaFiscalDrawer.tsx:798-811`).
- O título não é um tipo de entidade da pilha de drawers
  (`src/contexts/RelationalNavigationContext.tsx:10-22`). As abas financeiras de
  cliente e fornecedor listam títulos sem abrir.
- As views `v_trilha_*` não têm leitor em `src/`.
- Fatura de cartão: os 20 títulos de origem `cartao_fatura` têm `origem_id` nulo.
  Do título não se chega à fatura por `origem_id`, só por `cartao_fatura_id`.

**Proposta.** Criar o tipo de entidade `lancamento` (o `FinanceiroDrawer` vira uma
view da pilha) e tornar clicáveis as linhas de título em NF, cliente e fornecedor
(M). Adicionar um bloco "Trilha" no drawer da NF com pedido → NF → títulos →
baixas → linha do extrato (M). Avaliar se `v_trilha_fiscal` serve; se não, remover
as quatro views.

**Esforço.** M. **Dependências.** Nenhuma.

---

### H12 — Ações em lote só em Financeiro e Logística · **não aprofundada**

É tema de tela e pertence à Sessão B. Do ponto de vista de fluxo, as ações em
lote que mais renderiam são: importar vários XMLs de uma vez, classificar conta
contábil em lote e arquivar rascunhos de orçamento.

---

### H13 — Social ocupando o menu · **NÃO VERIFICÁVEL PELO CÓDIGO**

O item só entra no menu quando `VITE_FEATURE_SOCIAL === 'true'`
(`src/lib/navigation.ts:224`). No `.env.example` o valor é `false`. O valor de
produção não está no repositório. Se o item aparece hoje, basta mudar a variável
no ambiente de build. Ver §2.3.

---

## 1b. Outras quebras de fluxo encontradas

### A1 — O aprendizado do matching nunca aprende
- **Evidência.** `financeiro_matching_feedback` e `financeiro_aliases` têm 0
  linhas, mesmo com 202 linhas de extrato conciliadas. O feedback só é gravado
  quando existe sugestão persistida para a linha
  (`src/pages/financeiro/conciliacao/useConciliacao.ts:333-334`), e nenhuma das 356
  linhas tem `sugestao_lancamento_id`. O alias só nasce do feedback
  (`src/services/financeiro/matching/feedback.service.ts:40-51`).
- **Causa provável.** As sugestões usadas na tela são calculadas em memória
  (`autoMatchBanco`) e as persistidas não chegam a existir, então o gancho de
  aprendizado nunca dispara. Falta confirmar em execução.
- **Impacto.** Cada extrato é conciliado do zero. A classificação automática por
  descrição, que depende dos aliases, não existe na prática.
- **Proposta.** Gravar feedback e alias em toda conciliação confirmada, com ou sem
  sugestão prévia (M). **Dependências.** H9.

### A2 — Fila de e-mail desligada
- **Evidência.** O cron `process-email-queue-tick` está com `active = false` e
  nunca rodou. O mesmo vale para `webhooks-dispatcher-tick`.
- **Impacto.** Explica os 0 orçamentos enviados por e-mail e bloqueia qualquer
  recurso de alerta por e-mail (N2, N9).
- **Proposta.** Decidir se e-mail será usado. Se sim, religar e testar (P).

### A3 — Transportadora não é lida do XML
- **Evidência.** 0 de 47 NFs de saída com `transportadora_id`. O parser de
  importação (`src/lib/nfeXmlParser.ts`) não lê o grupo `transp`. Só o gerador de
  DANFE lê (`src/services/fiscal/nfeXmlToDanfe.ts:107`).
- **Impacto.** A logística precisa redigitar o que já está no XML. Ver §2.2.

### A4 — Nenhum produto tem estoque mínimo
- **Evidência.** 0 de 268 produtos ativos com `estoque_minimo > 0`.
- **Impacto.** O alerta "estoque baixo" da sidebar, o estoque crítico do workbook
  e qualquer sugestão de compra nunca disparam.
- **Proposta.** Sugerir o mínimo a partir do giro, depois de H3 (N10).

### A5 — Crons da SEFAZ rodando sem uso
`process-distdfe-cron-tick` (a cada 30 min) e `process-nfe-retry-cron-tick` (a
cada 10 min) estão ativos, embora a integração não vá ser ligada. Está fora de
escopo. Fica o registro para quem decidir desligar.

---

## 2. Módulos sem uso: por que não pegaram e o que fazer

### 2.1 Compras — **esconder agora, reintroduzir simplificado depois do estoque**

**Por que não foi adotado.**
- O desenho tem 8 status de cotação e 8 de pedido, com etapas de aprovação
  (`docs/compras-modelo.md`). Na empresa, as mesmas 2 pessoas são gestor de
  compras, estoquista e admin. Aprovar o próprio pedido é só burocracia.
- A compra já entra pelo caminho mais curto: o XML da NF de entrada gera o contas
  a pagar. O módulo não acrescenta nada que o financeiro precise.
- O ganho que Compras daria (saber o que comprar e conferir o recebido) depende de
  estoque confiável e de estoque mínimo. Hoje não há nenhum dos dois (H3, A4).
- `financeiro_lancamentos.pedido_compra_id` está vazio em 100% dos títulos.

**O que fazer.**
1. **Esconder** Cotações e Pedidos de Compra do menu, o atalho "Novo Pedido"
   (H10) e o contador `pedidosCompraPendentes` da sidebar, por configuração da
   empresa (P).
2. **Integrar à NF de entrada o que tem valor imediato:** ao importar o XML,
   atualizar `produtos_fornecedores` com último preço e data (48 vínculos hoje) e
   avisar quando o preço subir acima de X% (M). É compras sem tela de compras.
3. **Depois de H3 e A4:** lista "Sugestão de compra" (produtos abaixo do mínimo,
   com último fornecedor e preço) e um "pedido simples" de 3 status: rascunho →
   enviado → recebido. O recebimento seria casado pela NF de entrada (G).

**Esforço.** 1: P · 2: M · 3: G.

### 2.2 Logística — **trocar "remessa" por "entrega da nota"**

**Por que não foi adotado.**
- A remessa só se liga a OV, que não existe mais (H2).
- Todas as 47 NFs de saída recentes têm modalidade de frete `0` (por conta do
  emitente). A transportadora está no XML, mas não é lida (A3). O usuário teria
  de recadastrar tudo numa tela separada.
- Não há gatilho no fluxo: a NF é importada depois que a mercadoria já saiu.

**O que fazer.**
1. Ler `transp` do XML e preencher transportadora, volumes e peso na NF, com
   cadastro rápido da transportadora (P/M).
2. Bloco "Entrega" no drawer da NF de saída: código de rastreio, data de
   expedição e data de entrega. Por baixo ele cria a remessa ligada a
   `nota_fiscal_id`, coluna que já existe (M).
3. Ligar CT-e à NF: 8 CT-es já foram importados e `cte_chave_nfe_ref` existe.
   Mostrar o frete pago por nota e por cliente (M). Isso alimenta a margem real
   no fechamento.
4. Tirar "Logística" do menu enquanto isso, ou deixá-la só como lista de entregas.
   Remover o `LogisticaBlock` do dashboard (`src/pages/Index.tsx:309`) enquanto
   estiver vazio (P).

**Esforço.** M no total. **Dependências.** Confirmar se rastrear entrega é dor
real da equipe.

### 2.3 Social — **manter desligado por flag**

Não tem ligação com a rotina financeira. O que está em uso é o conector MCP de
matérias (`docs/conector-mcp.md`), que não depende do menu Social. Manter
`VITE_FEATURE_SOCIAL=false` no build e retirar os slides de redes sociais da
apresentação gerencial quando não houver dados. **Esforço.** P.

### 2.4 Recorrências — **completar** (ver H8)

É o único dos quatro com demanda comprovada e motor pronto. Falta a interface.

---

## 3. Recursos novos

Critério: equipe de 5 pessoas, rotina centrada em XML → títulos → baixa →
conciliação → fechamento. Cada item reaproveita algo existente.

### N1 — Painel "Hoje no financeiro" (M)
- **Problema.** O dashboard divide a tela em 5 blocos de peso igual, e 2 deles são
  de módulos sem uso. Quem cuida do financeiro precisa abrir 4 telas para saber o
  que fazer.
- **Proposta.** Uma lista de trabalho única, com contagem e link filtrado:
  - a pagar e a receber nos próximos 7 dias (hoje 5 e 3);
  - vencidos ativos (51);
  - NFs importadas por XML ainda em status `importada` (19 de saída e 42 de
    entrada no total; 9 e 10 nos últimos 90 dias);
  - títulos sem conta contábil;
  - contas com extrato desatualizado (3);
  - baixas com conta bancária aguardando conciliação (cerca de 46).
- **Aproveita.** `useSidebarAlerts`, `PendenciasPanel`, `PendenciasList`.
- **Dependências.** H7 (status `nao_aplicavel`) para o número de conciliação fazer
  sentido.

### N2 — Resumo diário ou semanal por e-mail (M)
- **Proposta.** Mesmo conteúdo do N1, enviado às 8h para quem tem o papel
  financeiro, com o aviso de extrato atrasado.
- **Aproveita.** `send-transactional-email`, `pg_cron`, `cron_health`.
- **Dependências.** A2 (religar a fila de e-mail).

### N3 — Classificação automática em três camadas (M)
- **Proposta.** Na criação de qualquer título:
  1. regra fixa por origem (receita de venda, cartão), ver H5b;
  2. conta mais usada do fornecedor ou cliente (acerta 37 de 37 fornecedores
     recorrentes);
  3. IA (`ia-sugestao`, ação `categorizar`) só quando 1 e 2 não resolvem.
  Mostrar a origem da sugestão ("pelo histórico do fornecedor") e permitir trocar.
- **Aproveita.** `ia-sugestao`, que hoje só é chamada por um botão no formulário
  manual (`FinanceiroLancamentoForm.tsx:99`), `conta_nf_entrada_inferida` e
  `financeiro_regras`.
- **Dependências.** H5.

### N4 — Detector de despesas recorrentes (P/M)
- **Proposta.** Ver H8, item 3. Rodar na abertura do Financeiro ou no fechamento.
- **Dependências.** Tela de recorrências (H8).

### N5 — Conector MCP com consultas financeiras de leitura (M)
- **Problema.** O conector só tem ferramentas de matérias do site. Perguntas como
  "quanto vence esta semana?" ou "qual cliente mais atrasa?" exigem abrir
  relatório.
- **Proposta.** Ferramentas somente leitura, com permissão `financeiro:visualizar`
  e RLS do usuário: `avizee_titulos` (filtros de período, tipo e status),
  `avizee_posicao_caixa`, `avizee_aging`, `avizee_dre_mes` e
  `avizee_pendencias` (o mesmo do N1).
- **Aproveita.** Edge function `mcp` (OAuth, limite de chamadas) e as views
  `vw_workbook_*`.
- **Dependências.** Revisão de segurança das views, que são `security_invoker`.

### N6 — Conciliação que aprende, com lembrete (M)
- **Proposta.** A1 mais o aviso de extrato atrasado (H7). Depois de aprender,
  criar o lançamento direto da linha do extrato já classificado (tarifas, juros,
  débitos automáticos). Esse caminho existe em `criarLancamentoInline.service.ts`
  e hoje consulta uma tabela de aliases vazia.

### N7 — Verificação antes do fechamento do mês (P/M)
- **Proposta.** Antes de gerar workbook ou apresentação, mostrar um semáforo:
  extrato importado até o último dia do mês em todas as contas, baixas bancárias
  sem conciliação, títulos do mês sem conta contábil, NFs não concluídas e faturas
  de cartão em aberto. Cada linha leva à lista filtrada.
- **Aproveita.** `fechamentos_mensais` e a tela de Fechamento do mês.
- **Motivo.** O workbook de outubro sairia hoje sem extrato de outubro e com 44
  receitas sem conta.

### N8 — Importar vários XMLs de uma vez (M)
- **Problema.** São cerca de 90 NFs por trimestre, importadas uma a uma pelo
  formulário.
- **Proposta.** Arrastar um lote. As notas "100% OK" (cadastros casados, com
  duplicatas no XML) são concluídas sozinhas. As demais vão para uma fila de
  pendências com o motivo: produto sem vínculo, sem forma de pagamento ou pedido
  não identificado.
- **Aproveita.** A regra de auto-confirmação (`mem/features/auto-confirm-nf.md`),
  o drawer de tradução e o `PendenciasPanel`.
- **Dependências.** H1(a) e H3, para a fila já tratar pedido e estoque.

### N9 — Régua de cobrança simples (P/M)
- **Proposta.** Para recebíveis vencidos (hoje 9, R$ 25,6 mil): botão "Cobrar"
  que monta a mensagem com NF, valor e vencimento para e-mail ou WhatsApp, e
  registra em `cliente_registros_comunicacao`.
- **Dependências.** A2 para o envio por e-mail. Por WhatsApp (link `wa.me`) não
  há dependência.

### N10 — Estoque mínimo sugerido pelo giro (M)
- **Proposta.** Calcular a saída média pelos itens de NF de saída e sugerir mínimo
  e ponto de reposição por produto, com aceite em lote.
- **Aproveita.** `vw_workbook_estoque_giro` e o alerta `estoqueBaixo`.
- **Dependências.** H3.

### N11 — Alerta de variação de preço na NF de entrada (P/M)
- **Proposta.** Ver §2.1, item 2. A explicação por IA já existe
  (`explicar_anomalia`, tipo `divergencia_preco`) e hoje só aparece em painel de
  administração (`src/pages/admin/components/AnomaliasPanels.tsx`). Trazer o aviso
  para o momento da importação.

---

## 4. Top 10 por impacto ÷ esforço

| # | Item | Ref. | Impacto | Esforço |
|---:|---|---|---|:-:|
| 1 | Religar NF → estoque: padrão `true` para NF-e de mercadoria e aviso ao desmarcar | H3 | Elimina cerca de 67 saídas manuais por trimestre e devolve confiança ao saldo | P |
| 2 | Conta contábil automática para a receber de NF e fatura de cartão, com correção dos existentes | H5b | Resolve 57 dos 65 títulos sem conta e a receita passa a entrar na DRE | P |
| 3 | Status `nao_aplicavel` para baixas sem banco e aviso de extrato atrasado | H7 | Tira 167 falsos pendentes e expõe o atraso real de 6 semanas | P |
| 4 | Limpeza de navegação: atalho "Novo Pedido", esconder Compras e Logística, link para Regras, remover Conciliação V2 do roteamento | H9, H10, §2 | Menu passa a refletir o uso real e as regras de classificação ficam acessíveis | P |
| 5 | Conta padrão por fornecedor aplicada na importação da NF de entrada | H5b, N3 | 37 de 37 fornecedores recorrentes previsíveis; zera o resto de "sem conta" | P/M |
| 6 | A NF registra o pedido: painel "De qual orçamento veio esta nota?" e sugestão sobre rascunhos | H1 | Liga até 17 de 34 NFs e dá vida a pedidos a faturar, funil e carteira | M |
| 7 | Recorrências: aba no Financeiro, "repetir todo mês" e detector | H8, N4 | Automatiza cerca de 66 lançamentos manuais por semestre | M |
| 8 | Painel "Hoje no financeiro" e verificação antes do fechamento | N1, N7 | Uma tela de trabalho diária e fechamento sem surpresa | M |
| 9 | Centro de custo: decidir e, se não for usar, retirar dos indicadores | H5a | Remove um "242 sem classificação" que hoje é impossível de resolver | P (retirar) / M (implantar) |
| 10 | Título como entidade navegável e trilha NF → títulos → baixas → extrato | H11 | Fecha a navegação entre os registros mais usados | M |

**Logo abaixo do corte:** N8 importação em lote de XML (M, alto impacto, depende
de 1 e 6) · A1/N6 conciliação que aprende (M) · N5 conector MCP financeiro (M) ·
§2.2 entrega na NF e CT-e ↔ NF (M) · §2.1 compras simplificado (G).

**Ordem sugerida.** Itens 1 a 4 formam um primeiro PR de ajustes pequenos. Os
itens 5 a 7 atacam digitação repetida. Os itens 8 e 10 dependem dos números
corrigidos pelos itens 2 e 3.

---

## 5. Limites desta análise e perguntas para o dono

**Não verificado.**
- Histórico do git anterior a 24/09 (clone raso): não foi possível datar nem
  atribuir a mudança do padrão de estoque (H3).
- Variáveis de ambiente de produção: `VITE_FEATURE_SOCIAL` (H13).
- Comportamento em execução: a causa de A1 foi deduzida do código e das contagens.
- Telas e indicadores que podem estar contando títulos inativos (H6): fica para a
  Sessão B.

**Perguntas.**
1. A parada do estoque por NF em junho foi decisão? Se foi, qual era o problema
   (conversão de unidade, saldo negativo, notas de remessa ou bonificação)?
2. Os orçamentos saem para o cliente por onde? Se for PDF por WhatsApp, o item
   H1(c) resolve o status sem mudar o hábito.
3. É viável escrever o número do orçamento nas informações complementares ao
   emitir no Sebrae?
4. Centro de custo é necessário para alguma decisão, ou a conta contábil basta?
5. Qual conta de receita usar como padrão para vendas? E para fatura de cartão?
6. Rastrear entregas é uma dor real, ou a Logística pode sair do menu?
7. E-mail pelo sistema vai ser usado (orçamentos, alertas, cobrança)? A fila está
   desligada.
8. As duas contas bancárias sem extrato desde maio e junho ainda estão em uso?
