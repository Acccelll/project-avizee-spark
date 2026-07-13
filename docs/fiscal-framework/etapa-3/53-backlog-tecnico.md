# 53 · Backlog técnico priorizado

Refina o doc 18 (Etapa 1) e o roadmap (doc 35 da Etapa 2). Organiza épicos,
histórias, dependências e ordem de execução.

Padrão: `E-XX` épico · `H-XXX` história · `[dep: ...]` dependências ·
`Prioridade: P0/P1/P2/P3` · `Marco: Etapa N`.

## E-01 · Fundações (Etapa 4 — ex-3 do roadmap)

Marco: base lib pronta antes de qualquer edge nova.

- **H-001** [P0] Criar estrutura `src/fiscal-framework/{core,engines,cross,modules}` com esqueleto de arquivos e barrels. Sem lógica ainda.
- **H-002** [P0] Implementar VOs em `core`: `ChaveAcesso`, `Cnpj`, `Cpf`, `Uf`, `Ambiente`, `Protocolo`, `CodigoMunicipio`.
- **H-003** [P0] Definir contratos: `FiscalResult`, `IFiscalClock`, `IXmlCanonicalizer`, `IXmlSigner`, `ISignatureValidator`, `ISigningCertificateProvider`, `ITransportChannel`, `IEndpointResolver`, `ISchemaValidator`, `IFiscalDocumentModule`, `SignatureSuite`.
- **H-004** [P0] Portar `_shared/xml-c14n.ts` para `engines/xml/` com testes golden. [dep: H-003]
- **H-005** [P0] `engines/xml/writer.ts` — writer determinístico de `XmlNode`.
- **H-006** [P0] `engines/signature/xmldsig.ts` — signer + validator RSA-SHA1/256. [dep: H-004, H-005]
- **H-007** [P0] `engines/soap/envelope.ts` — single/double wrapper. [dep: H-005]
- **H-008** [P0] `engines/transport/http.ts` — fetch mTLS (com adapter externo para AN). [dep: H-003]
- **H-009** [P0] `engines/schema/xsd.ts` — validador XSD opcional. [dep: H-003]
- **H-010** [P0] Cross: `certificate`, `clock`, `logger`, `cache` (in-memory).
- **H-011** [P0] Migration `fiscal_endpoints` + seed inicial autorizadores + SVAN/SVRS/AN. [F-021, RN-250]
- **H-012** [P0] Migration `fiscal_auditoria` + trigger anti-tamper + RLS. [F-014]
- **H-013** [P0] Migration `fiscal_runtime_config` + linha default. [F-013]
- **H-014** [P1] Migration `fiscal_idempotency`. [F-016]
- **H-015** [P1] Migration `fiscal_schemas_pl` + seed PL-010 (NF-e 4.00). [F-022]
- **H-016** [P1] `cross/endpoints/registry.ts` (leitura de `fiscal_endpoints` + cache 5min). [dep: H-011]
- **H-017** [P1] `cross/audit/writer.ts` (helper para escrever `fiscal_auditoria`). [dep: H-012]
- **H-018** [P1] `cross/idempotency/store.ts`. [dep: H-014]
- **H-019** [P1] Testes unitários fundacionais — cobertura ≥ 95%.
- **H-020** [P2] `runtime.ts` — `createFiscalRuntime(options)` compondo tudo.

**Definition of Done**: pipeline serialize → sign → validate → parse → audit em harness de teste (sem SEFAZ).

## E-02 · Autorização NF-e sob flag (Etapa 5)

- **H-030** [P0] `modules/nfe/serialize.ts` — DTO → XmlNode. [dep: E-01]
- **H-031** [P0] `modules/nfe/parse-retorno.ts` — respostas SEFAZ tipadas.
- **H-032** [P0] `modules/nfe/index.ts` — implementa `IFiscalDocumentModule`.
- **H-033** [P0] `Application/AutorizarNFe.ts` — use case (comando + resposta).
- **H-034** [P0] Edge `supabase/functions/fiscal-nfe/index.ts` com actions `autorizar`, `consultar-chave`, `status-servico`. [dep: H-033]
- **H-035** [P0] Fachada `src/services/fiscal/emitirV2.ts` + flag `fiscal:v2:autorizacao`. [ADR-016]
- **H-036** [P0] Migrar `useEmitirNfe` para usar fachada v2 quando flag ligada.
- **H-037** [P1] Testes integração `AutorizarNFe` com SEFAZ mock. [F-001]
- **H-038** [P1] E2E Playwright `nfe-homologacao-v2.spec.ts`. [F-001]
- **H-039** [P1] Runbook: rollback flag em incidente.
- **H-040** [P1] Testes fiscais em homologação SEFAZ (SP + RJ + MG) **[manual]**.
- **H-041** [P2] Métricas `fiscal.request.*` emitidas.

