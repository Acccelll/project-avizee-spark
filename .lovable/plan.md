# Inspeção somente-leitura: NSU DistDFe do CNPJ 16615493000104

Nenhuma alteração de código, deploy, escrita no banco ou chamada à SEFAZ foi feita. Não há implementação proposta neste plano.

## Conclusão
Não há evidência de que este projeto tenha avançado, avance ou consiga avançar o NSU do CNPJ 16615493000104. Nada no banco ou no código o referencia.

## Estado operacional comprovado (consultas ao banco `mqqkngebblqiteydvxsz`)
1. Presença do CNPJ 16615493000104
   - `empresa_config`: 1 linha, AviZee Equipamentos LTDA, CNPJ 53.078.538/0001-85. Ambiente SEFAZ = 1 (produção). O CNPJ 16615493000104 não está lá.
   - `empresas`: 1 linha ("AviZee — Empresa Padrão"), CNPJ nulo.
   - `companies`: a tabela não existe.
   - `nfe_distdfe_sync`: 2 linhas, ambas do CNPJ 53078538000185. Nenhuma do 16615493000104.
   - `cte_distdfe_sync`: vazia.
   - `fiscal_telemetria` (4.934 linhas) e `nfe_distribuicao` (45 linhas): 0 ocorrências do CNPJ como emitente, destinatário ou consultado.
   - Busca textual no repositório: 0 ocorrências de "16615493000104" ou "CS RODRIGUES".
2. Agendamento (`cron.job`, 5 jobs ativos)
   - `process-distdfe-cron-tick` (jobid 3): ativo, `*/30 * * * *`, faz `net.http_post` para `/functions/v1/process-distdfe-cron`.
   - Os últimos 5 disparos em `cron.job_run_details` (até 30/09 17:00 UTC) constam como `succeeded`. Isso só prova que o HTTP foi disparado.
   - Outros jobs: webhooks-dispatcher, process-email-queue, process-nfe-retry-cron, gerar-lancamentos-recorrentes-diario.
3. Última execução do `process-distdfe-cron`
   - `cron_health`: `last_run_at` 2026-09-30 17:00:09 UTC, status `error` ("1 CNPJ(s) com erro"), 2.434 execuções.
   - `auditoria_logs` (`distdfe_cron_run`): todas as execuções recentes têm ambiente 1, 1 CNPJ (53078538000185), erro "Falha na consulta", 0 novos documentos.
   - `fiscal_telemetria`, `sefaz-distdfe/consultar-nsu`: 2.465 falhas e 1 sucesso desde 08/05. O único sucesso foi em 10/06, ambiente 2, cStat 137, CNPJ 53078538000185.
4. Cursor `ultNSU`
   - Não existe cursor para 16615493000104.
   - Cursor do CNPJ 53078538000185, ambiente 1: `ultimo_nsu` = 143, `max_nsu` = 143, última sincronização em 2026-06-16 17:09 UTC (cStat 138). Nada avançou desde então.
   - Cursor do CNPJ 53078538000185, ambiente 2: `ultimo_nsu` = 0, última sincronização em 10/06.
   - Circuit breaker: `distdfe_circuit_break_until_1` vencido desde 12/06.
5. Outros mecanismos de DistDFe
   - Não existe função `fiscal-cron`.
   - Filas pgmq existentes: apenas `auth_emails`, `transactional_emails`, suas DLQs e `webhook_events`. Não há `fiscal.dfe.sync`.
   - `cte-distdfe` existe como função, mas não está agendada em `cron.job`. `cte_distdfe_sync` está vazia.
   - `sefaz-distdfe` é chamada pelo cron e por ações manuais da UI.

## Código existente (não é prova de execução)
- O CNPJ consultado na SEFAZ não vem de `empresa_config` nem de `nfe_distdfe_sync`. `sefaz-distdfe` extrai o CNPJ do certificado A1 (`dbavizee/certificados/empresa.pfx`). O CNPJ na tabela de sync é só a chave onde o cursor é gravado.
- O cron só avança o NSU se `sefaz-distdfe` retornar sucesso. Aí faz upsert em `nfe_distdfe_sync` com o CNPJ do certificado. Portanto, se o A1 fosse do 16615493000104, um sync bem-sucedido criaria uma linha nova para ele.
- Hoje não existe essa linha. `storage.objects` não tem nenhum arquivo em `dbavizee/certificados/`. É consistente com o binário do storage não ter sido copiado na migração. Sem o PFX, a função não chega a chamar a SEFAZ.
- Não confirmei o motivo exato da falha "Falha na consulta": o erro detalhado não foi persistido. É uma inferência a validar pelos logs da edge function, não um fato.

## Limites da inspeção
- Só cobre o banco atual (`mqqkngebblqiteydvxsz`). O projeto antigo (`cpvdncsxzostovdduhci`) e o Worker Cloudflare mTLS não foram acessados. Se o CNPJ 16615493000104 foi consultado por eles, não há como comprovar daqui.
- Não li o conteúdo do certificado.
