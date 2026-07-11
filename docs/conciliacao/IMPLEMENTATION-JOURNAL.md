# Implementation Journal — Conciliação Financeira

> Etapa 12 — Memória técnica oficial do projeto. Fonte única de rastreabilidade histórica; toda alteração deve ser registrada aqui.

## Parte 1 — Estrutura Geral

Hierarquia:
```text
Release → Epic → Sprint → Feature/Hotfix/Correção/Refatoração/Ajuste/Melhoria/Mudança de Requisito
```

| Nível              | Quando usar                                                 |
| ------------------ | ----------------------------------------------------------- |
| Release            | Entrega versionada (`vMAJOR.MINOR.PATCH`).                  |
| Epic               | Conjunto coerente de features (ex.: “Matching v2”).         |
| Sprint             | Janela de execução; sempre registrada.                      |
| Feature            | Funcionalidade nova.                                        |
| Hotfix             | Correção urgente em produção.                               |
| Correção           | Bug não urgente.                                            |
| Refatoração        | Alteração sem mudança funcional.                            |
| Ajuste arquitetural| Impacta ADR.                                                |
| Melhoria técnica   | Débito técnico endereçado.                                  |
| Mudança de requisito| Alteração de escopo, com aprovação do PO.                  |

## Estrutura de Diretórios (lógica)

```text
docs/conciliacao/journal/
  releases/
    v1.0.0/README.md
  epics/
    matching-v2/README.md
  sprints/
    2026-W02-fundacao/README.md
  features/
    FT-0001-import-ofx/README.md
  hotfixes/
    HF-0001-outbox-lag/README.md
  changes/
    2026-01-15-refactor-workbench.md
```
Todo registro segue os templates: `SPRINT-JOURNAL-TEMPLATE.md`, `FEATURE-IMPLEMENTATION-TEMPLATE.md`, `CHANGE-HISTORY.md`.

## Regras de Atualização

- Registrar no ato da conclusão do item (nunca retroativamente sem justificativa).
- Um item = um arquivo Markdown.
- Referenciar Blueprint, ADR, Sprint e Feature relacionados.
- Anexar evidências (relatórios/testes/prints).
- Nada sem rastreabilidade: cada registro liga-se a Requisito → Domínio → Arquivos → Testes → Docs.

## Partes 2–16 — Padrões de Registro

Detalhados nos templates deste diretório. Resumo:

- **Sprint (Parte 2):** ver `SPRINT-JOURNAL-TEMPLATE.md`.
- **Feature (Parte 3):** ver `FEATURE-IMPLEMENTATION-TEMPLATE.md`.
- **Alterações (Parte 4):** ver `CHANGE-HISTORY.md`.
- **Decisões (Parte 5):** ADRs no repositório + link no Journal.
- **Problemas (Parte 6):** seção "Problemas" no registro da Sprint + arquivo dedicado quando P0/P1.
- **Riscos (Parte 7):** `RISK-REGISTER.md`.
- **Débito Técnico (Parte 8):** `TECHNICAL-DEBT-REGISTER.md`.
- **Testes (Parte 9):** subseção do Sprint Journal.
- **Financeiro (Parte 10):** subseção dedicada em Sprint e Feature (mudanças em regras, workflow, matching, baixa, auditoria, impacto e validações).
- **Performance (Parte 11):** benchmarks anexados como evidência.
- **Segurança (Parte 12):** subseção dedicada (permissões, RLS, LGPD, incidentes).
- **Documentação (Parte 13):** cada atualização de doc entra no `CHANGE-HISTORY.md`.
- **Qualidade (Parte 14):** cópia do Scorecard e parecer do Gate anexados.
- **Regressões (Parte 15):** registro obrigatório + teste novo criado.
- **Melhorias Futuras (Parte 16):** entram no `TECHNICAL-DEBT-REGISTER.md` (categoria "melhoria").

## Parte 17 — Templates

Sprint · Feature · Hotfix · Refatoração · Bug · Problema · Decisão · Teste · Rollback · Risco · Documentação — presentes ou referenciados nos arquivos desta etapa.

## Parte 18 — Integração com a Governança

- **Execution Blueprint:** cada Feature aponta o item do Blueprint que executa.
- **DoR:** o registro só é criado depois de DoR aprovado.
- **Quality Gates:** parecer do Gate é anexado no registro.
- **ADRs:** decisões técnicas geram ADR e link recíproco.
- **Roadmap/Backlog:** ID do item de backlog obrigatório.
- **Auditoria Final:** consulta o Journal como evidência.
- **Master Decisions:** consolida decisões estratégicas com links para o Journal.
- **Traceability Matrix:** atualizada em conjunto.

## Parte 19 — Processo Operacional

| Quando registrar | Quem registra | Quem revisa | Quem aprova | Quando arquivar |
| ---------------- | ------------- | ----------- | ----------- | --------------- |
| Ao concluir Feature/Sprint/Hotfix | Desenvolvedor + Tech Lead | QA + Arquiteto | PO + CQO | Release fechada → mover para `releases/vX.Y.Z/` |

Versionamento por semver documental (`vMAJOR.MINOR`); consulta via índice em `docs/conciliacao/journal/README.md` (a ser criado quando o primeiro registro for adicionado).

## Parte 20 — Auditoria do Journal

Trimestral: consistência, completude, rastreabilidade, atualização, qualidade, docs faltantes, registros duplicados e pendências. Resultado alimenta o `READINESS-AUDIT.md`.

## Parte 21 — Automação (Claude / Lovable)

Ao final de cada Sprint, o agente deve:

- Coletar: diffs de código, migrations, RPCs, PRs, resultados de testes, scorecards, ADRs alterados, arquivos de doc atualizados, itens de backlog concluídos.
- Consultar: Blueprint, DoR aprovado, Quality Gates, TRACEABILITY, DOMAIN-IMPLEMENTATION-GUIDE.
- Evitar inconsistências: aplicar o `SPRINT-JOURNAL-TEMPLATE.md`, referenciar ID único, validar links.
- Validar histórico: rodar checklist de auditoria (Parte 20) e reportar divergências em vez de "corrigir sozinho".

## Parte 22 — Métricas do Journal

Registros completos vs. abertos · pendências por Sprint · tempo médio de atualização · cobertura documental (% Features com registro) · decisões registradas · débito técnico ativo · riscos abertos.

## Parte 23 — Validação Cruzada

Journal × Blueprint × Arquitetura × ADRs × Quality Gates × Backlog × Documentação × Código — divergências viram itens de auditoria.

## Parte 24 — Visão Executiva

- Memória técnica suficiente: **sim**, dado o cumprimento do processo.
- Reconstrução da implementação a partir do Journal: **sim** (rastreabilidade completa).
- Risco de perda de conhecimento: **baixo**, condicionado à disciplina de atualização.
- Melhorias futuras: automação plena via CI (bot que abre PR de registro), extração de métricas para o Quality Dashboard, integração com ADR viewer.
