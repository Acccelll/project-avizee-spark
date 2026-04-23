

# Revisão Mobile — Configurações (`/configuracoes`)

Análise focada em **<768px**, baseada em `Configuracoes.tsx`, `MeuPerfilSection.tsx`, `AparenciaSection.tsx`, `SegurancaSection.tsx`, `EmpresaInfoSection.tsx`. **Importante:** os "campos técnicos (SMTP, API)" e "teste de conexão" mencionados ficam em `/administracao` (`IntegracoesSection`, `EmpresaSection`) e não nesta tela — `/configuracoes` é exclusivamente pessoal (perfil, aparência, segurança e visualização de empresa). Esta revisão respeita esse escopo e trata apenas das 4 abas reais. A separação pessoal × global já existe e funciona; o foco mobile é **encurtar formulários, melhorar leitura e tornar as ações principais alcançáveis**.

---

## 1. Visão geral

`/configuracoes` é uma tela de **preferências**, não operacional. Em mobile é razoavelmente usável (não há tabelas, gráficos nem matrizes), mas tem três focos de fricção:

- **Tabs horizontais com 4 itens + ícones** — em 360px ficam apertadas mas cabem com scroll horizontal (já tem `overflow-x-auto`).
- **`AparenciaSection` muito longa** (~290 linhas, 6 grupos separados por `Separator`) — vira um único scroll vertical de >1500px sem ancoragem nem sticky.
- **`SegurancaSection` formulário de senha** com 3 campos + critérios + força — funciona, mas inputs `max-w-sm` ficam estreitos demais em mobile e o botão "Alterar senha" fica perdido no fim sem sticky.
- Os atalhos para **Administração** (3 botões "Ir para configurações globais") aparecem em 3 cards distintos — bom para não confundir, mas o card de "Escopo pessoal" ocupa muito espaço útil em mobile.

Não há bloqueios de uso reais — Configurações é uma das melhores telas mobile do sistema hoje. Os ajustes são todos de **redução de carga visual** e **alcance de polegar**.

## 2. Problemas críticos (bloqueiam uso real)

Não há problemas críticos — a tela é navegável e completável em mobile.

## 3. Problemas médios (atrapalham uso)

- **M1 — Card "Escopo pessoal" ocupa espaço útil**: `Configuracoes.tsx` linhas 79-101, antes das tabs, há um Card explicativo grande (`pt-6`, texto longo + botão/badge). Em mobile consome ~180px do topo antes do usuário ver as tabs. Útil em desktop, ruído em mobile.
- **M2 — `AparenciaSection` é um único scroll de 6 grupos**: Aparência geral, Leitura, Acessibilidade, Sessão, Menu lateral, Branding global, Restaurar — separados só por `<Separator />`. Sem âncoras nem agrupamento colapsável, o usuário rola muito para encontrar "Tamanho da fonte" ou "Sessão".
- **M3 — Slider de fonte difícil de tocar**: `<Input type="range">` nativo (linhas 111-124) tem touch target ~20px de altura. Em iOS/Android o "polegar" do slider é pequeno e fácil de errar.
- **M4 — Trio de cards "Modo do menu lateral"** (`grid-cols-3` em desktop, vira `grid-cols-1` em mobile, linha 193): 3 botões grandes empilhados ocupam ~240px, e em mobile o conceito "menu lateral" não se aplica (mobile usa bottom nav / drawer). Deveria ficar **oculto em mobile** com nota explicativa.
- **M5 — `SegurancaSection` inputs com `max-w-sm`** (linhas 110, 144, 203): em mobile 360px, `max-w-sm` (24rem = 384px) acaba ficando confortável, mas em telas 320px corta. Para formulário, `w-full` em mobile é mais natural.
- **M6 — Botão "Alterar senha" sem sticky**: o usuário preenche 3 campos + valida 5 critérios + força, mas o botão fica no fim do scroll. Em mobile, após digitar a confirmação com teclado virtual aberto, o botão pode ficar fora da viewport.
- **M7 — `MeuPerfilSection` 3 cards grandes** (Avatar+identidade, Dados editáveis, Dados corporativos read-only) — soma ~900px de scroll. O 3º card é puro read-only e poderia colapsar em mobile.
- **M8 — `EmpresaInfoSection` Field grid** `sm:grid-cols-2`: em <640px vira 1 coluna, ficando ~10 linhas de "label + value" empilhadas (~600px). Os pares "Cidade/UF", "CEP", "Telefone" são curtos e poderiam ser apresentados como `dl` compacto inline.
- **M9 — Tabs horizontais com label + ícone em 360px**: "Meu Perfil", "Aparência", "Segurança", "Empresa" + ícone + `gap-2 px-4 py-2.5` = força scroll horizontal. Aceitável, mas sem indicador visual (chevron/gradient) de que há mais à direita.
- **M10 — Touch targets de toggles `Switch`**: o componente `Switch` shadcn em mobile tem ~24px de altura. Em "Reduzir animações" e "Manter sessão ativa" funciona, mas a área tocável poderia ser o card inteiro (clicar em qualquer lugar do `rounded-lg border p-4`).
- **M11 — Color preview branding read-only** em `AparenciaSection` (linhas 224-262): bloco grande com 2 swatches + botão "Gerenciar branding global". Em mobile, ocupa ~180px só para mostrar 2 cores — informação pouco acionável aqui.
- **M12 — `AlertDialog` "Restaurar padrão"** em mobile usa `Dialog` clássico, sem bottom-sheet nem touch targets enlarged.

