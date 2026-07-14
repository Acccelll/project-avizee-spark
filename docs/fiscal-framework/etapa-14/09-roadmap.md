# 09 — Roadmap Técnico de Evolução

Fonte de verdade programática: `src/modules/fiscal/compliance/application/roadmap.ts` (`ROADMAP_PADRAO`).

## Documentos fiscais
| Item | Prioridade | Dependências | Impacto | Complexidade |
|------|-----------|--------------|---------|--------------|
| NFC-e | Alta | NF-e | Alto | Média |
| CT-e | Alta | NF-e | Alto | Alta |
| MDF-e | Média | NF-e, CT-e | Médio | Média |
| NFS-e (padrão nacional) | Alta | — | Alto | Alta |
| BP-e | Baixa | NF-e | Baixo | Média |
| NF3-e | Baixa | NF-e | Baixo | Média |

## Obrigações acessórias
| Item | Prioridade | Dependências | Complexidade |
|------|-----------|--------------|--------------|
| SPED Fiscal (EFD ICMS/IPI) completo | Crítica | Escrituração | Alta |
| SPED Contribuições | Alta | Escrituração | Alta |
| EFD-Reinf | Alta | SPED | Média |
| eSocial | Alta | — | Alta |

## Reforma Tributária
| Item | Prioridade | Complexidade |
|------|-----------|--------------|
| IBS | Crítica | Alta |
| CBS | Crítica | Alta |
| Imposto Seletivo | Alta | Média |
| Período de transição (coexistência) | Crítica | Alta |

## Inteligência
| Item | Prioridade | Dependências | Complexidade |
|------|-----------|--------------|--------------|
| IA para classificação fiscal (NCM/CFOP/CST) | Alta | Escrituração, Recebimento | Alta |
| Conciliação automática (matching bancário/fiscal) | Alta | Recebimento, Financeiro | Média |
| Detecção de inconsistências (anomalias) | Média | Escrituração | Alta |
| Recomendações tributárias | Média | Compliance | Alta |
