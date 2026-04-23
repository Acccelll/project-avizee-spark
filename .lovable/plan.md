

# Revisão Mobile — Fiscal

Análise focada em **<768px**, baseada em `src/pages/Fiscal.tsx`, `src/components/fiscal/NotaFiscalDrawer.tsx`, `NotaFiscalEditModal.tsx`, `DevolucaoDialog.tsx`, `DanfeViewer.tsx`, `CertificadoValidadeAlert.tsx`, `SefazAcoesPanel.tsx`. Tabela `notas-fiscais/notas-entrada/notas-saida` cai em `MobileCardList` mas **sem nenhum prop mobile** — repete o padrão dos outros módulos antes do refactor.

---

## 1. Visão geral

Fiscal é o módulo com maior **densidade de informação por nota** (status ERP + status SEFAZ + tipo + modelo + operação + chave 44 dígitos + parceiro + valor) e maior **risco operacional** (Confirmar gera estoque/financeiro, Estornar reverte tudo, Devolução cria nova NF). Em mobile hoje:

- **Lista (`/fiscal`)** — 5 KPIs em `grid-cols-2 lg:grid-cols-4`, 5 `MultiSelect` de filtros (Tipo/Modelo/Status ERP/Origem/Status SEFAZ) `w-[150px]`–`w-[180px]` no `AdvancedFilterBar`. A tabela tem **12 colunas** (várias `hidden`) mas as 6 visíveis (Nº, Parceiro, Emissão, Status ERP, Total, Tipo, Modelo, Operação, Status SEFAZ) viram detail-fields cinzas indistinguíveis no card. Os **dois badges de status** (ERP + SEFAZ) que são a info mais importante para o gestor escanear ("essa NF foi autorizada pela SEFAZ?") aparecem como linhas do meio do card sem hierarquia.
- **Drawer (`NotaFiscalDrawer`)** — Resumo razoável, mas **6 tabs** (Resumo / Itens / Fiscal / Arquivos / Eventos / Vínculos) que em mobile `Tabs` viram scroll horizontal apertado. Tabs Itens e Fiscal contêm `<table>` HTML com 7 colunas — estouram horizontal. Footer V2 já tem `DrawerStickyFooter` com Estornar à esquerda + DANFE/Devolução/Confirmar à direita — **4 botões competindo por ~390px**.
- **Form de criação (`FormModal`)** — `grid-cols-2 md:grid-cols-5` para Tipo/Modelo/Número/Série/Data (5 campos em 1 linha desktop) → em mobile vira `grid-cols-2` com 3 linhas. Itens via `ItemsGrid`. Bloco "Frete, Impostos e Despesas" é `grid-cols-2 md:grid-cols-4` com 8 inputs `h-8 text-xs` — campos de ~150px de largura, teclado QWERTY (sem `inputMode="decimal"`).
- **`DevolucaoDialog`** — `Dialog max-w-3xl` com tabela HTML 5-col + Input qtd `h-7 w-20` por linha. Em mobile a tabela estoura e o input "qtd a devolver" — campo crítico — fica num `h-7 w-20` (28px de altura, 80px de largura).
- **`DanfeViewer`** — `Dialog max-w-3xl max-h-[90vh]`. Emitente/Destinatário em `grid-cols-2`, tabela de itens com 6+ colunas. Em portrait estoura horizontal e o usuário precisa pinch-zoom.
- **Edit Modal (`NotaFiscalEditModal`)** — herda do `FormModal` com mesma estrutura do create.
- **`CertificadoValidadeAlert`** — `Alert` full-width com texto em 2-3 linhas. OK em mobile, mas o CTA "renovar" é apenas texto inline, sem botão tappable.

## 2. Problemas críticos (bloqueiam uso real)

