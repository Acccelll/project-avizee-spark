# Etapa 12 — Compliance Fiscal Contínuo, Reforma Tributária e Evolução do Framework

## Objetivo

Transformar o Framework Fiscal do AVIZEE em uma plataforma preparada para
evoluir junto com a legislação brasileira: monitorar mudanças, versionar
layouts/regras/tributos, suportar a Reforma Tributária em coexistência com o
modelo atual e reduzir o custo de manutenção fiscal.

## Módulo criado

`src/modules/fiscal/compliance/` — Compliance Engine, com Clean Architecture:

```
compliance/
├─ domain/entities.ts               # NormaLegal, VersaoArtefato, TributoDefinicao, MudancaRegulatoria...
├─ application/
│  ├─ contracts.ts                  # Portas (IArtefatoRepository, ITributoRepository, ...)
│  ├─ versionamentoLegal.ts         # Registro/vigência de normas e artefatos (XML, XSD, WS, endpoints, SPED)
│  ├─ layoutRegistry.ts             # Registry centralizado com coexistência de versões
│  ├─ tributoRegistry.ts            # Registry de tributos parametrizados
│  ├─ reformaTributaria.ts          # Coexistência IBS/CBS/IS com ICMS/IPI/PIS/COFINS/ISS
│  ├─ motorTributarioAbstrato.ts    # Motor plugável por calculador — sem hard-code por tributo
│  ├─ compatibilidadeEngine.ts      # Alertas de versão/certificado/endpoint
│  ├─ governancaConfiguracoes.ts    # Versionamento, aprovação, rollback e diff de configs
│  ├─ monitorRegulatorio.ts         # Mudanças regulatórias, pendências, status por módulo
│  ├─ centroAtualizacoes.ts         # Catálogo administrativo com pré-validação obrigatória
│  ├─ migracaoStrategy.ts           # Runner com rollback automático
│  ├─ observabilidadeRegulatoria.ts # Indicadores para dashboards
│  ├─ testesCompatibilidade.ts      # Suíte reutilizável multi-empresa
│  ├─ roadmap.ts                    # Roadmap padrão (NFC-e, CT-e, MDF-e, NFS-e, BP-e, NF3-e, SPED, Reinf, eSocial, Reforma)
│  └─ events.ts                     # Nomes `fiscal.compliance.*`
├─ infrastructure/inMemoryRepositories.ts
└─ __tests__/compliance.test.ts
```

## Diretrizes preservadas

- **Configuração antes de customização**: nenhum tributo, alíquota ou layout é hard-coded — tudo passa pelos registries versionados.
- **Coexistência tributária**: modelo atual e Reforma Tributária vigem juntos (`ContextoTransicao.modo = 'coexistencia'`) sem substituição forçada.
- **Compatibilidade retroativa**: NF-e/eventos/recebimento/escrituração existentes continuam funcionando; o Compliance Engine adiciona uma camada superior.
- **Rollback seguro**: `GovernancaConfiguracoesService.rollback` e `MigracaoRunner` revertem passos aplicados quando um erro ocorre no meio de uma migração.
- **Observabilidade**: `ObservabilidadeRegulatoriaService` fornece agregados para dashboards regulatórios.

## Eventos publicados

Prefixo `fiscal.compliance.*` — registrados em `FiscalEventBus`:
`norma.registrada`, `artefato.versionado`, `tributo.registrado`,
`configuracao.versionada`, `mudanca.registrada`, `mudanca.status_atualizado`,
`alerta.emitido`, `migracao.aplicada`, `migracao.revertida`,
`roadmap.atualizado`.

## Restrições cumpridas

- Não remove suporte aos tributos atuais.
- Não altera APIs públicas existentes; adiciona novas.
- Não substitui as regras atuais pelas da Reforma — apenas prepara a coexistência.
- Não quebra empresas já configuradas.

## Roadmap padrão

`ROADMAP_PADRAO` documenta NFC-e, CT-e, MDF-e, NFS-e, BP-e, NF3-e, SPED
completo, EFD-Reinf, eSocial e Reforma Tributária com dependências e prioridades.
