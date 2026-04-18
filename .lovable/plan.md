

# Diagnóstico visual — Continuidade entre módulos

## Inventário visual de transições

| Transição | Sinalização atual | Problema |
|---|---|---|
| Pedido Compra → /fiscal (entrada) | `navigate("/fiscal?...&pedido_compra_id=UUID")` | Usuário chega no Fiscal sem **breadcrumb de origem**, sem botão "Voltar ao PC", sem chip "vindo de PC-123" |
| Cotação → Pedido (drawer) | Após conversão fica no drawer, status muda | Sem **toast com CTA** "Abrir Pedido X". Usuário não percebe o que aconteceu |
| Cotação → Pedido (grid) | `navigate('/pedidos')` | Comportamento divergente entre grid e drawer (já apontado) |
| OV → NF gerada | `reload()` no drawer; aparece botão "NF X" | Sem destaque visual de "novo". Sem toast com "Abrir NF" |
| Drawer relacional | Stack lateral com offset/sombra | Card de "vínculos" interno bom, mas **header não mostra trilha do que abriu o drawer** (apenas "Pedido · 123") |
| Botões "Ver pedido", "Ver fornecedor" | RelationalLink com ícone ExternalLink | Inconsistência: alguns usam `pushView` (drawer), outros `navigate` (rota). Sem padrão visual que avise "vai abrir em drawer" vs "vai sair desta tela" |
| Dashboard → módulos | "Ver todas →" | OK, mas tela destino não filtra pelo contexto que veio |
| Status que dependem de outro módulo | Badges (status_faturamento, % recebido) | Mostra estado mas **não explica origem** ("Faturado por NF 567", "85% recebido por NF 23+24") |
| Dialog "Gerar Pedido" / "Gerar NF" | `ConfirmDialog` simples | Sem **preview** do que vai acontecer cross-módulo (ex: "Vai criar 1 OV + 3 itens em /pedidos") |

## Problemas reais

### 1. Chegada sem contexto de origem
Quando `darEntrada` redireciona para `/fiscal`, a página filtra por `tipo=entrada` mas:
- Não mostra banner "Você veio do Pedido de Compra **PC-123**"
- Não tem botão "Voltar ao Pedido de Compra"
- Filtro `pedido_compra_id` é lido (já no plan anterior) mas **sem indicação visual** do filtro ativo
- Modal de "Nova NF" não abre pré-preenchido

### 2. Toast pós-ação cross-módulo é "burro"
Após gerar NF, converter cotação, gerar pedido de compra: toast "Sucesso" sem CTA. Usuário precisa adivinhar onde foi parar o resultado. Padrão atual em `OrcamentoForm.tsx` (linha 615) já faz isso bem com action `Visualizar` — replicar.

### 3. RelationalLink não diferencia "drawer" vs "navegação"
Visualmente idêntico. Usuário não sabe se vai abrir lateralmente (mantendo contexto) ou sair da tela. Causa surpresa quando sai.

### 4. Header do drawer não mostra origem da abertura
Drawer `nota_fiscal:UUID` aberto a partir de OV mostra só "Nota Fiscal · 567". Stack tem 2 itens (OV + NF), mas o usuário precisa olhar o badge "2 de 2" para entender. Falta breadcrumb encadeado: "OV-123 › NF-567".

### 5. Dialogs de ação cross-módulo sem preview de impacto
"Gerar Pedido a partir desta cotação?" — sim/não. Não diz: "Cria OV-XXX em /pedidos com 5 itens, valor R$ X. Cotação fica como 'convertida'."

### 6. Vínculos enterrados em tab "Vínculos"
PedidoCompraView e OrdemVendaView têm tab "Vínculos" com cards. Mas o **Resumo** (primeira tab) não mostra contadores rápidos: "3 NFs · 2 lançamentos · 1 cotação origem". Usuário precisa clicar para descobrir conexões.