- **C1 — DataTable `notas-fiscais` sem props mobile**: `mobileStatusKey`, `mobileIdentifierKey`, `mobilePrimaryAction`, `mobileInlineActions` ausentes. Os **dois status críticos** (ERP + SEFAZ) ficam enterrados como linhas cinzas. Ações sensíveis (Confirmar/Estornar/DANFE/Devolução) só ficam acessíveis após abrir o drawer.
- **C2 — Footer do `NotaFiscalDrawer` em mobile**: até **4 botões** simultâneos (Estornar, DANFE, Devolução, Confirmar NF) competem por ~390px. `DrawerStickyFooter` já existe, mas com 4 botões `size="sm"` lado a lado em mobile, cada um fica < 80px de largura — touch target ruim para ação destrutiva (Estornar) ao lado de ação primária (Confirmar). **Risco real de tap acidental em ação irreversível**.
- **C3 — `DevolucaoDialog` em mobile**: `Dialog max-w-3xl` + tabela HTML 5-col que estoura + Input `h-7 w-20` (28×80px) por linha para a quantidade — abaixo dos 44px e do `inputMode="numeric"`. Devolução é operação que cria nota nova vinculada (RPC) — precisa precisão. Em celular o usuário facilmente digita errado.
- **C4 — `DanfeViewer` em mobile**: tabela de 6+ colunas dentro de `Dialog max-w-3xl` força scroll horizontal cego. O DANFE no celular é um caso de uso comum (mostrar para conferência) e fica ilegível.
- **C5 — Tabs do Drawer (6) em mobile**: `Resumo / Itens / Fiscal / Arquivos / Eventos / Vínculos` em viewport 360-414px viram `overflow-x-auto`. Mesmo com scroll, labels como "Eventos (12)" + "Itens (24)" disputam espaço; aba ativa não fica visível ao trocar.
- **C6 — Bloco "Frete, Impostos e Despesas" no form**: 8 inputs numéricos `h-8 text-xs` em `grid-cols-2 md:grid-cols-4`. Em mobile = 4 linhas de 2 inputs de ~150px cada, sem `inputMode="decimal"` (abre QWERTY). Para uma NF de entrada manual (caso comum), o usuário precisa preencher ICMS/IPI/PIS/COFINS — **operação contábil sensível em UX hostil**.
- **C7 — Confirmar / Estornar em ConfirmDialog desktop**: `useConfirmDialog` abre Dialog padrão; em mobile o texto longo de descrição ("o ERP registrará efeitos operacionais (estoque) e financeiros…") + botão "Estornar" (destrutivo) podem ficar cobertos pelo teclado se houver textarea de motivo.

## 3. Problemas médios (atrapalham uso)

- **M1 — 5 KPIs**: `grid-cols-2 lg:grid-cols-4` = **3 linhas** em mobile (~360px de altura) antes da lista. "Total de NFs" e "Valor Total" são sempre redundantes com o footer da tabela.
- **M2 — 5 MultiSelect de filtros** + 1 SearchInput no `AdvancedFilterBar` — já colapsa em popover, mas o popover herda `w-[180px]` dos selects internos, e em modo "tipo entrada/saída" (rota `/fiscal/entrada`) o filtro Tipo é redundante (já filtrado por `tipoParam`).
- **M3 — Botão "Importar XML" no `headerActions`**: input file escondido + botão `size="sm"` `gap-1.5` com ícone `h-3.5 w-3.5`. Em mobile o XML vem de email/WhatsApp — fluxo de seleção de arquivo funciona, mas o botão tem touch target ~32px.
- **M4 — Tab "Itens" no Drawer**: `<table>` HTML 7-col (Produto/Qtd/Unit/Total/CST/CFOP/Conta) sem fallback mobile. Usuário precisa scroll horizontal dentro de drawer dentro de página.
- **M5 — Tab "Fiscal" + chave de acesso**: bloco "Identificação Fiscal" `grid-cols-2`, e a chave 44 dígitos com `break-all` + botão Copy `h-3.5 w-3.5` (14px). Em touch o botão é praticamente inalcançável.
- **M6 — Tab "Impacto em Estoque"**: outra `<table>` 4-col (Produto/Tipo/Qtd/Saldo). Mesmo problema.
- **M7 — `FormModal` edit**: tem 1100 linhas e múltiplos `grid-cols-2 md:grid-cols-4` que em mobile comprimem inputs financeiros. Read-only fields ainda renderizam como `<Input disabled>` (cinza, ocupa espaço). Em NF confirmada (`isFiscalReadOnly`) o usuário não deveria editar nada — em mobile faz mais sentido renderizar como ViewField compacto.
- **M8 — Conta contábil por item**: bloco com `Select h-8 text-xs flex-1` por item — em mobile cada linha tem nome truncado em `min-w-[120px]` + Select. Comprime tudo.
- **M9 — `OriginContextBanner`**: quando vem de Pedido de Compra (`?pedido_compra_id=`), banner ocupa linha dupla em mobile.
- **M10 — `CertificadoValidadeAlert`**: em mobile, Alert ocupa ~120px de altura com texto explicativo + sem CTA "Renovar agora"/"Configurar certificado" tappable. Ação fica perdida.

