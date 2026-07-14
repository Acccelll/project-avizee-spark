# Etapa 9 — Escrituração Fiscal, Apuração Tributária e Obrigações Acessórias

## Escopo entregue

Núcleo de escrituração fiscal desacoplado dos módulos de emissão (NF-e) e recebimento, preparado para múltiplos regimes tributários e evolução legal.

## Estrutura

`src/modules/fiscal/escrituracao/`

- `domain/entities.ts` — `PeriodoFiscal`, `DocumentoConsolidado`, `ParametroTributario`, `ApuracaoPeriodo`, `LivroFiscal`, `InconsistenciaFiscal`.
- `domain/rules.ts` — validação CFOP/CST/CSOSN, seleção de parâmetro vigente, detecção de inconsistências.
- `domain/stateMachine.ts` — máquina de estados do período (`aberto → em_apuracao → apurado → fechado ↔ reaberto`).
- `application/motorTributario.ts` — motor parametrizável (ICMS, ICMS-ST, IPI, PIS, COFINS, ISS, DIFAL, FCP, retenções). Zero regras hard-coded.
- `application/consolidacao.ts` — consolida emitidos + recebidos + eventos por período.
- `application/apuracao.ts` — débitos, créditos, ajustes, saldos anterior/a pagar/credor.
- `application/livrosFiscais.ts` — Entradas, Saídas, Apuração ICMS/IPI, Inventário via layouts plugáveis.
- `application/fechamento.ts` — abertura, fechamento, reabertura versionada.
- `application/consistencias.ts` — engine de inconsistências (CFOP, CST, cadastros, divergências).
- `application/dashboards.ts` — indicadores fiscais para consumo por UI.
- `infrastructure/spedBase.ts` — `SpedLayoutRegistry`, `SpedSerializer`, fila para EFD-Reinf/eSocial.
- `infrastructure/inMemoryRepositories.ts` — implementações de referência para os contratos.

## Eventos publicados (11)

`fiscal.escrituracao.periodo.*`, `consolidacao.executada`, `apuracao.executada`, `livro.gerado`, `inconsistencia.detectada`, `parametro.atualizado`, `sped.preparado`.

## Restrições respeitadas

- SPED Fiscal / Contribuições / EFD-Reinf / eSocial: apenas infraestrutura e contratos.
- Nenhuma integração governamental adicional.
- Nenhuma alíquota fixa: tudo vem do repositório de parâmetros vigentes.

## Qualidade

- Testes: 11 novos — suíte fiscal 60/60.
- Typecheck limpo, sem regressões.
