---
name: Framework Fiscal — Recebimento (Etapa 8)
description: Módulo src/modules/fiscal/recebimento — parser universal, dedup por hash+chave, conciliação, workflow, integração ERP via portas
type: feature
---

# Framework Fiscal — Etapa 8 (Recebimento Fiscal)

Local: `src/modules/fiscal/recebimento/`

## Escopo
- Parser universal extensível (`registerParser`) — plugins NF-e/NFC-e/CT-e/MDF-e/NFS-e/eventos/protocolos.
- Importação individual e em lote com concorrência configurável e progresso a cada 25 documentos.
- Deduplicação dupla: `hashXml` (SHA-256 normalizado) + `chaveAcesso` (44 dígitos). Duplicado retorna existente sem regravar Storage e sem tocar o ERP.
- Máquina de estados de 11 estados: recebido → em_validacao → validado → em_conciliacao/pendente_aprovacao → integrado / rejeitado / arquivado.
- Conciliação sem side-effects — identifica fornecedor/pedido/produtos, valida CFOP/NCM, apura divergências de valor/quantidade.
- Integração ERP via portas: IComprasIntegration, IEstoqueIntegration, IFinanceiroIntegration, ICadastroLookup.
- Monitor Fiscal — snapshot agregado por status/origem para dashboards.

## Regra crítica
- Fornecedor/produto inexistente NUNCA é criado automaticamente. Workflow exige Cadastro Assistido antes de aprovar.
- Validação bloqueia CNPJ destinatário divergente para NF-e.

## Reuso
- `xmlEngine.parseXml`/`textOf` (Etapa 5), `FiscalEventBus` (união estendida com 15 nomes novos).
- Storage via porta `IRecebimentoStorage` — bucket canônico `dbavizee/fiscal/recebimento/` quando o adaptador Supabase for plugado.

## Testes
`__tests__/recebimento.test.ts` — 14 cenários (parser, hash, validação, máquina, importar+dedup, lote, conciliação, workflow aprovar/rejeitar, monitor). Total do módulo fiscal: 49/49.

## Fora de escopo
Apuração de tributos, SPED Fiscal/Contribuições, EFD-Reinf, eSocial, livros fiscais, obrigações acessórias, fechamento, escrituração automática.