### 7. Filtros "vindos de outro módulo" não aparecem como chip removível
`/fiscal?tipo=entrada` filtra mas `AdvancedFilterBar` não mostra chip "Tipo: Entrada" vindo da URL. Confunde — usuário vê grid filtrada sem entender por quê.

### 8. Conversão de cotação no drawer — falta animação de status
Status muda de "aprovado" para "convertido" mas sem destaque visual transitório. Botão "Gerar Pedido" some, aparece "Ver Pedido X" — mudança brusca.

## Padrão-base visual proposto

### A. `OriginContextBanner` — "você veio de"
Componente novo no topo do módulo destino quando há query params de origem:
```
[← Voltar ao Pedido de Compra PC-123]   Vinculando NF de entrada deste pedido
```
- Banner discreto (faixa info bg-info/5, border-info/20, h-9)
- Esquerda: botão ghost com seta + label do origem
- Direita: descrição da operação contextual
- Aplicar em: `/fiscal` quando `pedido_compra_id`, `/pedidos` quando `orcamento_id`, `/pedidos-compra` quando `cotacao_id`

### B. Toast com CTA contextual
Padrão obrigatório pós-ação cross-módulo:
```ts
toast.success("Pedido gerado!", {
  description: `OV ${numero} criada em /pedidos`,
  action: { label: "Abrir pedido", onClick: () => pushView("ordem_venda", id) }
});
```
Aplicar em: conversão de cotação, geração de NF, recebimento de PC, geração de pedido de compra, faturamento de OV.

### C. RelationalLink com sinalização visual
Adicionar variante visual:
- **Ícone PanelRightOpen** (drawer lateral) → quando abre via `pushView`
- **Ícone ExternalLink** (existente) → quando faz `navigate` (sai da tela)
- Tooltip já existe; reforçar com microcopy: "Abre painel lateral" vs "Abre em nova tela"

### D. Breadcrumb encadeado no drawer
`DrawerHeaderShell.breadcrumb` recebe o caminho do stack:
- Stack `[OV-123, NF-567]` → header da NF mostra: `Pedido OV-123 › Nota Fiscal NF-567`
- Cada segmento é clicável para navegar de volta naquele nível (em vez de só "voltar 1")
- Componente novo `DrawerStackBreadcrumb` que consome `useRelationalNavigation().stack` e renderiza com chevrons.

### E. Dialog de ação cross-módulo com `ImpactPreview`
Substituir `ConfirmDialog` simples por `CrossModuleActionDialog` em conversões/gerações:
```
Gerar Pedido a partir da Cotação ORC-456?

▸ Cria 1 Pedido em /pedidos
▸ Vincula 5 itens · R$ 12.340,00
▸ Cotação muda para "convertido"
▸ Atualiza estoque previsto

[Cancelar]  [Gerar Pedido]
```
Lista de impactos vinda como prop `impacts: { icon, label, target? }[]`.

### F. `RelatedRecordsStrip` no Resumo do drawer
Faixa horizontal de chips contadores no topo de cada View (acima das tabs):
```
[3 NFs] [2 Lançamentos] [1 Cotação origem] [1 Remessa]
```
Cada chip é clicável: abre a tab correspondente OU pushView do registro único. Resolve "conexões enterradas".

### G. Chip de filtro vindo de URL
`AdvancedFilterBar` aceita prop `urlContextChips: FilterChip[]` (read-only ou removível) que visualiza filtros vindos de query params. Variante visual: prefixo `↪ ` ou ícone Link2 indicando origem externa.

### H. Animação de transição de status
Quando status muda após ação cross-módulo (cotação convertida, NF gerada, PC recebido):
- Badge antigo faz fade-out + scale
- Badge novo faz fade-in + scale com pulse de cor
- Hook `useStatusTransition(prevStatus, currentStatus)` controla via `framer-motion` ou Tailwind keyframe simples (200ms)

## Implementação

