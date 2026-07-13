# 41 · Catálogo de regras de negócio

Cada regra recebe código `RN-XXX`. Formato: **enunciado + fundamento + reação
quando violada**.

## Emissão (RN-001..020)

- **RN-001** Chave de acesso é imutável após primeira serialização. Fundamento: SEFAZ. Violação: erro programação — abortar.
- **RN-002** Chave = UF(2) + AAMM(4) + CNPJ(14) + Modelo(2) + Série(3) + NNF(9) + tpEmis(1) + cNF(8) + DV(1) — 44 dígitos.
- **RN-003** DV da chave calculado por módulo 11.
- **RN-004** `cNF` (código numérico) aleatório 8 dígitos, ≠ `nNF`.
- **RN-005** Numeração sequencial por (empresa, série, ambiente). Não pular; gaps só via F-008.
- **RN-006** NF em homologação exige `xProd = "NOTA FISCAL EMITIDA EM AMBIENTE DE HOMOLOGACAO - SEM VALOR FISCAL"` no primeiro item.
- **RN-007** Autorização exige XML assinado antes do envio.
- **RN-008** cStat=100 → status `Autorizada`; cStat 110/301/302 → `Denegada` (persiste, sem retry); cStat de rejeição → `Rejeitada` (não persiste como emitida).
- **RN-009** cStat=204/539 (duplicidade) → tratada como sucesso se protocolo existe local.
- **RN-010** Timeout de transporte não persiste como rejeitada — enfileira retry.
- **RN-011** Retry máximo 10 tentativas; esgotado → status `RejeitadaDefinitiva` + notificação.
- **RN-012** Retry só no orquestrador (nunca no transport).
- **RN-013** `dhEmi` do XML = `runtime.clock.now()` no momento da serialização.
- **RN-014** Fuso `dhEmi` deve ser fuso local do emitente (não UTC).
- **RN-015** Item obrigatório: `cProd`, `xProd`, `NCM` (8 dígitos), `CFOP`, `uCom`, `qCom`, `vUnCom`, `vProd`, `uTrib`, `qTrib`, `vUnTrib`, `indTot`.
- **RN-016** Totais da nota = soma dos itens (± centavos por arredondamento — tolerância 0,01 aceita).
- **RN-017** `natOp` obrigatório; deve refletir CFOP predominante.
- **RN-018** Destinatário CPF/CNPJ obrigatório para NF-e (mod 55); consumidor final anônimo só em NFC-e.
- **RN-019** IE do destinatário obrigatória quando `indIEDest=1`; isenta = 2; não contribuinte = 9.
- **RN-020** `vNF` = `vProd - vDesc + vFrete + vSeg + vOutro + vII + vIPI + vICMSST + vFCPST` (fórmula SEFAZ).

## Consulta (RN-030..040)
- **RN-030** Consulta por chave não altera dado local — só reflete SEFAZ.
- **RN-031** cStat=217 → nota "Não localizada"; pode ser autorização em andamento (aguardar 1min e reconsultar).
- **RN-035** Status serviço cStat=107 = disponível; ≠107 alimenta circuit breaker.
- **RN-040** Download XML só para empresas do usuário; signed URL máx. 10min.

## Importação (RN-050..058)
- **RN-050** Dedupe por `(empresa_id, chave_acesso)`.
- **RN-051** XML deve ter assinatura válida (defensivo); falha bloqueia import.
- **RN-052** Fornecedor não cadastrado → sugere cadastro rápido (não bloqueia).
- **RN-053** Produto não cadastrado → sugere cadastro rápido; item fica com `produto_id=null` até resolução.
- **RN-054** Import de nota já cancelada exige confirmação.
- **RN-055** Import ZIP > 500 arquivos vai obrigatoriamente para fila.
- **RN-058** Tradução de campos fiscais para nomenclatura ERP via `mem/features/traducao-xml-fiscal.md`.

## Manifestação (RN-070..078)
- **RN-070** Ciência: até 180d após ciência da existência; obrigatório antes de outros eventos.
- **RN-071** Confirmação: até 180d.
- **RN-072** Desconhecimento: até 10d após autorização.
- **RN-073** Operação não realizada: até 180d; exige justificativa 15..255 chars.
- **RN-075** Sequência única por tipo de evento por chave.
- **RN-078** Manifestação em nota já cancelada rejeita cStat 573.