## 4. Problemas leves (polimento)

- **L1 — Subtitle do `ModulePage`** ("Notas fiscais, faturas e documentos") em 360px quebra em 2 linhas e empurra os KPIs.
- **L2 — Coluna "Modelo" e "Operação"** no card mobile aparecem como linhas extras quando o tipoParam já implica o contexto.
- **L3 — Badges Tipo entrada (primary) e saída (warning)** com `border-` apenas, baixo contraste em mobile dark mode.
- **L4 — Tooltip `title="Estorno operacional…"`** no botão Estornar — em touch só aparece com long-press não óbvio.
- **L5 — Botão Copy chave de acesso** com Tooltip nativo (`title=`) — não dispara em touch; usuário descobre por tentativa.
- **L6 — Status SEFAZ "nao_enviada"** padrão renderizado como badge neutra — para uma NF em rascunho/pendente isso é esperado, mas o usuário lê como "está faltando alguma coisa".

## 5. Melhorias de layout

- **Card de NF mobile com hierarquia clara**:
  - **primary**: `NF nº · Modelo` (ex.: "NF 1234 · NF-e")
  - **identifier**: parceiro (truncate)
  - **status pill (`mobileStatusKey`)**: status ERP via `STATUS_VARIANT_MAP`
  - **sub-pill secundário**: status SEFAZ (ao lado da pill principal, menor)
  - **primary metric**: valor total
  - **sub-metric**: data emissão + chip "Devolução" se tipo_operacao≠normal
  - **primaryAction (`mobilePrimaryAction`)**: contextual por estado
    - `pendente`/`rascunho` → "Confirmar NF" (full-width 44px)
    - `confirmada`/`autorizada` → "DANFE"
    - `cancelada`/`rejeitada` → "Ver detalhes"
  - **inlineActions**: "Editar" (se `!isFiscalReadOnly`) + "Mais ⋯" (menu com Estornar/Devolução/Importar)
- **Drawer footer mobile**: ação primária full-width + secundárias num menu "⋯". Estornar (destrutivo) **sempre** dentro do menu, nunca lado a lado com Confirmar.
- **Drawer tabs**: reduzir a 3 abas em mobile — `Resumo` (junta Resumo + Fiscal), `Itens`, `Mais` (com Eventos/Vínculos/Arquivos em sub-seções colapsáveis).
- **DANFE em mobile**: layout vertical com cards (Emitente, Destinatário, Itens como lista de cards, Totais), full-screen sheet em vez de Dialog quadrado.
- **DevolucaoDialog em mobile**: bottom-sheet com itens em **lista de cards verticais** (cada card: nome do produto grande, qtd original, stepper [−][qty][+] com inputs `h-11`, subtotal). Footer sticky com total + Confirmar.
- **Form de impostos**: Collapsible "Impostos e despesas (avançado)" colapsado por padrão em mobile; quando aberto, inputs full-width `h-11` com `inputMode="decimal"`.
- **5 KPIs → 4 + banner**: remover "Total de NFs" (redundante com count na lista) e mostrar 4 cards (Pendentes, Confirmadas, Rejeitadas, Valor Total). Pendentes tappable filtra a lista.

## 6. Melhorias de navegação