## 4. Problemas leves (polimento)

- **L1 — Subtítulo do `ModulePage`** "Preferências pessoais da sua conta." é curto e ok.
- **L2 — Avatar `h-16 w-16`** em `MeuPerfilSection` ok, mas o nome "{user?.email}" pode quebrar em emails longos sem `truncate` aparente nos breakpoints menores.
- **L3 — Critérios de senha** (linhas 235-244): 5 itens com `text-xs` (12px) — leitura no limite em mobile.
- **L4 — Mensagem "Aplicação imediata no seu perfil"** em `AparenciaSection` (linhas 40-48): bloco informativo de ~80px, útil mas redundante com o pattern visual de auto-save.
- **L5 — `EmpresaInfoSection` "Identidade visual"** com swatches + textos `font-mono text-[11px]` — abaixo do recomendado para mobile (12px+).
- **L6 — Lista de admins (não-admin)**: `<a href="mailto:">` com ícone pequeno (`h-3.5`) — touch target abaixo de 44px.
- **L7 — Tabs roleplay**: `aria-selected` ok, mas falta `tabIndex` e gestão de foco para teclado/leitor de tela em swipe.

## 5. Melhorias de layout

### Tabs mobile
- Deslocar para **scrollable underline tabs** com indicador de overflow (gradient/sombra à direita) sinalizando que há mais abas — já tem `overflow-x-auto`, falta o feedback visual.
- Em telas <640px, considerar **só ícone + label curta** ("Perfil / Aparência / Segurança / Empresa") sem o "Meu" para economizar espaço.

### Card "Escopo pessoal" (topo)
- Em mobile (`md:hidden` invertido), **colapsar em uma única linha**: `Badge` "Escopo pessoal" + ícone `Info` que abre tooltip/sheet com a explicação completa. Recupera ~140px do topo.

### `MeuPerfilSection`
- Card identidade: manter (é o cabeçalho da seção).
- Card "Dados editáveis": adicionar **sticky save bar mobile** (`fixed bottom-0` com `safe-area-inset-bottom`) que aparece **só quando `dirty=true`**.
- Card "Dados corporativos e de acesso": **`<details>`/`Accordion` colapsado por padrão em mobile** — usuário expande quando precisa ver o e-mail/perfil.

### `AparenciaSection` (maior ganho)
- Refatorar os 6 grupos como **`Accordion type="multiple"`** em mobile (em desktop continua tudo aberto via `Separator`). Cada grupo vira um item recolhível, acelerando navegação.
- Esconder em mobile: o bloco "Comportamento do menu lateral" (M4) — mostrar apenas uma nota: *"Configurações do menu lateral aplicam-se ao desktop."* com link para abrir em desktop.
- Slider de fonte: substituir `<Input type="range">` nativo por **`Slider` shadcn** (padrão Radix) com `min-h-11` no thumb e marcas visuais maiores (Padrão / Médio / Grande / Máximo).
- Cards de toggle (Reduzir animações, Manter sessão ativa): tornar o **card inteiro tappable** (`role="button"` no wrapper) — toque em qualquer lugar alterna o switch.
- Bloco "Cores institucionais": em mobile, reduzir para 1 linha compacta com 2 swatches + botão pequeno "Editar (admin)".
- Botão "Restaurar padrão" no fim: trocar `AlertDialog` por **`Drawer` bottom-sheet** em mobile.

