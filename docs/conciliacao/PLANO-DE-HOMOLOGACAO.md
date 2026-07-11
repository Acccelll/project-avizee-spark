# PLANO DE HOMOLOGAÇÃO

Validação, homologação, implantação e critérios para produção.

## Camadas de Homologação

### 1. Técnica (SRE / Tech Lead)
Verifica:
- Testes unit/integração/E2E verdes em CI.
- Benchmarks dentro da meta (Parte 23 do TO-BE).
- RLS+GRANT auditados por role.
- Logger + métricas + tracing operando.
- Cadeia hash do ledger íntegra.
- Feature flags configuradas.
- Rollback validado (flag off; RPC v1 disponível se aplicável).
Critério: **checklist técnico 100%**.

### 2. Funcional (Product Owner Financeiro)
Roteiro guiado por 3 dias em ambiente de homologação (dados anonimizados de produção):
- Importar OFX → normalizar → sugestões → aprovar → baixa → auditoria.
- Reimportar mesmo arquivo → aviso.
- CONFLITO → resolver via comparador.
- Estorno → confirma reabertura de workflow.
- Fechar período → tentativa retroativa bloqueada.
- Reabrir com N-olhos.
- Criar/editar regra com simulador.
Critério: **0 bug crítico + PO assina termo de aprovação**.

### 3. Financeira (Controller / Contabilidade)
Verifica:
- Saldos e razão contábil coincidem com dataset canônico.
- Trilha exportável para auditoria fiscal.
- Fechamento gera snapshot íntegro.
- LGPD: mascaramento por role validado.
Critério: **Controller aprova formalmente**.

### 4. Testes Exploratórios
- Sessões de exploração livre por revisor experiente.
- Objetivo: encontrar cenários não previstos.
- Duração mínima: 4 horas por release grande.
- Resultado: bugs classificados P0..P3.

### 5. Testes de Regressão
- Suite E2E completa executada.
- Dataset canônico byte-a-byte.
- Comparação de KPIs baseline × pós-release.
Critério: **zero regressão**.

## Ambientes

- **dev**: sandbox individual.
- **CI**: pipeline por PR.
- **staging**: espelho de produção; dados anonimizados; feature flags conforme piloto.
- **homologação**: subset de staging dedicado à validação com PO/Controller.
- **produção**: rollout gradual por empresa.

## Critérios para Produção (por release)

Uma release só entra em produção quando:
- [ ] Homologação técnica aprovada
- [ ] Homologação funcional aprovada
- [ ] Homologação financeira aprovada
- [ ] Testes de regressão sem falha
- [ ] Benchmarks OK
- [ ] Rollback testado em staging
- [ ] Runbooks publicados
- [ ] Comunicação à operação enviada
- [ ] Feature flag configurada e revisada
- [ ] Plano de contingência aprovado

## Plano de Implantação

### Ordem
1. Deploy em staging → smoke tests → homologação.
2. Deploy em produção com flag **off** para todas as empresas.
3. Ativar flag para **empresa piloto** (baixo volume, engajada).
4. Monitorar 7 dias sem P0/P1.
5. Expandir para 3 empresas → 10 → 30 → 100%.
6. Em cada wave: consistência diária + KPIs + feedback.

### Janelas
- Deploy: horário não-crítico (fora do fechamento contábil).
- Ativação por empresa: início do expediente, com equipe de suporte a postos.

### Monitoramento
- Alertas P0: fila > X, erro > Y%, cadeia ledger inválida, RPC timeout > Z, divergência de consistência.
- Painel SRE em tempo real por 7 dias após cada wave.
- Painel Controller (KPIs de negócio) durante todo o rollout.

### Contingência
- Alerta P0 → pausa expansão + investigação imediata.
- Bug financeiro em produção → flag off na(s) empresa(s) afetada(s) → RCA em 48h.
- Regressão sistêmica → flag off global; RPC v1 assume; PR revert.

## Critérios para Fim do Projeto

- 100% das empresas em v2.
- 30 dias sem P0/P1.
- Métricas do TO-BE (Parte 23) sustentadas.
- Código v1 removido do repositório.
- Documentação viva atualizada.
- Aprovação executiva final registrada.

## Registros obrigatórios

- Termo de aprovação por camada (técnica/funcional/financeira) por release.
- Ata de rollout por empresa em `HISTORICO-EXECUCAO.md`.
- Ata de incidente (se houver) com RCA e ação corretiva.
- Changelog do módulo por release.
