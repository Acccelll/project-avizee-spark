# 25 · Modelo conceitual de serviços

"Serviço" aqui = **unidade de comportamento** (use case ou operação
encapsulada), independente de ser edge, function, RPC ou classe.

## AutorizacaoService
- **Objetivo**: autorizar documento fiscal (v1: NF-e).
- **Operações**: `autorizar(command)`, `consultarRetorno(nRec, ctx)`.
- **Dep.**: DocumentModule, Signature, Schema, SOAP, Transport, Cert, Audit, Endpoint.
- **Extensões futuras**: `autorizarLote(nRec, notas[])` para NF-e ≥ v4 (múltiplas em um lote).
- **Implementação futura**: edge `fiscal-nfe` + `APP.AutorizarNFe`.

## ConsultaService
- **Objetivo**: consultar situação de documento na SEFAZ (não depende de dados locais).
- **Operações**: `consultarChave(chave, ctx)`, `statusServico(uf, amb)`, `consultarCadastro(cnpj, uf)`.
- **Extensões**: `consultarInutilizacao`, `consultarLote`.

## EventoService
- **Objetivo**: registrar eventos (cancel, CCe, manifestação, EPEC).
- **Operações**: `cancelar`, `cartaCorrecao`, `inutilizar`, `manifestar`, `epec` (futuro).
- **Extensões**: `atorAutorizado` (SEFAZ Ator Interessado — evento 110140).

## DistribuicaoDFeService
- **Objetivo**: obter documentos endereçados ao CNPJ do usuário.
- **Operações**: `sincronizar(empresaId, ambiente)`, `consultarChave(chave)`, `consultarNSU(nsu)`.
- **Extensões**: `sincronizarLote(empresas[])` para operações multi-CNPJ.

## ManifestacaoService
- **Objetivo**: aplicar manifestações (210200/210/220/240).
- **Separado do EventoService?** Sim — regras de prazo, semântica de negócio e RBAC distintos.
- **Extensões**: manifestação em lote, política automática por regra (`sempre confirmar`, `confirmar acima de X`).

## ImportacaoService
- **Objetivo**: ingerir XML externo (upload manual, DF-e, e-mail).
- **Operações**: `importarXml(fileOrString, opts)`, `importarLote(zip)`.
- **Extensões**: parse de CT-e, MDF-e, NFS-e municipais (heterogêneas).

## ExportacaoService
- **Objetivo**: entregar XML para o usuário (download, e-mail, webhook).
- **Operações**: `exportarPorChave`, `exportarPorPeriodo`, `agendarExportacaoContabil`.
- **Extensões**: pacote SPED, exportação para contador com filtros.

## CertificadoService
- **Objetivo**: ciclo de vida do certificado A1.
- **Operações**: `upload(pfxBytes, senha)`, `parse(pfxBytes, senha)`, `remover`, `status`.
- **Extensões**: A3 via PKCS#11 (fora do escopo v1), rotação automática programada.

## InutilizacaoService
- **Objetivo**: registrar faixas de numeração inutilizadas.
- **Operações**: `inutilizar(faixa, justificativa, ctx)`.

## ValidacaoService
- **Objetivo**: validar XML contra XSD sem enviar.
- **Operações**: `validar(xml, documento, versaoPL)`.
- **Extensões**: validação de regras de negócio (CFOP × CST, natureza × operação).

## AssinaturaService
- **Objetivo**: assinar XML standalone (útil para reassinatura e testes).
- **Operações**: `assinar(xml, elementId, empresaId, suite?)`.

## AuditoriaService
- **Objetivo**: registrar e consultar rastro fiscal.
- **Operações**: `registrar(entry)`, `consultarPorCorrelationId(id)`, `consultarPorChave(chave)`, `consultarPorPeriodo(range, filtro)`.
- **Extensões**: exportação para auditoria externa (CSV/Parquet).

## MonitoramentoService
- **Objetivo**: agregar métricas, dispararlerts, exibir dashboards.
- **Operações**: `metricas(empresaId, range)`, `saudeSefaz(uf, amb)`, `certificadosExpirando(dias)`.

## ContingenciaService (novo — Etapa 2)
- **Objetivo**: decidir e aplicar contingência (SVC-AN, SVC-RS, EPEC, FS-DA).
- **Operações**: `avaliar(ctx, ultimoErro)`, `ativar(modo)`, `encerrar`, `estado(empresaId)`.

## NotificacaoFiscalService (novo — Etapa 2)
- **Objetivo**: canal único para eventos fiscais relevantes ao usuário.
- **Operações**: `notificar(evento, destinatarios[])`, `assinar(evento, canal)`.
- **Consome eventos**: `CertificadoProximoDoVencimento`, `SefazIndisponivel`, `DocumentoRejeitado`.

## RelatoriosFiscaisService (futuro)
- **Objetivo**: relatórios agregados (livros fiscais, apuração, ICMS/IPI).
- **Fora do escopo v1**; pré-condição para SPED Fiscal/Contribuições.

## SchemaRegistryService (novo — Etapa 2)
- **Objetivo**: metadados dos PLs XSD, resolver bytes, versionar.
- **Operações**: `plVigente(documento, data)`, `bytesDe(documento, versao, arquivo)`.

## Pontos de extensão comuns

Todos os serviços podem receber:
- **`hooks: { before, after, onError }`** — para injetar auditoria custom, métricas, transformação de payload sem alterar núcleo.
- **`policyOverrides`** — timeouts, retry, contingência (útil em migração).
- **`transportOverride`** — para testes E2E (mock) ou proxy diferente.

## Composição

`createFiscalRuntime(options)` compõe **todos** os serviços acima e expõe:
```
runtime.autorizacao
runtime.consulta
runtime.evento
runtime.dfe
runtime.manifestacao
runtime.importacao
runtime.exportacao
runtime.certificado
runtime.inutilizacao
runtime.validacao
runtime.assinatura
runtime.auditoria
runtime.monitoramento
runtime.contingencia
runtime.notificacao
runtime.schemaRegistry
```