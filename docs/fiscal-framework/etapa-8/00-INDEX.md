# Etapa 8 — Recebimento Fiscal, Importação de XML e Integração com o ERP

**Status:** ✅ Concluída  
**Local do código:** `src/modules/fiscal/recebimento/`

## Entregas

| Área | Arquivo |
|------|---------|
| Entidades | `domain/entities.ts` (`DocumentoRecebido`, `ParseResult`, `ConciliacaoResultado`, `Divergencia`) |
| Máquina de estados | `domain/stateMachine.ts` (11 estados: recebido→…→integrado/rejeitado/arquivado) |
| Validação | `domain/validation.ts` (tipo, chave, CNPJ dest, valores, itens) |
| Parser universal | `infrastructure/parser/universalParser.ts` — plugins NF-e/NFC-e/CT-e/MDF-e/NFS-e/Eventos/Protocolos, `registerParser()` extensível |
| Hash / dedup | `infrastructure/hash/xmlHash.ts` — SHA-256 sobre XML normalizado |
| Contratos | `application/contracts.ts` (Repository, Storage, CadastroLookup, Compras/Estoque/Financeiro, Auditoria) |
| Importar XML | `application/importarXml.ts` — parse → hash → dedup → validar → Storage → persistir |
| Importar Lote | `application/importarLote.ts` — concorrência configurável, progresso a cada 25 docs |
| Conciliação | `application/conciliacao.ts` — fornecedor/pedido/produtos/CFOP/NCM/valores |
| Workflow | `application/workflow.ts` — pendente_aprovacao / aprovar / rejeitar / reprocessar |
| Monitor | `application/monitor.ts` — snapshot agregado para dashboards |
| Eventos | `application/events.ts` + 15 novos nomes no `FiscalEventName` |
| Testes | `__tests__/recebimento.test.ts` — 14 cenários |

## Deduplicação

Duas chaves de idempotência:
1. `hashXml` (SHA-256 do XML normalizado) — captura reimports do mesmo arquivo.
2. `chaveAcesso` (44 dígitos) — captura reimports do mesmo documento via
   fontes diferentes (upload manual + DF-e).

Documentos duplicados retornam o registro existente com `duplicado: true`
e não regravam Storage; nada é atualizado no ERP.

## Fluxo de integração ERP

```text
DocumentoRecebido(validado)
  → ConciliacaoUseCase                      → ConciliacaoResultado
     ├─ ICadastroLookup (forn/prod/CFOP/NCM)
     └─ IComprasIntegration.buscarPedidoRelacionado
  → WorkflowRecebimentoUseCase.aprovar
     ├─ IComprasIntegration.registrarRecebimento     (compras)
     ├─ IEstoqueIntegration.registrarEntrada          (só itens cadastrados)
     └─ IFinanceiroIntegration.gerarTitulos           (contas a pagar)
  → status = integrado + auditoria + eventos
```

Fornecedor ou produto inexistente **nunca** é criado automaticamente
(Cadastro Assistido obrigatório, ver core rule do projeto).

## Barramento

15 novos eventos `fiscal.recebimento.*` (recebido/duplicado/inválido/
validado/lote iniciado/progresso/finalizado/conciliação/pendente aprovação/
integrado.compras/estoque/financeiro/aprovado/rejeitado/reprocessado).

## Restrições respeitadas

Não foram implementados nesta etapa: apuração de impostos, SPED (Fiscal/
Contribuições), EFD-Reinf, eSocial, livros fiscais, obrigações acessórias,
fechamento fiscal e escrituração automática completa.

## Validação

```
bunx tsgo --noEmit                                        → 0 erros
bunx vitest run src/modules/fiscal                        → 49/49 passando
```

ADRs relacionados: 005 (plugin por documento — reutilizado pelo parser
universal), 014 (envelope de resposta), 016 (strangler — recebimento novo
coexistindo com a rotina legada de importação de XML), 017 (eventos como
fato passado).