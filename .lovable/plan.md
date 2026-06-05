# Plano — Faturas/Cartões + Tipo de Documento Fiscal + Refresh global

## 1) Faturas do cartão — listar itens da fatura sem precisar abrir "Baixar"

**Arquivo:** `src/pages/CartoesCredito.tsx` (Sheet `faturasListOpen`).

- Tornar cada linha de fatura expansível (Accordion/Collapsible) com botão "Ver itens".
- Ao expandir, chamar `listLancamentosDaFatura(f.id)` (já existe) e renderizar lista com `descricao`, `data_vencimento`, `parcela_numero/total`, `valor`, `saldo`, `StatusBadge`.
- Manter o botão **Baixar** ao lado, separado.
- Cachear o resultado por fatura em estado local `Record<string, LancamentoFatura[]>` para evitar refetch toda vez que reabre.

## 2) Cartões — remover botão "Editar cartão" inline

**Arquivo:** `src/pages/CartoesCredito.tsx`.

- Remover o botão "Editar cartão" do `rowExtraActions` e do `mobileInlineActions`. A edição continuará disponível no menu de 3 pontos (já fornecido pelo `DataTable` via `onEdit`). Trocar `onEdit={openFaturasList}` por: `onEdit={openEdit}` (editar) e mover a abertura de faturas para o `onRowClick` (clique na linha) **ou** manter como ação primária mobile via `mobilePrimaryAction` (já existe).
- Resultado: clique na linha = abrir faturas; menu 3 pontos contém "Editar".

## 3) Fiscal — Tipo de documento também no CRIAR + filtro por contexto

### 3.1 Mostrar "Tipo de documento" ao criar
**Arquivo:** `src/pages/fiscal/components/NfeFormBody.tsx` (usado por criar e editar via `NfeCreateFormModal`/`NotaFiscalEditModal`).

- Hoje o `TipoDocumentoSelector` só aparece em `NotaFiscalEditModal`. Mover o seletor para o topo do `NfeFormBody` (sempre visível), controlado por `form.tipo_documento` (`"nfe" | "nfse" | "cte"`).
- Remover a duplicação no `NotaFiscalEditModal` (passa a delegar ao body).

### 3.2 Filtrar opções de "modelo_documento" pelo tipo
**Arquivo:** `NotaFiscalEditModal.tsx` linha ~110 e `NfeFormBody.tsx` (se também tiver dropdown de modelo).

- Hoje o Select de "Modelo" lista todos: 55/65/57/67/nfse mesmo quando o tipo é `nfe`.
- Aplicar tabela `MODELOS_POR_TIPO`:
  - `nfe` → 55 (NF-e), 65 (NFC-e)
  - `cte` → 57 (CT-e), 67 (CT-e OS)
  - `nfse` → nfse (Serviço)
- Quando o tipo muda, resetar `modelo_documento` para o default do tipo.

### 3.3 Revisar campos por tipo (CT-e / NFS-e não mostram campos exclusivos de NF-e)
**Arquivos:** `NfeFormBody.tsx`, `NfseFieldsSection.tsx`, `CteFieldsSection.tsx`.

- Identificar blocos que só fazem sentido para NF-e e renderizá-los condicionalmente:
  - Itens de produto / Impostos ICMS/IPI/PIS-COFINS → só `tipo_documento === 'nfe'`.
  - Tomador / Discriminação do serviço → só `nfse`.
  - CFOP de transporte, modal, remetente/destinatário/tomador do frete → só `cte`.
- Manter campos comuns (número, série, data emissão, valor total, observações, parcelas) sempre.

## 4) Refresh automático após mutações (problema global)

**Diagnóstico:** Várias telas chamam `fetchData()` manual em vez de invalidar a query do `useQuery`. Quando outra aba/realtime altera os dados, ou quando o `mutation.onSuccess` é executado, nem todas as queries são invalidadas.

**Estratégia (sem mexer em backend):**

1. Padronizar `mutation.onSuccess` para invalidar a queryKey canônica do recurso afetado **e** as queryKeys agregadas relacionadas. Exemplo: ao criar/editar `financeiro_lancamentos`, invalidar `["financeiro_lancamentos"]`, `["fluxo-caixa"]`, `["dashboard-pendencias"]`.
2. Aplicar `refetchOnWindowFocus: true` no `QueryClient` default (`src/main.tsx` ou onde o `QueryClientProvider` é montado) — hoje provavelmente está `false`.
3. Auditar mutações nas telas com queixas mais frequentes e converter `fetchData()` manual em `queryClient.invalidateQueries({ queryKey: [...] })`. Foco em: Financeiro, Cartões de Crédito, Fiscal, Orçamentos, Pedidos.
4. Para a tela atual de Cartões: após `baixarFaturaCartao`, invalidar `["financeiro_lancamentos"]` e refazer `listFaturasPorCartao` (já faz). Trocar `fetchData` por invalidateQueries onde aplicável.

**Escopo:** Não é viável fazer 100% num único passo. Vou:
- Ligar `refetchOnWindowFocus: true` (ganho imediato e amplo).
- Padronizar 4 telas-piloto (Cartões, Financeiro, Fiscal, Orçamentos) — as demais ficam para passes futuros.

## Arquivos impactados

- `src/pages/CartoesCredito.tsx` — itens 1, 2, 4.
- `src/pages/fiscal/components/NfeFormBody.tsx` — itens 3.1, 3.2, 3.3.
- `src/components/fiscal/NotaFiscalEditModal.tsx` — itens 3.1, 3.2 (remover duplicação).
- `src/components/fiscal/NfseFieldsSection.tsx`, `CteFieldsSection.tsx` — item 3.3 (revisão de campos).
- `src/main.tsx` (ou onde está o `QueryClient`) — item 4 (refetchOnWindowFocus).
- Hooks afetados: `useNotasFiscaisPaged`, `useFinanceiroLancamentosPaged`, `useBaixaFinanceira` — invalidar query keys corretas no `onSuccess`.

## Fora do escopo
- Mudanças no backend (RPCs/triggers).
- Implementar realtime websocket onde ainda não existe — só ajustar invalidação client-side.
- Refactor completo de todos os módulos para o padrão de invalidação (apenas as 4 telas-piloto).
