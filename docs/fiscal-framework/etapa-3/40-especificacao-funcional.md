# 40 · Especificação funcional

Cada funcionalidade recebe código `F-XXX`. Padrão de ficha:

```
F-XXX Nome
  Objetivo            · o que resolve
  Responsabilidade    · quem executa (contexto/módulo)
  Pré-requisitos      · condições necessárias
  Fluxo principal     · caminho feliz
  Fluxos alternativos · variações válidas
  Fluxos de exceção   · falhas tratadas
  Dependências        · módulos/serviços/tabelas
  Eventos gerados     · nomes canônicos
  Eventos consumidos  · nomes canônicos
  Integrações         · módulos ERP, SEFAZ, storage
  Regras de negócio   · RN-XXX (doc 41)
  Restrições          · limites, prazos, versão
```

## F-001 · Emissão de documento fiscal (NF-e v1)
- **Objetivo**: autorizar NF-e junto à SEFAZ e persistir o resultado.
- **Responsabilidade**: `AutorizacaoService` (contexto Documentos Fiscais).
- **Pré-requisitos**: empresa configurada (CNPJ/IE/CRT/série/ambiente); certificado A1 válido; endpoint cadastrado para (documento, uf, ambiente, autorizacao); usuário com `fiscal:emitir`.
- **Fluxo principal**: DTO da nota → serialize → sign → validate XSD (opcional) → resolve endpoint → SOAP envelopar → transport mTLS → parseRetorno → grava `notas_fiscais` + XML no bucket → audit → devolve `{ chave, protocolo, dhAutorizacao }`.
- **Alternativos**: lote assíncrono cStat=103 → enfileira `fiscal.retry.autorizacao` → cron consulta retorno.
- **Exceção**: XSD inválido → rejeita antes de enviar; endpoint ausente → erro prescritivo; timeout → enfileira retry; cStat de rejeição → devolve `ok:false` sem persistir como autorizada; cStat de denegação → persiste como `Denegada`; duplicidade (cstat 204/539) → trata como sucesso se protocolo local existe.
- **Dependências**: `fiscal-module-nfe`, engines XML/Signature/Schema/SOAP/Transport, Cross Certificate/Endpoint/Audit, tabelas `notas_fiscais`, `notas_fiscais_itens`, `nota_fiscal_anexos`, `fiscal_endpoints`, `fiscal_auditoria`.
- **Eventos gerados**: `DocumentoSerializado`, `DocumentoAssinado`, `DocumentoAutorizado` (feliz) ou `DocumentoRejeitado`/`DocumentoDenegado`.
- **Eventos consumidos**: `EmpresaFiscalConfigurada`, `CertificadoCarregado`.
- **Integrações**: Estoque (baixa após autorizado), Financeiro (lançamentos), Vendas (atualiza pedido).
- **Regras**: RN-001 a RN-020.
- **Restrições**: layout NF-e 4.00 v1; ambiente `homologacao|producao`; timeout 30s default; retry máx. 10.

## F-002 · Consulta de situação por chave
- **Objetivo**: verificar status atual na SEFAZ.
- **Responsabilidade**: `ConsultaService`.
- **Pré-req**: chave válida (44 dígitos + DV); endpoint `consultaProtocolo` cadastrado.
- **Fluxo**: monta SOAP `consSitNFe` → envia → parseRetorno.
- **Exceção**: cStat 217 (não consta) → devolve status "Não localizada"; timeout → tenta 1x mais.
- **Eventos**: `SefazRequisitado`, `SefazRespondeu`.
- **Regras**: RN-030–035.

## F-003 · Download XML
- **Objetivo**: entregar bytes XML ao usuário.
- **Pré-req**: chave existe em `notas_fiscais` ou `nfe_distribuicao`; usuário com acesso à empresa.
- **Fluxo**: consulta `caminho_xml` → gera signed URL 10min → 302; se ausente e chave é de destinatário, dispara F-004.
- **Exceção**: XML não encontrado → tenta consulta por chave via DistDFe (cnpjTitular = destinatário).
- **Regras**: RN-040.

