

## Diagnóstico visual — telas de edição

Mapeei **12 telas/modais de edição** (todas via `FormModal`). A base é a mesma (Dialog do shadcn, `max-w-*` + `max-h-[90dvh]`), mas cada tela inventou seu cabeçalho, contexto, abas, footer e densidade. Resultado: parece sistema montado por equipes diferentes.

### Inconsistências concretas

**1. Cabeçalho do modal**
`FormModal` só renderiza `<DialogTitle>{title}</DialogTitle>` — texto puro. Nenhum suporte a:
- código/identificador (SKU, CNPJ, código)
- StatusBadge
- ações rápidas no topo
- linha de metadados (atualizado em, classificação)

Telas tentam compensar com "barras de contexto" inventadas por baixo do título — cada uma com layout diferente.

**2. Barras de contexto (4 estilos diferentes)**
| Tela | Container | Conteúdo |
|---|---|---|
| Clientes | `bg-muted/40 rounded-lg px-3 py-2 mb-4 border` | Status + data + forma pgto + grupo + dirty |
| GruposEconomicos | mesma classe | Status + data + empresas + risk badge + dirty + botão "Ver painel" |
| Produtos | `p-3 bg-muted/40 rounded-lg border mb-4` + emoji `●/○` | Status (texto colorido) + atualização + link "Ver resumo" |
| Transportadoras | `gap-x-3 gap-y-1 px-3 py-2 mb-5 bg-muted/30` | Status + duas datas + modalidade + cidade |
| Fornecedores/Funcionarios/FormasPagamento/ContasBancarias/UnidadesMedida | **nenhuma** | — |

**3. Tabs inconsistentes**
- Clientes/Produtos/Transportadoras usam Tabs com ícones `h-3.5 w-3.5` + `text-xs` + badge contador
- Funcionarios/FormasPagamento/GruposEconomicos usam **divisores horizontais** (`<div className="h-px bg-border" />`) ao invés de Tabs — mistura abordagem
- ContasBancarias/UnidadesMedida sem Tabs nem divisores

**4. Section headers (3 padrões)**
- Produtos: `<h3 className="font-semibold text-sm flex items-center gap-2 border-t pt-3"><Icon />Título</h3>`
- GruposEconomicos: `pb-3 border-b mb-3` com ícone `text-primary/70`
- FormasPagamento: `pb-2 border-b mb-4` com ícone `text-primary/70`
- Funcionarios: chip uppercase `text-xs font-semibold uppercase tracking-wider text-muted-foreground` + linha
- Clientes: misto (sem header em Dados Gerais)

**5. Footer (sem sticky, repetido 12×)**
Todas usam variações de `<div className="flex justify-end gap-2 pt-4 border-t">` inline. Não é sticky → em formulário longo, usuário precisa rolar pra achar Salvar. Texto do botão varia: "Salvar" vs "Salvar Alterações" vs "Salvando..." vs spinner com `<Loader2>`.

**6. Outros**
- Indicador "Alterações não salvas" só existe em Clientes/Fornecedores/GruposEconomicos
- Cores hardcoded `text-amber-600` / `text-emerald-600` em vez de tokens semânticos
- "Cancelar" sem confirmação visual de descarte — só Clientes/Fornecedores fazem o `confirmDiscard`
- Tooltip no botão Salvar inexistente quando desabilitado

## Estratégia

Padronizar **a casca** sem reescrever conteúdo. O conteúdo de cada tela (campos, tabs, regras) fica como está — só ganha um shell consistente.

### Fase 1 — Infraestrutura visual compartilhada

**1. Evoluir `FormModal`** (mantém API atual + adiciona props opcionais)
```tsx
<FormModal
  open onClose title="Editar Cliente"
  // novos opcionais:
  identifier="CNPJ 12.345.678/0001-90"   // mono, ao lado do título
  status={<StatusBadge .../>}             // badge ao lado do título  
  meta={[                                 // linha de metadados
    { icon: Calendar, label: "Atualizado em 17/04/2026" },
    { icon: User, label: "Grupo ABC" }
  ]}
  headerActions={<Button>Ver painel</Button>}  // ações rápidas top-right
  isDirty={isDirty}                        // mostra indicador "não salvas"
  footer={<FormModalFooter ... />}         // sticky bottom
  size="xl"
/>
```

