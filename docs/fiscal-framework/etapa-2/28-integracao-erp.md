# 28 · Integração com módulos do ERP

O framework fiscal **não substitui** módulos do ERP — integra-se via
**contratos publicados** e **eventos**. Nenhum módulo do ERP importa código
do Domain fiscal; consomem apenas a fachada.

## Padrão geral

```text
┌──────────────┐   DTO ERP    ┌────────────┐   Command   ┌────────────┐
│ ERP Module   │ ───────────► │  Fachada   │ ──────────► │ Application│
│ (compras,    │              │ fiscal svc │             │ (use case) │
│  vendas...)  │ ◄─────────── │            │ ◄────────── │            │
└──────────────┘   Resultado  └────────────┘   Result    └────────────┘
       ▲                                                        │
       │           evento de domínio (opcional)                 │
       └────────────────────────────────────────────────────────┘
```

## Por módulo ERP

### Cadastros (base compartilhada)
- **Consome do fiscal**: `matriz_fiscal`, `naturezas_operacao`.
- **Fornece ao fiscal**: nada direto.
- **Integração**: seleção de CFOP default, CST default, cenário tributário.

### Produtos
- **Fornece**: NCM, CEST, origem, unidade comercial/tributável, código EAN, cbenef, extipi.
- **Consome**: validação de campos fiscais obrigatórios (ex.: NCM 8 dígitos).
- **Ponto crítico**: alteração de NCM/CST em produto **não** afeta notas já emitidas (XML congelado).

### Clientes
- **Fornece**: CNPJ/CPF, IE, endereço, indicador IE (`indIEDest`), consumidor final, código municipal (IBGE).
- **Consome**: validação de IE via consulta cadastro (opcional, futuro).

### Fornecedores
- **Fornece**: dados do emitente para NF-e de entrada.
- **Consome**: manifestação do destinatário para NF-e recebidas.
- **Evento**: `DFeRecebido` pode disparar `SugestaoCadastroFornecedor` no ERP.

### Empresas / Filiais
- **Fornece**: CNPJ, IE, IM, CRT (Simples/Normal), regime tributário, endereço.
- **Consome**: nada.
- **Fiscal owner**: `empresa_config` e (futuro) `filial_config`.
- **Regra**: alterar CNPJ da empresa é operação **crítica** — invalida certificado, invalida numeração, exige confirmação e re-onboarding.

### Compras
- **Consome do fiscal**: importação de NF-e de entrada, DF-e, manifestação.
- **Fluxo**: DF-e detecta NF endereçada → sugere criação de pedido de compra retroativo → confirmação manifesta.
- **Evento consumido**: `DFeRecebido`, `DocumentoAutorizado` (entrada por importação).

### Vendas (Orçamentos/Pedidos/Faturamento)
- **Fornece ao fiscal**: DTO da nota (dados de cliente, itens, totais, condições).
- **Consome**: chave, protocolo, status para exibição.
- **Evento consumido**: `DocumentoAutorizado` → dispara movimentação de estoque + geração de financeiro.
- **Regra**: pedido não é excluído após emissão; cancelamento fiscal ≠ cancelamento de pedido (dois níveis).

### Estoque
- **Consome**: `DocumentoAutorizado` (saída) → baixa; `DFeRecebido` + manifesto confirmado (entrada) → entrada.
- **Regra**: baixa/entrada só após cStat=100. `Rejeitada`/`Denegada` não movimenta.
- **Integridade**: trigger `trg_estoque_movimentos_sync` continua sendo fonte de `estoque_atual`.

### Financeiro
- **Consome**: `DocumentoAutorizado` → cria lançamentos conforme `data_vencimento`/`parcelas` da nota (ver `mem/features/fiscal-vencimento-parcelas.md`).
- **Regra**: cancelamento fiscal (< 24h, cstat=135) → estorno automático dos lançamentos **se não baixados**; se baixados, exige `editar_admin` com auditoria.

### Logística
- **Fornece**: dados de transporte (transportadora, veículo, volume, peso, ChNFe secundárias).
- **Consome**: emissão de MDF-e (futuro), CT-e (futuro), etiquetas.

### Relatórios
- **Consome**: view materializadas (`v_nfe_portal`, futuro `v_fiscal_apuracao`) para produzir livros fiscais.
- **Regra**: relatórios fiscais oficiais (livros, SPED) ficam em módulo próprio (`RelatoriosFiscaisService`, doc 25).

### Dashboard
- **Consome**: `fiscal_telemetria` agregada, cStat do dia, alertas de certificado.
- **Atualização**: eventos `DocumentoAutorizado`, `DocumentoRejeitado`, `CertificadoProximoDoVencimento` alimentam widgets em tempo real.

### Usuários
- **Fornece**: `auth.uid()`, `user_empresas`.
- **Consome**: `fiscal_admin` como perfil especial.

### Permissões
- **Fornece**: `user_permissions` com escopos `fiscal:*` (doc 26).
- **Consome**: nada.

## Contratos publicados (Fiscal → ERP)

```
FiscalFacade {
  emitir(nota): Promise<Result>
  cancelar(chave, justificativa): Promise<Result>
  cartaCorrecao(chave, texto, nSeq): Promise<Result>
  inutilizar(faixa, justificativa): Promise<Result>
  manifestar(chave, tipo): Promise<Result>
  sincronizarDFe(): Promise<DFeResumo>
  importarXml(fileOrString): Promise<Result>
  baixarXml(chave): Promise<{ url }>
  statusCertificado(): Promise<CertStatus>
  statusSefaz(uf, ambiente): Promise<StatusSefaz>
}

FiscalEventBus {
  on(evento, handler): unsubscribe
}
```

`FiscalEventBus` é canal in-app (Postgres LISTEN/NOTIFY ou react-query invalidate). Não substitui webhooks para integrações externas.

## Regras de acoplamento

1. **Módulo do ERP nunca faz SQL em `fiscal_*` diretamente.** Só via fachada ou view.
2. **Módulo do ERP nunca importa `src/fiscal-framework/domain/*`.** Só types compartilhados de `src/types/fiscal.ts`.
3. **Cross-cutting** (auth, permissões, logger, feature flag) é compartilhado — não é duplicado no fiscal.
4. **Views de leitura** (`v_nfe_portal`, `v_fiscal_apuracao`) são o canal read-only preferido para telas complexas — reduz round-trip e permite otimização de índice.
5. **Idempotência de integração ERP→Fiscal**: ERP passa `sourceRef` (ID do pedido/orçamento); fachada usa como `Idempotency-Key`.

## Migração dos consumidores atuais

Feature flags `fiscal:v2:*` permitem migrar por operação:

| Consumidor atual | Ação |
|---|---|
| `src/services/nfe/*` (chamadas diretas ao sefaz-proxy) | migrar para `FiscalFacade.*` |
| `useNfe*` hooks | apontar para nova fachada, mantendo assinatura |
| Componentes de UI | zero mudança — hooks encapsulam |

**Estratégia**: strangler pattern — nova fachada delega ao antigo até que operação por operação seja migrada.