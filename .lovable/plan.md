# Etapa 6 — Refatoração dos monólitos

Princípio para todos: **comportamento idêntico**, só reorganização. Página vira orquestrador (~300 linhas) que compõe `useXxx` (estado/queries/mutations) + componentes de UI puros + services. Validar entre cada alvo: `typecheck:core`, build, suíte vitest e smokes.

## Estado atual real (auditoria nesta sessão)

| Arquivo | Linhas hoje | Roadmap dizia | Observação |
|---|---|---|---|
| `src/pages/OrcamentoForm.tsx` | **708** | 2096 | Já parcialmente decomposto (pasta `comercial/orcamento-form/` com ~30 sub-arquivos). Falta só finalizar. |
| `src/pages/Fiscal.tsx` | **1766** | 1934 | Pasta `fiscal/components/` existe mas página ainda concentra orquestração de abas + estado. |
| `src/pages/faturamento/EmitirNFeWizard.tsx` | **1718** | 1718 | Sem decomposição prévia. Maior risco. |
| `src/pages/Conciliacao.tsx` | **1456** | 1406 | Sem decomposição prévia. |

Ordem proposta: 6.1 → 6.4 → 6.3 → 6.2 (menor risco/menor arquivo primeiro; Wizard NF-e por último por ser o mais crítico e preparar terreno para Reforma Tributária).

## 6.1 OrcamentoForm (mais simples, fechar o que falta)

Auditar `src/pages/OrcamentoForm.tsx` e extrair o que sobrou inline:
- Mover estado/orquestração para novo hook `useOrcamentoForm` em `src/pages/comercial/orcamento-form/useOrcamentoForm.ts`, consolidando os hooks já existentes (`useOrcamentoLoad`, `useOrcamentoSave`, `useOrcamentoDraft`, `useOrcamentoRentabilidade`, `useOrcamentoFormTemplates`).
- Garantir que não restou `supabase.from/rpc` na página (mover p/ `orcamentos.service.ts`).
- Corrigir os 2 fetch-all residuais em `orcamentos.service.ts` (substituir `.limit(N)` por `fetchAllPages`).
- Meta: página final < 300 linhas, apenas JSX + composição.

## 6.4 Conciliacao

Criar `src/pages/financeiro/conciliacao/`:
- `useConciliacao.ts` — estado de extrato, candidatos, seleção, mutations.
- `ImportarExtratoSection.tsx` — upload/preview/parse.
- `ParesSugeridosList.tsx` — lista de pares com score.
- `PainelConfirmacao.tsx` — confirmação e desfazer.
- `ResumoConciliacaoBar.tsx` — totais.
- Não tocar em `conciliacao.service.ts` (`sugerirConciliacao`, `calcularScoreConciliacao`, `confirmarConciliacao` preservados).
- Página vira orquestrador < 300 linhas.

## 6.3 Fiscal

Aproveitar `src/pages/fiscal/components/` já existente. Quebrar por aba:
- `tabs/EmitidasTab.tsx`, `tabs/RecebidasTab.tsx` (DistDFe), `tabs/EventosTab.tsx`, `tabs/ConfiguracaoTab.tsx`.
- Cada aba carrega dados próprios via lazy + hook dedicado (`useFiscalEmitidas`, etc.) — reduz custo inicial.
- Estado compartilhado (filtros globais, seleção) num hook `useFiscalPage`.
- Página vira shell com `<Tabs>` + Suspense.

## 6.2 EmitirNFeWizard (por último, maior risco)

Criar `src/pages/faturamento/emitir-nfe/`:
- `useEmitirNFe.ts` — máquina de passos + validação via `preEmissao.validator.ts` (já existe).
- Um arquivo por passo: `steps/DestinatarioStep.tsx`, `ItensStep.tsx`, `TributosStep.tsx`, `TransporteStep.tsx`, `PagamentoStep.tsx`, `RevisaoStep.tsx`.
- `useEmitirNFeNavigation.ts` — back/next/validação por passo.
- Extrair montagem do payload/XML para `src/services/fiscal/emitirNfe/buildPayload.ts` (puro, testável) — prepara IBS/CBS NT 2025.002.
- Página vira shell de wizard < 300 linhas.

## Trilhos comuns (todos os 4 alvos)

- Sem alteração visual nem de fluxo — pixel-equivalente.
- Toda I/O via `src/services/` (regra `mem://tech/camada-services-unica`).
- `console.*` proibido — usar `src/lib/logger`.
- Tipos de domínio em `src/types/domain.ts`; nada de `any`.
- Após cada alvo: rodar `bunx vitest run`, `npm run build`, smokes (`auth-routing`, `dashboard`, `financeiro`) + smoke novo se a Etapa 7 já tiver entregue (caso contrário, validar manualmente).
- Cada refator entra como commit isolado para permitir reverter.

## Fora de escopo desta etapa

- Mudanças de UX, novos campos, novas regras de negócio.
- Reforma Tributária IBS/CBS (épico próprio).
- Cobertura de testes nova (Etapa 7).

## Critérios de aceite

- Os 4 arquivos-página com **< 300 linhas** cada.
- Zero regressão funcional (suíte verde + verificação manual nos fluxos críticos).
- Zero novo round-trip a banco/edge function.
- `npm run typecheck:core` e build OK; lint sem novas violações.
