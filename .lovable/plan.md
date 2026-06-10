## Frente 1 — Decompor `src/pages/Fiscal.tsx`

**Alvo:** 2.204 → ≤ 800 linhas (orquestrador + JSX).
**Premissa inegociável:** zero mudança funcional, zero migration, mesmos handlers, mesmos toasts, mesmos modais. Apenas extração para arquivos coesos.

## Por que agora

A Frente 4 já encostou em `Fiscal.tsx` (linha 1448) e exigiu navegação por 2.200 linhas para uma mudança de 8 linhas. NFS-e e CT-e (próximas features) precisam acrescentar 3 ramos de discriminador (`tipo_documento`) ao mesmo arquivo — sem decomposição, isso vira regressão garantida.

## Mapa de extração

| # | Novo arquivo | O que sai de `Fiscal.tsx` | Linhas est. |
|---|---|---|---|
| 1 | `src/pages/fiscal/hooks/useFiscalXmlActions.ts` | `handleXmlImport`, `handleAnexarXmlChange`, `processarXmlParaAnexar`, `handleTraducaoConfirm`, `handleTraducaoCancel`, estados `traducao*`, `pendingXmlImport`, `xmlOriginInfo`, `anexarTargetNf`, refs `xmlInputRef`/`anexarXmlInputRef` | ~280 |
| 2 | `src/pages/fiscal/hooks/useFiscalLifecycleActions.ts` | `handleConfirmar`, `handleEstornar`, `handleCancelarRascunho`, `handleInativar`, `openDevolucao`, locks `confirmarLock`/`estornarLock`, `confirmDialog` | ~180 |
| 3 | `src/pages/fiscal/hooks/useFiscalVencimentos.ts` | Loader `vencimentoNotaIds` (já corrigido na Frente 4 com `fetchAllPages`) + estado `vencimentoMes` | ~50 |
| 4 | `src/pages/fiscal/components/FiscalTableColumns.tsx` | `renderFiscalStatus` + factory `buildFiscalColumns({ tipoParam, parceiroLabel, isMobile })` retornando o array de colunas | ~190 |

**Total extraído:** ~700 linhas. Orquestrador final: ~700–800 linhas.

## O que NÃO sai (decisão consciente)

- **Form state da NF** (`form`, `items`, `parcelas*`, `itemFiscalData`, `itemContaContabil`, quick-adds): já existe `useFiscalNotaForm` (401 linhas) para a versão modal, mas o estado *inline* da página alimenta o `NotaFiscalEditModal` legado em múltiplos pontos do JSX. Migrar para o hook é a Fase 2 da decomposição — fora do escopo desta sessão (alto risco de divergência de comportamento entre modal antigo e novo).
- **JSX root** (linhas 1685–2200): permanece em `Fiscal.tsx` como orquestrador. Após a extração ele referencia apenas hooks + columns factory + componentes já existentes.
- **`buildNfItemsPayload` e `handleSubmit`** (~770 linhas combinadas): acoplados ao state inline acima; saem na Fase 2 junto com a migração do form.

## Detalhes técnicos

### Hook 1 — `useFiscalXmlActions`

```ts
function useFiscalXmlActions(deps: {
  fornecedoresCrud, clientesCrud, produtosCrud,
  cnpjEmpresa, onAfterImport: (result) => void,
  // tradução abre/fecha modal controlado pelo orquestrador:
  setTraducaoOpen, setTraducaoLinhas, setTraducaoReadOnly,
}) {
  // retorna: { xmlInputRef, anexarXmlInputRef, anexarTargetNf, setAnexarTargetNf,
  //   xmlOriginInfo, setXmlOriginInfo, pendingXmlImport,
  //   handleXmlImport, handleAnexarXmlChange,
  //   handleTraducaoConfirm, handleTraducaoCancel }
}
```

Mantém o `useNFeXmlImport` interno (já é hook) — só extrai os *handlers de página* que orquestram o resultado.

### Hook 2 — `useFiscalLifecycleActions`

```ts
function useFiscalLifecycleActions(deps: {
  confirmarMutation, estornarMutation, invalidate, can,
  closeModal: () => void,
}) {
  const confirmarLock = useActionLock();
  const estornarLock = useActionLock();
  const { confirm, dialog } = useConfirmDialog();
  // retorna: { handleConfirmar, handleEstornar, handleCancelarRascunho,
  //   handleInativar, openDevolucao, devolucaoFlowRef, confirmDialog: dialog }
}
```

Recebe `closeModal` para chamar após cancelar/estornar (substitui o `setModalOpen(false)` inline).

### Hook 3 — `useFiscalVencimentos`

Único loader; já paginado via `fetchAllPages`. Apenas encapsula `useState<Set<string> | null>` + `useEffect` por `vencimentoMes`.

### Componente 4 — `FiscalTableColumns.tsx`

Exporta `buildFiscalColumns(opts: BuildColumnsOpts): Column<NotaFiscal>[]`. As 13 colunas hoje inline viram declarativas. `renderFiscalStatus` é função interna do módulo (não exportada).

## Sequência de execução

1. **Extrair** os 4 arquivos em paralelo (são independentes entre si).
2. **Adaptar** `Fiscal.tsx`:
   - Adicionar 4 imports.
   - Substituir blocos de handlers/states pelos retornos dos hooks (uma seção por vez).
   - Substituir `const columns = [...]` por `const columns = useMemo(() => buildFiscalColumns({...}), [tipoParam, parceiroLabel, isMobile])`.
3. **Verificação**:
   - Build limpo (TypeScript estrito).
   - Smoke manual: criar NF rascunho, importar XML, confirmar, estornar, cancelar, anexar XML, abrir devolução.

## Riscos e mitigação

| Risco | Mitigação |
|---|---|
| Hook 1 expõe muitas deps (acopla a `setTraducao*`) | Aceitar nesta fase; consolidação no `useFiscalNotaForm` é Fase 2 |
| Quebra silenciosa de closure (handler usa state stale) | Cada hook devolve handlers via `useCallback` com deps explícitas |
| Coluna `tipoParam`-dependente perde reatividade | Factory recebe `tipoParam` por argumento; `useMemo` no consumidor |

## Não faz parte desta sessão

- Migrar form inline para `useFiscalNotaForm` (Fase 2 da decomposição).
- Tocar `handleSubmit`/`buildNfItemsPayload` (saem com Fase 2).
- Qualquer SQL/migration.
- Refatorar a árvore JSX dos 520 linhas finais (cosmético; baixa prioridade).

## Critério de pronto

- `wc -l src/pages/Fiscal.tsx` ≤ 800.
- 0 erro TS, 0 warning novo.
- Os 4 novos arquivos cobertos por imports apenas em `Fiscal.tsx` (nenhum vazamento de uso).
