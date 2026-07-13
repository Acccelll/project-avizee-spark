# 35 · Roadmap arquitetural

Ordem oficial das próximas etapas de implementação. Cada etapa pode ser
detalhada em novo prompt/planning quando iniciada.

## Etapa 3 · Fundações
**Objetivo**: colocar de pé Foundation + Engines mínimos + Cross essencial, sem tocar em fluxo produtivo.
- Estruturar `src/fiscal-framework/{core,engines,cross}`.
- Criar `IFiscalClock`, `IXmlCanonicalizer`, `IXmlSigner`, `ISignatureValidator`, VOs.
- Portar `xml-c14n` para dentro do framework (mantendo helper legacy compat).
- Migração `fiscal_endpoints` + seed inicial (autorizadores próprios + SVAN/SVRS + AN).
- Migração `fiscal_auditoria` + trigger anti-tamper.
- Migração `fiscal_runtime_config` com linha default.
- Testes unitários de core + engines em `src/fiscal-framework/**/*.test.ts`.

**Nada roda em produção ainda.** Toda a nova base é lib-only.

## Etapa 4 · Autorização NF-e sob flag
**Objetivo**: primeira operação real usando o novo framework, coexistindo com atual.
- Edge `fiscal-nfe` com action `autorizar` + `consultar-chave` + `status-servico`.
- `fiscal-module-nfe` completo (serialize/sign/validate/enviar/parse).
- Fachada `src/services/fiscal/emitir.ts` — flag `fiscal:v2:autorizacao` decide entre edge nova e `sefaz-proxy` antigo.
- Auditoria escrita em `fiscal_auditoria`.
- Métricas mínimas em `fiscal_telemetria`.
- Corte por empresa (flag por tenant quando multi-tenant chegar; single-tenant liga geral).

## Etapa 5 · Eventos sob flag
- `fiscal-events` com cancelar / carta-correcao / inutilizar / manifestar.
- `fiscal-module-eventos`.
- Flags `fiscal:v2:cancelamento`, `:cce`, `:inutilizacao`, `:manifestacao`.
- Testes E2E em homologação.

## Etapa 6 · DF-e nova geração
- Edge `fiscal-dfe` substitui `sefaz-distdfe`.
- `fiscal-module-dfe`.
- Cron `fiscal-cron` drena `fiscal.dfe.sync` (substitui `process-distdfe-cron`).
- Flag `fiscal:v2:distdfe`.

## Etapa 7 · Retry / contingência / observabilidade
- Filas `fiscal.retry.*` operacionais.
- Cron consome retry (substitui `process-nfe-retry-cron`).
- `fiscal-circuit-breaker` implementado.
- `fiscal-contingency-manager` (sugestão, não ativação automática).
- Dashboards `/admin/fiscal/health`.
- Alertas do doc 32 v1.

## Etapa 8 · Certificado
- Edge `fiscal-cert` substitui `sefaz-proxy action=parse/upload`.
- Alerta 30d/7d/expirado.
- Modelo preparado para multi-empresa (mesmo em single-tenant vigente).

## Etapa 9 · Depreciação legacy
- Congelar `sefaz-proxy`, `sefaz-distdfe`, `process-nfe-retry-cron`, `process-distdfe-cron`.
- Remover código legacy após 60 dias sem uso.
- ADR de fechamento da migração.

## Etapa 10 · Multi-empresa
- `empresa_id` derivado do JWT em todas as edges.
- Certificado por empresa (storage + Vault prefixados).
- Numeração por empresa.
- Testes de isolamento.

## Etapa 11 · Multi-filial (v2)
- `filial_id` opcional em `notas_fiscais` + derivados.
- `series_numeracao` por (empresa, filial).

## Etapa 12 · NFC-e
- `fiscal-module-nfce` (65).
- Contingência offline com transmissão diferida.
- CSC no Vault.

## Etapa 13 · CT-e / MDF-e
- Módulos plugáveis, endpoints via `fiscal_endpoints`.

## Etapa 14 · NFS-e nacional + top 20 municípios
- Padrão ABRASF primeiro.
- Adapters por município conforme demanda.

## Etapa 15 · SPED Fiscal + Contribuições
- Módulo `fiscal-module-sped` gera TXT.

## Etapa 16 · EFD-Reinf + eSocial
- Transport REST novo.
- Contrato `IFiscalEventModule` novo.

## Regras do roadmap

1. Nenhuma etapa começa sem ADR aprovado (quando envolve decisão).
2. Nenhuma etapa entra em produção sem coexistência de 30 dias com legacy (quando aplicável).
3. Feature flag por operação.
4. Rollback preparado em toda etapa.
5. Documentação atualizada **antes** do deploy final da etapa.
6. Testes E2E em homologação antes de produção.

## O que NÃO está no roadmap (por design)

- Web UI para configuração de `fiscal_endpoints` — usar SQL admin (baixa frequência).
- Interface para editar XSD — arquivo estático versionado.
- Migração para outro banco.
- Framework em outra linguagem.

Alterações no roadmap exigem novo ADR e atualização deste documento.