## F-004 · Importação de XML
- **Objetivo**: ingerir NF-e de terceiros (fornecedor) ou reingressar próprias.
- **Pré-req**: `fiscal:emitir` ou operação de compras; XML bem-formado.
- **Fluxo**: parse → valida assinatura → dedupe por `(empresa_id, chave)` → resolve fornecedor/produtos (cadastro rápido opcional) → persiste `notas_fiscais` (tipo entrada) + itens → arquiva XML em `dbavizee/fiscal/YYYY/MM/entrada/`.
- **Alternativo**: import ZIP → fila `fiscal.import.lote`.
- **Exceção**: assinatura inválida → devolve erro; duplicidade → devolve nota existente com flag.
- **Eventos**: `XMLImportado`, `DocumentoRecebido`.
- **Regras**: RN-050–058.

## F-005 · Manifestação do destinatário
- **Objetivo**: registrar ciência/confirmação/desconhecimento/não realizada.
- **Pré-req**: chave em `nfe_distribuicao`; prazo válido (180d ciência, etc.); permissão `fiscal:manifestar`.
- **Fluxo**: monta evento por tipo → assina → envia → persiste em `nota_fiscal_eventos`.
- **Exceção**: prazo expirado → devolve erro; evento duplicado (nSeq já existe) → 409.
- **Regras**: RN-070–078.

## F-006 · Cancelamento
- **Pré-req**: nota `Autorizada`, dentro de 24h da autorização, sem CT-e vinculado, sem MDF-e transmitido.
- **Fluxo**: monta evento 110111 → assina → envia → cStat=135 → atualiza status `Cancelada`.
- **Exceção**: > 24h → cStat=155 (fora prazo) → devolve erro; nota já cancelada → 409.
- **Regras**: RN-080–086.

## F-007 · Carta de Correção (CCe)
- **Pré-req**: nota `Autorizada`; texto 15..1000 chars; nSeq incremental por chave; máx. 20 CCe por chave.
- **Fluxo**: monta evento 110110 → assina → envia → persiste.
- **Restrições**: não corrigir valores, CFOP, emitente, destinatário, data de emissão/saída, itens de mercadoria.
- **Regras**: RN-090–096.

## F-008 · Inutilização de numeração
- **Pré-req**: faixa não emitida; mesma série e ano; usuário `fiscal:inutilizar`.
- **Fluxo**: monta pedido → assina → envia → cStat=102 → persiste em `inutilizacoes_numeracao`.
- **Exceção**: número já usado → erro; período > 30d anterior → aceita mas alerta.
- **Regras**: RN-100–104.

## F-009 · Distribuição DF-e
- **Pré-req**: certificado válido; NSU cursor em `nfe_distdfe_sync`.
- **Fluxo**: loop `distDFeInt` até cStat=137 → decodifica docZip → grava `nfe_distribuicao` + `nfe_distribuicao_itens` → avança NSU.
- **Alternativo**: `fiscal_runtime_config.sync_auto_ciencia=true` → enfileira `fiscal.eventos.ciencia` por chave.
- **Exceção**: 656 (consumo indevido) → aumenta intervalo para 60min; timeout → mantém NSU, retry.
- **Regras**: RN-110–120.

## F-010 · Consulta cadastro
- **Objetivo**: verificar situação de contribuinte na SEFAZ.
- **Pré-req**: UF suporta `consultaCadastro` (nem todas suportam); CNPJ ou IE.
- **Fluxo**: monta SOAP → envia → parseRetorno.
- **Uso**: cadastro de cliente/fornecedor (autocomplete opcional).
- **Regras**: RN-130.

## F-011 · Status serviço
- **Objetivo**: verificar disponibilidade SEFAZ.
- **Fluxo**: SOAP `nfeStatusServicoNF` → cStat=107 ok.
- **Uso**: pré-check antes de emissão em massa; alimentação de circuit breaker.
- **Regras**: RN-140.

## F-012 · Gerenciamento de certificado A1
- **Objetivo**: ciclo de vida (upload, parse, status, remoção).
- **Fluxo upload**: usuário envia `.pfx` + senha → edge parseia → grava bucket + Vault → metadata em `fiscal_certificado_metadata` (v2) ou `app_configuracoes` (v1).
- **Alertas**: 30d/7d/expirado (cron diário).
- **Restrições**: só `fiscal:certificado` ou `fiscal:admin`.
- **Regras**: RN-150–158.

