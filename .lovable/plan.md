

# Diagnóstico visual — Shell global

## Inventário visual atual

| Camada | Altura/largura | Observação |
|---|---|---|
| Sidebar expandida | 240 px | logo + busca + favoritos + 9 seções + footer |
| Sidebar colapsada | 72 px | só ícones |
| Topbar | **64 px** (h-16) | breadcrumbs + busca (220px) + Novo + atalhos + tema + notif + conta com nome+cargo |
| `<main>` | `max-w-[1600px] px-6 py-6` | conteúdo da página |
| Headers de página | `PageShell` / `ListPageHeader` / `ModulePage` | três padrões |
| Breadcrumbs | dentro da topbar à esquerda | sempre visível |

## Problemas visuais reais

### 1. Topbar pesada demais (64 px)
A topbar tem 7 elementos competindo por atenção (breadcrumbs + busca grande de 220 px + botão "Novo" + atalhos + tema + notificações + bloco conta com nome e cargo). Em 1128 px de viewport (atual do usuário) sobra pouquíssimo espaço útil. Padrão de ERP maduro: topbar **52–56 px**, com elementos secundários compactados.

### 2. Bloco "conta" desbalanceado
`Avatar 36px + nome + cargo` ocupa ~180 px na direita só para mostrar info que o usuário já sabe. Notion/Linear/Odoo modernos mostram **só o avatar**; nome aparece no dropdown. Ganha-se ~140 px para o conteúdo central.

### 3. Busca de 220 px no header desnecessária
Já existe busca dedicada na sidebar com mesmo atalho ⌘K. Manter as duas é redundante. No header bastava um botão-ícone (igual aos demais), pois a ação primária de busca vive no rail lateral.

### 4. Breadcrumb subutilizado verticalmente
A topbar tem 64 px e o breadcrumb é uma única linha de texto pequeno. Sobra bastante "ar" vertical não usado — mas a topbar continua alta. Falta uma **segunda linha opcional** com título da página + ações rápidas, OU reduzir a altura.

### 5. Falta separação visual entre topbar e conteúdo
Topbar usa `border-b border-border bg-background/95 backdrop-blur`. O fundo `<main>` é o mesmo `bg-background`. Sem contraste, a página parece "flutuar". Falta o efeito típico de ERP: topbar levemente diferenciada (bg-card ou shadow-sm) que ancora visualmente.

### 6. PageShell repete o título da topbar
O breadcrumb já mostra "Cadastros / Clientes / **Novo Cliente**", e o `PageShell` repete `<h1>Novo Cliente</h1>` logo abaixo. Duplicação visual. ERPs maduros usam **um ou outro**: ou breadcrumb forte + título compacto, ou breadcrumb sutil + título grande. Hoje os dois competem.

### 7. PageShell sem hairline divisor
O header do PageShell (título + ações) e o conteúdo abaixo ficam num mesmo bloco `space-y-6`. Sem `border-b` ou shadow, falta ancoragem do "header da página" como zona distinta.

### 8. Padding do `<main>` defasado para o shell
`px-6 py-6` no main + `px-6` na topbar — quando a sidebar está colapsada, o conteúdo ganha 168 px extras, mas o `max-w-[1600px]` raramente é atingido em notebooks (1366–1440 px). Resultado: em larguras intermediárias o conteúdo respira bem; em telas muito largas há mar de vazio nas laterais sem que ninguém olhe pra isso.

### 9. Sidebar sem hairline interno entre zonas
Header (logo) → busca → favoritos → dashboard → seções → footer. Apenas o header e o footer têm `border-b/-t`. Favoritos, busca e seções fluem sem separação. Em ERPs maduros, há **divisores extra-sutis** entre busca/nav e entre nav/footer.

### 10. Avatar bordered competindo com primary
`Avatar` tem `border border-border` + `bg-primary text-primary-foreground` no fallback. A combinação cria um halo desnecessário. Em produtos modernos o avatar é flat ou tem ring sutil só no hover/focus.

### 11. "Novo" como pílula primary chama mais que tudo
`<Button className="gap-2 rounded-full px-4">` com fundo primary fica visualmente igual ou maior que o logo. Em ERPs profissionais a ação "Novo" é importante mas não deveria competir com o módulo atual. Padrão melhor: outline ou ghost com ícone destacado.

