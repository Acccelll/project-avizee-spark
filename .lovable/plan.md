# Paridade Conciliação de Cartão × Conciliação Bancária

Objetivo: alinhar a tela **`/financeiro/conciliacao-cartao`** aos padrões visuais e funcionais já consolidados em **`/financeiro/conciliacao`** (bancária), reaproveitando wrappers canônicos do ERP e sem quebrar o fluxo atual de fatura (importar → fechar → baixar).

## Fase 1 — Coerência visual (sem mudança de negócio)

Refatorar apenas `ConciliacaoCartao.tsx` para trocar wrappers "crus" pelos canônicos.

- **KPIs**: trocar os 4 `<Card>` por `SummaryCard` com `variant` semântico e ícones
  (`Abertas` → warning `FileText`, `Fechadas` → info `Lock`, `Pagas` → success `CheckCheck`, `Valor a pagar` → default `CircleDollarSign`).
- **Filtros**: substituir o Card "Filtros" por `AdvancedFilterBar` + `MultiSelect`
  (Cartão, Status) com chips ativos e botão "Limpar tudo" nativos.
- **Período**: trocar os dois `<input type=date>` por `PeriodFilter` (preset + range),
  padrão `mem://produto/contrato-de-periodos`.
- **Busca textual**: adicionar `searchTerm` filtrando por competência, cartão, últimos 4.
- **Empty state**: quando `rows.length === 0`, usar `EmptyState`
  (variant `firstUse`, icon `Upload`, CTA "Importar fatura (PDF)" / "Importar em lote").
- **Header actions no mobile**: agrupar `ImportarFaturasLoteDialog` + `ImportarFaturaCartaoDialog` + `Limpar tudo`
  em `DropdownMenu` "Mais ações" (como o `ConciliacaoTopControls`).
- **Lista de faturas**: manter estrutura master-detail, mas envolver cada item em
  padrão consistente com bancária (badges e tipografia iguais); `StatusBadge` já usado.

Entregável: build limpo, sem alteração de RPC. Verificação com `tsgo`.

## Fase 2 — Paridade funcional

- **Abas superiores** `Faturas` / `Histórico de importações`, movendo o
  `LotesImportacaoPanel` para a segunda aba.
- **Exportar Excel** das faturas visíveis (colunas: Competência, Cartão, Fechamento,
  Vencimento, Total, Status), via `exportarParaExcel` (mesmo serviço da bancária).
- **Conciliar automaticamente (global)**: botão no header que executa
  `autoCandidato` para todas as linhas pendentes de todas as faturas fechadas do
  filtro atual (extração do laço interno de `executarLote`).
- **Toggle "Exibir apenas pendentes"** dentro do `ReconciliacaoFaturaPanel`.
- **Barra flutuante de confirmação** (`ConfirmFloatingBar`) ao selecionar múltiplas
  linhas dentro do painel de reconciliação (aceitar/rejeitar em lote).

Entregável: mesmas capacidades de conferência em lote da bancária.

## Fase 3 — Fechamento do ciclo com o banco

- **Ajuste de diferença**: quando `Σ(linhas vinculadas) ≠ valor_total` da fatura,
  botão "Gerar ajuste" cria lançamento avulso (equivalente ao `handleGerarAjusteBancario`).
- **Onboarding em passos** no estado vazio: "1. Selecione um cartão · 2. Importe
  PDF/OFX · 3. Feche a fatura · 4. Baixe · 5. Concilie no banco".
- **Badge "Fatura de cartão"** na `OFXMatchingPane` bancária quando o candidato
  vier de `grupo_baixa_id` de fatura (já previsto em `.lovable/plan.md` Fase 2).

Entregável: ciclo cartão ↔ banco fechado, sem lacunas de reconciliação.

## Ordem e riscos

```text
Fase 1  (visual, ~1 PR)  → risco baixo, só UI
Fase 2  (funcional)      → risco médio, reuso de services existentes
Fase 3  (integrações)    → risco médio, toca matcher e RPC de baixa
```

Cada fase termina com `tsgo` limpo e verificação manual da rota
`/financeiro/conciliacao-cartao`. Sem migração SQL nas Fases 1‑2; Fase 3 pode
exigir ajuste no matcher (`scoreExtratoPendentes.service`) — sem alterar schema.

## Fora de escopo

- Reescrever `ReconciliacaoFaturaPanel` do zero.
- Unificar as duas rotas em uma única página.
- Alterar RPCs `cartao_importar_fatura`, `baixar_fatura_cartao`, `cartao_importacao_desfazer`.
