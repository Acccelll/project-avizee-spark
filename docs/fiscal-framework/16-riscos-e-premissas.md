# 16 · Riscos, limitações e premissas

## Riscos técnicos

| # | Risco | Probabilidade | Impacto | Mitigação |
|---|-------|---------------|---------|-----------|
| R1 | Deno TLS não expõe todos os ciphers do .NET; SEFAZ estadual pode exigir cipher específico | Média | Alto | POC contra SEFAZ-SP hom antes de cortar; documentar cipher testado por autorizador |
| R2 | C14N/XMLDSig próprio em TS ter bug sutil não detectado | Média | Alto | Suíte de vetores conhecidos (framework .NET como oráculo); teste round-trip com XMLs de terceiros já assinados |
| R3 | Endpoint SEFAZ mudar novamente durante rollout | Alta | Médio | ADR-003 (registry); playbook de atualização em minutos |
| R4 | Bloqueio de IP da edge Supabase por SEFAZ (rate limit / geo) | Baixa | Alto | Documentar backoff longo para cStat 656; monitor 429/403 |
| R5 | Certificado A1 vencer sem alerta em produção | Média | Crítico | Cron diário + e-mail 30/15/7d; badge no dashboard |
| R6 | Rejeição em massa por erro de schema no XML gerado | Baixa | Crítico | Validação XSD obrigatória em produção; canary 1% antes do rollout |
| R7 | Perda de correlation-id em edge que reinvoca outra edge | Baixa | Médio | Header `x-correlation-id` propagado por convenção; teste de integração |
| R8 | pgmq indisponível → filas param | Baixa | Alto | Fallback in-memory 1 tentativa + alerta; retry manual via UI |
| R9 | LGPD: request de anonimização em NF cancelada | Média | Médio | RPC anonimiza `destinatario_*` somente fora do prazo de retenção; documentado |
| R10 | Multi-empresa introduzir cross-tenant leak via RLS mal escrita | Média | Crítico | Testes RLS obrigatórios por tabela; revisão dupla no PR |

## Limitações conhecidas

| Limitação | Origem | Impacto |
|-----------|--------|---------|
| Sem suporte A3/PKCS#11 | Deno edge não conecta token físico | Empresas com A3 ficam fora (documentar) |
| Sem contingência automática (EPEC/SVC) na v1 | Escopo | Emissão para se SEFAZ estadual cai por horas |
| NFS-e depende de adaptador por município | Padrão nacional adere ~30% dos municípios | Rollout gradual, prioridade por demanda |
| Latência edge cold start (~500ms) | Supabase runtime | Aceitável para operações fiscais (10s+ normal) |
| Bucket sem versionamento por arquivo | Storage Supabase | Upsert sobrescreve — histórico só via `fiscal_auditoria` |

## Premissas

1. **SEFAZ mantém SOAP 1.2** como padrão nos próximos 3 anos (não há sinal contrário).
2. **Perfil XMLDSig continua RSA-SHA1** até NT explícita (ADR-004 pronto para SHA-256).
3. **Certificado A1** é suficiente para 100% dos clientes AVIZEE atuais.
4. **Lovable Cloud** cobre Storage + Vault + pgmq + edge Deno para todo o ciclo fiscal.
5. **Volume esperado** < 10k NF-e/mês por empresa — dispensa infra dedicada.
6. **Multi-empresa Onda 1** será concluída antes ou em paralelo à v2 do framework fiscal.
7. **Migração é gradual**: nova camada coexiste com `sefaz-proxy`/`sefaz-distdfe`
   até validação em produção.
8. **Time tem 1 pessoa sênior full-time** para a construção — cronograma do
   backlog (doc 18) baseado nisso.

## Dependências externas

- SEFAZ (todos os autorizadores) — disponibilidade fora do nosso controle.
- ICP-Brasil (cadeia de certificados) — validação SEFAZ do lado servidor.
- Portal Nacional para XSDs do Pacote de Liberação vigente.
- Supabase (edge runtime + pgmq + storage + vault).

## Fora de escopo (Etapa 1)

- Levantamento de custo detalhado.
- Plano de treinamento de operadores.
- Contrato de SLA interno.
- Localização por município (NFS-e).