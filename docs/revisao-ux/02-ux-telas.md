# Revisão UX/Fluxos — Etapa 2: Intuitividade e qualidade de vida nas telas

> Sessão B. Revisão somente leitura feita em 16/11/2026 sobre o código do branch
> `claude/quirky-brown-czdda1`, com algumas contagens agregadas do banco de
> produção para dimensionar cada problema. Nada foi alterado.
>
> **Limite importante:** a análise foi feita **lendo o código**, sem abrir o
> sistema num navegador (não há credenciais nesta sessão). Contagens de cliques
> e descrições de tela saem da estrutura dos componentes. Itens marcados
> "conferir na tela" precisam de uma olhada visual antes de virar tarefa.
>
> Este documento não repete o que está em `01-fluxos-e-recursos.md`. Quando um
> problema de tela é consequência de um item de lá, a referência aparece como
> **[01·H3]**, **[01·N8]** etc.
>
> Esforço: **P** = até 1 dia · **M** = 2 a 5 dias · **G** = mais de 1 semana.

---

## 0. Resumo

As telas do Financeiro estão bem acabadas: filtros na URL, indicadores
clicáveis, baixa em lote, versão de celular e estado de erro. Os atritos que
sobram são de **valores padrão e redigitação**, e não de falta de recurso:

1. **A baixa pede de novo o que o título já sabe.** Forma de pagamento e conta
   bancária abrem vazias em toda baixa, individual ou em lote.
2. **Os padrões dos formulários apontam para o caso raro.** O novo lançamento
   abre como "a receber" (73% dos manuais são a pagar). O movimento de estoque
   abre como "ajuste" (em 90 dias houve 67 saídas e nenhum ajuste). A lista de
   orçamentos abre em "Todos", com 203 registros legados no meio.
3. **A tarefa mais frequente do sistema fica num submenu.** Importar XML está
   dentro de um menu suspenso, aceita um arquivo por vez, e o botão principal
   da tela é "Nova NF" manual.
4. **"Hoje" é calculado em UTC em 49 pontos.** Depois das 21h (horário de
   Brasília) os formulários sugerem a data de amanhã.
5. **Classificação contábil está escondida.** No formulário de lançamento a
   conta fica dentro de "Avançado" e rotulada "(opcional)". A lista não tem
   coluna nem filtro de conta.
6. **O menu e os atalhos refletem o sistema desenhado, não o usado.** O grupo
   Fiscal tem 10 itens, dos quais 7 são de SEFAZ. A busca global não encontra
   fornecedores nem títulos.

Uma boa notícia que fecha uma pendência da Sessão A: os indicadores de
"vencidos" do Financeiro, do dashboard e da lista de pendências **filtram
registros inativos corretamente**. O número inflado do mapa (157) não aparece
para o usuário.

---

## 1. Financeiro

### 1.1 Lançamentos (`/financeiro`)

**O que já está bom.** Filtros persistidos na URL
(`src/pages/financeiro/hooks/useFinanceiroFiltros.ts`), indicadores que filtram
a lista ao clicar, seleção em lote com baixa, exportação e cancelamento
(`src/pages/Financeiro.tsx:748-760`), botão "Baixar" na própria linha
(`:833-851`), faixa "vence hoje" no celular (`:668-683`), visão de calendário e
leitor de boleto.

