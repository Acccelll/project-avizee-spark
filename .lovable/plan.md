# Esconder seta de próxima página quando não há mais itens

## Diagnóstico

O print mostra um grid vazio ("Nenhum registro encontrado") após o usuário clicar em "próxima". Isso acontece por dois motivos combinados em `useSupabaseCrud` + `DataTable`:

1. **`hasMore` falso-positivo** (`src/hooks/useSupabaseCrud.ts:230`)
   `hasMore = rows.length === pageSize`. Quando a última página tem exatamente `pageSize` linhas (ex.: 100 itens com pageSize=50 → página 1 com 50 e nenhuma próxima), `hasMore` continua `true` e a seta permanece habilitada. Clicar leva a uma página vazia.

2. **Seta sempre renderizada, apenas desabilitada** (`DataTable.tsx:998` e `1164`)
   Mesmo nos casos em que `disabled` fecharia, a seta fica visível e o usuário tenta clicar. A solicitação do usuário é **ocultar** a seta, não apenas desabilitá-la.

## Mudanças

### 1. `src/hooks/useSupabaseCrud.ts` — corrigir `hasMore`

Trocar:

```ts
hasMore: rows.length === pageSize,
```

por uma checagem que prioriza `totalCount` quando disponível:

```ts
const knownTotal = count ?? null;
const hasMore =
  knownTotal != null
    ? (effectivePage + 1) * pageSize < knownTotal
    : rows.length === pageSize;
```

Isso elimina o falso-positivo da última página cheia.

### 2. `src/components/DataTable.tsx` — ocultar setas quando não navegável

No bloco mobile (linhas 995-999) e desktop (linhas 1161-1165), substituir a renderização incondicional dos botões `‹ ›` por renderização condicional:

```tsx
{serverPagination ? (
  <div className="flex gap-1">
    {effectivePage > 0 && (
      <Button ... aria-label="Página anterior" onClick={() => goToPage(effectivePage - 1)}>
        <ChevronLeft className="h-4 w-4" />
      </Button>
    )}
    {(serverPagination.hasMore || effectivePage < totalPages - 1) && (
      <Button ... aria-label="Próxima página" onClick={() => goToPage(effectivePage + 1)}>
        <ChevronRight className="h-4 w-4" />
      </Button>
    )}
  </div>
) : ...}
```

Aplicar o mesmo padrão no ramo client-side (linhas 1005-1008), ocultando "anterior" quando `currentPage === 0` e "próxima" quando `currentPage >= totalPages - 1`.

Também ajustar a condição `mobilePagerVisible` (linha 980) para esconder a barra inteira quando há só uma página e nenhuma seta apareceria — mantendo o `<div className="pb-24 md:pb-0" />` espaçador.

### 3. Defesa: clamp de página fora de range

Se ainda assim o consumidor pedir `page` além de `totalPages - 1` (ex.: deep link), o `useEffect` já existente em `useSupabaseCrud` reseta para 0. Adicionar o mesmo clamp no efeito (lá só dispara quando `paged` e `totalCount != null && page * pageSize >= totalCount`), evitando piscar página vazia. Sem novo estado — só estende a condição que já existe.

## Validação

1. `/produtos` com filtro que retorne exatamente múltiplo de `pageSize` (ex.: 50, 100): verificar que a seta "próxima" some na última página.
2. Página única (poucos resultados): nenhuma seta visível, badge "1–N de N" continua.
3. Página intermediária: ambas as setas visíveis.
4. Rodar `bunx vitest run src/hooks/__tests__/useSupabaseCrud.test.tsx src/components/__tests__/DataTable.test.tsx`.

## Escopo

- `src/hooks/useSupabaseCrud.ts` — cálculo de `hasMore` + clamp no effect.
- `src/components/DataTable.tsx` — render condicional das setas (mobile + desktop, server + client).
- Sem mudança de API pública dos componentes, sem migrações.
