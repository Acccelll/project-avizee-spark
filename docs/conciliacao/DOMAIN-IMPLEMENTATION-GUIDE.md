# Domain Implementation Guide — Conciliação

Guia por domínio. Cada seção segue o mesmo esqueleto: responsabilidades · arquivos existentes (reutilizar/adaptar/substituir/remover) · novos elementos · dependências · sequência · aceite · testes · rollback · riscos.

Convenção de arquivos: rotas em `src/pages/conciliacao/*`, hooks em `src/hooks/conciliacao/*`, services em `src/services/conciliacao/*`, RPCs via `supabase/migrations`, edge functions em `supabase/functions/*`.

---

## 1. Importação

**Faz:** ingestão, dedupe por hash, persistência bruta.
**Não faz:** parsing detalhado, scoring, baixa.
**Existentes:** `financeiro_extrato_importacoes` (reutilizar), uploader atual (adaptar).
**Novos:** `importService.dedupe`, `useImportacaoUpload`, `ConciliacaoImportarPage` (ajustes).
**Dependências:** Storage, RBAC, Outbox.
**Sequência:** após Fundação.
**Aceite:** dedupe idempotente; log com `operation_id`; RLS ok.
**Testes:** unit de hash; integração de upload; e2e OFX/CNAB.
**Rollback:** flag off por empresa; sem drop de tabela.
**Riscos:** layout novo → registrar contrato.

## 2. Parser

**Faz:** extrair linhas tipadas de OFX/CNAB240/CNAB400/CSV.
**Não faz:** normalização semântica.
**Existentes:** parsers atuais (adaptar).
**Novos:** contratos Zod por layout.
**Dependências:** Importação.
**Aceite:** cobertura de layouts por testes de contrato.
**Testes:** unit por layout; regressão em datasets canônicos.
**Rollback:** manter parser anterior via flag.
**Riscos:** variação bancária → catálogo versionado.

## 3. Normalização

**Faz:** padronizar valores/datas/contrapartes; aplicar aliases.
**Não faz:** matching.
**Existentes:** `financeiro_aliases` (reutilizar).
**Novos:** `normalizationService`.
**Dependências:** Parser, Configurações.
**Aceite:** invariantes de domínio testadas.
**Testes:** unit puro; property-based para datas/valores.
**Rollback:** flag off.
**Riscos:** alias ambíguo → precedência definida.

## 4. Matching

**Faz:** scoring Top-N por movimento.
**Não faz:** decidir a conciliação.
**Existentes:** `matchingService` (adaptar); `financeiro_matching_feedback` (reutilizar).
**Novos:** ponderação configurável por empresa.
**Dependências:** Normalização, Regras.
**Aceite:** taxa de auto-match no dataset canônico ≥ baseline.
**Testes:** unit de scoring; integração; e2e workbench.
**Rollback:** desativar auto-sugestão; manter manual.
**Riscos:** falso positivo → threshold conservador inicial.

## 5. Motor de Regras

**Faz:** aplicar regras vigentes versionadas.
**Não faz:** persistir baixa.
**Existentes:** `financeiro_regras` (reutilizar).
**Novos:** UI de versionamento; `ruleService.applyVigentes`.
**Dependências:** Configurações.
**Aceite:** precedência determinística; simulação disponível.
**Testes:** unit por tipo de regra; regressão.
**Rollback:** reverter para versão anterior da regra.
**Riscos:** regra abrangente demais → simulação obrigatória.

## 6. Workflow

**Faz:** estados/transições (Sugerida → Em revisão → Aprovada/Rejeitada).
**Não faz:** cálculo financeiro.
**Existentes:** máquina simples atual (substituir por state chart interno).
**Novos:** `workflowService` puro.
**Dependências:** RBAC/SoD.
**Aceite:** transições ilegais bloqueadas por RLS + código.
**Testes:** unit de máquina; integração RBAC.
**Rollback:** flag off retorna ao fluxo antigo.
**Riscos:** SoD mal configurada → seed padrão auditado.

## 7. Conciliação

**Faz:** vincular pares (1×1, N×1, 1×N, N×N).
**Não faz:** baixar.
**Existentes:** `conciliacao_pares`, `conciliacao_bancaria` (reutilizar).
**Novos:** validação de somatório em RPC.
**Dependências:** Workflow.
**Aceite:** invariante de somatório sempre atendido.
**Testes:** unit; integração; e2e N×N.
**Rollback:** desfazer par via evento reverso.
**Riscos:** desvinculação sem trilha → sempre via evento.

## 8. Baixa

**Faz:** efetivar baixa/estorno atomicamente.
**Não faz:** decisões de conciliação.
**Existentes:** `financeiro_baixas`, `financeiro_baixa_lotes` (reutilizar).
**Novos:** RPC de baixa em lote idempotente.
**Dependências:** Conciliação, RPC.
**Aceite:** idempotência por `operation_id`; saldo íntegro.
**Testes:** unit; integração; carga.
**Rollback:** estorno auditável; manter dados.
**Riscos:** divergência de saldo → invariantes testadas.

## 9. Auditoria

**Faz:** append no ledger + hash-chain + verificação.
**Não faz:** regras de negócio.
**Existentes:** `financeiro_auditoria`, `auditoria_logs` (reutilizar).
**Novos:** verificador de integridade agendado.
**Dependências:** todos os domínios (via Outbox).
**Aceite:** 100% dos eventos com hash íntegro.
**Testes:** integração hash-chain; verificação periódica.
**Rollback:** somente append; nunca perde histórico.
**Riscos:** corrupção de hash → alerta + rebuild controlado.

## 10. Dashboard

**Faz:** KPIs e listas operacionais.
**Não faz:** transacional.
**Existentes:** telas atuais (adaptar).
**Novos:** views materializadas (P2).
**Dependências:** Auditoria, Baixa, Conciliação.
**Aceite:** filtros persistidos; performance < 2s.
**Testes:** e2e; carga.
**Rollback:** flag off.
**Riscos:** consultas pesadas → índices + view.

## 11. Indicadores

**Faz:** métricas de negócio a partir do Outbox.
**Não faz:** UI.
**Novos:** coletor + endpoint de métricas.
**Dependências:** Outbox.
**Aceite:** métricas disponíveis para alertas.
**Testes:** integração worker.
**Rollback:** desligar coletor.
**Riscos:** perda de eventos → replay do outbox.

## 12. Configurações

**Faz:** flags, regras, aliases, thresholds.
**Não faz:** transacional.
**Existentes:** `empresa_config`, `app_configuracoes` (reutilizar).
**Novos:** UI de versionamento e simulação.
**Dependências:** RBAC.
**Aceite:** somente admin; auditado.
**Testes:** unit; integração RBAC.
**Rollback:** versão anterior selecionável.
**Riscos:** flag errada → default seguro.
