# Revisão UX/Fluxos — Backlog consolidado

> Junta `01-fluxos-e-recursos.md` (Sessão A) e `02-ux-telas.md` (Sessão B) num
> único backlog sem itens repetidos, organizado em **ondas**. Cada onda vira um
> PR, ou poucos PRs. As referências apontam para os documentos de origem, onde
> estão evidências, arquivos e números: `A·H3` = 01, item H3; `B·F2` = 02, item F2.
>
> Esforço: **P** = até 1 dia · **M** = 2 a 5 dias · **G** = mais de 1 semana.

---

## Decisões tomadas (16/11/2026)

- **D1 — Estoque por NF desligado foi intencional.** Fica desligado. Sai da
  Onda 1 o item de religar (1.1). Entram: descrição verdadeira do status
  "Confirmada" (B·N10), o movimento de estoque abre em "Saída" e mantém o tipo
  (B·E1) e "Lançar saída a partir de uma nota" (B·E2, M), que vai para a Onda 6.
- **D4 — Manter Compras, Logística e Social no menu.** O item 2.1 não esconde
  módulos. Ficam só a correção dos atalhos errados ("Novo Pedido" → venda;
  Ctrl+4) e os alertas e blocos que mostram dados inexistentes.
- **D3 — Implantar centro de custo** (item 4.5, opção M): cadastro, campo no
  lançamento e centro padrão por fornecedor.
- **Ordem:** primeiro o CI da `main` verde, depois a Onda 1.

## Decisões ainda em aberto

Elas destravam ou mudam o escopo de várias ondas.

| # | Pergunta | Afeta |
|---|---|---|
| D1 | A parada do estoque por NF em junho foi intencional? Se foi, por quê (unidade, saldo negativo, bonificação)? | Onda 1 |
| D2 | Qual conta de receita usar como padrão nas vendas? E na fatura de cartão (conta própria ou "Cartão a pagar")? | Onda 1 |
| D3 | Centro de custo é necessário, ou a conta contábil basta? | Onda 4 |
| D4 | Compras, Logística e Social podem sair do menu? Rastrear entregas é uma dor real? | Onda 2, Depois |
| D5 | Por onde o orçamento chega ao cliente (PDF pelo WhatsApp, link, e-mail)? Dá para escrever `ORC…` nas informações complementares ao emitir no Sebrae? | Onda 5 |
| D6 | O sistema vai mandar e-mail (orçamentos, resumo diário, cobrança)? A fila está desligada. | Onda 7 |
| D7 | As duas contas bancárias sem extrato desde maio e junho ainda estão em uso? | Onda 1 (operação) |
| D8 | Quantas pessoas usam o sistema pelo celular? | Prioridade do que é específico de celular |

---

## Onda 1 — Dados certos na origem (P, ~3 dias)

Corrige o que deixa números errados em todo o sistema.

| Item | O que fazer | Ref. |
|---|---|---|
| 1.1 | NF de mercadoria importada por XML nasce com "Movimenta estoque" marcado (CT-e e NFS-e não). O campo sobe para junto do pagamento, com o efeito escrito. Aviso ao salvar desmarcado. Inventário de partida em vez de reprocessar o passado. A descrição do status "Confirmada" passa a dizer a verdade | A·H3, B·N6, B·N10 |
| 1.2 | Conta de receita padrão no a receber gerado por NF de saída e conta padrão na fatura de cartão, com correção em lote dos 57 títulos existentes | A·H5b |
| 1.3 | Status de conciliação `nao_aplicavel` para baixas sem conta bancária ou por cartão, com correção das 167 existentes. Baixa por cartão deixa de pedir conta bancária | A·H7, B·B4 |
| 1.4 | "Hoje" em horário local: corrigir `todayISO()`, trocar as 49 ocorrências e criar uma regra de lint | B·T1 |
| 1.5 | A baixa (individual e em lote) já abre com a forma e a conta do título, ou com as da última baixa da pessoa. Atalhos "No vencimento" e "Ontem" na data | B·B1, B·B2 |
| 1.6 | Valores padrão pelo uso: novo lançamento em "Pagar" (ou último tipo usado); movimento de estoque em "Saída", mantendo o tipo após salvar; aba Financeiro do celular sem filtro "a receber" | B·F1, B·E1, B·G6, B·T2 |

## Onda 2 — Menu e linguagem refletem o uso real (P, ~2 dias)