### 12. Notificações, atalhos e tema sem agrupamento
3 botões circulares outline em sequência (atalhos, notif, tema) parecem soltos. Falta separador visual ou agrupamento (ex: divider vertical entre "ações da página" e "ações do usuário").

### 13. Sidebar header com tipografia genérica
"AviZee" em `text-sm font-semibold` — sem peso de marca. Em ERPs modernos o header da sidebar usa logo + nome do produto com tipografia mais distintiva (ou só logo, sem texto).

### 14. Footer da sidebar perdido
"Configurações" + sync status + status dot — três informações soltas no rodapé sem hierarquia. Funciona, mas parece "puxadinho".

## Proposta visual — Padrão-base

### Topbar — reduzir e equilibrar
- Altura `h-14` (56 px) em vez de `h-16`
- Remover bloco nome+cargo do header — só avatar (com ring no focus)
- Substituir botão de busca de 220 px por **botão-ícone** circular (mesma família dos demais)
- Reordenar: `[ Breadcrumbs … flex-1 ] [ Novo ] | divider | [ Buscar ] [ Atalhos ] [ Notif ] [ Tema ] [ Avatar ]`
- "Novo": variant outline com ícone primary, não pílula sólida
- Adicionar divider vertical sutil entre "ações da página" e "ações do usuário"
- Topbar com `bg-card/50` (levemente diferente do background) para criar ancoragem

### Breadcrumb — refinar leitura
- Ícone do módulo permanece no segundo item (já implementado)
- Último item (página atual) ganha mais peso (`font-semibold`, já é `font-medium`)
- Separador `chevron-right` `h-3 w-3` (em vez de 3.5)

### PageShell — eliminar duplicação com breadcrumb
- Quando o título do PageShell é o **mesmo** do último breadcrumb, renderizar apenas subtítulo/contexto, escondendo o `<h1>` redundante (via prop opcional `hideTitleWhenSameAsBreadcrumb` ou simplesmente reduzindo o `<h1>` para `text-lg` quando há breadcrumb visível)
- Adicionar `border-b border-border/50 pb-4` no `<header>` interno para ancorar a zona "cabeçalho da página"
- Botão "voltar" como `variant="ghost"` em `size="sm"` (não icon) — fica mais discreto e o título ganha protagonismo

### Sidebar — pequenos ajustes de polimento
- Adicionar separador `border-b border-border/40` após o bloco busca e antes do footer
- Header: aumentar peso do "AviZee" para `font-bold` + tracking mais apertado (`tracking-tight`)
- Footer: agrupar "Configurações" + sync em um bloco com `bg-muted/30 rounded-lg` discreto, melhorando hierarquia

### `<main>` — densidade ajustada
- Reduzir `py-6` para `py-5` (compatibiliza com a topbar mais baixa, dá mais tela útil)
- Manter `max-w-[1600px]` e padding lateral

### Avatar — polimento
- Remover `border border-border`; usar `ring-2 ring-transparent hover:ring-primary/20 focus-visible:ring-primary/40 transition`
- Mantém aspecto flat e ganha feedback de interação

## Arquivos afetados

- `src/components/navigation/AppHeader.tsx` — altura, ordem, busca como ícone, divider, avatar simplificado
- `src/components/navigation/AppBreadcrumbs.tsx` — peso do último item, separador menor
- `src/components/AppLayout.tsx` — `py-5`, `bg-card/50` na topbar (via classe no header)
- `src/components/PageShell.tsx` — `border-b` no header, "voltar" ghost+sm, lógica de duplicação opcional
- `src/components/AppSidebar.tsx` — divisores adicionais, header com tipografia ajustada, footer agrupado
- `src/index.css` — opcional: ajuste sutil em `.page-title` para variação compacta

## Fora do escopo
- Não tocar lógica de hotkeys, providers, rotas (já refatorados)
- Não alterar tokens de cor (`--primary`, `--background`)
- Não mexer em RelationalDrawerStack
- Não migrar `ModulePage` ou `ListPageHeader` (vivem com PageShell)

## Critério de aceite
- Topbar 56 px, equilibrada e com agrupamento visual
- Sem duplicação de "Buscar" (rail + topbar)
- PageShell + breadcrumb não competem pelo mesmo título
- Sidebar com hairlines internos sutis e footer agrupado
- Avatar e ações de usuário discretos
- Build OK; sem regressão funcional

## Entregáveis
Resumo final por superfície: topbar, sidebar, breadcrumb, PageShell.