### `SegurancaSection`
- Card "Dados de acesso" ok — read-only e curto.
- Card "Alterar senha":
  - Inputs **`w-full` em mobile**, removendo `max-w-sm` no breakpoint mobile.
  - **Sticky bottom action bar** com botão "Alterar senha" `min-h-11` enquanto o usuário digita.
  - Critérios da senha + força: agrupar num **bloco compacto inline** (não em card separado) — economiza ~120px.
  - Botões `Eye/EyeOff` (`absolute right-3`): aumentar área tocável para `min-w-11 min-h-11` (botão maior, ícone do mesmo tamanho).
- "Boas práticas de segurança" no fim: colapsar em accordion `<details>` em mobile.

### `EmpresaInfoSection`
- Substituir o grid de Fields por **lista compacta `dl`**: cada item em uma linha (`label · valor`), com `Razão social` em destaque acima.
- Cards "Identidade visual" e "Para alterar dados, fale com admin": manter, mas com swatches `h-7 w-7` e códigos `text-xs` (não `text-[11px]`).
- Lista de admins: cada item em **card tappable** (`min-h-11`) que abre direto o `mailto:` — não exigir tap preciso no link pequeno.

### Geral
- **Sticky save em qualquer aba com `dirty`**: padronizar a barra inferior (`fixed bottom-0 left-0 right-0 z-30 bg-background border-t pb-[env(safe-area-inset-bottom)]`) — já estabelecida em `mem://produto/administracao-mobile.md`.
- **Skeletons** em `EmpresaInfoSection` já existem ✓; padronizar `MeuPerfilSection` e `AparenciaSection` (que hoje renderizam "vazio" enquanto carregam).
- **Touch targets**: garantir `min-h-11` em todos os botões/triggers de seção (Tabs, Switch wrappers, links externos).

## 6. Roadmap de execução

| # | Etapa | Resolve | Esforço |
|---|---|---|---|
| **1** | `Configuracoes.tsx`: card "Escopo pessoal" colapsado em mobile (badge + tooltip/sheet com explicação); tabs com indicador de overflow horizontal e labels mais curtas em <640px | M1, M9 | XS |
| **2** | `AparenciaSection`: converter os 6 grupos em `Accordion type="multiple"` em mobile (todos abertos em desktop); ocultar bloco "Menu lateral" em mobile com nota; substituir slider nativo por `Slider` shadcn `min-h-11` | M2, M3, M4 | M |
| **3** | `AparenciaSection`: cards de toggle (Reduzir animações, Manter sessão) inteiramente tappable; bloco "Cores institucionais" em 1 linha compacta em mobile; `AlertDialog` "Restaurar padrão" como `Drawer` bottom-sheet em mobile | M10, M11, M12 | S |
| **4** | `SegurancaSection`: inputs `w-full` em mobile; sticky bottom save bar com "Alterar senha" `min-h-11` quando há `currentPassword`; critérios + força inline compactos; áreas tocáveis Eye/EyeOff `min-h-11 min-w-11`; "Boas práticas" em accordion mobile | M5, M6, L3, L6 | S |
| **5** | `MeuPerfilSection`: sticky save bar mobile aparece quando `dirty=true`; card "Dados corporativos" em `Accordion` colapsado por padrão em mobile; truncate no email longo | M7, L2 | S |
| **6** | `EmpresaInfoSection`: substituir grid de Fields por lista `dl` compacta; tipografia `text-xs` (≥12px) em vez de `text-[11px]`; cards de admin tappable inteiros (`min-h-11`) com `mailto:` | M8, L5, L6 | S |
| **7** | Polimento: subtítulo do `AlertDialog` "Restaurar" curto; padronizar Skeletons em `MeuPerfilSection` e `AparenciaSection` durante load | L1, L4 | XS |
| **8** | Documentar em `mem://produto/configuracoes-mobile.md` (padrão accordion para sections com 4+ grupos, sticky save em forms pessoais, tappable card-toggle pattern) + atualizar `mem://index.md` | governança | XS |

**Quick wins (alto valor, baixo risco)**: 1, 3, 4, 5, 6, 7.
**Estrutural (muda fluxo de leitura)**: 2 (Accordion em Aparência).
**Polimento + governança**: 7, 8.

> **Fora de escopo desta tela**: SMTP, API e "teste de conexão" — esses ficam em `/administracao` (`IntegracoesSection` + `EmpresaSection`). A revisão mobile dessas seções já foi feita no roadmap de Administração (etapa 12 — Textarea SEFAZ + toggle `min-h-11`). Se quiser aprofundar UX de "teste de conexão SMTP" especificamente, é um plano à parte focado em `IntegracoesSection`.