| # | Problema | Evidência | Proposta (antes → depois) | Esf. |
|---|---|---|---|:-:|
| F1 | Novo lançamento abre como "A receber" | `src/pages/financeiro/types.ts:39`. Em 90 dias: 29 manuais a pagar, 11 a receber | Antes: tipo "Receber" sempre. Depois: abre com o último tipo usado pela pessoa; sem histórico, "Pagar" | P |
| F2 | Conta contábil escondida e marcada como opcional | `FinanceiroLancamentoForm.tsx:386-392` (bloco "Avançado" fechado) e `:442` ("Conta Contábil (opcional)") | Antes: 1 clique para abrir "Avançado", depois buscar a conta. Depois: conta visível logo abaixo de fornecedor/cliente, já preenchida pela última conta usada com aquela pessoa **[01·N3]**; "Sugerir (IA)" vira o plano B | P |
| F3 | Botão "Sugerir (IA)" quase invisível | Mesmo bloco "Avançado", `:447-462`. Só habilita com descrição preenchida | Ao sair do campo fornecedor ou descrição com a conta vazia, sugerir sozinho e mostrar "Sugerido pelo histórico" ao lado do campo | P |
| F4 | Não há "Salvar e lançar outro" | Rodapé do formulário só tem Cancelar e Salvar (`:517-520`) | Segundo botão "Salvar e novo", que mantém tipo, data e forma de pagamento. Útil para lançar várias contas do mês em sequência | P |
| F5 | Lista sem coluna e sem filtro de conta contábil | Colunas em `src/pages/financeiro/config/financeiroColumns.tsx` (Natureza, Pessoa, Descrição, Vencimento, Valor, Saldo, Status, Categoria, Forma, Banco). Filtros em `Financeiro.tsx:764-771` | Coluna "Conta contábil" (oculta por padrão, liga pelo seletor de colunas) e filtro rápido "Sem conta". Com isso a ação em lote "Classificar selecionados" fica possível | P/M |
| F6 | Coluna chamada "Categoria" mostra a origem | `financeiroColumns.tsx:178-179` (`key: "origem"`, `label: "Categoria"`). O filtro da mesma informação chama "Origem" (`Financeiro.tsx:768`) | Renomear a coluna para "Origem" | P |
| F7 | Dois formulários diferentes para a mesma coisa | O Fluxo de Caixa tem o seu "Lançamento Manual" (`src/pages/FluxoCaixa.tsx:855-990`), com campos e regras próprios (tem Status, não tem conta contábil nem parcelas) | Usar o mesmo formulário do Financeiro nas duas telas | M |
| F8 | "Importar (IA)" não diz o que importa | `Financeiro.tsx:639-647`. O texto explicativo está só no `title` (dica ao passar o mouse, invisível no celular) | Rótulo "Ler boleto ou nota (IA)" | P |
| F9 | Atalho "Baixa Financeira" abre a baixa em lote sem nada selecionado | `src/lib/navigation.ts:112` → `Financeiro.tsx:258-273` abre o modal direto. **Conferir na tela** o que aparece | Em vez de abrir o modal vazio, levar à lista já filtrada em "vencidos + vence hoje" com a seleção ativa | P |

### 1.2 Baixas (individual e em lote)

| # | Problema | Evidência | Proposta (antes → depois) | Esf. |
|---|---|---|---|:-:|
| B1 | **Forma de pagamento e conta bancária sempre vazias** | Individual: `src/components/financeiro/BaixaParcialDialog.tsx:108-109` zera os dois ao abrir. Lote: `BaixaLoteModal.tsx:66-67`. Ambos são obrigatórios (`BaixaParcialDialog.tsx:134-135`) | Antes: 2 seleções obrigatórias em toda baixa, mesmo quando o título já tem forma e conta. Depois: abre com a forma e a conta do título; se o título não tiver, usa as da última baixa da pessoa. Baixa típica cai de 4 interações para 1 (confirmar) | P |
| B2 | Data da baixa sempre "hoje" | `BaixaParcialDialog.tsx:107` | Manter "hoje" como padrão e acrescentar dois atalhos ao lado do campo: "No vencimento" e "Ontem". Quem baixa com o extrato na mão quase nunca está baixando algo pago hoje | P |
| B3 | Erros de validação só por aviso flutuante | `:130-137`: uma mensagem por vez, que some sozinha | Marcar o campo em vermelho com o texto embaixo, todos de uma vez | P |
| B4 | Baixa por cartão exige conta bancária | `:135` vale também quando a forma é cartão. Daí vêm baixas com status de conciliação que nunca fecha **[01·H7]** | Com forma "cartão de crédito", pedir só o cartão e esconder a conta bancária | P |

### 1.3 Extrato e conciliação (`/conciliacao`)

**O que já está bom.** O extrato importado fica guardado e reaparece ao voltar à
tela (`useConciliacao.ts:356-376`), a conta escolhida é lembrada, há estados
vazios com o próximo passo (`src/pages/Conciliacao.tsx:232-262`) e aceita OFX,
CSV e PDF.

