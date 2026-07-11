# MATRIZ DE PRIORIZAÇÃO — CONCILIAÇÃO FINANCEIRA

> Consolida os itens de `CONCILIACAO-GAPS.md` em quatro faixas de
> prioridade. Nenhuma implementação é proposta.
>
> **Legenda**
> - Impacto: Baixo · Médio · Alto · Crítico
> - Esforço: XS (< 1d) · S (1-3d) · M (1-2s) · L (2-6s) · XL (> 6s)
> - Frequência: R (rara) · O (ocasional) · F (frequente) · S (sempre)
>
> **Faixas**
> - **P0** — Crítico, afeta integridade financeira ou perda de dados
> - **P1** — Alto impacto operacional ou de performance
> - **P2** — Melhoria importante de arquitetura, UX ou manutenção
> - **P3** — Refinamentos incrementais

---

## P0 — Risco financeiro / integridade / segurança

| ID   | Categoria    | Item                                                                                      | Impacto  | Freq | Esforço | Benefício |
|------|--------------|-------------------------------------------------------------------------------------------|----------|------|---------|-----------|
| A7   | Arquitetura  | Confirmação não transacional (baixa → concilia → update → RPC lote sem atomicidade)       | Crítico  | S    | M       | Elimina estados parciais |
| A8   | Arquitetura  | `try/catch` silencioso em `confirmarConciliacao`                                           | Crítico  | S    | XS      | Torna falhas visíveis |
| C4   | Banco        | `conciliacao_bancaria` / `conciliacao_pares` opcionais → livro incompleto                  | Crítico  | F    | M       | Livro auditável obrigatório |
| J1   | Financeiro   | Baixa conciliada sem cabeçalho de lote                                                     | Crítico  | F    | (A7+A8) | Auditoria confiável |
| J2   | Financeiro   | Reimport sobrescreve `sugestao_*` em linha já conciliada                                   | Alto     | O    | S       | Impede regressão de estado |
| B2   | Fluxo        | Race entre parse local e Motor Universal                                                   | Alto     | F    | S       | Consistência de dados |
| B8   | Fluxo        | Sem suporte a OFX multi-conta (mistura FITIDs)                                             | Alto     | O    | M       | Evita contaminação de contas |
| H6   | Segurança    | RLS permite DELETE em `financeiro_extrato_importacoes` por qualquer usuário da empresa     | Alto     | R    | XS      | Reduz perda silenciosa |
| J3   | Financeiro   | Fallback "mais recente" pode conciliar baixa errada                                        | Alto     | O    | S       | Escolha determinística |
| J8   | Financeiro   | Sem bloqueio para conciliar mês fechado                                                    | Alto     | O    | S       | Integridade contábil |
| J6   | Financeiro   | Desfazer não limpa par `is_transferencia_interna`                                          | Médio    | O    | XS      | Estado consistente |
| J10  | Financeiro   | Diferença > R$ 0,05 aceita com `confirm()`                                                 | Alto     | O    | S       | Rastreabilidade da divergência |

---

## P1 — Performance, escalabilidade e operação

| ID   | Categoria     | Item                                                                        | Impacto  | Freq | Esforço | Benefício |
|------|---------------|-----------------------------------------------------------------------------|----------|------|---------|-----------|
| D1   | Performance   | Reload de período inteiro após confirmação                                  | Alto     | S    | S       | UX + carga menor no banco |
| D3   | Performance   | Matching JS síncrono (sem worker)                                           | Alto     | F    | M       | UI responsiva em grandes lotes |
| D4   | Performance   | `scoreExtratoPendentes` potencial N+1                                       | Alto     | F    | M       | Escalabilidade |
| D8   | Performance   | Sem virtualização no `OFXMatchingPane`                                      | Alto     | F    | S       | Cumpre regra do design system |
| A1   | Arquitetura   | God object `useConciliacao` (867 LoC)                                       | Alto     | S    | L       | Manutenibilidade |
| A2   | Arquitetura   | Duas camadas (legado + Motor Universal)                                     | Alto     | S    | L       | Fonte única de verdade |
| C5   | Banco         | Índices ausentes (`sugestao_lancamento_id`, `status`, `data_transacao`)     | Médio    | F    | S       | Consultas 10-100× mais rápidas |
| C8   | Banco         | `financeiro_matching_feedback` sem particionamento                          | Médio    | F    | M       | Métricas em escala |
| B1   | Fluxo         | CSV/PDF sem UI de matching                                                  | Alto     | O    | M       | Cobertura funcional completa |
| D9   | Performance   | Detecção de transferências O(n²)                                            | Médio    | F    | S       | Escalabilidade |
| G3   | UX            | Sem progresso da importação                                                 | Médio    | S    | S       | Menor ansiedade e ligações de suporte |
| G12  | UX            | Sem indicador do Motor Universal em segundo plano                           | Médio    | S    | S       | Confiança do usuário |
| I3   | Manutenção    | Contratos TS não centralizados                                              | Médio    | S    | S       | Menos regressões |
| E7   | Qualidade     | Falta de testes de integração / hook / confirmação                          | Alto     | S    | M       | Base para refactor seguro |