| Item | O que fazer | Ref. |
|---|---|---|
| 2.1 | Configuração "módulos em uso". Ela esconde Compras, Logística e os itens de SEFAZ (menu, blocos do dashboard, alertas, colunas "Status SEFAZ", relatórios sem dados e contador da sidebar). Social continua desligado pela variável | A·§2, B·T9, B·G1, B·G2, B·N11, B·R1, B·H2 |
| 2.2 | Financeiro em dois subgrupos: Dia a dia e Configuração. Link para Regras. "Aprendizado do matching" sai do menu até ter dados | B·G3, A·H9 |
| 2.3 | Ações rápidas e atalhos: Importar XML · Novo lançamento · Registrar baixa · Importar extrato · Novo orçamento · Novo cliente. Ctrl+1..8 reordenado. "Novo Pedido" de compra sai | A·H10, B·H3, B·G5 |
| 2.4 | Dashboard: Pendências no topo, Estoque recolhido, Logística escondida. Alertas trocados por "Extrato desatualizado" e "Notas a concluir" | B·H1, B·H2 |
| 2.5 | Remover a Conciliação V2, a tela de dashboard e a de regras órfãs, e o link do workbook "modelo antigo" | A·H9, B·R4 |
| 2.6 | Limpeza de linguagem: "RPC", "auditoria_logs", "fallback", "Match", "Pendentes ERP", "Categoria" → "Origem", "Baixar" padronizado. Trocar `confirm()` do navegador pelo diálogo do sistema | B·T5, B·C2, B·E3, B·N7, B·F6, B·F8, B·T8 |
| 2.7 | Estoque: esconder "Situação/Sem mínimo" enquanto não houver mínimo; "Lançar movimento" sempre visível e na linha do produto | B·E5, B·E4 |

## Onda 3 — Importação de XML sem atrito (P → M)

| Item | O que fazer | Esf. | Ref. |
|---|---|:-:|---|
| 3.1 | "Importar XML" vira o botão principal, numa entrada única que detecta entrada ou saída. "Digitar nota" vai para o menu secundário | P | B·N1, B·N3 |
| 3.2 | Nota duplicada: botão "Abrir a nota" na própria mensagem | P | B·N4 |
| 3.3 | Status "Importada — falta concluir", com o motivo e o botão "Concluir" na lista (61 notas hoje) | P | B·N9 |
| 3.4 | Campo "Pedido (opcional)" de OV antiga sai do formulário | P | B·N8 |
| 3.5 | Nota de XML com cabeçalho fixo de leitura; o formulário fica só com pagamento, conta e estoque | M | B·N5 |
| 3.6 | Ler `transp` do XML (transportadora, volumes e peso) | P/M | A·A3 |
| 3.7 | **Importar vários XMLs** arrastando: os 100% OK entram sozinhos e o resto vai para a fila "Revisar" com o motivo | M | A·N8, B·N2 |

## Onda 4 — Classificação contábil automática (P → M)

| Item | O que fazer | Esf. | Ref. |
|---|---|:-:|---|
| 4.1 | Conta contábil visível no novo lançamento, preenchida pela última conta usada com a pessoa. "Sugerir (IA)" automático como plano B | P | B·F2, B·F3 |
| 4.2 | Coluna e filtro "Conta contábil / Sem conta" na lista, com ação em lote "Classificar selecionados" | P/M | B·F5 |
| 4.3 | Conta padrão por fornecedor (campo no cadastro, preenchido pelo histórico) aplicada na importação da NF de entrada | P/M | A·H5b, B·D4 |
| 4.4 | Motor em três camadas (regra por origem → histórico da pessoa → IA), mostrando de onde veio a sugestão | M | A·N3 |
| 4.5 | Centro de custo: retirar dos indicadores (P) **ou** implantar cadastro, campo e padrão (M), conforme D3 | P/M | A·H5a |

## Onda 5 — Venda ligada ao faturamento (P → M)

| Item | O que fazer | Esf. | Ref. |
|---|---|:-:|---|
| 5.1 | Lista de orçamentos abre em "Em negociação", sem legados. Indicadores do topo passam a "Em negociação", "Vencem esta semana" e "Pedidos a faturar" | P | B·O1, B·O7 |
| 5.2 | Ao gerar o PDF ou copiar o link: "Marcar como enviado?" com "Sim, sempre" | P | A·H1c, B·O3 |
| 5.3 | Arquivar em lote os rascunhos com mais de 60 dias, com aviso na aba | P | A·H1c, B·O5 |
| 5.4 | Sugestão por valor/produtos também sobre rascunhos e pendentes | P | A·H1b |
| 5.5 | **Painel "De qual orçamento veio esta nota?"** na importação da NF de saída. Um clique registra o pedido com o `xPed` e liga a nota | M | A·H1a |
| 5.6 | Botão de "próxima ação" com texto na lista e no formulário, e os demais itens no menu "⋯" | P/M | B·O2, B·O4, B·T4 |
| 5.7 | "Usar esta condição como padrão do cliente" ao salvar o orçamento | P | B·O6 |