| # | Problema | Evidência | Proposta (antes → depois) | Esf. |
|---|---|---|---|:-:|
| C1 | A tela oferece "Todas as contas", mas não funciona sem escolher uma | Seletor em `ConciliacaoTopControls.tsx:44-47`; mensagem "Selecione uma conta bancária para começar" em `Conciliacao.tsx:285` | Tirar a opção "Todas as contas". Na primeira visita, abrir já na conta com mais pendências | P |
| C2 | Rótulos em linguagem de sistema | Cartões "Pendentes ERP" e "Sem Correspondência" (`Conciliacao.tsx:116-118`); botões "Conciliação automática" e "Match por valor" (`ConciliacaoTopControls.tsx:94, 110`) | "No sistema, sem extrato" · "No extrato, sem lançamento" · "Conciliar automaticamente" · "Casar só pelo valor" | P |
| C3 | Nada avisa que o extrato está atrasado | Último movimento importado: 30/09 **[01·H7]** | Linha abaixo do seletor de conta: "Último movimento importado: 30/09 (há 47 dias)" em amarelo acima de 10 dias | P |
| C4 | Filtros de período e status não vão para a URL | `Conciliacao.tsx` não usa `useUrlFilters` (as demais telas do Financeiro usam) | Mesmo padrão das outras listas; permite voltar da tela de um título sem perder o recorte | P |
| C5 | Três telas de conciliação e regras sem caminho | **[01·H9]** | Abas Banco · Cartão · Regras na mesma tela | M |

### 1.4 Cartões de crédito (`/cartoes-credito`)

| # | Problema | Evidência | Proposta | Esf. |
|---|---|---|---|:-:|
| K1 | Indicadores do topo descrevem o cadastro, não a rotina | "Total", "Ativos", "Inativos", "Limite Total" (`src/pages/CartoesCredito.tsx:399-403`) | Trocar por "Fatura aberta", "Vence em", "Itens sem classificação". A pergunta diária é "quanto vou pagar e quando" | P |
| K2 | Caminho até a fatura tem um passo a mais | Clicar no cartão abre a lista de faturas (`:428-429`), depois a fatura | Mostrar a fatura atual direto na linha do cartão (valor e vencimento), com "Ver fatura" | P/M |
| K3 | "Conciliar faturas" é um link solto no cabeçalho | `:393-394` | Vira aba da conciliação (C5) | — |

### 1.5 Fluxo de caixa (`/fluxo-caixa`)

| # | Problema | Evidência | Proposta | Esf. |
|---|---|---|---|:-:|
| X1 | Formulário próprio de lançamento | Ver F7 | Unificar | M |
| X2 | Período inicial de 30 dias à frente, sem saldo de partida explícito | `src/pages/FluxoCaixa.tsx:127-132`. **Conferir na tela** se o saldo inicial das contas aparece | Primeira linha do painel: "Saldo hoje nas contas" e a data do último extrato de cada uma | P |
| X3 | "Importar CSV" de lançamentos ao lado do botão principal | `:466` | Mover para o menu "mais opções". É uso raro ocupando lugar de uso diário | P |

---

## 2. Importação de NF por XML (`/fiscal?tipo=entrada|saida`)

É a porta de entrada de 70% do financeiro e hoje exige mais passos do que
qualquer outra tarefa frequente.

**Passos atuais para uma nota** (pela estrutura de
`FiscalToolbarActions.tsx:113-145` e `useFiscalXmlImport.ts`):

1. Menu Fiscal → "Notas de Entrada" ou "Notas de Saída" (a pessoa precisa saber
   de antemão o tipo; o sistema descobre sozinho pelo emitente).
2. Botão "Importar NF-e" → item "Importar arquivo XML".
3. Escolher **um** arquivo (`useFiscalXmlImport.ts:312` lê só `files[0]`; o campo
   não tem `multiple`).
4. Se o fornecedor ou cliente não existe: cadastro rápido.
5. Se há itens sem vínculo: gaveta de tradução.
6. Revisar o formulário completo e salvar.

Para as cerca de 90 notas por trimestre, são no mínimo 4 cliques e uma revisão
de formulário por nota, mesmo quando está tudo certo.