## Cancelamento (RN-080..086)
- **RN-080** Prazo 24h após `dhRecbto` da autorização.
- **RN-081** Justificativa 15..255 chars.
- **RN-082** Não cancelar nota com evento CT-e/MDF-e vinculado (regra SEFAZ, cStat 574).
- **RN-083** cStat=135 → autorizado.
- **RN-084** cStat=155 → fora prazo; bloqueia.
- **RN-085** Cancelamento fiscal ≠ cancelamento de pedido no ERP.
- **RN-086** Cancelamento estorna estoque; estorna financeiro se lançamentos ainda não baixados.

## CCe (RN-090..096)
- **RN-090** Só correção de campos permitidos (correção formal, sem impacto tributário).
- **RN-091** Texto 15..1000 chars.
- **RN-092** `nSeqEvento` incremental 1..20 por chave.
- **RN-093** cStat=135 → aceita.
- **RN-094** Máximo 20 CCe por chave (regra SEFAZ).
- **RN-095** Não corrigir: valores, CFOP, CST, emitente, destinatário, data emissão/saída, itens.
- **RN-096** CCe reflete no PDF DANFE (obrigação de reimprimir).

## Inutilização (RN-100..104)
- **RN-100** Faixa contínua na mesma série/ano.
- **RN-101** Nenhum número da faixa pode ter sido emitido.
- **RN-102** Prazo até 30d após final do mês; após, exige justificativa admin.
- **RN-103** cStat=102 → inutilizado.
- **RN-104** Registro em `inutilizacoes_numeracao` com UNIQUE evita duplicidade.

## DistDFe (RN-110..120)
- **RN-110** NSU monotônico crescente por (empresa, ambiente).
- **RN-111** Reset de NSU exige intervenção admin (drop cascade — cuidado fiscal).
- **RN-112** cStat=137 → nada mais para retornar; agenda próximo poll em 30min.
- **RN-113** cStat=656 (consumo indevido) → intervalo mínimo 60min; log warn.
- **RN-114** Documentos recebidos ficam em `nfe_distribuicao` mesmo sem manifestação.
- **RN-115** DFe é read-only; alterações só via manifestação.
- **RN-116** Auto-ciência (`sync_auto_ciencia=true`) enfileira ciência mas nunca confirmação/desconhecimento (decisão comercial).
- **RN-120** Retenção mínima DFe: 5 anos.

## Consulta cadastro (RN-130)
- **RN-130** UFs que não suportam: AM, DF, ES, PI, RN (verificar tabela SEFAZ vigente). Retorna erro amigável.

## Status serviço (RN-140)
- **RN-140** cStat=107 fecha breaker; ≠107 mantém aberto e agenda próximo poll.

## Certificado (RN-150..158)
- **RN-150** Só A1 em v1; A3 fora do escopo.
- **RN-151** Validade máxima 12m (padrão AC).
- **RN-152** Alerta 30d → info; 7d → warn; expirado → crit.
- **RN-153** Upload substitui `.pfx` vigente; senha vai para Vault (`CERTIFICADO_PFX_SENHA__{empresaId}`).
- **RN-154** Parse com leaf-detection (múltiplos certs na cadeia).
- **RN-155** CNPJ do certificado deve casar com CNPJ da empresa; divergência bloqueia upload.
- **RN-156** Certificado expirado bloqueia emissão; consulta continua permitida.
- **RN-157** Remoção exige confirmação; auditada.
- **RN-158** Cache in-memory por invocação — nunca persiste em disco.

## Configuração fiscal (RN-160..166)
- **RN-160** Ambiente sem default; sempre explícito.
- **RN-161** CRT alterável só por `fiscal:admin` + confirmação (afeta tributação).
- **RN-162** Série alterável; próximo `nNF` calculado da sequence.
- **RN-163** Alteração de CNPJ da empresa dispara: invalida certificado, invalida numeração, exige re-onboarding.
- **RN-164** Timeouts editáveis (min 5s, max 120s).
- **RN-165** `sync_auto_ciencia` opt-in explícito.
- **RN-166** Uma linha `fiscal_runtime_config` por empresa + linha default `empresa_id IS NULL`.

## Auditoria (RN-170..175)
- **RN-170** Append-only; trigger bloqueia UPDATE/DELETE.
- **RN-171** Retenção 5 anos (Ajuste SINIEF 07/05).
- **RN-172** XML nunca completo; hash SHA-256 + tamanho.
- **RN-173** CNPJ/CPF completo permitido em auditoria (contexto legal).
- **RN-174** Leitura restrita a `fiscal:auditoria`/`fiscal:admin`.
- **RN-175** Correlation-id obrigatório em toda entrada.

## Monitoramento (RN-180..185)
- **RN-180** Métricas emitidas para toda operação fiscal.
- **RN-181** Alertas deduplicam por (tipo, empresa, 1h).
- **RN-182** Silenciar alerta exige registro do motivo.
- **RN-183** SEFAZ down > 60min gera alerta crítico.
- **RN-184** Rejeição em massa (> 10 em 5min) alerta admin.
- **RN-185** Certificado alerta é diário até renovação.