## E-03 · Eventos sob flag (Etapa 6)

- **H-050** [P0] `modules/eventos/` — cancelar/CCe/manifestar/inutilizar. [dep: E-02]
- **H-051** [P0] Edge `fiscal-events` com 4 actions.
- **H-052** [P0] Flags `fiscal:v2:cancelamento`, `:cce`, `:inutilizacao`, `:manifestacao`.
- **H-053** [P0] Fachadas correspondentes.
- **H-054** [P1] Testes UI + integ + fiscais para cada evento.

## E-04 · DF-e nova geração (Etapa 7)

- **H-060** [P0] `modules/dfe/decodifica-doczip.ts`. [dep: E-01]
- **H-061** [P0] `Application/SincronizarDFe.ts`.
- **H-062** [P0] Edge `fiscal-dfe` com actions `sincronizar`, `listar`, `download`.
- **H-063** [P0] Cron `fiscal-cron` — arquitetura consumidora de todas as `fiscal.*`. [F-016]
- **H-064** [P0] Migração da consumer de `sefaz-distdfe` para `fiscal-dfe` sob flag `fiscal:v2:distdfe`.
- **H-065** [P1] Auto-ciência opt-in via `fiscal_runtime_config`.

## E-05 · Retry, contingência, observabilidade (Etapa 8)

- **H-070** [P0] Filas `fiscal.retry.*` criadas (pgmq). [F-016]
- **H-071** [P0] Handler retry no `fiscal-cron` com backoff (doc 46).
- **H-072** [P1] `cross/circuit-breaker/` — in-memory + `fiscal_circuit_state` (opcional).
- **H-073** [P1] `cross/rate-limiter/` cooperativo.
- **H-074** [P1] `ContingenciaService` (sugestão apenas) + RPC ativação admin. [ADR-013]
- **H-075** [P0] Dashboard `/admin/fiscal/health` com cStat, filas, certs.
- **H-076** [P0] Alertas doc 32 v1 (cert, sefaz down, fila lag).
- **H-077** [P2] View `v_fiscal_saude_diaria`.

## E-06 · Certificado (Etapa 9)

- **H-080** [P0] Edge `fiscal-cert` (upload/parse/status/remover). [F-012]
- **H-081** [P0] `CertificadoService` completo.
- **H-082** [P0] Alerta 30d/7d/expirado (cron diário).
- **H-083** [P1] Modelo `fiscal_certificado_metadata` (v2) mesmo em single-tenant.

## E-07 · Depreciação legacy (Etapa 10)

- **H-090** [P0] Congelar `sefaz-proxy` (só bugfix).
- **H-091** [P0] Congelar `sefaz-distdfe`, `process-*-cron`.
- **H-092** [P1] Após 60d sem uso → remover código.
- **H-093** [P1] ADR de fechamento da migração.

## E-08 · Multi-empresa (Etapa 11)

- **H-100** [P0] `empresa_id` derivado do JWT em todas edges fiscais.
- **H-101** [P0] Migração certs para prefixo `certificados/{empresaId}/`.
- **H-102** [P0] Vault por empresa: `CERTIFICADO_PFX_SENHA__{empresaId}`.
- **H-103** [P0] Numeração isolada por empresa (`series_numeracao`).
- **H-104** [P1] Testes matriz de isolamento (usuário A × empresa B).

## E-09 · Multi-filial (Etapa 12 do roadmap)

- **H-110** [P1] `filial_id` opcional em `notas_fiscais` + derivados.
- **H-111** [P1] `series_numeracao (empresa, filial, doc, serie, ambiente)`.
- **H-112** [P2] Cert por filial (opcional; herda empresa por default).

## E-10 · NFC-e (Etapa 13)

