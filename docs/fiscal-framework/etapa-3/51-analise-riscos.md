# 51 · Análise de riscos e mitigação

Escala: **Prob** = Baixa/Média/Alta · **Impacto** = Baixo/Médio/Alto/Crítico. Risco alto (P·I ≥ 6 numa escala 1-4×1-4) exige mitigação com data.

## Técnicos

| ID | Risco | P | I | Mitigação |
|----|-------|---|---|-----------|
| RT-01 | Deno rustls não fecha handshake mTLS com Ambiente Nacional | Alta | Crítico | Proxy externo mTLS (memória `sefaz-mtls-transporte`); adapter dedicado; monitorar disponibilidade do proxy |
| RT-02 | C14N própria diverge da spec em caso raro (namespace herdado) | Média | Alto | Golden tests cross-tools (comparar com C14N Java/libxml em fixtures); validar SEFAZ retornar 100 |
| RT-03 | Cold start edge > 500ms afeta UX | Média | Médio | Bundle pequeno; keep-warm cron ping; medir p95 |
| RT-04 | Bundle edge > limite (10MB) por dependências | Baixa | Alto | Tree-shaking; vitar libs pesadas; auditoria mensal |
| RT-05 | Timeout edge 60s incompatível com lote grande | Alta | Médio | Toda operação longa vai para fila |
| RT-06 | pgmq bug/perda de mensagem | Baixa | Alto | Auditoria em `fiscal_auditoria` como fonte da verdade; possível replay via SQL |
| RT-07 | Feature flag esquecida em produção | Média | Médio | Painel `/admin/flags`; auditoria de alteração; cleanup pós-corte |
| RT-08 | Migration com breaking change | Baixa | Crítico | Regra "add + backfill + drop" em migrations separadas com ≥ 1 release entre |

## Fiscais

| ID | Risco | P | I | Mitigação |
|----|-------|---|---|-----------|
| RF-01 | Nova NT SEFAZ (ex: NF-e 5.00) exige refactor rápido | Alta | Alto | Plugin por documento + `SignatureSuite` ágil + `fiscal_schemas_pl` versionado |
| RF-02 | UF muda URL de endpoint sem aviso | Alta | Médio | Endpoint registry declarativo — 1 UPDATE resolve, sem deploy |
| RF-03 | Cancelamento após 24h por erro do usuário | Média | Alto | UI destaca prazo restante; alerta ao aproximar; documentação clara |
| RF-04 | Certificado expira em produção durante fim de semana | Média | Crítico | Alerta 30d/7d/1d; e-mail para múltiplos admins; documentação de emergência |
| RF-05 | Emissão em ambiente errado (homologação → produção) | Baixa | Crítico | Ambiente sem default (ADR-001); badge visual sempre; UI exige confirmação em produção |
| RF-06 | Assinatura inválida por bug no signer | Baixa | Crítico | Round-trip test em CI; validação defensiva pré-envio; golden tests |
| RF-07 | Contingência ativada por engano | Baixa | Alto | Ativação manual admin (ADR-013); confirmação dupla |
| RF-08 | Numeração duplicada por race condition | Baixa | Crítico | Sequência atômica via RPC (padrão existente); UNIQUE constraint |
| RF-09 | Denegação por débito fiscal (cStat 110) inesperada | Média | Médio | Persistir + notificar; não repetir; orientar operador |
| RF-10 | Perda de XML autorizado | Baixa | Crítico | Storage com replicação Supabase; backup PITR; `caminho_xml` obrigatório antes de confirmar |

## Integração

| ID | Risco | P | I | Mitigação |
|----|-------|---|---|-----------|
| RI-01 | ERP move módulo compras e integração quebra | Média | Médio | Fachada estável; contratos versionados; testes de integração |
| RI-02 | Estoque baixa duas vezes (racing autorizações + retry) | Baixa | Alto | Idempotência via `notas_fiscais.chave_acesso` UNIQUE + estoque_movimentos com FK |
| RI-03 | Financeiro gera lançamento antes de nota autorizada | Baixa | Alto | Trigger `lancamento_pago_requer_baixa` + regra: só cria após `DocumentoAutorizado` |
| RI-04 | Import XML cria fornecedor duplicado | Média | Médio | Dedupe por CNPJ antes de sugerir cadastro rápido |
| RI-05 | DFe sync sobrescreve manifestação manual | Baixa | Alto | DFe é read-only para status manifestação; UNIQUE `(chave, tp_evento, nSeq)` protege eventos |

## Performance

