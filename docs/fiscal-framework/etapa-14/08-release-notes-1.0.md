# 08 — Release Notes — Framework Fiscal AVIZEE 1.0

**Data:** 2026-07-14
**Baseline:** Etapas 1–14 concluídas.

## Funcionalidades
- Núcleo de comunicação fiscal (XML, XSD, C14N, Signature, SOAP, Transport, Retry, Circuit Breaker).
- Módulo NF-e completo (autorização, ciclo de vida, DF-e, sincronização).
- Recebimento fiscal (parser universal, dedup por hash+chave, conciliação, workflow, integração ERP).
- Escrituração e apuração tributária parametrizáveis; SPED base.
- Camada operacional (Central Fiscal, dashboards, monitores, notificações, prontidão para produção).
- Homologação técnica com E2E, carga, recuperação, hardening e auditoria arquitetural.
- Compliance Engine, versionamento legal, registries e preparação para Reforma Tributária (IBS/CBS/IS em coexistência).
- Fiscal Platform (plugin architecture) + SDK + template para novos documentos.
- Adapter NF-e como plugin (compatibilidade total).

## Melhorias
- Motor tributário abstrato — sem hard-code de tributo.
- Workflow executor com compensação (saga) genérico.
- Descoberta automática de plugins e cache de adapters.

## Correções
- Nenhuma regressão introduzida nas Etapas 12–14.

## Breaking changes
- Nenhum. Todas as APIs públicas anteriores permanecem estáveis.

## Limitações conhecidas
- NFC-e, CT-e, MDF-e, BP-e, NF3-e, NFS-e ainda não implementados como plugins (infraestrutura pronta).
- SPED (EFD ICMS/IPI, Contribuições), EFD-Reinf e eSocial: apenas base implementada; layouts específicos pendentes.
- Recursos de IA fiscal previstos apenas para versões futuras.

## Dependências
- React 18, Vite 5, Tailwind v3, TypeScript 5, Vitest.
- Lovable Cloud (Supabase): RLS + Vault + Storage + Edge Functions (Deno).
- @xmldom/xmldom (C14N SEFAZ).

## Métricas de qualidade
- 105/105 testes fiscais passando (10 arquivos de teste).
- Typecheck limpo (`tsgo --noEmit`).
- 17 ADRs vigentes, 14 etapas documentadas.
