# Roteiros para as sessões com o Fable

Cada roteiro é uma sessão nova do Claude Code com o modelo Fable, no
repositório `project-avizee-spark`, branch `claude/quirky-brown-czdda1`.
Cole o texto do roteiro como primeira mensagem.

---

## Sessão A — Fluxos de informação e recursos novos

```
Leia docs/revisao-ux/00-mapa-do-sistema.md por inteiro antes de qualquer outra coisa.
Ele traz o uso real do sistema, os fluxos desenhados × reais e hipóteses a validar.
Integração com a SEFAZ está fora de escopo (importação de XML continua dentro).

Objetivo: revisão SOMENTE LEITURA (não edite código) focada em:
1. Ligações de fluxo de informação que faltam ou estão quebradas entre módulos
   (venda → faturamento → financeiro; NF → estoque; remessa ↔ pedido; títulos ↔ origem;
   classificação contábil/centro de custo). Valide ou derrube cada hipótese da §5
   do mapa olhando o código e as migrations. Para cada uma, diga a causa.
2. Por que os módulos sem uso (Compras, Logística, Social, Recorrências) não foram
   adotados e o que mudaria isso: simplificar, integrar ou esconder.
3. Recursos novos que fariam sentido para uma equipe de 5 pessoas que vive no
   financeiro alimentado por XML: automações, alertas, sugestões, painéis. Aproveite
   o que já existe (IA de extração/sugestão, matching, conector MCP, workbook).

Pode rodar consultas SELECT agregadas no Supabase (projeto "ERP AviZee") para
confirmar hipóteses; nada de escrita e nada de dados pessoais.

Entregue em docs/revisao-ux/01-fluxos-e-recursos.md:
- Para cada item: problema, evidência (arquivo:linha ou número), impacto para o
  usuário, proposta concreta, esforço (P/M/G) e dependências.
- No fim, um top 10 ordenado por impacto ÷ esforço.
```

---

## Sessão B — Intuitividade e qualidade de vida nas telas

```
Leia docs/revisao-ux/00-mapa-do-sistema.md por inteiro (principalmente §1, §3 e §4).
Se docs/revisao-ux/01-fluxos-e-recursos.md existir, leia também para não repetir.
Integração com a SEFAZ está fora de escopo.

Objetivo: revisão SOMENTE LEITURA (não edite código) da experiência nas telas mais
usadas, nesta ordem de prioridade:
  Financeiro (lançamentos, baixas, extrato/conciliação, cartões, fluxo de caixa)
  → importação de NF por XML → Orçamentos → Estoque → Cadastros (clientes, produtos,
  fornecedores) → Dashboard → Relatórios/Fechamento do mês → navegação geral (menu,
  busca, atalhos, drawers).

Para cada tela, avalie: quantos passos e cliques as tarefas frequentes exigem,
dados que precisam ser redigitados, consistência com as outras telas, clareza de
rótulos e status, mensagens de erro e estados vazios, ações em lote, filtros e
valores padrão, uso no celular, e se os recursos de qualidade de vida que já
existem (§4 do mapa) são fáceis de descobrir.

Entregue em docs/revisao-ux/02-ux-telas.md:
- Por tela: problemas (com arquivo:linha), proposta concreta (descreva o antes/depois
  da interface), esforço (P/M/G).
- Uma seção de padrões transversais (o que corrigir uma vez e vale para todas as telas).
- No fim, um top 15 de ganhos rápidos.
```

---

## Depois das duas sessões (sem Fable)

Com Opus ou Sonnet: consolidar 01 + 02 em `docs/revisao-ux/03-backlog.md`
(sem duplicatas, com prioridade) e, se quiser, transformar em issues no GitHub.
Em seguida, implementar em PRs pequenos.
