---
name: Excluir vs Inativar vs Cancelar vs Estornar
description: Árvore de decisão para ações destrutivas/terminais por tipo de entidade
type: feature
---

# Excluir vs Inativar vs Cancelar vs Estornar

**Princípio**: o usuário deve conseguir prever o efeito da ação antes de
clicar. A escolha do verbo **e** do botão segue a tabela abaixo.

## Árvore de decisão

```
A entidade tem histórico operacional (movimenta estoque, financeiro, fiscal)?
├── SIM → Cancelar (RPC dedicada com motivo)
│         + se afeta saldos colaterais (estoque), avisar no diálogo
│         + status terminal: `cancelado` / `cancelada` (variant destructive)
│
└── NÃO → É cadastro mestre referenciável (cliente, produto, fornecedor)?
          ├── SIM → Inativar (toggle `ativo = false`)
          │         + nunca expor "Excluir" como botão padrão
          │         + permitir reativar
          │
          └── NÃO → Tabela de configuração (formas pgto, unidades, sócios)?
                    └── Excluir físico permitido,
                        mas SEMPRE checar uso (FK count) antes;
                        se em uso → oferecer Inativar.

Estornar = inverso de Baixa. Apenas Financeiro. Devolve título a `aberto`/`parcial`.
Rejeitar = status terminal alternativo a Aprovado (Orçamento, Cotação Compra).
```

## Por entidade

| Entidade | Verbo padrão | Verbo alternativo | RPC? |
|---|---|---|---|
| Cliente, Produto, Fornecedor, Transportadora | Inativar | — | UPDATE direto |
| Funcionário | Inativar | — | UPDATE direto |
| Forma de Pagamento, Unidade, Sócio, Conta | Inativar (default) | Excluir só se sem uso | UPDATE / DELETE |
| Orçamento | Cancelar | Rejeitar | RPC `cancelar_orcamento` |
| Pedido | Cancelar (avisa estorno de estoque) | — | RPC `cancelar_pedido` |
| Cotação Compra | Cancelar | Rejeitar | RPC |
| Pedido Compra | Cancelar | — | RPC |
| NF | Cancelar (SEFAZ) | — | RPC + edge fn |
| Remessa | Cancelar | — | RPC |
| Lançamento Financeiro | Cancelar (não pago) ou Estornar (com baixa) | — | RPCs distintas |

## Regras de UI

- Botão **Excluir** só aparece quando o verbo padrão é Excluir.
- Botão **Cancelar** sempre exige modal de confirmação com campo `motivo` (obrigatório quando RPC pede).
- Quando Cancelar tem efeito colateral (estoque, financeiro), o diálogo
  **lista o que será afetado** antes do confirm.
- Toggle `ativo` sempre via `Switch`, com tooltip "Inativar preserva histórico".
- Nunca misturar "Excluir" + texto "considere inativar". Se inativar é
  recomendação, o botão padrão deve ser Inativar.