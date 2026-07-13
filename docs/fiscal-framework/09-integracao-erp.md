# 09 · Mapa de integração com o resto do ERP

Como cada módulo do AVIZEE se conecta ao Framework Fiscal.

## Cadastros

| Entidade | Uso pelo Framework Fiscal |
|----------|---------------------------|
| `empresas` / `empresa_config` | Emitente (CNPJ, IE, CRT, ambiente, série). **Chave primária** de multi-tenant. |
| Filiais (futuro) | Sub-emitente por CNPJ; entra como registro em `empresas` com relação `matriz_id`. |
| `clientes` | Destinatário em NF-e de saída. Precisa CPF/CNPJ + IE + endereço completo + código de município IBGE. |
| `fornecedores` | Emitente em NF-e de entrada (importação). |
| `produtos` | Descrição, NCM, CEST, CFOP default, unidade, EAN/GTIN, origem (`orig`). |
| `naturezas_operacao` | CFOP default por operação. |
| `matriz_fiscal` | Regra tributária por (UF origem, UF destino, NCM). |
| `unidades_medida` | Coerência entre `uCom` e `uTrib`. |
| `ibge_municipios` | Código IBGE em emit/dest/local retirada. |

## Estoque

- Confirmação de NF-e de **saída** → movimento de saída em `estoque_movimentos`.
- Confirmação de NF-e de **entrada** → movimento de entrada.
- Devolução → movimento reverso com natureza fiscal correta.
- RPC `confirmar_nota` já implementa; framework não muda.

## Compras

- `pedidos_compra` → vincula/desvincula NF-e (`vincularNFPedidoCompra`).
- Importação de XML de entrada bate quantidade × valor com pedido para validar.

## Vendas

- `ordens_venda` → gera NF-e via `emitirNfe` (composição de itens, financeiro, frete).
- `orcamentos` não emite NF (só após virar OV).

## Financeiro

- NF-e de saída com `geraFinanceiro=true` cria parcelas em `financeiro_lancamentos`.
  Regra: soma parcelas = total NF (± 0,01). Schema Zod já valida (`NFeForm/schema.ts`).
- Cancelamento da NF cancela parcelas não baixadas; parcelas baixadas exigem estorno manual (`mem/security/lancamento-pago-requer-baixa`).
- CCe **não** afeta financeiro.

## Logística

- NF-e transportada gera `remessas` opcionalmente.
- MDF-e (futuro) consumirá `remessas` para composição.

## CRM / Comercial

- Sem integração direta hoje; mantido desacoplado.

## Dashboard

- `dashboardFiscal.service.ts` já agrega KPIs (emitidas, canceladas, em contingência).
- Novo: badge de status SEFAZ por UF (via `runtime.status.consultar`, cache 60s).

## Relatórios

- Exportação de XMLs em lote (`xmlBatchExport.ts`) → segue funcionando; agora
  puxa também os XMLs de entrada arquivados pela distribuição.
- Relatório de rejeição (novo, backlog) — consumo de `fiscal_auditoria`.

## Configurações

- `app_configuracoes.chave = 'certificado_digital'` continua sendo a fonte
  para metadados de certificado.
- Nova: `app_configuracoes.chave = 'fiscal_runtime'` — configurações do
  motor (`SYNC_AUTO_CIENCIA`, timeouts, política de retry). Pode ser por
  empresa quando multi-tenant.

## Usuários e permissões

- RBAC via `user_permissions` já existe.
- Novos recursos: `fiscal:emitir`, `fiscal:cancelar`, `fiscal:cce`,
  `fiscal:manifestar`, `fiscal:inutilizar`, `fiscal:certificado`, `fiscal:dfe`.
- `can('fiscal', 'emitir')` valida no frontend; edge revalida com JWT + `user_permissions`.

## Auditoria

- `auditoria_logs` continua para ações de UI.
- **Adicional**: `fiscal_auditoria` (nova, especializada) para toda comunicação
  com SEFAZ. Correlation-id conecta as duas.

## Notificações

- Certificado a vencer em 30d → e-mail via `process-email-queue` (infra já existe).
- SEFAZ indisponível > X min → notificação para o admin fiscal.
- Rejeição de emissão → notificação para o operador.

## Multi-empresa

Quando ativado:
- `user_empresas` define quais empresas o usuário acessa.
- Todas as tabelas fiscais recebem `empresa_id` + RLS `empresa_id IN (SELECT ... FROM user_empresas WHERE user_id = auth.uid())`.
- Certificado é por empresa: bucket `dbavizee/certificados/{empresaId}/empresa.pfx`, Vault `CERTIFICADO_PFX_SENHA__{empresaId}`.
- Endpoint registry é compartilhado (mesmos endpoints por UF/ambiente).

## O que **não** integra

- Social, Apresentação Gerencial, Workbook — não têm interação com fiscal.
- Help/Onboarding — só documenta.