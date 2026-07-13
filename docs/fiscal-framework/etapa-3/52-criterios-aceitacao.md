# 52 · Critérios de aceitação

Padrão Gherkin-like: **Dado / Quando / Então**. Um bloco por funcionalidade.
`CA-XXX.n` = critério `n` da funcionalidade `F-XXX`.

Marcos: todo CA deve ter teste automatizado (unit/integ/E2E) antes do release, salvo indicado como **[manual]**.

## F-001 Emissão NF-e

- **CA-001.1** Dado empresa configurada, cert válido, endpoint cadastrado, quando emito NF-e válida em homologação, então recebo cStat=100 + protocolo + XML no bucket em < 3s (p95).
- **CA-001.2** Dado cert expirado, quando tento emitir, então recebo `FISCAL.CERTIFICADO_EXPIRADO` sem chamar SEFAZ.
- **CA-001.3** Dado endpoint ausente para (UF, ambiente, autorizacao), quando tento emitir, então recebo `FISCAL.ENDPOINT_NAO_CADASTRADO` com hint SQL prescritivo.
- **CA-001.4** Dado SEFAZ retorna cStat=103, quando emito, então nota fica em `EmProcessamento` e cron consulta retorno em ≤ 1min.
- **CA-001.5** Dado timeout SEFAZ, quando emito, então nota vai para fila `fiscal.retry.autorizacao` com backoff.
- **CA-001.6** Dado cStat=204 (duplicidade) e protocolo existe local, quando reenvio, então trato como sucesso (não erro).
- **CA-001.7** Dado nota em homologação, então primeiro item contém `xProd = "NOTA FISCAL EMITIDA EM AMBIENTE DE HOMOLOGACAO - SEM VALOR FISCAL"`.
- **CA-001.8** Dado emissão feita, então `fiscal_auditoria` contém entrada com correlationId, request_hash, response cstat.
- **CA-001.9** Dado cStat de rejeição, então nota **não** é persistida como `AUTORIZADA`; devolve `ok:false` com cstat.
- **CA-001.10** Dado cStat=110/301/302, então nota fica `DENEGADA` e não pode ser retentada.

## F-002 Consulta situação

- **CA-002.1** Dado chave válida, quando consulto, então recebo `situacao` + `cstat` sem alterar dados locais.
- **CA-002.2** Dado cStat=217, então retorno "Não localizada" com hint de "pode estar em processamento".

## F-003 Download XML

- **CA-003.1** Dado nota com `caminho_xml`, quando baixo, então recebo signed URL válida por ≤ 10min.
- **CA-003.2** Dado nota de destinatário sem XML local, quando baixo, então sistema consulta por chave e devolve URL após download.
- **CA-003.3** Dado usuário sem acesso à empresa, quando tento baixar, então recebo 403.

## F-004 Import XML

- **CA-004.1** Dado XML válido não duplicado, quando importo, então nota persistida + XML arquivado + `XMLImportado` emitido.
- **CA-004.2** Dado XML já importado (mesma chave, mesma empresa), quando importo, então devolvo nota existente com `duplicada:true`.
- **CA-004.3** Dado XML com assinatura inválida, então bloqueio import com `FISCAL.ASSINATURA_INVALIDA`.
- **CA-004.4** Dado ZIP com > 500 arquivos, então import vai obrigatoriamente para fila.

## F-005 Manifestação

- **CA-005.1** Dado chave em `nfe_distribuicao` e prazo válido, quando manifesto ciência, então cStat=135 + evento persistido.
- **CA-005.2** Dado prazo expirado (> 180d ciência), então bloqueio com `FISCAL.MANIFESTACAO_FORA_PRAZO`.
- **CA-005.3** Dado manifestação repetida (mesmo tipo + chave), então UNIQUE bloqueia via 409.

## F-006 Cancelamento

