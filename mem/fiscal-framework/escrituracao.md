---
name: Framework Fiscal — Escrituração
description: Módulo de escrituração, motor tributário parametrizável, apuração, livros, fechamento, SPED base
type: feature
---

Módulo `src/modules/fiscal/escrituracao/`, Clean Architecture.

- Motor tributário só consulta `ParametroTributario` vigente — nunca hard-code de alíquotas.
- Máquina de estados do período: aberto → em_apuracao → apurado → fechado ↔ reaberto (versão incrementa na reabertura).
- Apuração produz `ApuracaoPeriodo` com débitos, créditos, saldo anterior, saldo a pagar/credor, detalhamento rastreável.
- Livros fiscais orientados por layout (`entradas_v1`, `saidas_v1`, `apuracao_icms_v1`...).
- SPED / EFD-Reinf / eSocial: apenas infraestrutura (`SpedLayoutRegistry`, `SpedSerializer`, `InMemoryObrigacoesQueue`).
- Eventos publicados no `FiscalEventBus` sob prefixo `fiscal.escrituracao.*` (11 nomes).
- Consumidores devem plugar implementações reais dos contratos (`IPeriodoRepository`, etc.) sobre Supabase antes do uso em produção.
