# QUICK WINS — CONCILIAÇÃO FINANCEIRA

> Melhorias de **baixo esforço** (XS/S) e **alto impacto** que podem
> ser executadas rapidamente após o redesenho arquitetural da
> Etapa 5. Não substituem os requisitos estruturais — são
> complementos de rápido retorno.
>
> Nenhuma implementação é feita nesta etapa. Referências: IDs de
> `MATRIZ-DE-PRIORIZACAO.md` e `CONCILIACAO-GAPS.md`.

Cada item traz: **Categoria · Esforço · Impacto · Risco de não
fazer · Como reconhecer o benefício**.

---

## Segurança / Integridade

- **QW-01 · Remover `try/catch` silencioso em `confirmarConciliacao`** (G03)
  - Esforço XS · Impacto Crítico · Risco Crítico.
  - Benefício: falhas visíveis, elimina baixas conciliadas sem
    cabeçalho.
- **QW-02 · Restringir DELETE em `financeiro_extrato_importacoes` a
  papel administrativo** (G08)
  - Esforço XS · Impacto Alto · Risco Alto.
- **QW-03 · Motivo obrigatório em desfazer/estornar/rejeitar** (G05)
  - Esforço S · Impacto Alto · Risco Alto.
- **QW-04 · Revalidar `can(...)` em ações críticas do hook
  (`desfazer`, `criarLancamentoInline`)** (G20)
  - Esforço S · Impacto Alto · Risco Médio.
- **QW-05 · Mascaramento de PII (CPF/CNPJ) antes de enviar à IA**
  (G46)
  - Esforço S · Impacto Alto (LGPD) · Risco Alto.
- **QW-06 · Bloquear reescrita de `sugestao_*` em linha com
  `status='conciliado'`** (G10)
  - Esforço S · Impacto Alto · Risco Alto.

## Financeiro / Consistência

- **QW-07 · Substituir fallback "mais recente" por seleção
  determinística de baixa ativa** (G09)
  - Esforço S · Impacto Alto · Risco Alto.
- **QW-08 · Ao desfazer, limpar par
  `is_transferencia_interna/transferencia_par_id`** (G11)
  - Esforço XS · Impacto Médio · Risco Médio.
- **QW-09 · Validar período do arquivo × período selecionado
  (avisar antes de ajustar datas)** (G63)
  - Esforço S · Impacto Médio · Risco Médio.

## Performance

- **QW-10 · Índices em `sugestao_lancamento_id`, `status`,
  `data_transacao`, `(empresa, conta, data)`** (C5/G23)
  - Esforço S · Impacto Alto · Risco Alto. Benefício: consultas
    10-100× mais rápidas.
- **QW-11 · Debounce nos filtros de URL** (D10)
  - Esforço XS · Impacto Baixo · Risco Baixo.
- **QW-12 · `staleTime` menor em contas bancárias (D6)**
  - Esforço XS · Impacto Baixo · Risco Baixo.
- **QW-13 · Atualização incremental de lançamentos após confirmar
  (evitar reload total)** (G25)
  - Esforço S · Impacto Médio · Risco Médio.
- **QW-14 · Invalidação global de queries relacionadas pós-
  confirmação** (A6)
  - Esforço S · Impacto Médio · Risco Médio.

## Qualidade de código

- **QW-15 · Unificar `normalizarDescricao` em util única** (E2)
  - Esforço XS · Impacto Baixo · Risco Baixo.
- **QW-16 · Extrair thresholds mágicos para constantes por empresa
  (config table)** (E3)
  - Esforço S · Impacto Médio · Risco Médio.
- **QW-17 · Padronizar tratamento de erros — nunca engolir; usar
  `logger.*` com contexto** (E5)
  - Esforço S · Impacto Médio · Risco Médio.
- **QW-18 · Mover tipos locais para `src/types/domain.ts`** (E6)
  - Esforço S · Impacto Médio · Risco Médio.
- **QW-19 · Remover `useConciliacaoBancaria` órfão + `conciliacaoQueries.ts`
  não referenciado** (A3/A4)
  - Esforço S · Impacto Médio · Risco Baixo. Benefício: menos dívida.
- **QW-20 · Auditoria final `console.*` → `logger.*`** (E10)
  - Esforço XS · Impacto Baixo · Risco Baixo.
- **QW-21 · Remover comentário/comportamento "Silently fail" após
  QW-01** (E9)
  - Esforço XS · Impacto Baixo · Risco Baixo.
- **QW-22 · Mover regra `hideConciliados` para o service** (A9)
  - Esforço XS · Impacto Baixo · Risco Baixo.

## UX

- **QW-23 · Substituir `window.confirm` por `ConfirmDialog` do DS**
  (G54)
  - Esforço S · Impacto Médio · Risco Baixo.
- **QW-24 · Consolidar filtros duplicados
  (`AdvancedFilterBar` + filtros locais)** (G55)
  - Esforço S · Impacto Médio · Risco Baixo.
- **QW-25 · Badge/aviso antecipado de "arquivo já importado" no
  input file (usar SHA-256 previamente)** (G11 do GAPs)
  - Esforço XS · Impacto Baixo · Risco Baixo.
- **QW-26 · Indicador de progresso do Motor Universal (spinner com
  etapa)** (G12 do GAPs)
  - Esforço S · Impacto Médio · Risco Baixo.
- **QW-27 · Contador de exceções pendentes no header do painel**
  - Esforço XS · Impacto Médio · Risco Baixo. Antecipa gestão do
    backlog (RF-13/G29).

## Regras / Aprendizado

- **QW-28 · Constraint `UNIQUE (empresa_id, prioridade)` em
  `financeiro_regras`** (C6)
  - Esforço XS · Impacto Baixo · Risco Baixo.
- **QW-29 · Painel simples de "regras sem uso há X dias" +
  "aliases com mais rejeições"** (base para G34)
  - Esforço S · Impacto Médio · Risco Baixo.

## Observabilidade

- **QW-30 · Log estruturado com `trace_id` (`empresa_id`,
  `usuario_id`) em toda escrita do módulo** (G28)
  - Esforço S · Impacto Alto · Risco Médio.
- **QW-31 · Contadores básicos (importações realizadas, sugestões
  aceitas, confirmações) em `financeiro_auditoria` ou similar** (G28)
  - Esforço S · Impacto Médio · Risco Baixo.

---

## Sequência sugerida (ondas curtas de quick wins)

1. **Onda A — Estabilização (dia 1-3)**: QW-01, QW-02, QW-05, QW-07,
   QW-08, QW-10, QW-21.
2. **Onda B — Compliance mínimo (semana 1)**: QW-03, QW-04, QW-06,
   QW-09, QW-30.
3. **Onda C — Higiene de código (semana 2)**: QW-15, QW-17, QW-18,
   QW-19, QW-20, QW-22.
4. **Onda D — UX rápido (semana 2-3)**: QW-11, QW-12, QW-13, QW-14,
   QW-23, QW-24, QW-25, QW-26, QW-27.
5. **Onda E — Regras/aprendizado (semana 3)**: QW-16, QW-28, QW-29,
   QW-31.

Todas as ondas dependem apenas de mudanças pontuais e são
compatíveis com o desenho atual — servem para reduzir risco e
preparar terreno para o TO-BE.