## F-013 · Configuração fiscal por empresa
- **Objetivo**: manter CNPJ, IE, IM, CRT, série, ambiente padrão, timeouts, retry.
- **Fonte**: `empresa_config` + `fiscal_runtime_config`.
- **Regras**: RN-160–166; alteração de CNPJ dispara re-onboarding.

## F-014 · Auditoria fiscal
- **Objetivo**: rastro imutável 5 anos.
- **Fluxo**: toda operação fiscal grava `fiscal_auditoria`.
- **Consulta**: por correlation_id, chave, período, empresa (permissão `fiscal:auditoria`).
- **Regras**: RN-170–175.

## F-015 · Monitoramento fiscal
- **Objetivo**: dashboard, métricas, alertas.
- **Fontes**: `fiscal_telemetria`, `cron_health`, `fiscal_auditoria` agregada.
- **Alertas**: doc 32 catálogo.
- **Regras**: RN-180–185.

## F-016 · Reprocessamento (retry)
- **Objetivo**: reenviar operação falhada com backoff.
- **Fluxo**: cron consome `fiscal.retry.*` → re-executa APP → sucesso ack | falha reenfileira.
- **Regras**: RN-190–196.

## F-017 · Contingência
- **Objetivo**: emitir em modo alternativo quando autorizador principal indisponível.
- **Ativação**: manual por `fiscal:admin` (ADR-013).
- **Modos v1.1**: SVC-AN, SVC-RS; v2: EPEC.
- **Regras**: RN-200–210.

## F-018 · Exportação de XML
- **Objetivo**: entregar XMLs individuais ou em lote (contador).
- **Fluxo**: signed URL individual (10min) ou zip agendado (fila).
- **Regras**: RN-220–224.

## F-019 · Validação standalone (XSD + regras)
- **Objetivo**: validar XML sem enviar.
- **Uso**: pré-envio, testes, debug.
- **Regras**: RN-230.

## F-020 · Assinatura standalone
- **Objetivo**: assinar XML sem enviar (reassinatura, testes).
- **Regras**: RN-240.

## F-021 · Registro/atualização de endpoints SEFAZ
- **Objetivo**: CRUD de `fiscal_endpoints`.
- **Acesso**: `fiscal:admin`.
- **Fluxo**: SQL admin (baixa frequência); UI não prevista v1.
- **Regras**: RN-250.

## F-022 · Publicação de PL/XSD
- **Objetivo**: incorporar novo Pacote de Liberação SEFAZ.
- **Fluxo**: upload XSDs no bucket + linha em `fiscal_schemas_pl` marcando vigência.
- **Regras**: RN-260.

## F-023 · Notificação fiscal
- **Objetivo**: publicar eventos operacionais (certificado vencendo, SEFAZ down, rejeição em massa) em canais AVIZEE.
- **Fluxo**: `NotificacaoFiscalService` reage a eventos → in-app/e-mail/webhook.
- **Regras**: RN-270.

## F-024 · Webhooks de saída (v3)
- **Objetivo**: notificar sistemas externos quando eventos fiscais ocorrem.
- **Regras**: RN-280–285.

## F-025 · SPED Fiscal / Contribuições (v3)
- **Objetivo**: gerar TXT SPED por período.
- **Fluxo**: agregar dados de notas + estoque + financeiro → validar → arquivo em bucket.
- **Regras**: RN-290–295.

## F-026 · EFD-Reinf / eSocial (v3)
- **Objetivo**: envio de eventos trabalhistas/previdenciários (REST).
- **Regras**: RN-300.

## Cobertura por versão

| Versão | Funcionalidades |
|---|---|
| v1 | F-001 a F-016, F-019, F-020 |
| v1.1 | + F-017 (contingência SVC), F-023 |
| v2 | + F-024 (webhooks) |
| v3 | + F-025, F-026, novos documentos (NFC-e/CT-e/MDF-e/NFS-e) |

F-018 (export lote), F-021, F-022 já contemplados em v1 como operações admin.