| # | Problema | Evidência | Proposta (antes → depois) | Esf. |
|---|---|---|---|:-:|
| N1 | O botão principal da tela é o caso raro | `addLabel: "Nova NF de Entrada"` (`src/pages/fiscal/fiscalFilterOptions.ts:60`). Das 97 notas de saída lançadas depois da carga histórica, 1 foi manual e 96 vieram de XML | Antes: botão destacado "Nova NF", importação num submenu. Depois: botão destacado "Importar XML"; "Digitar nota manualmente" vai para o menu secundário | P |
| N2 | Um arquivo por vez, sem arrastar | `FiscalToolbarActions.tsx:113` (`accept=".xml"`, sem `multiple`); não há tratamento de arrastar e soltar em `src/pages/fiscal` | Aceitar vários arquivos e arrastar para a tela. Notas sem pendência entram sozinhas; as outras vão para uma fila "Revisar" **[01·N8]** | M |
| N3 | É preciso escolher entrada ou saída antes | Rotas separadas por `tipo` | Uma entrada única "Importar XML" (no menu e na busca). O sistema decide o tipo e mostra "Entrada de <fornecedor>" ou "Saída para <cliente>" | P |
| N4 | Nota duplicada só avisa por mensagem que some | `useFiscalXmlImport.ts:115`: "Documento já importado (nº …, status …)" | Acrescentar o botão "Abrir a nota" na própria mensagem | P |
| N5 | Formulário de revisão mostra campos que o XML já resolve | `NfeFormBody.tsx:155-174`: Tipo, Modelo, Número, Série, Data, Chave, todos editáveis | Em nota vinda de XML, mostrar esses dados como cabeçalho fixo de leitura. O formulário fica só com o que é decisão: pagamento, conta contábil e estoque | M |
| N6 | "Movimenta Estoque" desmarcado e no fim do formulário | `NfeFormBody.tsx:336-342` **[01·H3]** | Subir para junto do pagamento, marcado por padrão em nota de mercadoria, com o efeito escrito: "Vai dar entrada de 12 itens no estoque" | P |
| N7 | Rótulo técnico | "Conta Contábil Geral (fallback para itens sem conta)" (`NfeFormBody.tsx:381`) | "Conta contábil da nota (vale para os itens sem conta própria)" | P |
| N8 | Campo "Pedido (opcional)" aponta para o modelo antigo | `NfeFormBody.tsx:208-209` lista ordens de venda, que não são mais criadas | Trocar pelo painel de pedido/orçamento **[01·H1]** ou remover | P |
| N9 | Status "Importada" não diz o que falta | Descrição: "Nota importada de fonte externa" (`src/lib/fiscalStatus.ts:62-66`). São 61 notas nesse status (19 de saída, 42 de entrada) | Rótulo "Importada — falta concluir", com o motivo na linha (sem forma de pagamento, parcelas incompletas) e o botão "Concluir lançamento" visível na lista | P |
| N10 | Descrição de "Confirmada" promete o que não acontece | "Estoque e financeiro já impactados" (`fiscalStatus.ts:56-60`). Com o estoque desligado **[01·H3]**, é falso para todas as notas desde agosto | Texto conforme a nota: "Financeiro gerado. Estoque: não movimentado" | P |
| N11 | Duas colunas de status na lista | "Status ERP" e "Status SEFAZ" (`FiscalTableColumns.tsx:103, 226`). Sem SEFAZ, a segunda é sempre igual | Esconder "Status SEFAZ" por padrão | P |

---

## 3. Orçamentos (`/orcamentos`)

| # | Problema | Evidência | Proposta (antes → depois) | Esf. |
|---|---|---|---|:-:|
| O1 | A lista abre em "Todos", misturando 203 legados | Aba padrão é a primeira, "Todos" (`src/pages/Orcamentos.tsx:83, 213`); filtro de legados começa em "Todos" (`:212`). Base: 203 `historico`, 53 rascunhos | Antes: 259 linhas, 78% históricas. Depois: abre em "Em negociação" com legados fora; "Todos" continua a um clique | P |
| O2 | Mudar o status depende de ícones sem texto na linha | "Marcar como enviado", "Registrar pedido", "Vincular NF": botões só com ícone e dica (`:560-637`). Uma linha chega a ter 6 ícones | Um botão de texto com a **próxima ação** conforme o status ("Marcar enviado" → "Registrar pedido" → "Vincular NF") e o resto num menu "⋯" | P/M |
| O3 | Gerar PDF não muda nada | `ActionsToolbar.tsx:50, 89`. Os 53 rascunhos nunca saíram do status e nenhum foi enviado por e-mail **[01·H1]** | Depois de gerar o PDF ou copiar o link, perguntar uma vez: "Marcar como enviado ao cliente?", com "Sim, sempre" | P |
| O4 | Dentro do formulário não há "Marcar como enviado" | Só existe na lista (`Orcamentos.tsx:560`). O formulário tem "Registrar pedido" (`PedidoClienteCard.tsx:60`) | A barra de ações do formulário ganha a mesma "próxima ação" de O2 | P |
| O5 | Rascunhos antigos se acumulam | 44 dos 53 rascunhos têm mais de 30 dias | Ação em lote "Arquivar rascunhos antigos" e aviso na aba: "44 rascunhos parados há mais de 30 dias" | P |
| O6 | Condição de pagamento é sempre digitada | Nenhum dos 132 clientes ativos tem forma de pagamento padrão preenchida; 42 não têm prazo | Ao salvar um orçamento, oferecer "Usar esta condição como padrão deste cliente" | P |
| O7 | Indicadores do topo somam o que não interessa | "Total de Orçamentos" e "Valor Total" (`:460-461`) incluem tudo o que o filtro traz | "Em negociação" (quantidade e valor), "Vencem esta semana", "Pedidos a faturar" | P |

