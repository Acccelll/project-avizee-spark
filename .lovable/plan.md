# Plano para estabilizar a navegação do grid

## Objetivo
Evitar que o usuário veja seta de próxima página quando já está no fim e impedir o retorno inesperado para a primeira página, mantendo a paginação previsível e coerente com os dados exibidos.

## Diagnóstico
No `/clientes`, a paginação está sendo decidida com base no total server-side, mas a tabela ainda recebe `filteredData`, que aplica um refinamento client-side para o caso especial de `sem_grupo`.

Isso cria um descompasso:
- o rodapé e as setas usam `totalCount`/`page` do backend;
- a grade renderiza uma lista já reduzida localmente;
- quando a página atual fica “sem itens visíveis”, o hook hoje faz `setPage(0)`, então a navegação parece voltar sozinha para a primeira página.

## Melhor abordagem
A melhor forma de manter isso sem confundir o usuário é fazer a paginação e o conjunto visível falarem sempre da mesma fonte de verdade.

### 1. Eliminar o filtro client-side que mexe no tamanho da página
No módulo de clientes, mover o caso especial de grupo (`sem_grupo` combinado com grupos reais) para o filtro server-side, em vez de aplicar `filteredData` depois que a página já veio pronta.

Resultado esperado:
- `data`, `totalCount`, `hasMore` e setas passam a refletir exatamente os mesmos registros;
- a última página deixa de “parecer” ter próxima quando a tabela já não tem mais linhas para mostrar.

### 2. Ajustar a regra de navegação para usar um critério único e confiável
Centralizar no `DataTable` um cálculo explícito de navegação:
- `canGoPrev = page > 0`
- `canGoNext = totalCount conhecido ? page < totalPages - 1 : hasMore`

E usar esse cálculo tanto no mobile quanto no desktop, inclusive para esconder o container de paginação quando não houver navegação possível.

### 3. Trocar o reset para página 0 por clamp para a última página válida
No `useSupabaseCrud`, quando o dataset diminuir por filtro, busca ou remoção:
- se a página atual ficar fora do range, navegar para a última página válida;
- só ir para a página 0 quando não existir nenhum resultado.

Exemplo:
- antes: usuário está na página 4, filtra, sobram 2 páginas, UI volta para página 1;
- depois: usuário cai na página 2, que é a última válida.

Isso preserva contexto e evita sensação de “salto aleatório”.

### 4. Alinhar contador e empty state ao dataset real
Garantir que contadores do toolbar/rodapé e a tabela usem a mesma base:
- se houver paginação server-side, a lista passada ao `DataTable` deve ser a página já definitiva;
- não deixar uma camada local esconder itens sem atualizar o total.

## Arquivos envolvidos
- `src/pages/Clientes.tsx`
- `src/hooks/useSupabaseCrud.ts`
- `src/components/DataTable.tsx`
- testes de paginação do hook/tabela

## Detalhes técnicos
```text
Hoje
backend => totalCount/page/hasMore
frontend => data da página -> filteredData local
DataTable => setas baseadas no backend, linhas baseadas no filteredData

Proposto
backend => totalCount/page/hasMore + linhas já filtradas corretamente
frontend => DataTable recebe só a página final
DataTable => setas e linhas usam a mesma verdade
```

## Validação
1. `/clientes` com apenas 1 página: sem setas.
2. Página intermediária: duas setas visíveis.
3. Última página: apenas seta de voltar.
4. Filtro reduzindo resultados enquanto o usuário está no fim: cair na última página válida, não na primeira.
5. Caso `sem_grupo` isolado e combinado com outros grupos: total, linhas e setas coerentes.
6. Testes automatizados para `DataTable` e `useSupabaseCrud` cobrindo clamp para última página válida.