- **Drawer V2 já tem fechar** ✓.
- **DevolucaoDialog**, **DanfeViewer**, **ConfirmDialog** (Confirmar/Estornar) → bottom-sheet em mobile (mesmo padrão de Comercial/Compras/Financeiro).
- **NotaFiscalEditModal** → continua FormModal (form com itens dinâmicos vai para página, conforme `mem://produto/quando-drawer-quando-pagina.md`). Já existe `/fiscal/:id` (FiscalDetail) e `NotaFiscalForm.tsx` — em mobile o "Editar" deveria **navegar para a página** em vez de abrir modal pesado.
- **Ações destrutivas em menu separado**: Estornar, Devolução e Inativar nunca lado a lado com ações primárias — sempre via menu `⋯` com confirm dialog mobile-friendly.
- **OriginContextBanner**: já existe — manter; só ajustar quebra mobile.

## 7. Melhorias de componentes

- **`DataTable` props mobile** (3 moduleKeys: `notas-fiscais`, `notas-entrada`, `notas-saida`):
  - `mobileStatusKey="status"` (ERP)
  - `mobileIdentifierKey="parceiro"` (computed)
  - `mobilePrimaryAction` contextual via callback (ver §5)
  - `mobileInlineActions`: Editar (se editável) + DANFE + menu Mais
  - Render adicional do `status_sefaz` como sub-pill no card
- **`DevolucaoDialog` → Sheet bottom-sheet em mobile**:
  - Lista de cards verticais por item (não tabela)
  - Stepper qtd com `min-h-11` e `inputMode="numeric"`
  - Header sticky com NF original (resumo compacto 2x2 grid)
  - Footer sticky com total + Confirmar
  - Textarea Motivo com label visível e placeholder
- **`DanfeViewer` → Sheet bottom-sheet em mobile**:
  - Cards verticais (Cabeçalho, Emitente, Destinatário, Itens-como-lista, Totais)
  - Itens viram cards (não tabela): Nome + Qtd × Unit = Total
  - Botão "Compartilhar PDF" sticky no footer
- **`NotaFiscalDrawer` footer mobile**:
  - Ação primária por estado em `right` (full-width 44px na linha de baixo)
  - DANFE + secundárias em menu `⋯`
  - Estornar **só dentro do menu**, com confirm sheet
  - Reduzir a 3 tabs (Resumo+Fiscal merged, Itens, Mais)
  - Tab "Itens" com lista de cards mobile (Produto, Qtd × Unit, CST/CFOP em chips inline)
- **`NotaFiscalEditModal`**: em mobile, redirecionar `Editar` → `/fiscal/:id/editar` (navegação) em vez de abrir modal pesado. Manter modal no desktop.
- **`FormModal` create**: bloco "Impostos" como `Collapsible` em mobile, inputs `h-11` com `inputMode="decimal"`.
- **`CertificadoValidadeAlert`**: adicionar botão "Configurar Certificado" tappable (`min-h-11`) que navega para `/configuracao-fiscal`.
- **Botão Copy chave acesso**: aumentar para `min-h-11 min-w-11` (target real).
- **`SefazAcoesPanel`**: 4 botões em linha → em mobile, primary "Transmitir" full-width + restante em menu.

## 8. Melhorias de fluxo

- **Confirmar em 2 toques**: card de NF pendente → tap "Confirmar NF" full-width → sheet de confirm com resumo (parceiro, valor, impactos esperados) → tap "Confirmar". Hoje: abrir drawer → scroll → tap Confirmar → ConfirmDialog → tap.
- **DANFE em 1 toque**: para NF autorizada/confirmada, primaryAction "DANFE" no card abre direto o viewer (sem passar pelo drawer).
- **Devolução em mobile**: card de NF saída confirmada → menu ⋯ → "Devolução" → bottom-sheet de itens com steppers (não inputs livres).
- **Importar XML mobile**: hoje funciona mas botão pequeno; aumentar e mover para FAB ou `addLabel` secundário.
- **Editar NF rascunho/pendente**: em mobile, ao tocar "Editar", **navegar para `/fiscal/:id/editar`** (página dedicada) — form com itens dinâmicos não cabe em drawer/modal mobile.
- **Renovar certificado**: alerta com CTA tappable que leva direto à `/configuracao-fiscal`.