---

## 4. Estoque (`/estoque`)

| # | Problema | Evidência | Proposta (antes → depois) | Esf. |
|---|---|---|---|:-:|
| E1 | O formulário de movimento abre e volta sempre em "Ajuste" | Padrão e reinício em `src/pages/Estoque.tsx:359-365` (`tipo: "ajuste"`). Uso real em 90 dias: 67 saídas, 10 entradas, 0 ajustes | Abrir em "Saída" e, depois de salvar, **manter o tipo** para o próximo lançamento | P |
| E2 | Um produto por vez | Formulário de produto único (`:831-1068`). As saídas manuais espelham itens de nota (67 saídas contra 109 itens de NF) | Enquanto **[01·H3]** não for religado: "Lançar saída a partir de uma nota", que traz os itens da NF para conferir e confirmar de uma vez. Depois de H3, esse trabalho desaparece | M |
| E3 | Texto de programador no formulário | "(exigido pela RPC; cai em auditoria_logs)" (`:975`) | "Obrigatório. Fica registrado no histórico." | P |
| E4 | Lançar movimento fica numa terceira aba | Abas Saldos · Movimentações · Ajuste (`:637-645`); o atalho do cabeçalho some no celular (`:546`, `max-sm:hidden`) | Botão "Lançar movimento" sempre visível, e também na linha de cada produto (pré-seleciona o produto) | P |
| E5 | Situação "Sem mínimo" em todos os itens | Nenhum produto tem estoque mínimo **[01·A4]**. A coluna "Situação" e os filtros "Em atenção / Abaixo do mínimo" (`:426-430`) não dizem nada | Até existir mínimo, esconder a coluna e mostrar um aviso único: "Defina o estoque mínimo para receber alertas", com a sugestão em lote **[01·N10]** | P |
| E6 | Filtros fora da URL | Apontado no mapa §4. **Conferir na tela** quais filtros o endereço preserva | Padrão das outras listas | P |

---

## 5. Cadastros (clientes, fornecedores, produtos)

**O que já está bom.** Consulta de CNPJ e de CEP, bloqueio de documento
duplicado entre clientes e fornecedores (`src/pages/Clientes.tsx:416, 964`),
cadastro rápido a partir do XML e dos campos de busca, "Copiar como novo" em
produtos.

| # | Problema | Evidência | Proposta | Esf. |
|---|---|---|---|:-:|
| D1 | Formulário de cliente com 7 abas | `Clientes.tsx:828-868` (Dados gerais, Contatos, Endereço, Entregas, Comercial, Comunicações, Observações) e 24 campos rotulados | Uma tela só com o essencial (documento, nome, cidade/UF, contato, condição de pagamento) e "Mais dados" recolhido. A consulta de CNPJ já preenche quase tudo | M |
| D2 | Cadastros incompletos não aparecem | Fornecedores ativos: 87 de 180 sem nenhum contato, 46 sem cidade, 14 com cadastro "parcial". Produtos ativos: 217 de 268 sem NCM, 71 sem grupo, 58 sem custo | Filtro "Cadastro incompleto" em cada lista, com o que falta na linha. Para fornecedores vindos de XML, botão "Completar pelo CNPJ" em lote | P/M |
| D3 | Sem ações em lote | Mapa §4 e H12 | As três que renderiam: inativar selecionados, definir grupo de produtos, definir conta contábil padrão de fornecedores **[01·H5b]** | M |
| D4 | Fornecedor não tem conta contábil padrão | A aba "Compras" do fornecedor (`src/pages/Fornecedores.tsx:635`) não tem o campo | Campo "Conta contábil padrão", preenchido sozinho pela conta mais usada | P |
| D5 | Aba "Compras" no fornecedor e pedidos de compra no drawer | Módulo sem uso **[01·§2.1]** | Trocar o conteúdo por "Notas de entrada e títulos" desse fornecedor, que é o que existe | P |

---

## 6. Dashboard (`/`)

