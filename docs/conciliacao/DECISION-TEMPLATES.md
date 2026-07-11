# Decision Templates

Templates reutilizáveis para o ciclo de vida das decisões arquiteturais.

## 1. Nova Decisão

```text
- ID: MD-XXXX
- Título:
- Categoria:
- Status: Proposta
- Data:
- Responsável:
- Problema:
- Alternativas avaliadas:
- Decisão:
- Justificativa:
- Trade-offs:
- Benefícios:
- Limitações:
- Impactos (módulos, componentes, banco, APIs, eventos, testes, docs):
- Dependências:
- Riscos:
- ADR relacionado:
- Documentos relacionados:
- Plano de revisão:
- Aprovadores: Arquiteto ___ · CTO ___
```

## 2. Revisão

```text
- Decisão: MD-XXXX
- Data da revisão:
- Motivo:
- Situação atual:
- Evidências:
- Resultado: Mantida / Ajustada / Substituída
- Notas:
- Aprovadores:
```

## 3. Revogação

```text
- Decisão: MD-XXXX
- Data:
- Motivo:
- Impactos da revogação:
- Migração/rollback:
- Decisão substituta (opcional):
- Aprovadores:
```

## 4. Substituição

```text
- Decisão original: MD-XXXX
- Nova decisão: MD-YYYY
- Motivo:
- Plano de transição:
- Data efetiva:
- Aprovadores:
```

## 5. Conflito

```text
- Decisões conflitantes: MD-XXXX vs MD-YYYY
- Origem do conflito:
- Impacto:
- Proposta de resolução (documental):
- Responsável:
- Prazo:
```

## 6. Exceção Temporária

```text
- Decisão: MD-XXXX
- Escopo da exceção:
- Justificativa:
- Prazo máximo:
- Compensação/mitigação:
- Aprovadores:
- Data de revalidação:
```

## 7. Aprovação

```text
- Decisão: MD-XXXX
- Versão:
- Aprovadores: Arquiteto ___ · CTO ___ · CQO ___
- Data:
- Evidências anexadas:
- Comunicação realizada: sim/não
- Registro no CHANGE-HISTORY (categoria AR): sim/não
```
