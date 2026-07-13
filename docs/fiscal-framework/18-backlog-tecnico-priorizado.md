# 18 · Backlog técnico priorizado

Ordem sugerida para as próximas etapas. Cada épico é auto-contido, gera
valor entregável e tem critério de aceite claro. **Nada implementado nesta
etapa** — este documento é a fila para as próximas.

## Legenda
- **P0** = fundamento, bloqueia demais.
- **P1** = alto valor, próxima onda.
- **P2** = valor médio, depende dos anteriores.
- **P3** = futuro / opcional.

## Etapa 2 — Fundamentos (P0)

### E2.1 · Endpoint Registry como dado
- Criar tabela `fiscal_endpoints` + migration seed com todos os autorizadores
  (SP, RS, AM, BA, GO, MG, MS, MT, PE, PR próprios; SVAN/SVRS; AN hom1/www1).
- Serviço `endpointRegistry.resolve(documento, servico, ctx)` em TS.
- Adaptar `sefaz-distdfe` para consumir (corrige o bug hom→hom1 imediatamente).
- **Critério**: DistDFe volta a funcionar em produção sem hardcoded.

### E2.2 · Correlation-id + `fiscal_auditoria`
- Migration `fiscal_auditoria` com RLS + GRANTs + retenção.
- Middleware nas edges existentes para gerar/propagar correlation-id.
- Escrever em `fiscal_auditoria` em todo chamada SEFAZ atual.
- **Critério**: consulta por correlation-id retorna trace completo de 1 emissão.

### E2.3 · Taxonomia de erros + política de retry declarativa
- Tabela `fiscal_cstat_policy` (dado).
- `classifyCstat(cstat) → FiscalErrorKind` puro.
- Adaptar `process-nfe-retry-cron` para consultar a política.
- **Critério**: cStat 108 (paralisado) tem backoff diferente de cStat 105 (em processamento).

## Etapa 3 — Engines (P0)

### E3.1 · XML Engine (writer + C14N)
- `src/fiscal-framework/engines/xml/` — writer determinístico + C14N 1.0.
- Suíte de vetores de teste contra oráculo (XMLs assinados pelo .NET).
- **Critério**: canonicalização byte-exact em 100 XMLs de teste.

### E3.2 · Signature Engine
- `XMLDSigSigner` + `XMLDSigValidator` com `SignatureSuite`.
- Substituir chamadas `node-forge` no `sefaz-proxy` gradualmente
  (feature flag `fiscal:v2:sign`).
- **Critério**: 100 NFes assinadas pela nova engine passam validação SEFAZ
  em homologação.

### E3.3 · SOAP Engine com `SoapOperationDescriptor`
- Motor único cobrindo single-wrapper (estadual) e double-wrapper (AN).
- **Critério**: mesma engine serve `NFeAutorizacao4` e `NFeDistribuicaoDFe`.

### E3.4 · Transport com mTLS Deno
- Wrapper sobre `Deno.createHttpClient({ cert, key })`.
- Testes de integração contra SEFAZ-SP homologação.
- **Critério**: cStat 107 (serviço em operação) retornado com sucesso.

### E3.5 · Schema Validator + `fiscal_schemas_pl`
- Upload dos XSDs vigentes no bucket `dbavizee/fiscal/schemas/PL_010_v1_00/`.
- Runtime valida antes do envio (feature flag; começa opcional).
- **Critério**: XML com erro estrutural bloqueado antes do transport.

## Etapa 4 — Módulos v1 (P1)

### E4.1 · `fiscal-module-nfe` (autorização + consulta)
- Serializer, sign, autorizar, consultarSituacao, parseRetorno.
- Substitui `sefaz-proxy` para emissão via flag `fiscal:v2:autorizacao`.
- **Critério**: emissão end-to-end via novo motor em homologação (100 NFes).

### E4.2 · `fiscal-module-eventos` (cancel/CCe/inut/manif)
- Todos os eventos por trás de `runtime.eventos.*`.
- **Critério**: cancelamento e CCe pela nova camada em produção.