Layout interno do header novo:
```
┌─────────────────────────────────────────────────────────┐
│ Editar Cliente   [CNPJ 12.345...] [● Ativo]  [⋯] [Ver]│ ← title row
│ 📅 Cadastrado 12/03  ·  💳 30/60/90  ·  ● Não salvas  │ ← meta row
├─────────────────────────────────────────────────────────┤
│ ... conteúdo ...                                        │
```

**2. Novo `FormModalFooter`** (sticky bottom, padronizado)
```tsx
<FormModalFooter
  saving={saving}
  isDirty={isDirty}
  onCancel={handleCancel}
  primaryLabel="Salvar"        // ou "Salvar Alterações" auto via mode
  // opcional:
  secondaryActions={<Button>Salvar e novo</Button>}
/>
```
- Sticky `bottom-0` com `bg-background/95 backdrop-blur`, sombra superior
- Esquerda: indicador "alterações não salvas" (se `isDirty`)
- Direita: Cancelar (outline) + Primária (default, com `Loader2` quando saving)
- Trava double-click via `disabled={saving}`

**3. Novo `FormSection` + `FormSectionHeader`** (substitui as 4 variações)
```tsx
<FormSection icon={Package} title="Identificação" 
             description="Como o produto será identificado no sistema">
  <div className="grid grid-cols-2 gap-4">...</div>
</FormSection>
```
Visual único: chip-label uppercase + linha sutil + ícone primary/70 + descrição opcional.

**4. Novo `FormTabsList` wrapper leve**
Encapsula o padrão Clientes/Produtos: ícones `h-3.5 w-3.5`, badge contador, sticky abaixo do header quando o modal tiver scroll alto.

### Fase 2 — Aplicação cirúrgica (12 telas)

| Tela | Mudança visual |
|---|---|
| **Clientes** | Header novo com CNPJ identifier + StatusBadge; meta row consolidada; FormModalFooter sticky; tabs via FormTabsList |
| **Fornecedores** | Mesmo padrão de Clientes (já é forma similar) |
| **Produtos** | Header com SKU/Código identifier + StatusBadge + último update; FormSection nas 5 seções existentes; footer sticky |
| **Transportadoras** | Header com CNPJ + modalidade + cidade no meta; FormTabsList; footer sticky |
| **Funcionarios** | Header com CPF + cargo no meta; converter divisores em FormSection; footer sticky |
| **FormasPagamento** | Header com tipo (chip) no meta; FormSection nos 3 blocos; footer sticky |
| **ContasBancarias** | Adicionar header context (banco + agência); FormSection; footer sticky |
| **GruposEconomicos** | Mover botão "Ver painel" para `headerActions`; FormSection nos blocos atuais; footer sticky |
| **UnidadesMedida** | Pequeno: footer sticky padrão; Switch de status mais discreto |
| **Remessas** | FormSection; footer sticky |
| **CotacoesCompra (modal)** | FormSection; footer sticky |
| **Fiscal/NotaFiscal create** | Footer sticky (modal já usa estrutura própria — só mexer no shell) |

### Fase 3 — Tokens e consistência fina
- Substituir `text-amber-600`/`text-emerald-600` hardcoded por tokens semânticos do design system
- Padronizar texto: "Salvar" (create) vs "Salvar Alterações" (edit) auto via prop `mode`
- Padronizar `disabled` + `Loader2` no botão primário
- `confirmDiscard` automático quando `isDirty=true` no `onClose` do modal

### Fora do escopo
- Não vou tocar lógica de validação, regra de negócio, hooks de submit
- Não vou redesenhar campos individuais (Inputs, Selects mantêm visual atual)
- Não vou mexer em `OrcamentoForm`/`PedidoCompraForm`/`CotacaoCompraForm`/`RemessaForm` (são páginas dedicadas, não modais — já têm header próprio na rota; ficam para próxima rodada)
- `NotaFiscalEditModal` já é modal próprio gigante — só ganha footer sticky, sem redesenho

## Critério de aceite

- Todos os 12 modais usam `FormModal` com header padronizado (title + identifier + status + meta + actions)
- Todos têm `FormModalFooter` sticky com hierarquia clara
- Section headers unificados via `FormSection`
- Indicador "alterações não salvas" consistente em todas as telas com `isDirty`
- Cores semânticas (sem amber/emerald hardcoded para status)
- Sem regressão funcional (campos, validações, fluxos intactos)
- Build OK (`tsc --noEmit`)

## Entregáveis
Tabela final por tela: `problema visual → ajuste aplicado`.