- **H-120** [P1] `modules/nfce/` — modelo 65.
- **H-121** [P1] Contingência offline com transmissão diferida (24h max).
- **H-122** [P1] CSC no Vault.
- **H-123** [P2] UI de venda balcão (fora do escopo do framework).

## E-11 · CT-e / MDF-e (Etapa 14)

- **H-130** [P2] `modules/cte/`, `modules/mdfe/`.
- **H-131** [P2] Endpoints via `fiscal_endpoints`.
- **H-132** [P2] Eventos CT-e (cancelamento, CT-e complementar).

## E-12 · NFS-e (Etapa 15)

- **H-140** [P2] `modules/nfse/` — padrão ABRASF.
- **H-141** [P2] `fiscal_nfse_padroes` + `fiscal_nfse_municipios`.
- **H-142** [P3] Adapters por município (incrementais).

## E-13 · SPED (Etapa 16)

- **H-150** [P3] `modules/sped/` gera EFD ICMS/IPI + Contribuições.
- **H-151** [P3] Validação por PVA externo.

## E-14 · EFD-Reinf / eSocial (Etapa 17)

- **H-160** [P3] Transport REST.
- **H-161** [P3] Contrato `IFiscalEventModule` (novo).

## Ordem recomendada e dependências

```
E-01 (Fundações) ─┬─► E-02 (NFe autorização)
                  ├─► E-06 (Cert)
                  └─► E-03 (Eventos) ─► E-05 (Retry/contingência/obs)

E-02 ─► E-04 (DFe) ─► E-05

E-05 ─► E-07 (Depreciação legacy) ─► E-08 (Multi-empresa)
                                       ├─► E-09 (Multi-filial)
                                       └─► E-10..E-14 (novos documentos)
```

## Funcionalidades críticas vs opcionais

**Críticas para v1 produção**: E-01, E-02, E-03 (cancelamento pelo menos), E-04, E-06 parcial (upload), E-05 (retry mínimo).

**Opcionais para v1**: contingência (E-05), export lote (dentro E-02), consulta cadastro (dentro E-02), dashboard avançado (E-05).

**Fora de v1**: NFC-e, CT-e, MDF-e, NFS-e, SPED, EFD-Reinf, eSocial, webhooks.

## Marcos de entrega

| Marco | Escopo | Critério |
|---|---|---|
| M1 | E-01 completo | Lib + migrations base; nenhuma edge nova em uso |
| M2 | E-02 sob flag em 1 empresa piloto | 100 NFe reais autorizadas sem incidente crítico em 15d |
| M3 | E-02 padrão + E-03 sob flag | Rollback legacy sem downtime possível |
| M4 | E-04 + E-05 | Retry/DFe operacionais; dashboard live |
| M5 | E-06 + E-07 | Legacy removível |
| M6 | E-08 | Suporte formal multi-empresa |
| M7 | E-10 | NFC-e disponível |
| M8 | E-11..E-13 | Suíte fiscal ampla |

## Riscos por fase

| Marco | Riscos principais (doc 51) |
|---|---|
| M1 | RT-02 (C14N), RT-06 (pgmq) |
| M2 | RF-01 (NT), RF-06 (assinatura), RO-03 (deploy) |
| M3 | RI-02/03 (integração estoque/financeiro) |
| M4 | RP-03 (fila stalled), RO-01 (SEFAZ down) |
| M5 | RS-04 (cert leak em v2 empresa) |
| M6 | RS-02 (IDOR), RS-04 |
| M7 | RF-01, RR-06 (NFC-e por UF) |
| M8 | RR-05 (prazos) |

## Métricas de progresso do backlog

- **Velocidade**: histórias/quinzena por épico.
- **Cobertura por CA**: % de critérios (doc 52) com teste automatizado green.
- **Débito técnico**: itens P3 que "envelhecem" > 3 meses reclassificados P2 ou removidos.
- **Cleanup**: cada épico encerrado remove código legacy correspondente.

## Regras do backlog

1. Nada em produção sem docs atualizados (Etapa 3 é fonte).
2. Toda H tem CA correspondente no doc 52.
3. Nenhuma H que exija ADR começa sem ADR aceito.
4. Ordem `P0 → P1 → P2 → P3` respeitada por milestone.
5. História que descobre novo risco alimenta o doc 51.
6. Refactor grande = novo E dedicado; não misturar com feature.