### Componentes novos
1. **`src/components/navigation/OriginContextBanner.tsx`** — banner de "você veio de", aceita `originLabel`, `originHref`, `description`.
2. **`src/components/navigation/DrawerStackBreadcrumb.tsx`** — breadcrumb encadeado consumindo stack do RelationalNavigation.
3. **`src/components/CrossModuleActionDialog.tsx`** — dialog com lista de impactos.
4. **`src/components/views/RelatedRecordsStrip.tsx`** — faixa de chips de vínculos.
5. **`src/hooks/useCrossModuleToast.ts`** — helper que padroniza toast com action contextual.

### Componentes ajustados
6. **`src/components/ui/RelationalLink.tsx`** — props `behavior?: 'drawer' | 'route'` define ícone e tooltip.
7. **`src/components/ui/DrawerHeaderShell.tsx`** — slot `breadcrumb` recebe `<DrawerStackBreadcrumb />` quando stack > 1.
8. **`src/components/views/RelationalDrawerStack.tsx`** — usar `DrawerStackBreadcrumb` no lugar do `breadcrumbContent` simples.
9. **`src/pages/Fiscal.tsx`** — render `OriginContextBanner` quando `pedido_compra_id` na URL; pré-abrir modal NF de entrada com `fornecedor_id`/`pedido_compra_id`; mostrar chip "vindo de PC-X" em `urlContextChips`.
10. **`src/components/views/OrcamentoView.tsx`** — substituir `ConfirmDialog convertConfirmOpen` por `CrossModuleActionDialog`; toast pós-conversão com action "Abrir Pedido X" via `pushView`.
11. **`src/components/views/OrdemVendaView.tsx`** — substituir confirm de Gerar NF por `CrossModuleActionDialog`; toast pós-geração com action "Abrir NF X"; adicionar `RelatedRecordsStrip` antes das tabs.
12. **`src/components/views/PedidoCompraView.tsx`** — `RelatedRecordsStrip` (cotação origem, NFs, lançamentos); toast pós-recebimento com CTA "Abrir Fiscal" e "Abrir Financeiro".
13. **`src/hooks/usePedidosCompra.ts`** (`darEntrada`) — usar `useCrossModuleToast`.
14. **`src/pages/Orcamentos.tsx`** — converter usa `useCrossModuleToast` com action.

### Onda de aplicação
- Onda inicial: Cotação→Pedido, OV→NF, PC→Fiscal, PC→Recebimento. (Os 4 fluxos críticos.)
- Demais fluxos (financeiro→baixa, conciliação→link) ficam para passada futura.

## Fora do escopo
- Refatorar todos os `RelationalLink` do projeto (apenas atualizar componente; uso por consumer fica em onda própria).
- Animar todos os badges de status do app (apenas pós-ação cross-módulo).
- Reescrever `RelationalDrawerStack` (apenas plug do breadcrumb).
- Criar mini-mapa global de fluxo entre módulos (visualização tipo grafo — feature nova).
- Notificações persistentes pós-ação cross-módulo (sino).
- Suporte a "desfazer" cross-módulo.

## Critério de aceite
- `OriginContextBanner` aparece em /fiscal quando vem de PC, com botão de retorno funcional e abertura automática do form de NF entrada pré-vinculada.
- Toasts pós-ação cross-módulo (4 fluxos) têm CTA clicável que abre destino via drawer ou rota.
- `RelationalLink` distingue visualmente drawer vs rota.
- Drawers em stack > 1 mostram breadcrumb encadeado clicável.
- Dialogs de "Gerar Pedido" e "Gerar NF" listam impactos antes de confirmar.
- Resumo de OrdemVendaView, PedidoCompraView, OrcamentoView mostra `RelatedRecordsStrip` com contadores clicáveis.
- Filtros vindos de query params aparecem como chips marcados com ícone de origem.
- Build OK; sem regressão funcional.

## Entregáveis
Resumo final por categoria: banner de origem para chegada contextualizada, toasts com CTA pós-ação cross-módulo, RelationalLink com semântica visual de drawer vs rota, breadcrumb encadeado nos drawers em stack, dialogs com preview de impacto cross-módulo, strip de registros relacionados no resumo, chips visuais para filtros vindos de URL.