| # | Problema | Evidência | Proposta | Esf. |
|---|---|---|---|:-:|
| H1 | Blocos de módulos sem uso ocupam a tela | Ordem em `src/pages/Index.tsx`: Financeiro, Ações rápidas, Histórico de notas, Pendências, Comercial, Estoque, Logística, Fiscal (`:189-334`). 3 das 5 pessoas recolheram o bloco de Estoque | Esconder Logística enquanto vazia; Estoque recolhido por padrão; "Pendências" sobe para o topo, antes dos gráficos | P |
| H2 | Faixa de alertas cita o que não existe | "Compras atrasadas" e "Remessas atrasadas" (`src/components/dashboard/AlertStrip.tsx:67, 76`) | Substituir por "Extrato desatualizado" e "Notas a concluir" **[01·N1]** | P |
| H3 | Ações rápidas levam a telas raras | `src/lib/navigation.ts:107-113`: "Novo Pedido" (de compra) e "Nova Nota" descrita como "Emitir nota fiscal de saída" | Lista nova: Importar XML · Novo lançamento · Registrar baixa · Importar extrato · Novo orçamento · Novo cliente | P |
| H4 | Pendências não distinguem pagar de receber à primeira vista | `PendenciasList.tsx` lista vencidos e próximos 7 dias juntos. **Conferir na tela** | Duas colunas, "A pagar" e "A receber", cada uma com total e botão "Baixar" na linha | P/M |

---

## 7. Relatórios e Fechamento do mês

| # | Problema | Evidência | Proposta | Esf. |
|---|---|---|---|:-:|
| R1 | Catálogo com relatórios de dados que não existem | 25 relatórios em `src/config/relatoriosConfig.ts`. "Compras" (`:561`) lê pedidos de compra (0 registros); "Estoque Mínimo" (`:231`) depende de mínimo (nenhum produto tem) | Marcar como "sem dados" e mandar para o fim da categoria, ou esconder | P |
| R2 | Favoritos de relatório nunca usados | `relatorios_favoritos`: 0 registros | Fixar no topo os 4 mais abertos por pessoa, sem depender de favoritar | P |
| R3 | Fechamento gera arquivos, mas ninguém "fecha" o mês | 18 workbooks e 4 apresentações gerados; `fechamentos_mensais`: 0 registros. O botão de finalizar existe (`src/pages/FechamentoMes.tsx:305`) | Colocar a conferência **[01·N7]** antes dos botões de download, e o "Finalizar mês" como último passo natural, explicando o efeito (trava lançamentos do período?). **Conferir na tela** o texto atual | M |
| R4 | Link para "modelo antigo" de workbook | `FechamentoMes.tsx:333` | Remover quando não houver mais uso | P |
| R5 | Filtros dos relatórios fora da URL | `src/pages/Relatorios.tsx` não usa o padrão de filtros na URL das listas. **Conferir na tela** o que o endereço preserva | Padrão das listas; permite mandar o link de um relatório já filtrado para um colega | P |

---

## 8. Navegação geral

| # | Problema | Evidência | Proposta | Esf. |
|---|---|---|---|:-:|
| G1 | Grupo Fiscal com 10 itens, 7 de SEFAZ | `src/lib/navigation.ts:201-218`: Emitir NF-e, Central Fiscal, Dashboard Fiscal, Portal NF-e, Consulta de Documentos, Histórico DistDF-e, Cadastros Fiscais | Deixar visíveis "Notas de Entrada", "Notas de Saída" e "Pedidos a faturar". O resto vai para trás de uma configuração "Emissão própria" desligada | P |
| G2 | Compras dentro de "Comercial"; Logística ao lado de Estoque | `:158-178` | Esconder **[01·§2]**. O grupo vira "Vendas", com Orçamentos e Pedidos em aberto | P |
| G3 | Financeiro com 8 itens na mesma altura | `:182-193`: Lançamentos, Fluxo de Caixa, Contas Bancárias, Cartões, Plano de Contas, Conciliação, Aprendizado do matching, Budget | Dois subgrupos: **Dia a dia** (Lançamentos, Conciliação, Cartões, Fluxo de Caixa) e **Configuração** (Contas bancárias, Plano de contas, Regras, Recorrências) | P |
| G4 | Busca global não acha fornecedor nem título | A função `global_search` consulta clientes, produtos, orçamentos e notas. Não consulta `fornecedores` nem `financeiro_lancamentos` (`supabase/migrations/20260930120000_global_search_cliente_documento.sql`) | Incluir fornecedores (nome e CNPJ) e títulos (descrição, número da nota, valor exato). Buscar "1.250,00" e cair no título é o uso mais comum de quem concilia | M |
| G5 | Atalho Ctrl+4 abre Pedidos de Compra | `src/hooks/useGlobalHotkeys.ts:38` | Reordenar pelos destinos reais: 1 Início · 2 Lançamentos · 3 Conciliação · 4 Notas de entrada · 5 Notas de saída · 6 Orçamentos · 7 Estoque · 8 Relatórios | P |
| G6 | No celular, a aba Financeiro abre filtrada em "a receber" | `navigation.ts:269`: `/financeiro?tipo=receber`. Em aberto hoje: 108 a pagar e 55 a receber | Abrir sem filtro de tipo, ou no último usado | P |
| G7 | Título financeiro fora da pilha de drawers | **[01·H11]** | — | M |
| G8 | Recursos de qualidade de vida pouco descobertos | Preferências salvas existem para tabelas (28) e favoritos de menu (2 pessoas); progresso de ajuda: 5 registros; favoritos de relatório: 0 | Uma dica por tela, na primeira visita, do atalho que mais importa ali ("Ctrl+K busca qualquer coisa", "clique no indicador para filtrar"), dispensável e sem tour longo | P/M |

