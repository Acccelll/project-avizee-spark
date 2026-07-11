# Risk Register — Conciliação Financeira

Catálogo oficial de riscos. Atualizado a cada Sprint pelo Tech Lead; revisado pelo Arquiteto e CQO.

## Dimensões

- Categoria: Técnico · Arquitetural · Financeiro · Operacional · Segurança · Regulatório · UX.
- Impacto: Baixo / Médio / Alto / Crítico.
- Probabilidade: Baixa / Média / Alta.
- Status: Aberto / Mitigado / Aceito / Encerrado.

## Estrutura por Risco

```text
- ID: RK-XXXX
- Título:
- Categoria:
- Descrição:
- Impacto:
- Probabilidade:
- Exposição (Impacto × Probabilidade):
- Mitigação:
- Plano de contingência:
- Responsável:
- Data de identificação:
- Última revisão:
- Status:
- Referências (Sprint, ADR, PR):
```

## Riscos Iniciais

- **RK-0001** · Fila de Outbox saturada · Operacional · Alto · Baixa · Mitigação: alerta + auto-scale · Contingência: replay manual · Status: Aberto.
- **RK-0002** · Divergência de saldo por não idempotência · Financeiro · Crítico · Baixa · Mitigação: `operation_id` + invariantes testadas · Contingência: reprocessamento a partir de snapshot · Status: Mitigado.
- **RK-0003** · Regra mal versionada · Arquitetural · Alto · Média · Mitigação: versionamento obrigatório + simulação · Contingência: rollback de regra · Status: Aberto.
- **RK-0004** · Layout bancário novo não suportado · Técnico · Médio · Média · Mitigação: catálogo de contratos + testes · Contingência: feature flag por banco · Status: Aberto.
- **RK-0005** · Volumes > 10M · Performance · Médio · Baixa · Mitigação: particionamento planejado · Contingência: batch off-hours · Status: Aceito.
- **RK-0006** · Observabilidade de negócio parcial · Operacional · Médio · Média · Mitigação: painel P2 · Contingência: consultas ad-hoc · Status: Aberto.
- **RK-0007** · Corrupção de hash-chain · Segurança · Crítico · Baixa · Mitigação: verificador agendado · Contingência: rebuild controlado com auditoria · Status: Mitigado.

## Fluxo

Novo risco → Sprint Journal → registro aqui → revisão pelo Arquiteto → revisão trimestral pelo CQO → encerramento com evidência.