| ID | Risco | P | I | Mitigação |
|----|-------|---|---|-----------|
| RP-01 | Serialização/assinatura lenta bloqueia UI | Média | Médio | Benchmarks CI; cert cache; alvos p95 < 1.5s |
| RP-02 | RLS overhead em `fiscal_auditoria` grande | Alta | Médio | Índices `(empresa_id, timestamp)`; particionamento mensal quando > 100k/mês |
| RP-03 | pgmq stalled com milhares de mensagens | Média | Alto | Cron intensivo + alerta lag; DLQ para envenenamento |
| RP-04 | Consulta cadastro SEFAZ lenta bloqueia autocomplete | Média | Baixo | Cache 24h; timeout 8s; opcional (não bloqueia cadastro) |
| RP-05 | DistDFe multi-empresa satura window edge 60s | Média | Alto | Paralelismo 1 por empresa (NSU sequencial); split por invocação |

## Segurança

| ID | Risco | P | I | Mitigação |
|----|-------|---|---|-----------|
| RS-01 | Vazamento de PFX via log/response | Baixa | Crítico | Sanitizador `_shared/sanitize.ts`; teste automático de vazamento |
| RS-02 | IDOR: usuário acessa nota de outra empresa | Baixa | Crítico | `empresa_id` do JWT (nunca body); RLS defense-in-depth; testes matriz |
| RS-03 | Tampering de auditoria | Baixa | Crítico | Trigger anti-tamper; RLS restrita |
| RS-04 | Certificate cross-tenant leak | Baixa | Crítico | Cache in-memory por invocação (não bundle); path prefix por empresa; teste |
| RS-05 | Vault comprometido | Baixa | Crítico | Rotação em incidente; auditoria de acesso; log de acesso Vault |
| RS-06 | Rate limit contornado | Média | Médio | Chave por (empresa, action); 429 com Retry-After; alerta em burst |
| RS-07 | XXE em parse XML importado | Baixa | Alto | Parser configurado sem external entities; teste com payload malicioso |
| RS-08 | Chave API de contador vazada | Baixa | Alto | Hash bcrypt; expiração; escopos mínimos; rotação |

## Operacionais

| ID | Risco | P | I | Mitigação |
|----|-------|---|---|-----------|
| RO-01 | SEFAZ down > 24h sem contingência ativada | Média | Alto | Alerta crítico > 60min; procedimento operacional documentado |
| RO-02 | Cron não roda (agendador Supabase falha) | Baixa | Alto | `cron_health` heartbeat + alerta 15min sem heartbeat |
| RO-03 | Deploy quebra edge existente | Baixa | Alto | Feature flag `fiscal:v2:*` permite rollback sem redeploy |
| RO-04 | Operador cancela nota errada | Média | Médio | UI exige justificativa + confirmação; auditoria |
| RO-05 | Certificado expirado em produção sem alerta | Baixa | Crítico | Alerta multi-canal (in-app + e-mail); cron diário obrigatório |
| RO-06 | Perda de conhecimento (bus factor) | Alta | Médio | Documentação exaustiva (esta Etapa 3); ADRs; código lint-limpo |

## Regulatórios

| ID | Risco | P | I | Mitigação |
|----|-------|---|---|-----------|
| RR-01 | Multa por atraso em manifestação obrigatória | Média | Alto | Auto-ciência opt-in; alerta de prazo; auditoria |
| RR-02 | Não retenção de XML por 5 anos | Baixa | Crítico | Storage + `caminho_xml` obrigatório; backup PITR |
| RR-03 | Não conformidade LGPD (eliminação) | Média | Alto | Base legal documentada; anonimização programada; resposta padronizada |
| RR-04 | Alteração legislativa (ex: NF-e obrigatória para MEI) | Baixa | Médio | Config por empresa (CRT); comunicação ativa a usuários |
| RR-05 | eSocial/EFD-Reinf com prazo apertado | Baixa | Alto | v3 no roadmap; contrato genérico já preparado |
| RR-06 | Layout NFC-e por UF (cada UF define credenciamento próprio) | Média | Médio | Módulo NFC-e por UF na v2 |

## Riscos aceitos (com justificativa)

| ID | Aceito porque |
|----|---------------|
| RT-03 | Volume baixo torna cold start ocasional aceitável |
| RT-05 | Fila cobre; UX melhor com resposta rápida + polling |
| RS-07 | Baixa probabilidade; parser configurado |
| RR-04 | Impacto médio; adaptação por config |

## Plano de contingência (organizacional)

- **Runbook** por incidente crítico (RF-04, RO-01, RO-05) documentado em `docs/runbooks/fiscal/` (backlog).
- **On-call** informal em MVP; formalizado quando > 5 empresas.
- **Post-mortem** obrigatório em incidente > 30min de indisponibilidade fiscal.
- **Retro trimestral** de riscos: revisar probabilidade/impacto e adicionar novos.

## Métricas de saúde do plano

- **MTTR fiscal**: mediana < 30min (v1 target).
- **Erros críticos/mês**: < 1 em v1.
- **Tempo até fix após incidente**: < 24h.
- **Cobertura de mitigação**: 100% dos riscos P·I ≥ 6 têm mitigação com dono.