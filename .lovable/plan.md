

# Fase 6 — UX e Refinamentos Finais

Última fase do roadmap aprovado. Foco em melhorias de experiência do usuário e consolidação de fontes de dados oficiais.

## Mudanças

### 1) Fluxo de Caixa via view oficial (`src/pages/FluxoCaixa.tsx`)
Migrar a agregação client-side para a view `vw_fluxo_caixa_financeiro` (UNION previsto+realizado documentada no modelo canônico).

- Substituir o `fetch` direto de `financeiro_lancamentos` + cálculo manual por consulta única à view.
- Eliminar a duplicação de lógica de status (já refatorada na Fase 2) — a view já entrega `previsto`/`realizado` corretamente.
- Manter filtros de conta bancária e período via parâmetros de query.

### 2) Atalhos de valor na `BaixaParcialDialog` (`src/components/financeiro/BaixaParcialDialog.tsx`)
Adicionar botões rápidos acima do campo "Valor pago":
- **Saldo total** (preenche com `saldo_restante`)
- **50%** (metade do saldo)
- **Limpar**

Posicionados como chips discretos para acelerar a operação sem poluir o formulário.

### 3) Chips de origem no grid (`src/pages/financeiro/config/financeiroColumns.tsx`)
Substituir o texto plano da coluna "Origem" (oculta) por badges coloridos baseados em `origem_tipo`, usando o helper `getOrigemKey`/`getOrigemLabel` já criado na Fase 4:

| Origem | Cor |
|---|---|
| `fiscal_nota` | azul |
| `comercial` | violeta |
| `compras` | âmbar |
| `parcelamento` | cinza |
| `manual` | neutro |
| `sistemica` | índigo |

### 4) Empty states acionáveis na Conciliação (`src/pages/Conciliacao.tsx`)
Quando uma conta está selecionada mas não há lançamentos no período:
- Substituir tabela vazia por `EmptyState` (variant `noResults`) com CTAs:
  - "Ampliar período (+30 dias)" — estende o `dataFim`
  - "Importar OFX" — abre o seletor de arquivo

Quando não há extrato carregado mas há lançamentos:
- `EmptyState` (variant `firstUse`) com CTA "Importar extrato OFX".

### 5) Badge de eixo na Conciliação
Adicionar badge no header da tabela de lançamentos indicando o eixo de filtragem ativo: **"Eixo: baixa + vencimento"** (refletindo a query híbrida implementada na Fase 3), com tooltip explicativo.

## Arquivos afetados

- `src/pages/FluxoCaixa.tsx` (refactor da query)
- `src/components/financeiro/BaixaParcialDialog.tsx` (atalhos)
- `src/pages/financeiro/config/financeiroColumns.tsx` (chips de origem)
- `src/pages/Conciliacao.tsx` (empty states + badge de eixo)

## Validação

- `tsc --noEmit` após cada arquivo.
- Rodar suíte de testes existente (`vitest run`) para garantir não-regressão.
- QA visual no preview: `/financeiro`, `/fluxo-caixa`, `/conciliacao`.

## Encerramento

Após Fase 6, o roadmap completo (6 fases) estará concluído. O módulo Financeiro estará alinhado integralmente ao modelo estrutural canônico (`docs/financeiro-modelo-estrutural.md`), com:
- Baixas atômicas via RPC (Fase 1)
- Status canônico unificado (Fase 2)
- Conciliação por eixo de baixa (Fase 3)
- Origem unificada + auditoria visível (Fase 4)
- Serviços modularizados (Fase 5)
- UX refinada e consolidada (Fase 6)