---

## 9. Padrões transversais (corrigir uma vez, vale para todas as telas)

### T1 — "Hoje" calculado em UTC (P)
- **Problema.** `new Date().toISOString().split("T")[0]` devolve a data em UTC.
  Das 21h à meia-noite em Brasília, o resultado é o dia seguinte.
- **Evidência.** 49 ocorrências em `src/` fora de testes, incluindo vencimento
  do novo lançamento (`src/pages/financeiro/types.ts:42`), data da baixa
  (`BaixaParcialDialog.tsx:65, 107`; `BaixaLoteModal.tsx:48, 65`) e o próprio
  utilitário central (`src/lib/dateUtils.ts:23-25`).
- **Impacto.** Baixa registrada à noite sai com a data de amanhã. Isso desloca o
  fluxo de caixa e dificulta casar com o extrato.
- **Proposta.** Corrigir `todayISO()` para a data local e trocar as 49
  ocorrências por ele. Uma regra de lint impede a volta.

### T2 — Valores padrão pelo uso, não pelo esquema (P cada)
- **Regra.** Todo formulário abre com o valor mais frequente ou o último usado
  pela pessoa: tipo do lançamento (F1), tipo do movimento de estoque (E1), forma
  e conta da baixa (B1), aba da lista de orçamentos (O1), aba Financeiro no
  celular (G6).
- **Como.** Um pequeno utilitário "último valor usado por campo", guardado nas
  preferências do usuário que já existem (`user_preferences`).

### T3 — A ação principal de cada tela é a tarefa mais frequente (P)
- Fiscal: Importar XML (N1). Estoque: Lançar movimento (E4). Dashboard e
  atalhos: H3. A regra é o botão de destaque ser a tarefa do dia a dia, e o caso
  raro ir para o menu secundário.

### T4 — "Próxima ação" em vez de fileira de ícones (M)
- Listas com status (orçamentos, notas, títulos) mostram um botão de texto com o
  próximo passo daquele registro e um menu "⋯" com o resto (O2, N9). Ícones sem
  texto exigem passar o mouse, o que não existe no celular.

### T5 — Linguagem do usuário (P)
- Tirar termos internos dos textos: "RPC", "auditoria_logs", "fallback"
  (`Estoque.tsx:975`, `NfeFormBody.tsx:381`), "Match", "Pendentes ERP", "Status
  ERP" (C2, N11).
- Um nome por conceito: "Origem" (não "Categoria", F6); "Baixar/Baixa" em todo
  lugar (o formulário de lançamento fala "Registrar Baixa", a lista "Baixar", o
  indicador "Baixados"); "Orçamento" e "Pedido" conforme o modelo novo.
- Descrições de status devem dizer a verdade do registro (N10).

### T6 — Filtros na URL em todas as listas (P cada)
- Já é padrão em Financeiro, Orçamentos e cadastros. Faltam Conciliação (C4),
  Estoque (E6), Contas bancárias, Cartões e Relatórios (R5).

### T7 — Erros no campo, não só em aviso flutuante (P/M)
- Validações com `toast.error` em sequência (B3; `CartoesCredito.tsx:230-242`;
  `Estoque.tsx:300-301`) mostram um erro por vez e somem. Padrão proposto: campo
  marcado, texto embaixo, foco no primeiro erro.
- Mensagem com saída: quando o erro tem um destino óbvio, a mensagem leva o botão
  (N4).

