# Plano de correção da pré-visualização do orçamento

## O que será corrigido

1. Fazer o botão de expandir funcionar de verdade na pré-visualização.
2. Melhorar a área de preview para mostrar a página inteira com melhor uso do espaço.
3. Corrigir o layout mobile para que os botões não fiquem cobertos pelo resumo nem pela navegação inferior.

## Diagnóstico confirmado

- O `OrcamentoForm` tem hoje três barras fixas diferentes em mobile, todas no rodapé. Isso causa a sobreposição vista no print.
- O modal de preview usa um `DialogContent` customizado para fullscreen, mas ele ainda herda comportamentos do dialog base e não redefine completamente o layout para mobile/desktop.
- Há um warning de React no preview: `Function components cannot be given refs`. Isso indica que o `ref={pdfRef}` está sendo passado para um componente que nem sempre está preparado corretamente no fluxo real do preview/PDF, e isso pode comprometer a captura/exportação.
- O preview atual usa um stage com `overflow-auto`, porém a toolbar e o container não estão otimizados para aproveitar a altura disponível nem para separar bem zoom, auto-fit e fullscreen.

## Implementação proposta

### 1) Reestruturar o modal de preview em `src/pages/OrcamentoForm.tsx`

- Ajustar o `DialogContent` para ter dois modos bem definidos:
  - modo janela
  - modo tela cheia real
- No modo tela cheia:
  - ocupar toda a viewport com classes consistentes para desktop e mobile
  - remover offsets herdados do dialog padrão
  - usar container interno com `min-h-0` para o stage realmente expandir
- Ao abrir o preview e ao alternar fullscreen:
  - recalcular auto-fit
  - resetar para `previewZoom = 0` quando necessário para encaixar a página inteira

### 2) Melhorar a experiência da pré-visualização

- Separar toolbar e stage de forma mais robusta:
  - toolbar fixa no topo do dialog
  - stage usando toda a altura restante
- Refinar o auto-fit para trabalhar com a área útil real do stage, descontando toolbar e paddings.
- Ajustar o wrapper da folha A4 para centralização estável, inclusive em fullscreen.
- Melhorar responsividade da toolbar do preview:
  - no desktop, manter controles completos
  - no mobile, evitar compressão dos botões em uma única linha; quebrar em 2 linhas ou reorganizar controles
- Garantir que o preview clássico continue mostrando o documento inteiro sem corte horizontal desnecessário.

### 3) Corrigir a causa do warning de `ref`

- Revisar o fluxo de `pdfRef` no `OrcamentoForm` e nos templates:
  - `OrcamentoPdfTemplate.tsx`
  - `OrcamentoPdfTemplateBrand.tsx`
- Garantir que o `ref` chegue sempre em um elemento DOM válido usado pela geração do PDF.
- Se necessário, mover o `ref` para um wrapper HTML no próprio `OrcamentoForm` em vez de depender do componente de template.

### 4) Corrigir o mobile do formulário de orçamento

- Consolidar os rodapés fixos mobile em uma única barra sticky, seguindo o padrão já documentado do módulo Comercial.
- Remover os footers duplicados hoje existentes no final do `OrcamentoForm`.
- Reposicionar essa barra para respeitar:
  - `env(safe-area-inset-bottom)`
  - altura da navegação inferior global (`MobileBottomNav`)
- Ajustar o spacer final da página para refletir a altura real do footer + bottom nav.
- Garantir que os botões de ação permaneçam tocáveis e nunca fiquem atrás do resumo ou da navegação.

## Arquivos previstos

- `src/pages/OrcamentoForm.tsx`
- `src/components/Orcamento/OrcamentoPdfTemplate.tsx`
- `src/components/Orcamento/OrcamentoPdfTemplateBrand.tsx`

## Detalhes técnicos

- O dialog base usa comportamento de bottom-sheet em mobile; por isso o fullscreen do preview precisa sobrescrever esse layout de forma explícita.
- O ajuste mobile deve convergir para este padrão:

```text
[conteúdo rolável]
[spacer calculado]
[footer fixo do orçamento]
[bottom nav global do app]
```

- O footer fixo do orçamento deve existir uma única vez.
- O `pdfRef` deve apontar para um `div` real que encapsula o conteúdo A4 renderizado.

## Resultado esperado

- O botão de expandir passa a alternar corretamente entre janela e tela cheia.
- A pré-visualização mostra a folha inteira com melhor encaixe.
- No mobile, os botões não ficam mais escondidos nem sobrepostos pela barra inferior/resumo.
- A geração de PDF fica mais estável, sem warning de ref no console.