---

## P2 — Arquitetura, UX, manutenção

| ID   | Categoria    | Item                                                                       | Impacto | Freq | Esforço | Benefício |
|------|--------------|----------------------------------------------------------------------------|---------|------|---------|-----------|
| A3   | Arquitetura  | Remover `useConciliacaoBancaria` órfão                                     | Médio   | -    | S       | Menos dívida técnica |
| A4   | Arquitetura  | Consolidar loaders + queries em serviço único                              | Médio   | S    | M       | Consistência |
| A5   | Arquitetura  | Introduzir camada de repositório                                           | Médio   | S    | M       | Testabilidade |
| A6   | Arquitetura  | Invalidação de cache pós-conciliação                                       | Médio   | S    | S       | Dashboards atualizados |
| B3   | Fluxo        | Estado misto memória × persistência                                        | Médio   | F    | M       | Menos perdas |
| B4   | Fluxo        | Sessão de conciliação persistida (draft)                                   | Médio   | F    | L       | Retomada e colaboração |
| B5   | Fluxo        | Substituir `window.confirm` por diálogos do DS                             | Médio   | F    | S       | Consistência de UX |
| B6   | Fluxo        | UI para reabrir sugestões rejeitadas                                       | Médio   | O    | S       | Reduz intervenção SQL |
| B9   | Fluxo        | Validar período do arquivo vs período selecionado                          | Médio   | F    | S       | Menos erros silenciosos |
| B10  | Fluxo        | Fluxo "extrato sem título" (despesa direta)                                | Médio   | F    | M       | Cobre casos comuns |
| C1   | Banco        | Refatorar `financeiro_extrato_importacoes` (segregar estado × canônico)    | Médio   | -    | L       | Modelagem clara |
| C3   | Banco        | FK real de `financeiro_baixas.conciliacao_extrato_referencia`              | Médio   | -    | M       | Integridade referencial |
| C7   | Banco        | TTL/versionamento de aliases                                               | Médio   | O    | M       | Aprendizado sadio |
| C10  | Banco        | Tabelas de sessão/rascunho                                                 | Médio   | F    | M       | Auditoria |
| C11  | Banco        | Constraint impedindo conciliar lançamento cancelado                        | Médio   | R    | XS      | Regra no banco |
| E1   | Qualidade    | Decompor hook God object                                                   | Alto    | S    | L       | Manutenibilidade |
| E3   | Qualidade    | Configurar thresholds por empresa                                          | Médio   | O    | S       | Flexibilidade |
| E5   | Qualidade    | Padronizar tratamento de erros                                             | Médio   | S    | S       | Observabilidade |
| E6   | Qualidade    | Mover tipos para `src/types/domain.ts`                                     | Médio   | S    | S       | Contratos claros |
| E8   | Qualidade    | Ampliar cobertura E2E                                                      | Médio   | S    | M       | Segurança de release |
| G1   | UX           | Redesenho do painel (reduzir carga cognitiva)                              | Alto    | S    | L       | Adoção |
| G2   | UX           | Unificar ações de "auto/valor/lote"                                        | Médio   | S    | S       | Menos confusão |
| G5   | UX           | Tela de detalhe do extrato                                                 | Médio   | O    | M       | Transparência |
| G6   | UX           | Consolidar filtros                                                         | Médio   | S    | S       | Consistência |
| G7   | UX           | Unificar mobile × desktop                                                  | Médio   | F    | M       | Consistência |
| G8   | UX           | Bulk actions no painel                                                     | Médio   | F    | S       | Produtividade |
| G10  | UX           | Visão "conciliação do mês" (book-to-bank)                                  | Alto    | S    | L       | Fechamento confiável |
| G11  | UX           | Aviso antecipado de arquivo já importado                                   | Baixo   | O    | XS      | UX preventiva |
| H1   | Segurança    | Revalidação de `can(...)` em ações críticas                                | Alto    | S    | S       | Defense in depth |
| H2   | Segurança    | Motivo/step-up para desfazer                                               | Alto    | O    | S       | Auditoria |
| H8   | Segurança    | Mascarar CPF/CNPJ antes de enviar à IA                                     | Alto    | F    | S       | LGPD |
| I1   | Manutenção   | Plugin registry para bancos/adapters                                       | Médio   | O    | M       | Escala funcional |
| I7   | Manutenção   | Feature flags                                                              | Médio   | O    | S       | Releases seguros |

