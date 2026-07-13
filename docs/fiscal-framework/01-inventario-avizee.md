# 01 · Inventário — camada fiscal atual do AVIZEE Spark

Snapshot do que existe hoje no ERP relacionado a fiscal. Base para o
diagnóstico (doc 04) e para o mapa de integração (doc 09).

## 1. Frontend

### Rotas (`src/routes/fiscal.routes.tsx`)
Portal Fiscal, emissão de NF-e, manifestação do destinatário, distribuição
DF-e, consulta por chave, dashboard fiscal.

### Páginas (`src/pages/fiscal/`)
- `PortalFiscal.tsx` — lista NF-es distribuídas (leitura sobre view `v_nfe_portal`).
- `NFeForm/*` — formulário de emissão (schema Zod em `NFeForm/schema.ts`).
- `ManifestacaoDestinatarioDrawer.tsx` — ciência, confirmação, desconhecimento, não-realizada.
- `DistribuicaoDFe.tsx` — sincronização com Ambiente Nacional.
- Componentes de DANFE e consulta por chave.

### Help entries
`src/help/entries/fiscal.ts` e `fiscalDistdfe.ts`.

## 2. Camada de serviço (`src/services/fiscal/`)

```
autoCiencia.service.ts          # Ciência automática em resNFe novos
certificado.service.ts          # Upload/leitura A1, integração com sefaz-proxy
chaveAcesso.parser.ts           # Parse dos 44 dígitos
danfe.service.ts / danfeEmail.service.ts
dashboardFiscal.service.ts / dashboardFiscalPdf.service.ts
emitirNfe/                      # Orquestração de emissão end-to-end
empresaConfig.service.ts        # empresa_config get/upsert
eventos.service.ts              # Registro de eventos manuais
lifecycle.service.ts            # Confirmar/estornar/cancelar/devolução
lookups.service.ts              # Ordens, contas, pedidos, anexos
manifestacao.repository.ts
nfeBuilders.service.ts          # Builders de payload de NF
nfeXmlParser.service.ts         # Parse XML → estrutura JS
nfeXmlToDanfe.ts
notasFiscaisPaged.service.ts
numeracao.service.ts            # Sequência de numeração
portal.service.ts               # Backing do PortalFiscal
sefaz.service.ts                # Fachada de comunicação (registrarRetornoSefaz)
tributacao.service.ts
validadores/                    # NCM, CFOP, pré-emissão
xmlBatchExport.ts
xmlStorage.service.ts           # Upload no bucket dbavizee/fiscal/
sefaz/
  autorizacao.service.ts
  cancelamento.service.ts
  cartaCorrecao.service.ts
  consulta.service.ts
  distdfe.service.ts
  inutilizacao.service.ts
  manifestacao.service.ts
  statusServico.service.ts
  xmlBuilder.service.ts         # Monta enviNFe
  assinaturaDigital.service.ts  # (assinatura via edge)
  httpClient.service.ts
  sefazUrls.service.ts          # URLs SEFAZ (hardcoded, ver diagnóstico)
  index.ts
```

## 3. Edge functions (Supabase, Deno)

| Função | Papel |
|--------|-------|
| `sefaz-proxy` | Recebe XML já montado, assina (node-forge), monta SOAP, envia via mTLS. Também parseia .pfx (`parse-certificado`) e envia via Vault (`assinar-e-enviar-vault`). |
| `sefaz-distdfe` | Consome `NFeDistribuicaoDFe` do Ambiente Nacional, escreve em `nfe_distribuicao` e atualiza cursor em `nfe_distdfe_sync`. |
| `process-distdfe-cron` | Dispara `sefaz-distdfe` periodicamente. |
| `process-nfe-retry-cron` | Reprocessa emissões pendentes com backoff. |
| `consultadanfe-proxy` | Proxy externo para renderização de DANFE. |

## 4. Banco de dados

### Tabelas fiscais
- `notas_fiscais` (121 col.) e `notas_fiscais_itens` (53 col.) — modelo fiscal completo.
- `nota_fiscal_anexos`, `nota_fiscal_eventos`, `eventos_fiscais`.
- `nfe_distribuicao` (34 col.), `nfe_distribuicao_itens`, `nfe_distdfe_sync`.
- `nfe_emissao_pendente` — fila leve de retry.
- `inutilizacoes_numeracao`.
- `matriz_fiscal`, `naturezas_operacao`.
- `empresa_config` (40 col.) — CNPJ, IE, CRT, ambiente, série.
- `fiscal_telemetria`, `sefaz_consulta_log`.

### View
- `v_nfe_portal` — projeção usada pelo Portal Fiscal.

### RLS
Todas as tabelas fiscais têm políticas por perfil (admin, fiscal). Regras
registradas em `.lovable/memory/security/rls-single-tenant.md`.

## 5. Certificado A1

- Arquivo `.pfx` no bucket **`dbavizee`**, path fixo `certificados/empresa.pfx`.
- Senha em `vault` sob o nome `CERTIFICADO_PFX_SENHA`.
- Metadados (CNPJ, razão social, validade) em `app_configuracoes.chave = 'certificado_digital'`.
- Upload orquestrado por `src/services/fiscal/certificado.service.ts` +
  RPC `salvar_secret_vault` + edge `sefaz-proxy action=parse-certificado`.

## 6. Storage

Bucket **`dbavizee`**, prefixos:
- `certificados/` — .pfx da empresa.
- `fiscal/{yyyy}/{mm}/{entrada|saida}/{chave}.xml` — XMLs arquivados.

## 7. Memória e docs existentes

- `mem/features/`: `arquivamento-xml-nfe`, `auto-confirm-nf`, `c14n-sefaz`,
  `certificado-digital-a1`, `fiscal-busca-por-chave-flag`,
  `fiscal-consulta-por-chave`, `fiscal-portal`, `fiscal-vencimento-parcelas`,
  `traducao-xml-fiscal`.
- `mem/tech/`: `sefaz-mtls-transporte`, `edge-functions-shared-helpers`,
  `infraestrutura-cors`.
- `docs/fiscal-modelo-estrutural.md` — modelo estrutural vigente.
- `.lovable/memory/produto/fiscal-mobile.md` — UX fiscal mobile.

## 8. Testes

- `src/tests/integration/fluxo-fiscal.test.ts` — smoke: construção do XML e
  autorização com mock do `sefaz-proxy`.
- `supabase/tests/004_confirmar_nota.test.sql`.
- `e2e/specs/nfe-homologacao.spec.ts`.

## 9. Convenções em vigor

- Serviços fiscais chamam **exclusivamente** `sefaz-proxy` (nunca SEFAZ direto do browser).
- XMLs sempre arquivados (`xmlStorage.service.ts`); falha de upload não bloqueia importação.
- `search_path = public` obrigatório em toda RPC (regra core do projeto).
- Logs via `src/lib/logger.ts` (proibido `console.*`).
- RBAC via `user_permissions` + `can(resource, action)`.