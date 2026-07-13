# 33 · Estratégia de extensibilidade

O framework nasce preparado para incorporar todos os documentos fiscais
brasileiros **sem reestruturação**. A base é o contrato `IFiscalDocumentModule`
em `fiscal-core` — cada novo documento é um plugin.

## Documentos suportados por versão

| Documento | v1 | v1.1 | v2 | v3 |
|---|---|---|---|---|
| NF-e (55) | ✅ | ✅ | ✅ | ✅ |
| NFC-e (65) |    | ✅ | ✅ | ✅ |
| CT-e (57) / CT-e OS (67) |    |    | ✅ | ✅ |
| MDF-e (58) |    |    | ✅ | ✅ |
| NFS-e (nacional padrão ABRASF) |    |    |    | ✅ |
| NFS-e municipal (heterogêneas) |    |    |    | ✅ (por município) |
| SAT-CF-e |    |    |    | avaliação |
| SPED Fiscal (EFD ICMS/IPI) |    |    |    | ✅ |
| SPED Contribuições |    |    |    | ✅ |
| EFD-Reinf |    |    |    | ✅ |
| eSocial |    |    |    | ✅ |
| MDF-e evento pré-encerramento |    |    | ✅ | ✅ |
| DIME/GIA estaduais |    |    |    | avaliação |
| Integrações municipais avulsas |    |    |    | por caso |

Datas concretas em `35-roadmap-arquitetural.md`.

## Como novo documento entra

1. **Contrato existente**: `IFiscalDocumentModule` cobre serialize/sign/validate/enviar/parse. Sem alteração para adicionar novo doc.
2. **Novo módulo**: pasta `src/fiscal-framework/modules/{doc}/`.
3. **Endpoints**: `INSERT INTO fiscal_endpoints` com URLs do novo autorizador. Zero deploy.
4. **XSD**: upload no bucket + linha em `fiscal_schemas_pl`. Zero deploy.
5. **Domain rules**: dentro do módulo (numeração, chave, dígito, regras de negócio).
6. **Fachada**: adicionar método (`runtime.mdfe.autorizar(...)`).
7. **Edge**: nova edge `fiscal-mdfe` (ou reusa `fiscal-nfe` com action=documento — decidir por complexidade).
8. **UI**: nova aba/módulo; hooks reusam infra fiscal.

## Novos autorizadores (estaduais/municipais)

- **Estadual**: linha em `fiscal_endpoints` — cobre todos os cenários NFe/CTe/MDFe.
- **Municipal (NFS-e)**: cada município tem WSDL próprio. Estratégia:
  - `fiscal_nfse_padroes (id, nome, wsdl_hash, adapter_ref)` — cataloga padrões.
  - Adapters por padrão (ABRASF, GINFES, IssNet, próprios) em `modules/nfse/adapters/`.
  - `fiscal_nfse_municipios (codigo_ibge, padrao_id, config)` — mapeia município → padrão.
  - Novo município = 1 linha, sem código (se padrão já suportado).
  - Novo padrão = novo adapter + PR.

## Novos layouts SEFAZ (versão XML)

Cenário: SEFAZ publica NF-e 5.00.

1. `fiscal_endpoints` ganha linhas com `versao=5.00`.
2. `fiscal_schemas_pl` ganha PL novo.
3. `fiscal-module-nfe` ganha branch por versão (`serializerV4`, `serializerV5`).
4. Feature flag `fiscal:v2:nfe-5-00` — coexiste com 4.00.
5. `empresa_config.versao_layout_nfe` decide qual usa.
6. Migração gradual por empresa.

## SPED (Fiscal / Contribuições) — v3

Diferente de documentos eletrônicos: **arquivo texto** gerado a partir de dados agregados.

### Módulo novo
`fiscal-module-sped`:
- `montarEfdIcmsIpi(empresaId, periodo): TXT`
- `montarEfdContribuicoes(empresaId, periodo): TXT`
- `validarSped(arquivo): violacoes[]` (via schemas oficiais)

### Fontes de dados
- `notas_fiscais` + itens (registros C100/C170).
- `nfe_distribuicao` (E-com destinatário).
- `estoque_movimentos` (registros H).
- `financeiro_baixas` (M/F para PIS/COFINS).

### Onde encaixa
- Application layer: `MontarSpedUseCase`.
- Output: arquivo TXT no bucket `dbavizee/sped/{empresaId}/{ano}/{mes}.txt`.
- Entrega manual (PVA) ou automática (futuro).

## EFD-Reinf e eSocial

- Comunicação **REST** (não SOAP) — precisa de novo transport adapter (`fiscal-transport-rest`).
- Assinatura XMLDSig continua.
- Modelo próprio (eventos vs documento) — `IFiscalEventModule` (novo contrato similar ao de documento).
- Fila dedicada (`fiscal.reinf.envio`, `fiscal.esocial.envio`).

## Extensões via hooks

Todo serviço aceita hooks (doc 25):
- **`beforeSign`**: útil para injeção de campos custom (ex.: infCpl específico).
- **`afterParse`**: pós-processamento de retorno (integração ERP-específica).
- **`onError`**: logging/notificação custom.

Hooks não substituem regra fiscal — apenas complementam integração.

## Extensões via feature flags

`fiscal:v2:*` permite ativar/desativar por operação, empresa ou global:
- Rollout gradual.
- Rollback isolado.
- A/B testing de estratégia de retry.

## Novos ambientes fiscais

Se surgir "SVAN 2" ou outro autorizador:
- Registro em `fiscal_endpoints` com `uf` específico (ex.: 92).
- `IEndpointResolver` já cobre fallback por UF.

## Novos documentos não-fiscais (ex.: NFS-e livre)

Alguns municípios permitem cancelamento por PDF/manual. Modelo:
- Módulo `fiscal-module-manual` (v3) para documentos sem SEFAZ eletrônico.
- Persistência mantida em `notas_fiscais` com `origem='manual'`, `status_sefaz='Emitida'`.

## O que NÃO é extensível sem redesign

Situações que exigem novo ADR:
- Adicionar transporte não-HTTP (queue nativa SEFAZ, futura webhook SEFAZ).
- Multi-runtime (Deno + Node coexistindo) — requer split de módulos.
- Migrar de Postgres para outro DB — muitas regras vivem em constraints/triggers.
- Substituir Supabase Vault — requer novo `ISecretsProvider`.

Todas cobertas por ADRs futuros quando/se necessárias.

## Roadmap de extensibilidade

Ver `35-roadmap-arquitetural.md`. Resumo:
- **6 meses**: NF-e 4.00 sólido, NFC-e primeira versão, contingência.
- **12 meses**: CT-e, MDF-e, DFe multi-empresa, alertas maduros.
- **18 meses**: NFS-e nacional + top 20 municípios, SPED Fiscal.
- **24 meses**: EFD-Reinf, eSocial, integrações estaduais avulsas.