## Onda 6 — Menos digitação repetida no financeiro (P → M)

| Item | O que fazer | Esf. | Ref. |
|---|---|:-:|---|
| 6.1 | "Salvar e novo" no lançamento, mantendo tipo, data e forma | P | B·F4 |
| 6.2 | **Recorrências**: aba no Financeiro, "Repetir todo mês" no formulário e detector "lançou 3 meses seguidos" | M | A·H8, A·N4 |
| 6.3 | Um único formulário de lançamento (o Fluxo de Caixa usa o do Financeiro) | M | B·F7, B·X1, B·T10 |
| 6.4 | Cartões: indicadores "Fatura aberta / Vence em / Sem classificação" e fatura atual direto na linha | P/M | B·K1, B·K2 |

## Onda 7 — Rotina diária e fechamento (M)

| Item | O que fazer | Esf. | Ref. |
|---|---|:-:|---|
| 7.1 | Aviso "último extrato importado há N dias" por conta; conciliação abre na conta com mais pendências (sem "Todas as contas") | P | A·H7, B·C1, B·C3 |
| 7.2 | **Painel "Hoje no financeiro"**: a pagar e a receber em 7 dias, vencidos, notas a concluir, sem conta, extrato atrasado e baixas a conciliar. Pendências separadas em pagar e receber | M | A·N1, B·H4 |
| 7.3 | **Conferência antes do fechamento** (semáforo) e "Finalizar mês" como último passo | M | A·N7, B·R3 |
| 7.4 | Régua de cobrança: "Cobrar" monta a mensagem para WhatsApp ou e-mail e registra no cliente | P/M | A·N9 |
| 7.5 | Resumo diário por e-mail, se D6 = sim (religar a fila) | M | A·N2, A·A2 |

## Onda 8 — Navegação entre registros e conciliação que aprende (M)

| Item | O que fazer | Esf. | Ref. |
|---|---|:-:|---|
| 8.1 | Título financeiro como entidade da pilha de drawers. Linhas de título clicáveis em NF, cliente e fornecedor. Bloco "Trilha" na NF (pedido → NF → títulos → baixas → extrato) | M | A·H11, B·G7 |
| 8.2 | Busca global com fornecedores e títulos (inclusive por valor exato) | M | B·G4 |
| 8.3 | Conciliação grava feedback e alias em toda confirmação; lançamento direto da linha do extrato já classificado | M | A·A1, A·N6 |
| 8.4 | Conciliação com abas Banco · Cartão · Regras; filtros na URL em Conciliação, Estoque, Contas, Cartões e Relatórios | M + P | B·C5, B·T6, B·C4, B·E6, B·R5 |

## Depois (depende de decisões ou de ondas anteriores)

| Item | O que fazer | Esf. | Depende de | Ref. |
|---|---|:-:|---|---|
| L1 | Bloco "Entrega" na NF de saída (cria a remessa por `nota_fiscal_id`) e CT-e ↔ NF com frete por nota | M | D4, 3.6 | A·§2.2, A·H2 |
| L2 | Estoque mínimo sugerido pelo giro, com aceite em lote | M | Onda 1 | A·N10, A·A4 |
| L3 | Último preço por fornecedor e alerta de aumento na importação da NF de entrada | M | — | A·§2.1-2, A·N11 |
| L4 | Sugestão de compra e pedido simples de 3 status | G | L2, D4 | A·§2.1-3 |
| L5 | Conector MCP com consultas financeiras de leitura | M | revisão de segurança | A·N5 |
| L6 | Cadastros: filtro "Cadastro incompleto", "Completar pelo CNPJ" em lote, ações em lote; formulário de cliente enxuto; aba do fornecedor com notas e títulos | P/M–M | — | B·D1, B·D2, B·D3, B·D5 |
| L7 | Fluxo de caixa: saldo de partida e data do último extrato; "Importar CSV" no menu secundário | P | — | B·X2, B·X3 |
| L8 | Relatórios mais abertos fixados no topo; dica de atalho por tela na primeira visita | P/M | — | B·R2, B·G8 |
| L9 | Erros no campo, e não só em aviso flutuante (padrão de formulário) | P/M | — | B·T7, B·B3 |
| L10 | Desligar crons de SEFAZ sem uso | P | — | A·A5 |

---

## Fora do escopo de UX, mas pendente

- O CI da `main` está vermelho: npm audit (22 vulnerabilidades, 17 altas), ESLint,
  Vitest, cobertura, pgTAP e touch targets. Vale um PR de manutenção antes da
  Onda 1, para que os PRs de melhoria tenham CI confiável.
- Itens "conferir na tela" da Sessão B (F9, X2, E6, H4, R3, R5) e uma passada
  visual no sistema aberto, que não foi feita.
