# PLANO DE TESTES — CONCILIAÇÃO

Estratégia de validação, homologação e critérios de aceite.

## Pirâmide de Testes

- Unitários (70%) — domínio puro: matching, regras, workflow, score, VOs.
- Integração (20%) — RPCs, adapters, repositórios, outbox worker, RLS.
- E2E (10%) — Playwright: fluxos completos usuário-final.

## Categorias

### 1. Unitários (domínio)
Alvo: cobertura ≥ 80% no core.
Casos obrigatórios:
- Matching: cada estratégia isoladamente + composição + score + empate CONFLITO.
- Regras: hierarquia, versão, vigência, conflito, simulação.
- Workflow: toda transição válida + toda transição inválida rejeitada.
- Score: soma dos pesos, decaimento por data, similaridade.
- VOs: Money (soma, subtração, comparação, moeda), Periodo (contém, sobreposição), Tolerancia.

### 2. Integração
- **RPCs**: `sp_conciliar` (feliz, idempotente por chave, rollback em falha, período fechado), `sp_estornar` (feliz, ledger encadeia), `sp_baixar_conciliacao` (atomicidade, saldo residual), `sp_fechar_periodo`, `sp_reabrir_periodo` (exige N-olhos).
- **Adapters**: OFX v2 multi-conta com fixtures reais anonimizadas; CNAB240/400; PIX (webhook + assinatura).
- **Repositórios**: filtros multi-tenant respeitando RLS; paginação por cursor.
- **Outbox worker**: entrega idempotente, retry com backoff, DLQ após N tentativas.
- **RLS**: usuário sem empresa correta nunca vê / escreve.
- **Ledger**: cadeia hash verificável; INSERT-only enforced.

### 3. End-to-End (Playwright)
Fluxos:
- Importar OFX → normalizar → sugestões geradas → revisor aprova → baixa efetivada → aparece no ledger.
- Reimportar mesmo arquivo → aviso, 0 duplicidade.
- Sugestão CONFLITO → comparador → revisor escolhe → auditoria mostra decisão.
- Estorno → ledger encadeia → workflow retorna a IN_REVIEW.
- Fechar período → tentativa de escrita retroativa bloqueada.
- Reabrir período com 1 aprovador (deve falhar) e com N (deve passar).
- SoD: importador tenta aprovar (deve falhar).
- Coexistência: empresa em v1 continua funcionando após v2 ativo em outra.

### 4. Performance
Benchmarks obrigatórios:
- Import 100k linhas ≤ 60s (p95).
- Matching 100k movimentos ≤ 120s (p95).
- Baixa unitária ≤ 500 ms (p95).
- Baixa batch 1k ≤ 5s.
- Dashboard KPIs ≤ 2s.

### 5. Carga e Estresse
- 10 empresas em paralelo importando 50k cada.
- Fila pgmq com 1M mensagens, N workers escalando.
- Verificar throughput linear e ausência de deadlocks.

### 6. Regressão Financeira
Dataset canônico versionado (`fixtures/reconciliation/canonical-v1.json`) com resultado esperado byte-a-byte para:
- Matching (candidatos + scores).
- Decisão (roteamento).
- Baixa (valores, saldos, ledger hash).
Qualquer divergência quebra o build.

### 7. Segurança
- Fuzz de RLS por role.
- Testes de autorização (`can()`) por endpoint/hook.
- Tentativas de UPDATE/DELETE em ledger e outbox (devem falhar).
- Tentativa de escrita em período CLOSED (deve falhar).
- Injeção via campos de descrição de regra (sanitização).
- Verificação de tampering: alterar 1 byte no ledger e provar detecção.

### 8. Adapters/Contrato
Cada adapter tem suite dedicada com fixtures reais anonimizadas cobrindo:
- Sucesso.
- Arquivo corrompido.
- Encoding inesperado.
- Múltiplas contas no mesmo arquivo.
- Datas em formatos alternativos.
- Valores negativos, zero, extremos.

## Ambientes

- **local**: unit + integração leves (SQLite/pg-mem quando aplicável).
- **CI**: unit + integração completos + E2E headless em Postgres real.
- **staging**: E2E full + performance + carga com dataset anonimizado de produção.
- **produção**: smoke tests pós-deploy + monitoramento contínuo.

## Critérios de Aceite Globais

Para cada feature:
- Todos os testes de sua categoria aprovados.
- Cobertura mínima atingida.
- Benchmark dentro da meta (quando aplicável).
- Trilha (ledger) verificada.
- Sem regressão no dataset canônico.
- Documentação e runbook atualizados.

## Homologação

- Ambiente de homologação com dados anonimizados de produção.
- Product Owner financeiro executa roteiro guiado por 3 dias.
- Bugs críticos = P0 → bloqueio de release.
- Aprovação formal antes de ativar flag em piloto.

## Definition of Done (testes)

Um item só é dado como DONE quando: pipeline verde em todas as camadas, benchmarks OK, dataset canônico OK, aprovação de code review, aprovação de homologação, feature flag configurada e rollback validado.