## 9. Sugestões de redesign mobile (sem inventar sistema novo)

Reaproveitar o padrão consolidado em **`mem://produto/comercial-mobile.md`**, **`compras-mobile.md`**, **`estoque-logistica-mobile.md`** e **`financeiro-mobile.md`**:

- **`MobileCardList` + props mobile** já no `DataTable`.
- **`Sheet` bottom-sheet** para DanfeViewer, DevolucaoDialog e ConfirmDialog (Confirmar/Estornar com motivo).
- **`DrawerStickyFooter` (V2)** já em uso — só ajustar a hierarquia (primary full-width + menu).
- **`STATUS_VARIANT_MAP`** já consolidado — `FiscalInternalStatusBadge` e `FiscalSefazStatusBadge` já seguem.
- **Sub-pill SEFAZ** ao lado do status ERP no header do card mobile (padrão novo, mas trivial).
- **Páginas dedicadas** (`/fiscal/:id`) para edit em mobile — alinhado com `mem://produto/quando-drawer-quando-pagina.md`.
- Documentar em **`mem://produto/fiscal-mobile.md`** as decisões.

## 10. Roadmap de execução

| # | Etapa | Resolve | Esforço |
|---|---|---|---|
| **1** | Aplicar `mobileStatusKey/mobileIdentifierKey/mobilePrimaryAction/mobileInlineActions` em `notas-fiscais/notas-entrada/notas-saida` com primary contextual por estado (Confirmar/DANFE/Ver) e sub-pill SEFAZ no header do card | C1 | M |
| **2** | `NotaFiscalDrawer` footer mobile: ação primária por estado full-width + menu `⋯` para secundárias; **Estornar sempre dentro do menu** com confirm sheet | C2 | S |
| **3** | `DevolucaoDialog` → bottom-sheet mobile com lista de cards + stepper qtd `min-h-11` + `inputMode="numeric"` + footer sticky com total | C3 | M |
| **4** | `DanfeViewer` → bottom-sheet mobile com layout vertical (cards de Emitente/Destinatário/Itens-como-lista/Totais) | C4 | M |
| **5** | `NotaFiscalDrawer` tabs mobile: reduzir a 3 (Resumo+Fiscal merged, Itens, Mais com Eventos/Vínculos/Arquivos colapsáveis); tabela de Itens vira lista de cards mobile | C5, M4, M5, M6 | M |
| **6** | `FormModal` create/edit: bloco Impostos como `Collapsible` em mobile; inputs `h-11` com `inputMode="decimal"`; conta contábil por item em layout vertical | C6, M7, M8 | S |
| **7** | `useConfirmDialog` (Confirmar/Estornar): garantir comportamento bottom-sheet em mobile com footer sticky (ConfirmDialog já tem patch — verificar e estender se necessário) | C7 | XS |
| **8** | KPIs Lista: 5 → 4 cards em mobile + banner "X pendentes" tappable (filtra status=pendente) | M1 | XS |
| **9** | Editar NF em mobile: redirecionar `onEdit` para `/fiscal/:id/editar` (página) em vez de abrir `NotaFiscalEditModal` | M7, fluxo | S |
| **10** | `CertificadoValidadeAlert`: adicionar botão "Configurar Certificado" tappable `min-h-11` que navega para `/configuracao-fiscal` | M10 | XS |
| **11** | Polimento: subtitle truncate, badges Tipo com fundo (não só border), botão Copy chave `min-h-11 min-w-11`, header `Importar XML` com touch target adequado | L1, L3, M3, M5 | XS |
| **12** | Documentar em `mem://produto/fiscal-mobile.md` + atualizar `mem://index.md` | governança | XS |

**Quick wins (alto valor, baixo risco)**: 1, 2, 8, 10, 11.
**Estruturais (mudam fluxo)**: 3, 4, 5, 6, 9.
**Polimento**: 7, 12.

