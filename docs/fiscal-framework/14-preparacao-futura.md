# 14 · Preparação para o futuro

A arquitetura nasce cobrindo NF-e (55) na v1, mas contratos e módulos são
desenhados para incorporar os demais documentos sem refactor estrutural.

## Documentos previstos

### NF-e (55) — v1
**Escopo v1**: emissão, cancelamento, CCe, inutilização, consulta situação,
consulta cadastro, manifestação (destinatário), distribuição DF-e, importação
de XML, arquivamento, DANFE.

### NFC-e (65) — v2
Diferenças previstas:
- CSC + CSCid no `infNFeSupl` para QRCode.
- Impressão do DANFE-NFC (não implementa aqui; renderizador separado).
- Endpoint próprio por UF (`NFCeAutorizacao4`, etc.).
**Ajustes na base**: novos endpoints em `fiscal_endpoints (documento='NFCe')`;
campo `csc_id`, `csc_hash` em `empresa_config`.
**Módulo**: `fiscal-module-nfce` implementa `IFiscalDocumentModule` — sem
alterar Core/Engines.

### CT-e (57) — v3
Documento de transporte. Envolve `CTeAutorizacao4`, eventos próprios
(alteração tomador, prestação em desacordo, comprovante entrega).
**Ajustes na base**: `conhecimentos_transporte` (nova, análoga a `notas_fiscais`),
endpoint registry expandido.
**Módulo**: `fiscal-module-cte`.

### MDF-e (58) — v3
Manifesto de carga. Agrupa NF-e/CT-e emitidos. Encerramento obrigatório.
**Ajustes**: `manifestos` (nova), consumidor de `remessas`/CTe/NFe emitidos.
**Módulo**: `fiscal-module-mdfe`.

### NFS-e — v4
Padrão nacional (ABRASF v2.04) + variações municipais (>5000 layouts).
**Estratégia**:
- Módulo `fiscal-module-nfse` implementa padrão nacional.
- Adaptadores por município como plugins do módulo (Curitiba, SP, Rio, BH, POA).
- Endpoint registry ganha coluna `municipio_ibge`.
**Especificidade**: transporte geralmente REST/JSON (não SOAP); `SoapClient`
opcional, `TransportChannel` genérico.

### Distribuição DF-e — v1 (já no escopo)
Já contemplada no `fiscal-module-dfe`.

### Manifestação do Destinatário — v1 (já no escopo)
`fiscal-module-eventos`.

### Eventos genéricos — v1
Cancelamento, CCe, Inutilização já cobertos.

### Consulta Cadastro — v1
`fiscal-module-nfe.consultaCadastro(uf, {cnpj|cpf|ie})`.

### Consulta Situação — v1
`fiscal-module-nfe.consultarSituacao(chave)`.

### Download XML — v1
Via DistDFe (`consChNFe`).

### Importação XML — v1
Upload manual + validação assinatura + upsert. Rota `/importar`.

### Exportação XML em lote — v1 (já existe)
`src/services/fiscal/xmlBatchExport.ts`. Só migrar chamada.

### DANFE / DACTE / DAMDFE — v1 (DANFE existe)
Renderização é serviço separado do motor. DACTE/DAMDFE na v3.

### EFD / SPED Fiscal — v5
Consumidor apenas: gera arquivos SPED a partir de `notas_fiscais`,
`estoque_movimentos`, `financeiro_lancamentos`. Não toca no motor SEFAZ.

### Integrações futuras
- **Marketplaces**: importar XMLs de venda de plataformas (Mercado Livre, Shopee).
- **NFCom (comunicação)** e **BP-e (bilhete passageiros)**: mesmo padrão de plugin.
- **e-Social / EFD-Reinf**: consumidores separados.

## Preparações estruturais já feitas na v1

| Preparação | Onde | Habilita |
|------------|------|----------|
| `documento` como coluna em `fiscal_endpoints` | Modelo dados (doc 10) | Todos os documentos futuros |
| `IFiscalDocumentModule` no `fiscal-core` | Módulos (doc 07) | Plugin por documento |
| `SignatureSuite` trocável | Signature Engine | Migração NT SHA-256 |
| `SoapOperationDescriptor` com `operationElementName` opcional | SOAP Engine | Double-wrapper AN |
| `ITransportChannel` genérico (SOAP e REST) | Transport | NFS-e REST |
| `empresa_id` em contratos | Todo o runtime | Multi-tenant |
| `fiscal_schemas_pl` | Modelo dados | Múltiplas versões de PL simultâneas |
| `fiscal_cstat_policy` | Modelo dados | Política declarativa por cStat |
| Filas pgmq nomeadas por operação | Queue Manager | Novos fluxos sem refactor |

## O que **não** entra na v1 mas está mapeado

- Contingência automática (EPEC/SVC).
- Certificado A3 / PKCS#11.
- SPED / EFD.
- Renderização DACTE/DAMDFE.
- NFS-e multi-município (>5k layouts).
- Multi-empresa completo (só contratos; UI/RLS na onda 1 já em curso).

## Compatibilidade retroativa

Enquanto o alvo é construído, a camada antiga (`sefaz-proxy`, `sefaz-distdfe`,
`process-*-cron`) continua operando. A migração é por **feature flag por
operação** (`fiscal:v2:autorizacao`, etc.) para permitir corte gradual.
Cada corte tem rollback simples (desligar a flag).