### T8 — Confirmações no padrão do sistema (P)
- 3 usos de `confirm()` do navegador: `FinanceiroRegrasAliases.tsx:158, 165` e
  `src/pages/fiscal/PortalFiscal.tsx:385`. Trocar pelo `ConfirmDialog` usado no
  resto.

### T9 — Esconder o que está vazio (P)
- Blocos, colunas, filtros, relatórios e itens de menu de módulos sem dados
  somem ou vão para o fim (H1, H2, E5, R1, G1, G2, N11). Uma configuração por
  empresa ("módulos em uso") resolve todos de uma vez.

### T10 — Um formulário por entidade (M)
- O mesmo registro não deve ter dois formulários com regras diferentes (F7).
  Vale conferir também o cadastro rápido contra o cadastro completo de cliente e
  fornecedor.

---

## 10. Top 15 de ganhos rápidos

Todos de esforço **P**, ordenados pelo quanto aparecem na rotina.

| # | Ganho | Ref. | Onde mexer |
|---:|---|---|---|
| 1 | Baixa abre com forma de pagamento e conta do título (ou da última baixa) | B1 | `BaixaParcialDialog.tsx:100-112`, `BaixaLoteModal.tsx:63-72` |
| 2 | "Hoje" em horário local em todo o sistema | T1 | `src/lib/dateUtils.ts:23` e 49 ocorrências |
| 3 | "Importar XML" como botão principal das telas de notas e nos atalhos | N1, H3 | `fiscalFilterOptions.ts:60`, `FiscalToolbarActions.tsx`, `navigation.ts:107-113` |
| 4 | Conta contábil visível no novo lançamento, preenchida pelo histórico | F2, F3 | `FinanceiroLancamentoForm.tsx:386-470` |
| 5 | Novo lançamento abre em "Pagar" (ou no último tipo usado) | F1 | `src/pages/financeiro/types.ts:39` |
| 6 | Lista de orçamentos abre em "Em negociação", sem legados | O1 | `Orcamentos.tsx:83, 212-213` |
| 7 | Perguntar "marcar como enviado?" ao gerar PDF ou copiar o link | O3 | `orcamento-form/pdfUtils.ts`, `ShareCard.tsx` |
| 8 | Movimento de estoque abre em "Saída" e mantém o tipo após salvar | E1 | `Estoque.tsx:359-365` |
| 9 | Menu: esconder itens de SEFAZ, Compras e Logística; Financeiro em dois subgrupos | G1, G2, G3 | `src/lib/navigation.ts` |
| 10 | Coluna e filtro "Conta contábil / Sem conta" na lista de lançamentos | F5 | `financeiroColumns.tsx`, `Financeiro.tsx:764` |
| 11 | Aviso "último extrato importado há N dias" e fim da opção "Todas as contas" | C1, C3 | `ConciliacaoTopControls.tsx:40-50` |
| 12 | Limpeza de linguagem: "RPC", "fallback", "Match", "Categoria", descrições de status | T5, N7, N10, E3, C2, F6 | arquivos citados |
| 13 | Aba Financeiro do celular sem filtro "a receber"; atalhos Ctrl+1..9 reordenados | G5, G6 | `navigation.ts:269`, `useGlobalHotkeys.ts:34-44` |
| 14 | Status "Importada — falta concluir" com motivo e botão na lista | N9 | `fiscalStatus.ts:62`, `FiscalTableColumns.tsx` |
| 15 | Dashboard: Pendências no topo, Logística escondida, alertas trocados | H1, H2 | `src/pages/Index.tsx`, `AlertStrip.tsx:58-85` |

**Fora do top por serem M, mas com maior retorno depois dos rápidos:**
importação de vários XMLs com fila de revisão (N2), busca global com
fornecedores e títulos (G4), "próxima ação" nas listas (T4) e formulário único
de lançamento (F7).

---

## 11. O que não foi possível avaliar

- **Aparência e comportamento reais**: alinhamento, densidade, tempos de
  carregamento, ordem de tabulação, leitura em telas pequenas. Tudo isso pede
  uma passada com o sistema aberto. Os itens "conferir na tela" são F9, X2, E6,
  H4, R3 e R5.
- **Uso no celular**: o código tem tratamento específico em quase todas as
  listas (cartões por linha, botões de 44 px, puxar para atualizar). Não há
  dado de quantas pessoas usam o sistema pelo celular; vale perguntar antes de
  investir.
- **Acessibilidade** (contraste, leitor de tela, navegação só por teclado): não
  avaliada.
- **Telas fora da lista de prioridade**: Contas bancárias, Plano de contas,
  Budget, Sócios, Funcionários, Administração.