- **CA-006.1** Dado nota `Autorizada`, < 24h, justificativa 15..255 chars, quando cancelo, então cStat=135 + status `Cancelada` + estorno estoque.
- **CA-006.2** Dado > 24h, então bloqueio com `FISCAL.FORA_PRAZO` (cStat=155).
- **CA-006.3** Dado nota já cancelada, então 409 `FISCAL.NOTA_JA_CANCELADA`.
- **CA-006.4** Dado nota com CT-e vinculado, então SEFAZ rejeita cStat=574 → devolvo erro claro.
- **CA-006.5** Dado cancelamento e financeiro não baixado, então lançamentos estornados automaticamente.

## F-007 CCe

- **CA-007.1** Dado nota `Autorizada`, texto 15..1000 chars, nSeq incremental, quando emito CCe, então cStat=135.
- **CA-007.2** Dado 20 CCe existentes para chave, então bloqueio `FISCAL.CCE_LIMITE_ATINGIDO`.
- **CA-007.3** Dado texto < 15 chars ou > 1000, então bloqueio `FISCAL.CCE_TEXTO_INVALIDO` antes de enviar.

## F-008 Inutilização

- **CA-008.1** Dado faixa livre, mesma série/ano, quando inutilizo, então cStat=102 + registro em `inutilizacoes_numeracao`.
- **CA-008.2** Dado número da faixa já emitido, então bloqueio `FISCAL.FAIXA_JA_UTILIZADA` antes de enviar.
- **CA-008.3** Dado > 30d após fim do mês, então alerto e exijo confirmação admin.

## F-009 DFe

- **CA-009.1** Dado cron dispara, quando sincronizo, então NSU avança e novas chaves persistidas.
- **CA-009.2** Dado cStat=137, então marco NSU e agendo próximo poll em 30min.
- **CA-009.3** Dado cStat=656, então backoff 60min + log warn.
- **CA-009.4** Dado `sync_auto_ciencia=true`, então cada nova chave gera enfileiramento de ciência.
- **CA-009.5** Dado docZip válido, então decodifico e persisto sem duplicar (dedupe por chave).

## F-010 Consulta cadastro

- **CA-010.1** Dado UF que suporta, quando consulto, então recebo dados de cadastro.
- **CA-010.2** Dado UF que não suporta, então `FISCAL.UF_NAO_SUPORTA` sem chamar SEFAZ.

## F-011 Status serviço

- **CA-011.1** Dado cStat=107 fresco, então cache hit por 3min.
- **CA-011.2** Dado cStat ≠ 107, então breaker (uf, ambiente) abre após 5 falhas em 60s.

## F-012 Certificado

- **CA-012.1** Dado .pfx válido + senha correta, quando faço upload, então cert vai para bucket + senha para Vault + metadata gravado.
- **CA-012.2** Dado senha errada, então `FISCAL.CERT_SENHA_INVALIDA` (401) sem gravar nada.
- **CA-012.3** Dado CNPJ do cert ≠ CNPJ empresa, então `FISCAL.CERT_CNPJ_DIVERGENTE` e bloqueio.
- **CA-012.4** Dado cert com < 30d de validade, então alerta info emitido diariamente até renovação.
- **CA-012.5** Dado cert expirado, então bloqueio operações que exigem assinatura; consulta continua.
- **CA-012.6** Dado cache in-memory ativo em uma invocação, então cert não é re-parseado.
- **CA-012.7** Dado invocação nova, então cert é parseado novamente (nunca reutilizado cross-invocação).

## F-013 Config fiscal

- **CA-013.1** Dado admin altera CRT, então requer confirmação + auditado.
- **CA-013.2** Dado admin altera CNPJ da empresa, então UI exige re-onboarding (novo cert, nova numeração).
- **CA-013.3** Dado runtime config editado, então mudança auditada + próxima operação usa novo valor.

## F-014 Auditoria

- **CA-014.1** Dado consulta por correlation_id, então recebo timeline completa da operação.
- **CA-014.2** Dado usuário sem `fiscal:auditoria`, então 403.
- **CA-014.3** Dado tentativa de UPDATE/DELETE em `fiscal_auditoria`, então trigger bloqueia.
- **CA-014.4** Dado consulta a nota específica, então histórico + eventos + entradas de auditoria retornam corretamente.

