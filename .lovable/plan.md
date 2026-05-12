## Contexto

A tela de **Notas de Entrada** e **Notas de Saída** é a mesma página (`/fiscal?tipo=entrada` / `?tipo=saida`). No mobile, ela é acessada por duas tabs do bottom nav (`MobileBottomNav.tsx`), mas hoje as duas tabs aparecem **destacadas como ativas ao mesmo tempo** porque a comparação de rota descarta a query string. Além disso, o cabeçalho mobile herda o layout desktop, o que polui a tela em viewports pequenos.

## Bug do toggle (raiz)

`MobileBottomNav.tsx` calcula:

```
const tabBase = basePath(tab.path)        // basePath() remove "?...""
const currentBase = basePath(currentRoute)
active = currentBase === tabBase
```

Para as tabs contextuais do Fiscal:

- `nf-entrada` → path `/fiscal?tipo=entrada` → `tabBase = '/fiscal'`
- `nf-saida`   → path `/fiscal?tipo=saida`   → `tabBase = '/fiscal'`
- `currentBase` em `/fiscal?tipo=entrada` = `/fiscal`

Resultado: **ambas casam** e ficam com pílula primary. O mesmo padrão pode afetar qualquer tab contextual futura que use querystring.

## Correção do toggle

Em `MobileBottomNav.tsx`, mudar a regra de `active` para tabs contextuais:

1. Se `tab.path` contém `?`, comparar `tab.path` **literal** (path + search) com `currentRoute` literal (sem `basePath`). Usar `URLSearchParams` para tolerar ordem diferente de params.
2. Se não contém query, manter o comportamento atual (`currentBase === tabBase || startsWith(tabBase + '/')`).

Isso garante:

- Em `/fiscal?tipo=entrada` → só **Entrada** ativa.
- Em `/fiscal?tipo=saida`   → só **Saída** ativa.
- Em `/fiscal` puro (sem `?tipo=`) → nenhuma das duas ativa (Dashboard fiscal continua se tornando ativa pela `activeKey` da seção; já é o comportamento esperado).
- Em `/fiscal/dashboard` → `dashboard-fiscal` ativa, demais inativas (já é exato hoje, segue funcionando).

## UX mobile da página de Notas (Entrada/Saída)

Mudanças escopadas a `src/pages/Fiscal.tsx` + um pequeno componente novo (`FiscalTipoSwitchMobile`). **Sem mudanças funcionais** — apenas apresentação mobile.

1. **Switch Entrada/Saída sticky no topo (mobile)**
   - Quando `tipoParam` está setado e `isMobile`, renderizar logo abaixo do header da `ModulePage` um segmented control 2-up (Entrada | Saída) `min-h-11`, full-width, com a opção atual destacada em `bg-primary/10 text-primary`.
   - Tocar troca a URL (`navigate('/fiscal?tipo=entrada'|'saida')`) preservando demais filtros via `searchParams`.
   - Reforça a leitura "estou em Entrada" e dá troca em 1 toque, eliminando o ruído do bug do bottom nav e a necessidade de voltar ao menu.

2. **Header / ações mobile**
   - `FiscalToolbarActions` (Importar XML, Buscar por Chave, Scanner) hoje renderiza 3 botões inline. Em mobile, agrupar **Importar XML + Buscar por Chave** em um menu "⋯" (`DropdownMenu`) `min-h-11 min-w-11` ao lado do "Nova NF". Scanner permanece como ícone solto (ação rápida típica em mobile).
   - Conforme `mem://produto/fiscal-mobile`: Editar continua navegando para `/fiscal/:id/editar`.

3. **KPIs em mobile**
   - Hoje: `grid-cols-2` mostrando **Valor Total / Pendentes / Confirmadas** (Total já está oculto). Manter.
   - Adicionar `aria-live="polite"` no card Pendentes para feedback quando filtro de status aplica.

4. **Banner pendentes**
   - Já existe e funciona. Adicionar `aria-pressed` refletindo se `statusFilters` já contém `"pendente"` e, nesse caso, ao tocar **limpar** o filtro (toggle), em vez de re-aplicar.

5. **Filtros avançados em mobile**
   - `AdvancedFilterBar` já colapsa filtros em sheet. Apenas garantir que, quando `tipoParam` ativo, a opção "Tipo" não apareça (já comportada pelo `!tipoParam &&`).

## Arquivos afetados

- `src/components/navigation/MobileBottomNav.tsx` — corrigir cálculo `active` para tabs com querystring.
- `src/pages/Fiscal.tsx` — montar `FiscalTipoSwitchMobile` quando `tipoParam && isMobile`; agrupar ações secundárias em `DropdownMenu` em mobile; ajustes de a11y do banner.
- `src/components/fiscal/FiscalTipoSwitchMobile.tsx` (novo, ~40 LOC) — segmented control acessível.
- `src/components/fiscal/FiscalToolbarActions.tsx` — variant mobile que esconde botões secundários (renderizados via menu pelo Fiscal.tsx) sem quebrar desktop.

## Fora de escopo

- Não mexer em `MobileMenu.tsx` nem na navegação de outras seções.
- Sem mudanças em filtros server-side, RPC, `useFiscalFilters` ou drawer de NF.
- Sem alteração de permissões ou de rotas.

## Critérios de aceitação

- Em `/fiscal?tipo=entrada` (mobile), apenas a tab "Entrada" do bottom nav fica destacada; idem para Saída.
- No topo da listagem em mobile, segmented control "Entrada | Saída" com a opção atual marcada; toque alterna sem perder filtros adicionais (mês, status etc.).
- Botões "Importar XML" e "Buscar por chave" não ocupam mais a barra do header em mobile — vivem em um menu "⋯".
- Banner de pendentes vira toggle (aplica/limpa) e expõe `aria-pressed`.
- Desktop permanece visualmente idêntico ao atual.
