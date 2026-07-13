# ADR-001 — Runtime nativo TS/Deno vs worker externo .NET

**Status**: aceito · **Data**: 2026-07-13 · **Etapa**: 1

## Contexto
O FiscalFramework v0.21 é .NET. Seu próprio guia (`docs/INTEGRACAO-AVIZEE-SPARK.md`)
propõe duas formas de plugar no AVIZEE:
1. Worker CLI .NET (`AvizeeSync`) agendado, PostgREST + service_role.
2. Fiscal Gateway HTTP .NET rodando em VPS externo, lendo cert do bucket.

Ambas exigem host externo ao Lovable Cloud.

## Decisão
Reimplementar o Framework Fiscal **nativamente em TypeScript**, rodando em
Supabase Edge Functions (Deno) integrado ao Postgres/RLS/Storage/Vault do
próprio projeto. Nenhum worker ou gateway externo.

## Justificativa
- **Operacional**: zero host adicional; SLA/deploy/CI unificados.
- **Segurança**: certificado A1 nunca sai do Lovable Cloud; sem service_role
  em rede pública.
- **Custo**: sem VPS/Azure/Render.
- **Observabilidade**: logs, métricas e auditoria no mesmo lugar.
- **DX**: uma stack (TS), um build, um repo.
- **Perda aceita**: implementar C14N/XMLDSig em TS custa esforço (o framework
  provou o padrão). Ganho: independência total.

## Alternativas rejeitadas
- **Worker .NET externo**: exige máquina ligada + service_role em rede pública.
- **Fiscal Gateway .NET em VPS**: replica lógica que pode viver na edge.
- **WebAssembly do .NET no Deno**: imaturo para XMLDSig completo.

## Consequências
- (+) Única stack, deploy simples, LGPD facilitado.
- (−) Precisamos escrever C14N/XMLDSig em TS/Deno (mitigado pelo ADR-002).
- (−) Deno TLS tem menos controles que .NET (validado como suficiente — doc 16).

## Referência
FiscalFramework `docs/INTEGRACAO-AVIZEE-SPARK.md`; `mem/tech/sefaz-mtls-transporte.md`.