### E4.3 · `fiscal-module-dfe`
- DistDFe pela nova camada + upsert em `nfe_distribuicao`.
- Substitui `sefaz-distdfe` via flag `fiscal:v2:distdfe`.
- **Critério**: cursor NSU avança corretamente por 1 semana.

### E4.4 · Runtime + Fachada
- `createFiscalRuntime(options)`; `runtime.nfe`, `runtime.eventos`, `runtime.dfe`, `runtime.status`.
- **Critério**: fachada tem 1 ponto de entrada por operação; testes unitários passam.

## Etapa 5 — Fila unificada (P1)

### E5.1 · Filas pgmq
- `fiscal.retry.autorizacao`, `fiscal.retry.evento`, `fiscal.dfe.sync`, `fiscal.eventos.ciencia`.
- Edge `fiscal-cron` consumidor único, backoff exponencial + jitter.
- **Critério**: aposenta `nfe_emissao_pendente`, `process-nfe-retry-cron`, `process-distdfe-cron`.

## Etapa 6 — Observabilidade (P1)

### E6.1 · Métricas em `fiscal_telemetria` completa
- Latência p50/p95, taxa de rejeição, cStat top-N.
- View agregada para dashboard.

### E6.2 · Alertas
- Certificado 30/15/7d, SEFAZ 108/109 > 30min, rejeição > 5%/h.
- Consumidor de `fiscal_auditoria` via cron enfileira `process-email-queue`.

### E6.3 · Badge de status SEFAZ no dashboard
- Componente React consumindo `runtime.status.consultar(uf)` com cache 60s.

## Etapa 7 — Segurança multi-empresa (P2)

### E7.1 · Certificado por empresa
- Bucket path por `empresaId`; Vault sufixado.
- Migração dos existentes.

### E7.2 · RLS por empresa em todas as tabelas fiscais
- `empresa_id IN (SELECT empresa_id FROM user_empresas WHERE user_id = auth.uid())`.
- Testes de cross-tenant leak (obrigatórios).

### E7.3 · Permissões granulares
- `fiscal:emitir`, `fiscal:cancelar`, `fiscal:cce`, `fiscal:manifestar`,
  `fiscal:inutilizar`, `fiscal:dfe`, `fiscal:certificado`, `fiscal:auditoria`,
  `fiscal:admin`.

## Etapa 8 — Documentos adicionais (P2/P3)

### E8.1 · NFC-e (P2)
- `fiscal-module-nfce` + endpoints + CSC/QRCode.
- Rota de emissão + impressora térmica.

### E8.2 · CT-e (P3) · MDF-e (P3) · NFS-e (P3)
- Novos módulos, novo modelo de dados, novos endpoints.

### E8.3 · Contingência EPEC (P3)
- Detecção automática + série de contingência + regularização.

## Etapa 9 — Retiradas da camada antiga (P2)

### E9.1 · Aposentadoria de `sefaz-proxy`
- Após 100% das operações no novo motor por 30 dias sem incidente.
- Remover arquivo, arquivar em `docs/legacy/`.

### E9.2 · Aposentadoria de `sefaz-distdfe`
- Idem.

## Marcos sugeridos

```
M0: Docs Etapa 1 aprovada           ← ATUAL
M1: E2 completa                     → base + auditoria + política de retry
M2: E3 completa                     → engines nativos rodando
M3: E4 + E5 completas               → NF-e end-to-end no novo motor + filas
M4: E6 + E7 completas               → observabilidade + multi-tenant
M5: E8.1 (NFC-e)                    → primeiro documento adicional
M6: E9 completa                     → camada antiga desligada
```

## Métricas de sucesso do backlog

- Taxa de rejeição por schema (215/225) cai a zero após E3.5.
- MTTR de incidente fiscal cai (correlation-id + auditoria).
- Cursor DistDFe nunca "trava" (E4.3 + E5.1).
- Nenhuma URL SEFAZ hardcoded em código depois de E2.1.