---

## P3 — Refinamentos e ausências desejáveis

| ID   | Categoria     | Item                                                                       | Impacto | Esforço |
|------|---------------|----------------------------------------------------------------------------|---------|---------|
| A9   | Arquitetura   | Mover regra `hideConciliados` para service                                 | Baixo   | XS      |
| B7   | Fluxo         | Regras de arredondamento de centavos                                       | Baixo   | S       |
| C2   | Banco         | `empresa_id` explícito na chave `(conta, fitid)`                           | Baixo   | S       |
| C6   | Banco         | Constraint em `prioridade` de regras                                       | Baixo   | XS      |
| C9   | Banco         | Investigar view `vw_conciliacao_eventos_financeiros`                       | Baixo   | XS      |
| D2   | Performance   | Otimizar re-renders (memoização de linhas)                                 | Médio   | S       |
| D5   | Performance   | Cache/parallelização do fallback IA                                        | Médio   | S       |
| D6   | Performance   | Reduzir `staleTime` de contas                                              | Baixo   | XS      |
| D7   | Performance   | Export Excel em worker                                                     | Médio   | S       |
| D10  | Performance   | Debounce nos filtros de URL                                                | Baixo   | XS      |
| E2   | Qualidade     | Unificar `normalizarDescricao`                                             | Baixo   | XS      |
| E4   | Qualidade     | Naming consistente                                                         | Baixo   | S       |
| E9   | Qualidade     | Remover comentário "Silently fail" (após A8)                               | Baixo   | XS      |
| E10  | Qualidade     | Auditoria final de `console.*` → `logger.*`                                | Baixo   | XS      |
| F1-F6| Estado        | Refatoração de estado (após A1/A6)                                         | Médio   | M       |
| G4   | UX            | Substituir alerts nativos                                                  | Baixo   | XS      |
| G9   | UX            | Auditoria de acessibilidade                                                | Médio   | S       |
| H3   | Segurança     | Autor da conciliação (após A8/C4)                                          | Médio   | XS      |
| H4   | Segurança     | Trilha WORM/append-only                                                    | Médio   | M       |
| H5   | Segurança     | Rate-limit client-side do `ia-sugestao`                                    | Baixo   | XS      |
| H7   | Segurança     | Validação de schema OFX antes de gravar                                    | Médio   | S       |
| I2   | Manutenção    | Consolidar regra única no Motor (após A2)                                  | Médio   | M       |
| I4   | Manutenção    | Testes de integração (base para refactor)                                  | Médio   | M       |
| I5   | Manutenção    | Docs no CI                                                                 | Baixo   | XS      |
| I6   | Manutenção    | Storybook dos componentes específicos                                      | Baixo   | S       |
| 12.* | Ausências     | Backlog completo em `CONCILIACAO-GAPS.md` §12 (Open Finance, ML, book-to-bank, aprovação em 2 níveis, etc.) | variável | variável |

---

## Sequência recomendada (não é plano de implementação)

1. Estabilizar integridade financeira: **A7, A8, C4, J1, J2, J8, H6**.
2. Escalar operação: **A1, A2, D1, D3, D4, D8, C5, E7**.
3. Redesenhar UX/arquitetura: **A3-A6, B1-B10, C1/C3/C7/C10, E1-E10, G1-G12, H1-H8**.
4. Refinar e adicionar funcionalidades faltantes (P3 + §12).