## F-015 Monitoramento

- **CA-015.1** Dado dashboard aberto, então cStat SEFAZ atual + filas + certificados exibidos em < 2s.
- **CA-015.2** Dado cert em < 30d, então alerta aparece no dashboard e via notificação.
- **CA-015.3** Dado breaker aberto, então dashboard destaca (uf, ambiente) afetado.

## F-016 Retry

- **CA-016.1** Dado timeout, quando cron consome retry, então re-executa e sucesso ack.
- **CA-016.2** Dado 10 tentativas esgotadas, então mensagem arquivada + notificação.
- **CA-016.3** Dado admin força retry, então contador resetado e log warn emitido.
- **CA-016.4** Dado backoff, então intervalo entre tentativas segue tabela (doc 46).

## F-017 Contingência **[manual]**

- **CA-017.1** Dado admin ativa SVC-AN, então próxima emissão usa endpoint SVC-AN + `tpEmis` correspondente.
- **CA-017.2** Dado ativação sem `fiscal:admin`, então 403.
- **CA-017.3** Dado encerramento de contingência, então sistema entra em `RegularizacaoPendente` até todas notas transmitidas.
- **CA-017.4** Dado alerta SEFAZ down, então UI **sugere** contingência mas nunca ativa sozinho.

## F-018 Export lote

- **CA-018.1** Dado seleção < 100 chaves, então download direto em signed URL.
- **CA-018.2** Dado seleção ≥ 100 chaves ou ≥ 30d, então fila + notificação quando pronto.

## F-019 Validação standalone

- **CA-019.1** Dado XSD disponível, então violações listadas ou vazio.
- **CA-019.2** Dado XSD ausente, então retorno `schemasDisponiveis:false` (não erro).

## F-020 Assinatura standalone

- **CA-020.1** Dado XML + cert, então XML assinado retornado.
- **CA-020.2** Dado validador executado no resultado, então digest + assinatura válidos.

## F-021 Endpoints

- **CA-021.1** Dado atualização de URL, então cache instância expira em ≤ 5min e nova URL usada.
- **CA-021.2** Dado auditoria da alteração, então `EndpointAlterado` gravado + admin notificado.

## F-022 PL/XSD

- **CA-022.1** Dado novo PL publicado com vigência futura, então validação passa a usar novo XSD a partir da data.

## F-023 Notificação

- **CA-023.1** Dado evento crítico, então notificação in-app + e-mail entregues em < 1min.
- **CA-023.2** Dado alertas repetidos (mesma chave), então dedup em janela de 1h.

## Critérios transversais (todo módulo fiscal)

- **CA-T.1** Sem `console.*` em nenhum arquivo `src/fiscal-framework/**` ou `supabase/functions/fiscal-*/**`.
- **CA-T.2** Sem `new Date()` fora de `IFiscalClock`.
- **CA-T.3** Sem URL SEFAZ hardcoded.
- **CA-T.4** Toda edge devolve `SucessoEnvelope` ou `ErroEnvelope` com `correlationId`.
- **CA-T.5** Toda edge fiscal escreve em `fiscal_auditoria` em sucesso e falha.
- **CA-T.6** Rate limit respeita limites do doc 43.
- **CA-T.7** Cobertura de teste atende doc 48.
- **CA-T.8** Feature flag `fiscal:v2:*` existe e permite rollback.
- **CA-T.9** Documentação atualizada antes do release.
- **CA-T.10** Nenhum secret em log, resposta ou repositório.

## Definition of Done por operação

1. CAs específicos atendidos.
2. CAs transversais atendidos.
3. Testes automatizados green (unit + integ + contract + E2E mock).
4. Ao menos 1 teste fiscal em homologação SEFAZ green.
5. Documentação (spec + ADR se aplicável) commitada na mesma etapa.
6. Feature flag cadastrada.
7. Runbook de incidente disponível se operação crítica.
8. Auditoria: entrada de exemplo verificada em `fiscal_auditoria`.
9. Métricas: emissão verificada em `fiscal_telemetria`.
10. Rollback documentado e testado ao menos 1x.