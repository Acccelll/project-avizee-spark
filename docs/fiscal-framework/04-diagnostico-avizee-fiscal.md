# 04 · Diagnóstico da camada fiscal atual do AVIZEE

## O que funciona bem

1. **Modelo de dados fiscal maduro** — `notas_fiscais` (121 col.) + itens (53 col.)
   + eventos + anexos + distribuição cobrem os campos do leiaute 4.00.
2. **Portal Fiscal desacoplado da SEFAZ** — lê `v_nfe_portal`; a UI não muda quando o motor muda.
3. **Certificado seguro** — .pfx no bucket privado, senha no Vault, metadados
   em `app_configuracoes`. Padrão bem estabelecido (`mem/features/certificado-digital-a1`).
4. **Idempotência de arquivamento XML** — `xmlStorage.service.ts` faz upsert por chave.
5. **Ciência automática** — `autoCiencia.service.ts` libera XML completo no ciclo seguinte.

## Débitos técnicos identificados

### D1. Endpoints hardcoded no código
`src/services/fiscal/sefaz/sefazUrls.service.ts` mantém URLs em constantes.
Quando a SEFAZ mudou `hom.nfe → hom1.nfe` (2022, comunicado oficial), o DistDFe
quebrou porque não havia camada de dados para atualizar sem deploy de código.
**O framework .NET provou a solução**: `EndpointRegistry` como dado versionado.
**Alvo**: tabela `fiscal_endpoints` versionada por migration.

### D2. Assinatura via `node-forge` na edge
`sefaz-proxy` usa `node-forge` para XMLDSig. Problemas:
- C14N do `node-forge` não cobre 100% do perfil SEFAZ (namespaces herdados).
- Falhas silenciosas em NFes com caracteres especiais.
- Difícil validar contra a implementação de referência (framework .NET) sem
  reimplementar.
**Alvo**: canonicalizer + signer próprios, testáveis offline, com suite
trocável (SHA1 hoje, SHA256 pronto para NT futura).

### D3. XML builder duplicado
`src/services/fiscal/sefaz/xmlBuilder.service.ts` e `nfeBuilders.service.ts`
têm responsabilidades sobrepostas. Falta um serializer determinístico único.
**Alvo**: engine de XML fiscal única (`XmlEngine`), com modelo intermediário
e writer strict (sem `<?xml?>` embutido).

### D4. Ausência de validação XSD
Nenhuma etapa valida o XML contra o Pacote de Liberação antes de enviar.
Todo erro de leiaute vira rejeição SEFAZ (cStat 2xx/4xx) tardia.
**Alvo**: `SchemaValidator` opcional (etapa reportada como pulada quando XSDs
ausentes, bloqueante quando presentes).

### D5. Retry sem taxonomia clara
`process-nfe-retry-cron` reprocessa `nfe_emissao_pendente` mas não distingue
cStats retryáveis (108/109 serviço indisponível) de definitivos (539 duplicidade).
**Alvo**: taxonomia de erros (doc 12) com política declarativa por cStat.

### D6. SOAP com dois padrões misturados
O tratamento do double-wrapper do Ambiente Nacional está espalhado entre
`distdfe.service.ts` e `sefaz-distdfe/index.ts`, sem descritor unificado.
**Alvo**: `SoapOperationDescriptor` como dado (equivalente TS do padrão .NET).

### D7. Logs fiscais sem correlação
`fiscal_telemetria` e `sefaz_consulta_log` não compartilham correlation-id.
Rastrear um envio ponta a ponta exige `join` manual por timestamp.
**Alvo**: correlation-id único por operação, propagado até a edge e persistido.

### D8. Ausência de `IFiscalClock`
Vários serviços chamam `new Date()` direto. Impossível testar sem freezetime.
**Alvo**: fonte única de tempo injetável (doc 07 — módulo Clock).

### D9. Certificado não faz hot-swap
Após upload de novo .pfx, o processo em execução na edge só carrega o novo
na próxima invocação (sem estado persistente, sim). Mas se movermos para um
gateway estável (futuro), precisamos de reload explícito.
**Alvo**: `ICertificateProvider.reload()` (fase futura, quando houver gateway).

### D10. Multi-empresa não previsto
Toda a camada fiscal assume 1 CNPJ. A migração para multi-empresa (já
iniciada em `.lovable/memory/features/multi-tenant-onda1.md`) exigirá
segregar cert, endpoints, numeração e RLS por `empresa_id`.
**Alvo**: `empresa_id` em todos os contratos desde já (ADR-006).

### D11. Falta de contingência
Sem suporte a EPEC / FS-DA / SVC. Se autorizador estadual cair, emissão para.
**Alvo**: previsto no roadmap (doc 14), não bloqueante nesta etapa.

### D12. NF-e é o único documento
Nenhuma preparação para NFC-e, CT-e, MDF-e, NFS-e. Tudo está acoplado a NF-e.
**Alvo**: contrato de "plugin por documento" (ADR-005).

## Pontos de risco imediato

| Risco | Onde | Impacto |
|-------|------|---------|
| Endpoints hardcoded desatualizam | `sefazUrls.service.ts` | Bug já ocorrido (hom→hom1); voltará a ocorrer |
| C14N incompleta | `sefaz-proxy` (node-forge) | Rejeição SEFAZ intermitente em XMLs com caracteres especiais |
| Sem validação XSD | Toda emissão | cStat 2xx tardio; retrabalho |
| Sem correlation-id | Toda emissão | Debug demorado em incidente |

## Débitos que **não** são fiscais mas afetam

- `search_path = public` já é regra Core — cumprir em toda nova RPC fiscal.
- Logs devem passar por `src/lib/logger.ts` (proibido `console.*`).
- RLS por perfil já existe; ao introduzir multi-empresa, adicionar cláusula
  `empresa_id = current_empresa_id()` em todas as políticas fiscais.