## Retry (RN-190..196)
- **RN-190** Backoff exponencial `min(60·2^n, 3600) + jitter(0..30)`s.
- **RN-191** Máximo 10 tentativas.
- **RN-192** Rejeições de negócio não retry.
- **RN-193** Timeout/5xx retry.
- **RN-194** Correlation-id preservado entre tentativas.
- **RN-195** Manual `forcarRetry=true` reseta contador (log warn).
- **RN-196** Após esgotamento, envia para arquivo (`pgmq.archive`) — investigação manual.

## Contingência (RN-200..210)
- **RN-200** Ativação exige `fiscal:admin` — nunca automática.
- **RN-201** Encerramento também manual.
- **RN-202** Modos v1.1: SVC-AN, SVC-RS.
- **RN-203** Notas em contingência marcadas `tpEmis` correspondente (2,3,4,7,9).
- **RN-204** SVC-AN só para NFe modelo 55.
- **RN-205** Transmissão diferida NFC-e (v2) tem prazo 24h.
- **RN-210** Regularização de contingência: obrigatória em 24h.

## Exportação (RN-220..224)
- **RN-220** Signed URL max 10min.
- **RN-221** Zip lote via fila; notificação ao concluir.
- **RN-222** Auditar exportação em massa.
- **RN-224** Exportação contábil ≥ 1 ano de dados vai obrigatoriamente para fila.

## Validação (RN-230)
- **RN-230** XSD ausente ≠ erro — devolve `schemasDisponiveis:false` + valida por regras.

## Assinatura standalone (RN-240)
- **RN-240** Não altera estado; útil para reassinatura pós-manipulação (raro; auditar).

## Endpoints (RN-250)
- **RN-250** Alteração de endpoint auditada + notifica admins da empresa.

## Schemas PL (RN-260)
- **RN-260** Vigência não sobrepõe para (documento, versao_pl); alteração exige janela sem emissão (~5min).

## Notificações (RN-270)
- **RN-270** Dedup 1h por (tipo, empresa, entidade).

## Webhooks (RN-280..285)
- **RN-280** HMAC-SHA256 assinatura obrigatória.
- **RN-281** Retry 5x com backoff em 2xx.
- **RN-282** Timeout 10s.
- **RN-283** Falha persistente marca webhook `suspenso` e notifica.
- **RN-285** Assinatura por segredo por webhook (rotacionável).

## SPED (RN-290..295)
- **RN-290** Geração por período (mês fechado).
- **RN-291** Validação por PVA externo (SPED gerado deve passar).
- **RN-292** Arquivo por empresa + período único.
- **RN-295** Retenção arquivo 5 anos.

## EFD-Reinf/eSocial (RN-300)
- **RN-300** REST + XMLDSig; contratos próprios (v3).

## Segurança transversal (RN-500..520)
- **RN-500** `empresa_id` nunca vem do body; sempre JWT.
- **RN-501** Erro nunca vaza stack ao cliente.
- **RN-502** XML/PFX nunca em log.
- **RN-503** Senha nunca em log ou resposta.
- **RN-504** CORS estrito por `ALLOWED_ORIGIN`.
- **RN-505** Rate limit por (empresa, action).
- **RN-506** Idempotency-Key obrigatório em API externa.
- **RN-507** RLS ativa em todas as tabelas `fiscal_*` e `notas_*`.
- **RN-508** `search_path=public` em todo RPC/trigger.
- **RN-509** Log mascarado (CNPJ/CPF parcial em info).
- **RN-510** Signed URL máx 10min.
- **RN-520** Trigger anti-tamper em `fiscal_auditoria` bloqueia UPDATE/DELETE.

## LGPD (RN-600..610)
- **RN-600** Base legal fiscal: obrigação legal.
- **RN-601** Eliminação de titular negada durante prazo legal.
- **RN-602** Anonimização após 5 anos via RPC.
- **RN-603** Exportação dados titular inclui NFs onde é destinatário.
- **RN-610** Acessos a dado pessoal fiscal auditados.

## Convenções de código (RN-900..910) — reforço
- **RN-900** Sem `console.*`.
- **RN-901** Sem `new Date()` em módulos fiscais (usar `runtime.clock`).
- **RN-902** Sem URL SEFAZ hardcoded.
- **RN-903** Sem `throw` para rejeição SEFAZ (usar `FiscalResult`).
- **RN-910** Toda nova tabela `public.fiscal_*` com GRANTs no mesmo migration.